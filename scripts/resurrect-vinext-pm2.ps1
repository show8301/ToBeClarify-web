param(
    [Parameter(Mandatory = $true)]
    [string]$Pm2Home,

    [Parameter(Mandatory = $true)]
    [string]$Pm2Command
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'native-command.ps1')

$env:PM2_HOME = [System.IO.Path]::GetFullPath($Pm2Home)
Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue

$logRoot = Join-Path $env:PM2_HOME 'startup-logs'
New-Item -Path $logRoot -ItemType Directory -Force | Out-Null
$logPath = Join-Path $logRoot 'resurrect.log'
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

try {
    $result = Invoke-NativeCommand -FilePath $Pm2Command -ArgumentList @('resurrect')
    Add-Content -LiteralPath $logPath -Value "[$timestamp] pm2 resurrect exit code: $($result.ExitCode)"
    if ($result.Output.Count -gt 0) {
        $result.Output | Add-Content -LiteralPath $logPath
    }
    exit $result.ExitCode
}
catch {
    Add-Content -LiteralPath $logPath -Value "[$timestamp] pm2 resurrect failed: $($_.Exception.Message)"
    throw
}
