param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactPath,

    [Parameter(Mandatory = $true)]
    [string]$DeployPath,

    [Parameter(Mandatory = $true)]
    [ValidateSet('production', 'development')]
    [string]$TargetEnvironment,

    [Parameter(Mandatory = $true)]
    [string]$HealthCheckUrl,

    [Parameter(Mandatory = $true)]
    [string]$SiblingHealthCheckUrl,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9A-Fa-f]{7,64}$')]
    [string]$DeploymentSha,

    [string]$AdminApiBaseUrl,

    [string]$PublicMediaBaseUrl,

    [string]$PublicClientApiBaseUrl,

    [string]$OrderingApiBaseUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NormalizedPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return [System.IO.Path]::GetFullPath($Path).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar)
}

function Assert-ChildPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ParentPath
    )

    $normalizedPath = Get-NormalizedPath -Path $Path
    $normalizedParent = Get-NormalizedPath -Path $ParentPath
    $requiredPrefix = $normalizedParent + [System.IO.Path]::DirectorySeparatorChar

    if (-not $normalizedPath.StartsWith($requiredPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to operate outside the deployment parent: $normalizedPath"
    }
}

function Rename-DirectoryWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$NewName,
        [int]$Attempts = 20,
        [int]$DelayMilliseconds = 500
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            Rename-Item -LiteralPath $Path -NewName $NewName -ErrorAction Stop
            return
        }
        catch {
            if ($attempt -eq $Attempts) {
                throw
            }

            Write-Warning "Directory rename is temporarily blocked (attempt $attempt of $Attempts): $Path"
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }
}

function Invoke-Pm2 {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$Quiet
    )

    $output = @(& $script:Pm2Command @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    if (-not $Quiet -and $output.Count -gt 0) {
        $output | ForEach-Object { Write-Host $_ }
    }
    if ($exitCode -ne 0) {
        throw "PM2 command failed with exit code ${exitCode}: pm2 $($Arguments -join ' ')`n$($output -join [Environment]::NewLine)"
    }

    return $output
}

function Get-Pm2App {
    param([Parameter(Mandatory = $true)][string]$Name)

    $output = Invoke-Pm2 -Arguments @('jlist', '--silent') -Quiet
    $text = ($output -join [Environment]::NewLine).Trim()
    if ([string]::IsNullOrWhiteSpace($text)) {
        throw 'PM2 returned an empty process list.'
    }

    $jsonStart = $text.IndexOf('[{', [System.StringComparison]::Ordinal)
    if ($jsonStart -lt 0 -and $text.Contains('[]')) {
        return $null
    }
    $jsonEnd = $text.LastIndexOf(']', [System.StringComparison]::Ordinal)
    if ($jsonStart -lt 0 -or $jsonEnd -lt $jsonStart) {
        throw "PM2 returned an unreadable process list: $text"
    }

    $apps = @($text.Substring($jsonStart, $jsonEnd - $jsonStart + 1) | ConvertFrom-Json)
    $matches = @($apps | Where-Object { $_.name -ceq $Name })
    if ($matches.Count -gt 1) {
        throw "PM2 contains more than one application named $Name."
    }
    if ($matches.Count -eq 0) {
        return $null
    }

    return $matches[0]
}

function Assert-Pm2AppIdentity {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$AppPath,
        [Parameter(Mandatory = $true)][int]$Port,
        [switch]$AllowMissing
    )

    $app = Get-Pm2App -Name $Name
    if ($null -eq $app) {
        if ($AllowMissing) {
            return $false
        }
        throw "The protected PM2 application does not exist: $Name"
    }

    $expectedAppPath = Get-NormalizedPath -Path $AppPath
    $expectedScriptPath = Get-NormalizedPath -Path (Join-Path $expectedAppPath 'node_modules\vinext\dist\cli.js')
    $actualCwd = Get-NormalizedPath -Path ([string]$app.pm2_env.pm_cwd)
    $actualScriptPath = Get-NormalizedPath -Path ([string]$app.pm2_env.pm_exec_path)
    $arguments = @($app.pm2_env.args | ForEach-Object { [string]$_ })
    $joinedArguments = $arguments -join ' '
    $portPattern = '(?i)(?:^|\s)--port(?:\s+|=)"?{0}"?(?:\s|$)' -f $Port
    $hasExpectedPort = $joinedArguments -match $portPattern

    if ($actualCwd -ine $expectedAppPath -or
        $actualScriptPath -ine $expectedScriptPath -or
        -not $hasExpectedPort) {
        throw "PM2 application $Name is not bound to the protected identity (path=$expectedAppPath, port=$Port)."
    }

    return $true
}

function Assert-Pm2AppRunning {
    param([Parameter(Mandatory = $true)][string]$Name)

    $app = Get-Pm2App -Name $Name
    if ($null -eq $app) {
        throw "The protected PM2 application does not exist: $Name"
    }
    if ([string]$app.pm2_env.status -ine 'online') {
        throw "The protected PM2 application is not online: $Name (status=$($app.pm2_env.status))"
    }
}

function Stop-Pm2App {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$AppPath,
        [Parameter(Mandatory = $true)][int]$Port
    )

    if (-not (Assert-Pm2AppIdentity -Name $Name -AppPath $AppPath -Port $Port -AllowMissing)) {
        return $false
    }

    Invoke-Pm2 -Arguments @('stop', $Name, '--silent') | Out-Null
    return $true
}

function Remove-Pm2App {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$AppPath,
        [Parameter(Mandatory = $true)][int]$Port
    )

    if (-not (Assert-Pm2AppIdentity -Name $Name -AppPath $AppPath -Port $Port -AllowMissing)) {
        return
    }
    Invoke-Pm2 -Arguments @('delete', $Name, '--silent') | Out-Null
}

function Start-Pm2App {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$AppPath,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string]$LogRoot
    )

    $ecosystemPath = Join-Path $AppPath 'deploy\pm2\ecosystem.config.cjs'
    if (-not (Test-Path -LiteralPath $ecosystemPath -PathType Leaf)) {
        throw "The PM2 ecosystem file was not found: $ecosystemPath"
    }

    $env:TOBECLARIFY_PM2_APP_NAME = $Name
    $env:TOBECLARIFY_PM2_APP_ROOT = $AppPath
    $env:TOBECLARIFY_PM2_APP_PORT = [string]$Port
    $env:TOBECLARIFY_PM2_NODE_PATH = $NodePath
    $env:TOBECLARIFY_PM2_LOG_ROOT = $LogRoot
    Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue

    Invoke-Pm2 -Arguments @(
        'startOrRestart',
        $ecosystemPath,
        '--only',
        $Name,
        '--update-env',
        '--silent'
    ) | Out-Null

    Assert-Pm2AppIdentity -Name $Name -AppPath $AppPath -Port $Port | Out-Null
    Assert-Pm2AppRunning -Name $Name
}

function Save-Pm2ProcessList {
    Invoke-Pm2 -Arguments @('save', '--force', '--silent') | Out-Null
}

function Stop-LegacyVinextTask {
    param([Parameter(Mandatory = $true)][string]$Name)

    $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($null -eq $task) {
        return $false
    }

    if ($task.State -eq 'Running') {
        Stop-ScheduledTask -TaskName $Name
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            Start-Sleep -Milliseconds 500
            $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
            if ($null -eq $task -or $task.State -ne 'Running') {
                break
            }
        }
    }

    return $true
}

function Get-PortListenerProcessId {
    param([Parameter(Mandatory = $true)][int]$Port)

    $listenerPid = $null
    try {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
            Select-Object -First 1
        if ($null -ne $listener) {
            $listenerPid = $listener.OwningProcess
        }
    }
    catch {
        $netstatPattern = "^\s*TCP\s+(127\.0\.0\.1|0\.0\.0\.0|\[::\]):$Port\s+.*\s+LISTENING\s+(\d+)\s*$"
        $netstatLine = netstat -ano -p TCP | Select-String -Pattern $netstatPattern | Select-Object -First 1
        if ($null -ne $netstatLine) {
            $listenerPid = [int]$netstatLine.Matches[0].Groups[2].Value
        }
    }

    return $listenerPid
}

function Wait-PortAvailable {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$Attempts = 20,
        [int]$DelayMilliseconds = 500
    )

    for ($attempt = 0; $attempt -lt $Attempts; $attempt++) {
        $listenerPid = Get-PortListenerProcessId -Port $Port
        if ($null -eq $listenerPid) {
            return $true
        }

        Start-Sleep -Milliseconds $DelayMilliseconds
    }

    return $false
}

function Stop-StaleVinextListener {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$AppPath
    )

    if (Wait-PortAvailable -Port $Port) {
        return
    }

    $listenerPid = Get-PortListenerProcessId -Port $Port
    if ($null -eq $listenerPid) {
        return
    }

    $listenerProcess = Get-CimInstance `
        -ClassName Win32_Process `
        -Filter "ProcessId = $listenerPid" `
        -ErrorAction SilentlyContinue
    if ($null -eq $listenerProcess) {
        throw "Node port $Port is still in use after stopping its process manager (PID $listenerPid), but the listener process could not be inspected."
    }

    $normalizedAppPath = Get-NormalizedPath -Path $AppPath
    $commandLine = [string]$listenerProcess.CommandLine
    $isNode = $listenerProcess.Name -ieq 'node.exe'
    $isVinext = $commandLine.IndexOf('vinext', [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    $isExpectedApp = $commandLine.IndexOf($normalizedAppPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    $portPattern = '(?i)(?:^|\s)--port(?:\s+|=)"?{0}"?(?:\s|$)' -f $Port
    $isExpectedPort = $commandLine -match $portPattern

    if (-not ($isNode -and $isVinext -and $isExpectedApp -and $isExpectedPort)) {
        throw "Port $Port is occupied by an unexpected process and will not be terminated (PID $listenerPid, name $($listenerProcess.Name))."
    }

    Write-Warning "The process manager stopped but its Vinext Node child is still listening on port $Port (PID $listenerPid). Stopping the verified stale listener."
    Stop-Process -Id $listenerPid -Force -ErrorAction Stop

    if (-not (Wait-PortAvailable -Port $Port -Attempts 20 -DelayMilliseconds 250)) {
        $remainingPid = Get-PortListenerProcessId -Port $Port
        throw "Node port $Port was not released after stopping the verified stale Vinext process (PID $remainingPid)."
    }
}

function Disable-LegacyVinextTask {
    param([Parameter(Mandatory = $true)][string]$Name)

    $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($null -ne $task -and $task.State -ne 'Disabled') {
        Disable-ScheduledTask -TaskName $Name | Out-Null
    }
}

function Enable-LegacyVinextTask {
    param([Parameter(Mandatory = $true)][string]$Name)

    $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($null -ne $task -and $task.State -eq 'Disabled') {
        Enable-ScheduledTask -TaskName $Name | Out-Null
    }
}

function Register-Pm2StartupTask {
    param(
        [Parameter(Mandatory = $true)][string]$Pm2Home,
        [Parameter(Mandatory = $true)][string]$Pm2Command,
        [Parameter(Mandatory = $true)][string]$SourceScript
    )

    $startupRoot = Join-Path $Pm2Home 'startup'
    New-Item -Path $startupRoot -ItemType Directory -Force | Out-Null
    $startupScript = Join-Path $startupRoot 'resurrect-vinext-pm2.ps1'
    Copy-Item -LiteralPath $SourceScript -Destination $startupScript -Force

    $powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
    $arguments = @(
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-File',
        "`"$startupScript`"",
        '-Pm2Home',
        "`"$Pm2Home`"",
        '-Pm2Command',
        "`"$Pm2Command`""
    ) -join ' '

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute $powershellPath -Argument $arguments -WorkingDirectory $startupRoot
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType S4U -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -RestartCount 5 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
        -MultipleInstances IgnoreNew

    Register-ScheduledTask `
        -TaskName 'ToBeClarify PM2 Web Resurrect' `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description 'Restores the isolated ToBeClarify Web PM2 process list after Windows starts.' `
        -Force | Out-Null
}

function Get-HealthCheckUrl {
    param([Parameter(Mandatory = $true)][string]$BaseUrl)

    $trimmedUrl = $BaseUrl.Trim().TrimEnd('/')
    [System.Uri]$parsedUrl = $null
    if (-not [System.Uri]::TryCreate($trimmedUrl, [System.UriKind]::Absolute, [ref]$parsedUrl)) {
        throw "Health check URL is not an absolute URL: $BaseUrl"
    }

    if ($parsedUrl.Scheme -ne 'http' -and $parsedUrl.Scheme -ne 'https') {
        throw "Health check URL must use HTTP or HTTPS: $BaseUrl"
    }

    if (-not [string]::IsNullOrWhiteSpace($parsedUrl.Query) -or
        -not [string]::IsNullOrWhiteSpace($parsedUrl.Fragment)) {
        throw "Health check URL must not include a query string or fragment: $BaseUrl"
    }

    if ($parsedUrl.AbsolutePath.TrimEnd('/') -ieq '/api/health') {
        return "$($parsedUrl.Scheme)://$($parsedUrl.Authority)/api/health"
    }

    if (-not [string]::IsNullOrWhiteSpace($parsedUrl.AbsolutePath.Trim('/'))) {
        throw "Health check URL must be the site origin or /api/health: $BaseUrl"
    }

    return "$($parsedUrl.Scheme)://$($parsedUrl.Authority)/api/health"
}

function Wait-VinextHealth {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][int]$Attempts,
        [Parameter(Mandatory = $true)][string]$ExpectedDeploymentSha
    )

    $lastError = $null
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $separator = if ($Url.Contains('?')) { '&' } else { '?' }
            $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $response = Invoke-WebRequest -Uri "$Url${separator}deploymentCheck=$cacheBuster" -UseBasicParsing -TimeoutSec 15
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                $payload = $response.Content | ConvertFrom-Json
                if ($payload.status -eq 'ok' -and $payload.deploymentSha -eq $ExpectedDeploymentSha) {
                    return $response
                }
                $lastError = "Unexpected health payload (status=$($payload.status), deploymentSha=$($payload.deploymentSha))"
            }
            else {
                $lastError = "HTTP $($response.StatusCode)"
            }
        }
        catch {
            $lastError = $_.Exception.Message
        }

        Start-Sleep -Seconds 2
    }

    throw "Health check did not succeed for $Url. Last error: $lastError"
}

function Wait-VinextAlive {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][int]$Attempts
    )

    $lastError = $null
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $separator = if ($Url.Contains('?')) { '&' } else { '?' }
            $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $response = Invoke-WebRequest -Uri "$Url${separator}deploymentCheck=$cacheBuster" -UseBasicParsing -TimeoutSec 15
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                $payload = $response.Content | ConvertFrom-Json
                $deploymentSha = [string]$payload.deploymentSha
                if ($payload.status -eq 'ok' -and $deploymentSha -match '^[0-9A-Fa-f]{7,64}$') {
                    return $deploymentSha
                }
                $lastError = "Unexpected health payload (status=$($payload.status), deploymentSha=$deploymentSha)"
            }
            else {
                $lastError = "HTTP $($response.StatusCode)"
            }
        }
        catch {
            $lastError = $_.Exception.Message
        }

        Start-Sleep -Seconds 2
    }

    throw "Health check did not report a live Vinext deployment for $Url. Last error: $lastError"
}

function Assert-LegacyVinextTaskRunning {
    param([Parameter(Mandatory = $true)][string]$Name)

    $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($null -eq $task) {
        throw "The protected sibling Scheduled Task does not exist: $Name"
    }
    if ($task.State -ne 'Running') {
        throw "The protected sibling Scheduled Task is not running: $Name (state=$($task.State))"
    }
}

function Assert-LegacyVinextTaskIdentity {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$AppPath,
        [Parameter(Mandatory = $true)][int]$Port,
        [switch]$AllowMissing
    )

    $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($null -eq $task) {
        if ($AllowMissing) {
            return $false
        }
        throw "The protected Scheduled Task does not exist: $Name"
    }

    $actions = @($task.Actions)
    if ($actions.Count -ne 1) {
        throw "Scheduled Task $Name has an unexpected number of actions: $($actions.Count)"
    }

    $expectedAppPath = Get-NormalizedPath -Path $AppPath
    $workingDirectory = Get-NormalizedPath -Path ([string]$actions[0].WorkingDirectory)
    $arguments = [string]$actions[0].Arguments
    $hasExpectedAppPath = $arguments.IndexOf($expectedAppPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    $portPattern = '(?i)(?:^|\s)-Port(?:\s+|=)"?{0}"?(?:\s|$)' -f $Port
    $hasExpectedPort = $arguments -match $portPattern

    if ($workingDirectory -ine $expectedAppPath -or -not $hasExpectedAppPath -or -not $hasExpectedPort) {
        throw "Scheduled Task $Name is not bound to the protected identity (path=$expectedAppPath, port=$Port)."
    }

    return $true
}

$environmentConfig = if ($TargetEnvironment -eq 'production') {
    [pscustomobject]@{
        DeployLeaf = 'ToBeClarify_web'
        NodePort = 4300
        Pm2AppName = 'tobeclarify-web-prod'
        LegacyTaskName = 'ToBeClarify Vinext PROD'
        SiblingDeployLeaf = 'ToBeClarify_web_dev'
        SiblingNodePort = 4310
        SiblingPm2AppName = 'tobeclarify-web-dev'
        SiblingLegacyTaskName = 'ToBeClarify Vinext DEV'
    }
}
else {
    [pscustomobject]@{
        DeployLeaf = 'ToBeClarify_web_dev'
        NodePort = 4310
        Pm2AppName = 'tobeclarify-web-dev'
        LegacyTaskName = 'ToBeClarify Vinext DEV'
        SiblingDeployLeaf = 'ToBeClarify_web'
        SiblingNodePort = 4300
        SiblingPm2AppName = 'tobeclarify-web-prod'
        SiblingLegacyTaskName = 'ToBeClarify Vinext PROD'
    }
}

$ExpectedDeployLeaf = $environmentConfig.DeployLeaf
$NodePort = [int]$environmentConfig.NodePort
$Pm2AppName = [string]$environmentConfig.Pm2AppName
$LegacyTaskName = [string]$environmentConfig.LegacyTaskName
$SiblingDeployLeaf = [string]$environmentConfig.SiblingDeployLeaf
$SiblingNodePort = [int]$environmentConfig.SiblingNodePort
$SiblingPm2AppName = [string]$environmentConfig.SiblingPm2AppName
$SiblingLegacyTaskName = [string]$environmentConfig.SiblingLegacyTaskName
$Pm2Home = 'D:\pm2\ToBeClarify-web'
$Pm2LogRoot = Join-Path $Pm2Home 'logs'
$Pm2CommandPath = Join-Path $Pm2Home 'cli\node_modules\.bin\pm2.cmd'

$artifactRoot = Get-NormalizedPath -Path (Resolve-Path -LiteralPath $ArtifactPath).Path
$deployRoot = Get-NormalizedPath -Path $DeployPath
$deployParent = Get-NormalizedPath -Path (Split-Path -Parent $deployRoot)
$deployLeaf = Split-Path -Leaf $deployRoot

if ($deployLeaf -ine $ExpectedDeployLeaf) {
    throw "Refusing to deploy to unexpected directory: $deployRoot"
}

if ([string]::IsNullOrWhiteSpace($HealthCheckUrl)) {
    throw 'The deployment health check URL is not configured.'
}
if ([string]::IsNullOrWhiteSpace($SiblingHealthCheckUrl)) {
    throw 'The sibling deployment health check URL is not configured.'
}

if (-not (Test-Path -LiteralPath $deployParent -PathType Container)) {
    throw "The deployment parent directory does not exist: $deployParent"
}

$publicHealthCheckUrl = Get-HealthCheckUrl -BaseUrl $HealthCheckUrl
$siblingPublicHealthCheckUrl = Get-HealthCheckUrl -BaseUrl $SiblingHealthCheckUrl
if ($publicHealthCheckUrl -ieq $siblingPublicHealthCheckUrl) {
    throw 'The target and sibling health check URLs must be different.'
}

$siblingDeployRoot = Get-NormalizedPath -Path (Join-Path $deployParent $SiblingDeployLeaf)
if ($deployRoot -ieq $siblingDeployRoot) {
    throw 'The target and sibling deployment directories must be different.'
}

$requiredFiles = @(
    'dist\server\index.js',
    'package.json',
    'package-lock.json',
    'deploy\web.config.template',
    'deploy\pm2\ecosystem.config.cjs',
    'scripts\start-vinext.ps1',
    'scripts\resurrect-vinext-pm2.ps1'
)
foreach ($relativePath in $requiredFiles) {
    $requiredPath = Join-Path $artifactRoot $relativePath
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "The Vinext artifact is incomplete; missing $relativePath"
    }
}

$nodeCommand = Get-Command node.exe -ErrorAction Stop
$npmCommand = Get-Command npm.cmd -ErrorAction Stop
$pm2Command = Get-Item -LiteralPath $Pm2CommandPath -ErrorAction Stop
$systemNodePath = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path -LiteralPath $systemNodePath -PathType Leaf)) {
    $systemNodePath = $nodeCommand.Source
}
$script:Pm2Command = $pm2Command.FullName
$env:PM2_HOME = $Pm2Home
$env:NO_COLOR = '1'
Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue
$nodeVersionText = (& $nodeCommand.Source --version).TrimStart('v')
$nodeVersion = [version]$nodeVersionText
if ($nodeVersion -lt [version]'22.13.0') {
    throw "Node.js 22.13.0 or newer is required; found $nodeVersionText"
}
$systemNodeVersionText = (& $systemNodePath --version).TrimStart('v')
if ([version]$systemNodeVersionText -lt [version]'22.13.0') {
    throw "The persistent PM2 interpreter requires Node.js 22.13.0 or newer; found $systemNodeVersionText at $systemNodePath"
}

$appcmdPath = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'
if (-not (Test-Path -LiteralPath $appcmdPath -PathType Leaf)) {
    throw "IIS appcmd.exe was not found: $appcmdPath"
}

$prerequisiteScript = Join-Path $PSScriptRoot 'test-iis-reverse-proxy-prerequisites.ps1'
& $prerequisiteScript `
    -AppCmdPath $appcmdPath `
    -DeployPath $deployRoot `
    -Pm2Home $Pm2Home `
    -Pm2CommandPath $Pm2CommandPath `
    -MinimumNodeVersion '22.13.0'

if ($null -eq (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)) {
    throw 'The Windows ScheduledTasks module is not available on the deployment runner.'
}

New-Item -Path $Pm2Home -ItemType Directory -Force | Out-Null
New-Item -Path $Pm2LogRoot -ItemType Directory -Force | Out-Null

# Refuse to touch the target when the other site is already unhealthy. This
# distinguishes a pre-existing outage from any effect of the current deploy.
$siblingUsesPm2 = Assert-Pm2AppIdentity `
    -Name $SiblingPm2AppName `
    -AppPath $siblingDeployRoot `
    -Port $SiblingNodePort `
    -AllowMissing
if ($siblingUsesPm2) {
    Assert-Pm2AppRunning -Name $SiblingPm2AppName
    $siblingManagerLabel = "PM2 application $SiblingPm2AppName"
}
else {
    Assert-LegacyVinextTaskIdentity `
        -Name $SiblingLegacyTaskName `
        -AppPath $siblingDeployRoot `
        -Port $SiblingNodePort | Out-Null
    Assert-LegacyVinextTaskRunning -Name $SiblingLegacyTaskName
    $siblingManagerLabel = "legacy Scheduled Task $SiblingLegacyTaskName"
}
$siblingLocalHealthCheckUrl = "http://127.0.0.1:$SiblingNodePort/api/health"
$siblingLocalSha = Wait-VinextAlive -Url $siblingLocalHealthCheckUrl -Attempts 3
$siblingPublicSha = Wait-VinextAlive -Url $siblingPublicHealthCheckUrl -Attempts 3
if ($siblingLocalSha -ne $siblingPublicSha) {
    throw "The protected sibling reports different deployments locally and through IIS (local=$siblingLocalSha, public=$siblingPublicSha)."
}
$siblingDeploymentSha = $siblingLocalSha
Write-Host "Protected sibling verified before deployment: $siblingManagerLabel ($siblingDeploymentSha)"

$stagingRoot = Join-Path $deployParent "$ExpectedDeployLeaf.staging"
$rollbackRoot = Join-Path $deployParent "$ExpectedDeployLeaf.rollback"
Assert-ChildPath -Path $stagingRoot -ParentPath $deployParent
Assert-ChildPath -Path $rollbackRoot -ParentPath $deployParent

if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
if (Test-Path -LiteralPath $rollbackRoot) {
    Remove-Item -LiteralPath $rollbackRoot -Recurse -Force
}

New-Item -Path $stagingRoot -ItemType Directory | Out-Null
foreach ($item in (Get-ChildItem -LiteralPath $artifactRoot -Force)) {
    Copy-Item -LiteralPath $item.FullName -Destination $stagingRoot -Recurse -Force
}

Push-Location $stagingRoot
try {
    & $npmCommand.Source ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

$webConfigTemplate = Get-Content -LiteralPath (Join-Path $stagingRoot 'deploy\web.config.template') -Raw
$webConfig = $webConfigTemplate.Replace('__NODE_PORT__', [string]$NodePort)
Set-Content -LiteralPath (Join-Path $stagingRoot 'web.config') -Value $webConfig -Encoding UTF8

$runtimeConfig = [ordered]@{}
$runtimeConfig.DEPLOYMENT_SHA = $DeploymentSha
if (-not [string]::IsNullOrWhiteSpace($AdminApiBaseUrl)) {
    $runtimeConfig.ADMIN_API_BASE_URL = $AdminApiBaseUrl.TrimEnd('/')
}
if (-not [string]::IsNullOrWhiteSpace($PublicMediaBaseUrl)) {
    $runtimeConfig.PUBLIC_MEDIA_BASE_URL = $PublicMediaBaseUrl.TrimEnd('/')
}
if (-not [string]::IsNullOrWhiteSpace($PublicClientApiBaseUrl)) {
    $runtimeConfig.PUBLIC_CLIENT_API_BASE_URL = $PublicClientApiBaseUrl.TrimEnd('/')
}
if (-not [string]::IsNullOrWhiteSpace($OrderingApiBaseUrl)) {
    $runtimeConfig.ORDERING_API_BASE_URL = $OrderingApiBaseUrl.TrimEnd('/')
}
$runtimeConfig | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stagingRoot 'runtime-config.json') -Encoding UTF8

# Never stop a pre-existing manager unless its identity is bound to this
# environment's exact app name, directory, and port. Legacy Scheduled Tasks
# are retained only for reversible migration to PM2.
$hadExistingPm2App = Assert-Pm2AppIdentity `
    -Name $Pm2AppName `
    -AppPath $deployRoot `
    -Port $NodePort `
    -AllowMissing
$hadLegacyTask = Assert-LegacyVinextTaskIdentity `
    -Name $LegacyTaskName `
    -AppPath $deployRoot `
    -Port $NodePort `
    -AllowMissing
$legacyTaskWasEnabled = $false
if ($hadLegacyTask) {
    $legacyTaskWasEnabled = (Get-ScheduledTask -TaskName $LegacyTaskName).State -ne 'Disabled'
}
if ($hadExistingPm2App) {
    Stop-Pm2App -Name $Pm2AppName -AppPath $deployRoot -Port $NodePort | Out-Null
}
if ($hadLegacyTask) {
    Stop-LegacyVinextTask -Name $LegacyTaskName | Out-Null
}
Stop-StaleVinextListener -Port $NodePort -AppPath $deployRoot

$hadExistingDeployment = Test-Path -LiteralPath $deployRoot -PathType Container
$swapped = $false
try {
    if ($hadExistingDeployment) {
        Rename-DirectoryWithRetry `
            -Path $deployRoot `
            -NewName (Split-Path -Leaf $rollbackRoot)
    }
    Rename-DirectoryWithRetry `
        -Path $stagingRoot `
        -NewName $ExpectedDeployLeaf
    $swapped = $true

    $proxyArguments = @(
        'set',
        'config',
        '/section:system.webServer/proxy',
        '/enabled:true',
        '/preserveHostHeader:true',
        '/reverseRewriteHostInResponseHeaders:false',
        '/commit:apphost'
    )
    $proxyConfigurationOutput = & $appcmdPath $proxyArguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to enable IIS ARR proxy support: $proxyConfigurationOutput"
    }

    Start-Pm2App `
        -Name $Pm2AppName `
        -AppPath $deployRoot `
        -Port $NodePort `
        -NodePath $systemNodePath `
        -LogRoot $Pm2LogRoot

    Wait-VinextHealth `
        -Url "http://127.0.0.1:$NodePort/api/health" `
        -Attempts 30 `
        -ExpectedDeploymentSha $DeploymentSha | Out-Null
    Wait-VinextHealth `
        -Url $publicHealthCheckUrl `
        -Attempts 15 `
        -ExpectedDeploymentSha $DeploymentSha | Out-Null

    # The deploy may only restart its own environment. Verify the sibling
    # manager, localhost listener, IIS route, and deployment SHA are unchanged.
    if ($siblingUsesPm2) {
        Assert-Pm2AppIdentity `
            -Name $SiblingPm2AppName `
            -AppPath $siblingDeployRoot `
            -Port $SiblingNodePort | Out-Null
        Assert-Pm2AppRunning -Name $SiblingPm2AppName
    }
    else {
        Assert-LegacyVinextTaskIdentity `
            -Name $SiblingLegacyTaskName `
            -AppPath $siblingDeployRoot `
            -Port $SiblingNodePort | Out-Null
        Assert-LegacyVinextTaskRunning -Name $SiblingLegacyTaskName
    }
    Wait-VinextHealth `
        -Url $siblingLocalHealthCheckUrl `
        -Attempts 3 `
        -ExpectedDeploymentSha $siblingDeploymentSha | Out-Null
    Wait-VinextHealth `
        -Url $siblingPublicHealthCheckUrl `
        -Attempts 3 `
        -ExpectedDeploymentSha $siblingDeploymentSha | Out-Null

    if ($hadLegacyTask) {
        Disable-LegacyVinextTask -Name $LegacyTaskName
    }
    Save-Pm2ProcessList
    Register-Pm2StartupTask `
        -Pm2Home $Pm2Home `
        -Pm2Command $script:Pm2Command `
        -SourceScript (Join-Path $deployRoot 'scripts\resurrect-vinext-pm2.ps1')

    Write-Host "Vinext deployment completed: $deployRoot"
    Write-Host "Verified deployment SHA through IIS: $DeploymentSha"
    Write-Host "Protected sibling remained healthy: $siblingManagerLabel ($siblingDeploymentSha)"
    if ($hadExistingDeployment) {
        Write-Host "Rollback copy retained at: $rollbackRoot"
    }
}
catch {
    $deploymentError = $_
    Write-Warning 'Vinext deployment failed. Restoring the previous site.'

    Stop-Pm2App -Name $Pm2AppName -AppPath $deployRoot -Port $NodePort | Out-Null

    if ($swapped) {
        if (Test-Path -LiteralPath $deployRoot) {
            Remove-Item -LiteralPath $deployRoot -Recurse -Force
        }
        if ($hadExistingDeployment -and (Test-Path -LiteralPath $rollbackRoot)) {
            Rename-DirectoryWithRetry `
                -Path $rollbackRoot `
                -NewName $ExpectedDeployLeaf
        }
    }

    if ($hadExistingPm2App -and (Test-Path -LiteralPath $deployRoot -PathType Container)) {
        Start-Pm2App `
            -Name $Pm2AppName `
            -AppPath $deployRoot `
            -Port $NodePort `
            -NodePath $systemNodePath `
            -LogRoot $Pm2LogRoot
    }
    else {
        Remove-Pm2App -Name $Pm2AppName -AppPath $deployRoot -Port $NodePort
    }

    if ($hadLegacyTask -and $legacyTaskWasEnabled) {
        Enable-LegacyVinextTask -Name $LegacyTaskName
        Start-ScheduledTask -TaskName $LegacyTaskName
    }
    elseif ($hadLegacyTask) {
        Disable-LegacyVinextTask -Name $LegacyTaskName
    }

    Save-Pm2ProcessList

    throw $deploymentError
}
