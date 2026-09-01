param(
    [string]$AppCmdPath = (Join-Path $env:windir 'System32\inetsrv\appcmd.exe'),

    [string]$DeployPath,

    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$MinimumNodeVersion = '22.13.0'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$missing = New-Object System.Collections.Generic.List[string]
$details = New-Object System.Collections.Generic.List[string]

if (-not (Test-Path -LiteralPath $AppCmdPath -PathType Leaf)) {
    $missing.Add('IIS Web Server management tools (appcmd.exe)')
}
else {
    $rewriteOutput = & $AppCmdPath list module RewriteModule 2>&1
    if ($LASTEXITCODE -ne 0 -or -not ($rewriteOutput -match 'RewriteModule')) {
        $missing.Add('Microsoft IIS URL Rewrite 2.1 (x64)')
    }
    else {
        $details.Add('Microsoft IIS URL Rewrite is available.')
    }

    $proxyOutput = & $AppCmdPath list config /section:system.webServer/proxy 2>&1
    if ($LASTEXITCODE -ne 0) {
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
        $nodeVersionText = (& $nodeCommand.Source --version).TrimStart('v')
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

$scheduledTaskCommands = @(
    'Get-ScheduledTask',
    'New-ScheduledTaskAction',
    'New-ScheduledTaskPrincipal',
    'Register-ScheduledTask',
    'Start-ScheduledTask',
    'Stop-ScheduledTask'
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
