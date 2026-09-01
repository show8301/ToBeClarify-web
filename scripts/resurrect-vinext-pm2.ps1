param(
    [Parameter(Mandatory = $true)]
    [string]$Pm2Home,

    [Parameter(Mandatory = $true)]
    [string]$Pm2Command
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$env:PM2_HOME = [System.IO.Path]::GetFullPath($Pm2Home)
Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue

$logRoot = Join-Path $env:PM2_HOME 'startup-logs'
New-Item -Path $logRoot -ItemType Directory -Force | Out-Null
$logPath = Join-Path $logRoot 'resurrect.log'
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

try {
    $output = & $Pm2Command resurrect 2>&1
    $exitCode = $LASTEXITCODE
    Add-Content -LiteralPath $logPath -Value "[$timestamp] pm2 resurrect exit code: $exitCode"
    if ($null -ne $output) {
        $output | Add-Content -LiteralPath $logPath
    }
    exit $exitCode
}
catch {
    Add-Content -LiteralPath $logPath -Value "[$timestamp] pm2 resurrect failed: $($_.Exception.Message)"
    throw
}
