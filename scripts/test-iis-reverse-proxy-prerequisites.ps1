param(
    [string]$AppCmdPath = (Join-Path $env:windir 'System32\inetsrv\appcmd.exe'),

    [string]$DeployPath,

    [string]$Pm2Home = 'D:\pm2\ToBeClarify-web',

    [string]$Pm2CommandPath = 'D:\pm2\ToBeClarify-web\cli\node_modules\.bin\pm2.cmd',

    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$MinimumNodeVersion = '22.13.0'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'native-command.ps1')

$missing = New-Object System.Collections.Generic.List[string]
$details = New-Object System.Collections.Generic.List[string]

if (-not (Test-Path -LiteralPath $AppCmdPath -PathType Leaf)) {
    $missing.Add('IIS Web Server management tools (appcmd.exe)')
}
else {
    $rewriteResult = Invoke-NativeCommand -FilePath $AppCmdPath -ArgumentList @('list', 'module', 'RewriteModule')
    if ($rewriteResult.ExitCode -ne 0 -or -not ($rewriteResult.Output -match 'RewriteModule')) {
        $missing.Add('Microsoft IIS URL Rewrite 2.1 (x64)')
    }
    else {
        $details.Add('Microsoft IIS URL Rewrite is available.')
    }

    $proxyResult = Invoke-NativeCommand -FilePath $AppCmdPath -ArgumentList @('list', 'config', '/section:system.webServer/proxy')
    if ($proxyResult.ExitCode -ne 0) {
        $missing.Add('Microsoft Application Request Routing (ARR) 3.0')
    }
    else {
        $details.Add('Microsoft ARR proxy configuration is available.')
    }
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
    $missing.Add("Node.js $MinimumNodeVersion or newer on the runner PATH")
}
else {
    try {
        $nodeVersionResult = Invoke-NativeCommand -FilePath $nodeCommand.Source -ArgumentList @('--version')
        if ($nodeVersionResult.ExitCode -ne 0) {
            throw "node --version failed with exit code $($nodeVersionResult.ExitCode)"
        }
        $nodeVersionText = ($nodeVersionResult.Output | Select-Object -Last 1).Trim().TrimStart('v')
        $nodeVersion = [version]$nodeVersionText
        if ($nodeVersion -lt [version]$MinimumNodeVersion) {
            $missing.Add("Node.js $MinimumNodeVersion or newer (found $nodeVersionText)")
        }
        else {
            $details.Add("Node.js $nodeVersionText is available at $($nodeCommand.Source).")
        }
    }
    catch {
        $missing.Add("A working Node.js $MinimumNodeVersion or newer installation")
    }
}

if ($null -eq (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    $missing.Add('npm on the runner PATH')
}
else {
    $details.Add('npm is available on the runner PATH.')
}

$pm2Command = Get-Item -LiteralPath $Pm2CommandPath -ErrorAction SilentlyContinue
if ($null -eq $pm2Command) {
    $missing.Add("The shared PM2 command installed at $Pm2CommandPath")
}
else {
    try {
        $originalPm2Home = $env:PM2_HOME
        $env:PM2_HOME = $Pm2Home
        Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue
        $pm2VersionResult = Invoke-NativeCommand -FilePath $pm2Command.FullName -ArgumentList @('--version')
        $pm2VersionText = @(
            $pm2VersionResult.Output |
                ForEach-Object { ([string]$_).Trim() } |
                Where-Object { $_ -match '^\d+\.\d+\.\d+$' }
        ) | Select-Object -Last 1
        if ($pm2VersionResult.ExitCode -ne 0 -or
            [string]::IsNullOrWhiteSpace($pm2VersionText) -or
            [version]$pm2VersionText -lt [version]'7.0.3') {
            $missing.Add("PM2 7.0.3 or newer (found $pm2VersionText)")
        }
        else {
            $details.Add("PM2 $pm2VersionText is available at $($pm2Command.FullName).")
            $details.Add("The isolated Web PM2 home is $Pm2Home.")
        }
    }
    catch {
        $missing.Add('A working PM2 7.0.3 or newer installation for the runner service account')
    }
    finally {
        if ([string]::IsNullOrWhiteSpace($originalPm2Home)) {
            Remove-Item Env:PM2_HOME -ErrorAction SilentlyContinue
        }
        else {
            $env:PM2_HOME = $originalPm2Home
        }
    }
}

$scheduledTaskCommands = @(
    'Get-ScheduledTask',
    'New-ScheduledTaskAction',
    'New-ScheduledTaskPrincipal',
    'Register-ScheduledTask',
    'Start-ScheduledTask',
    'Stop-ScheduledTask',
    'Enable-ScheduledTask',
    'Disable-ScheduledTask'
)
$missingScheduledTaskCommands = @(
    $scheduledTaskCommands | Where-Object {
        $null -eq (Get-Command $_ -ErrorAction SilentlyContinue)
    }
)
if ($missingScheduledTaskCommands.Count -gt 0) {
    $missing.Add("Windows ScheduledTasks PowerShell module ($($missingScheduledTaskCommands -join ', '))")
}
else {
    $details.Add('Windows ScheduledTasks PowerShell module is available.')
}

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal -ArgumentList $identity
$isAdministrator = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdministrator) {
    $missing.Add("An elevated self-hosted runner identity; current identity is $($identity.Name)")
}
else {
    $details.Add("Runner identity $($identity.Name) has local administrator rights.")
}

if (-not [string]::IsNullOrWhiteSpace($DeployPath)) {
    $normalizedDeployPath = [System.IO.Path]::GetFullPath($DeployPath).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar)
    $deployParent = Split-Path -Parent $normalizedDeployPath
    if (-not (Test-Path -LiteralPath $deployParent -PathType Container)) {
        $missing.Add("Deployment parent directory $deployParent")
    }
    else {
        $details.Add("Deployment parent directory is available: $deployParent")
    }
}

foreach ($detail in $details) {
    Write-Host "[OK] $detail"
}

if ($missing.Count -gt 0) {
    Write-Host '::error::The IIS runner is not ready for Vinext deployment.'
    foreach ($item in $missing) {
        Write-Host "::error::Missing prerequisite: $item"
    }
    throw "Missing deployment prerequisites: $($missing -join '; ')"
}

Write-Host 'All Vinext IIS deployment prerequisites are available.'
