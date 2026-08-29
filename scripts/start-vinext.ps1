param(
    [Parameter(Mandatory = $true)]
    [string]$AppPath,

    [Parameter(Mandatory = $true)]
    [string]$NodePath,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1024, 65535)]
    [int]$Port
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$appRoot = (Resolve-Path -LiteralPath $AppPath).Path
$nodeExecutable = (Resolve-Path -LiteralPath $NodePath).Path
$vinextCli = Join-Path $appRoot 'node_modules\vinext\dist\cli.js'
$serverEntry = Join-Path $appRoot 'dist\server\index.js'
$runtimeConfigPath = Join-Path $appRoot 'runtime-config.json'

if (-not (Test-Path -LiteralPath $vinextCli -PathType Leaf)) {
    throw "Vinext CLI was not found: $vinextCli"
}

if (-not (Test-Path -LiteralPath $serverEntry -PathType Leaf)) {
    throw "Vinext server build was not found: $serverEntry"
}

if (Test-Path -LiteralPath $runtimeConfigPath -PathType Leaf) {
    $runtimeConfig = Get-Content -LiteralPath $runtimeConfigPath -Raw | ConvertFrom-Json
    foreach ($property in $runtimeConfig.PSObject.Properties) {
        if (-not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
            Set-Item -Path "Env:$($property.Name)" -Value ([string]$property.Value)
        }
    }
}

$env:PORT = [string]$Port
$env:HOSTNAME = '127.0.0.1'
$env:WRANGLER_LOG_PATH = Join-Path $appRoot 'logs\wrangler.log'
$env:WRANGLER_WRITE_LOGS = 'false'
$env:MINIFLARE_REGISTRY_PATH = Join-Path $appRoot '.wrangler\registry'

# This process is the long-lived IIS backend, not a child workload that should
# be reaped when the self-hosted GitHub Actions job completes.
Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue

$logRoot = Join-Path $appRoot 'logs'
New-Item -Path $logRoot -ItemType Directory -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdoutPath = Join-Path $logRoot "vinext-$timestamp.stdout.log"
$stderrPath = Join-Path $logRoot "vinext-$timestamp.stderr.log"

$arguments = @(
    $vinextCli,
    'start',
    '--port',
    [string]$Port,
    '--hostname',
    '127.0.0.1'
)

Push-Location $appRoot
try {
    # Keep Node attached to the Scheduled Task's PowerShell process. Using
    # Start-Process here can leave the Node child alive after Stop-ScheduledTask
    # reports that the outer task has stopped.
    & $nodeExecutable @arguments 1>> $stdoutPath 2>> $stderrPath
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

exit $exitCode
