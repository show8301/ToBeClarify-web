param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactPath,

    [Parameter(Mandatory = $true)]
    [string]$DeployPath,

    [Parameter(Mandatory = $true)]
    [string]$HealthCheckUrl,

    [Parameter(Mandatory = $true)]
    [ValidateSet('ToBeClarify_web_dev')]
    [string]$ExpectedDeployLeaf,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1024, 65535)]
    [int]$NodePort,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$TaskName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9A-Fa-f]{7,64}$')]
    [string]$DeploymentSha,

    [string]$AdminApiBaseUrl,

    [string]$PublicMediaBaseUrl
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

function Stop-VinextTask {
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
        throw "Node port $Port is still in use after stopping the scheduled task (PID $listenerPid), but the listener process could not be inspected."
    }

    $normalizedAppPath = Get-NormalizedPath -Path $AppPath
    $commandLine = [string]$listenerProcess.CommandLine
    $isNode = $listenerProcess.Name -ieq 'node.exe'
    $isVinext = $commandLine.IndexOf('vinext', [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    $isExpectedApp = $commandLine.IndexOf($normalizedAppPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    $portPattern = "(?i)(?:^|\s)--port(?:\s+|=)[`\"']?$Port(?:[`\"']?(?:\s|$))"
    $isExpectedPort = $commandLine -match $portPattern

    if (-not ($isNode -and $isVinext -and $isExpectedApp -and $isExpectedPort)) {
        throw "Port $Port is occupied by an unexpected process and will not be terminated (PID $listenerPid, name $($listenerProcess.Name))."
    }

    Write-Warning "Scheduled Task stopped but its Vinext Node child process is still listening on port $Port (PID $listenerPid). Stopping the verified stale listener."
    Stop-Process -Id $listenerPid -Force -ErrorAction Stop

    if (-not (Wait-PortAvailable -Port $Port -Attempts 20 -DelayMilliseconds 250)) {
        $remainingPid = Get-PortListenerProcessId -Port $Port
        throw "Node port $Port was not released after stopping the verified stale Vinext process (PID $remainingPid)."
    }
}

function Register-VinextTask {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$AppPath,
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][int]$Port
    )

    $launcherPath = Join-Path $AppPath 'scripts\start-vinext.ps1'
    if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
        throw "Vinext launcher was not found: $launcherPath"
    }

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
        "`"$launcherPath`"",
        '-AppPath',
        "`"$AppPath`"",
        '-NodePath',
        "`"$NodePath`"",
        '-Port',
        [string]$Port
    ) -join ' '

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $serviceAccounts = @(
        'NT AUTHORITY\SYSTEM',
        'NT AUTHORITY\LOCAL SERVICE',
        'NT AUTHORITY\NETWORK SERVICE'
    )
    $logonType = if ($serviceAccounts -contains $identity.ToUpperInvariant()) { 'ServiceAccount' } else { 'S4U' }

    $action = New-ScheduledTaskAction -Execute $powershellPath -Argument $arguments -WorkingDirectory $AppPath
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType $logonType -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -RestartCount 5 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
        -MultipleInstances IgnoreNew

    Register-ScheduledTask `
        -TaskName $Name `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description 'Runs the ToBeClarify Vinext DEV server behind IIS.' `
        -Force | Out-Null

    Start-ScheduledTask -TaskName $Name
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

$artifactRoot = Get-NormalizedPath -Path (Resolve-Path -LiteralPath $ArtifactPath).Path
$deployRoot = Get-NormalizedPath -Path $DeployPath
$deployParent = Get-NormalizedPath -Path (Split-Path -Parent $deployRoot)
$deployLeaf = Split-Path -Leaf $deployRoot

if ($deployLeaf -ine $ExpectedDeployLeaf) {
    throw "Refusing to deploy to unexpected directory: $deployRoot"
}

if ([string]::IsNullOrWhiteSpace($HealthCheckUrl)) {
    throw 'DEV_WEB_HEALTHCHECK_URL is not configured.'
}

if (-not (Test-Path -LiteralPath $deployParent -PathType Container)) {
    throw "The deployment parent directory does not exist: $deployParent"
}

$publicHealthCheckUrl = Get-HealthCheckUrl -BaseUrl $HealthCheckUrl

$requiredFiles = @(
    'dist\server\index.js',
    'package.json',
    'package-lock.json',
    'deploy\web.config.template',
    'scripts\start-vinext.ps1'
)
foreach ($relativePath in $requiredFiles) {
    $requiredPath = Join-Path $artifactRoot $relativePath
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "The Vinext artifact is incomplete; missing $relativePath"
    }
}

$nodeCommand = Get-Command node.exe -ErrorAction Stop
$npmCommand = Get-Command npm.cmd -ErrorAction Stop
$nodeVersionText = (& $nodeCommand.Source --version).TrimStart('v')
$nodeVersion = [version]$nodeVersionText
if ($nodeVersion -lt [version]'22.13.0') {
    throw "Node.js 22.13.0 or newer is required; found $nodeVersionText"
}

$appcmdPath = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'
if (-not (Test-Path -LiteralPath $appcmdPath -PathType Leaf)) {
    throw "IIS appcmd.exe was not found: $appcmdPath"
}

$prerequisiteScript = Join-Path $PSScriptRoot 'test-iis-reverse-proxy-prerequisites.ps1'
& $prerequisiteScript `
    -AppCmdPath $appcmdPath `
    -DeployPath $deployRoot `
    -MinimumNodeVersion '22.13.0'

if ($null -eq (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)) {
    throw 'The Windows ScheduledTasks module is not available on the DEV runner.'
}

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
$runtimeConfig | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stagingRoot 'runtime-config.json') -Encoding UTF8

$hadExistingTask = Stop-VinextTask -Name $TaskName
Stop-StaleVinextListener -Port $NodePort -AppPath $deployRoot

$hadExistingDeployment = Test-Path -LiteralPath $deployRoot -PathType Container
$swapped = $false
try {
    if ($hadExistingDeployment) {
        Rename-Item -LiteralPath $deployRoot -NewName (Split-Path -Leaf $rollbackRoot)
    }
    Rename-Item -LiteralPath $stagingRoot -NewName $ExpectedDeployLeaf
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

    Register-VinextTask -Name $TaskName -AppPath $deployRoot -NodePath $nodeCommand.Source -Port $NodePort

    Wait-VinextHealth `
        -Url "http://127.0.0.1:$NodePort/api/health" `
        -Attempts 30 `
        -ExpectedDeploymentSha $DeploymentSha | Out-Null
    Wait-VinextHealth `
        -Url $publicHealthCheckUrl `
        -Attempts 15 `
        -ExpectedDeploymentSha $DeploymentSha | Out-Null

    Write-Host "Vinext DEV deployment completed: $deployRoot"
    Write-Host "Verified deployment SHA through IIS: $DeploymentSha"
    if ($hadExistingDeployment) {
        Write-Host "Rollback copy retained at: $rollbackRoot"
    }
}
catch {
    $deploymentError = $_
    Write-Warning 'Vinext deployment failed. Restoring the previous DEV site.'

    Stop-VinextTask -Name $TaskName | Out-Null

    if ($swapped) {
        if (Test-Path -LiteralPath $deployRoot) {
            Remove-Item -LiteralPath $deployRoot -Recurse -Force
        }
        if ($hadExistingDeployment -and (Test-Path -LiteralPath $rollbackRoot)) {
            Rename-Item -LiteralPath $rollbackRoot -NewName $ExpectedDeployLeaf
        }
    }

    $previousLauncher = Join-Path $deployRoot 'scripts\start-vinext.ps1'
    if ($hadExistingTask -and (Test-Path -LiteralPath $previousLauncher -PathType Leaf)) {
        Register-VinextTask -Name $TaskName -AppPath $deployRoot -NodePath $nodeCommand.Source -Port $NodePort
    }
    elseif (-not $hadExistingTask) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    }

    throw $deploymentError
}
