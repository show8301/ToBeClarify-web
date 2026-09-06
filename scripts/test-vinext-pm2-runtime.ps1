param(
    [string]$Pm2Home = 'D:\pm2\ToBeClarify-web',
    [switch]$SmokeTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'native-command.ps1')

function Invoke-Pm2ValidationCommand {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $result = Invoke-NativeCommand -FilePath $script:Pm2Command -ArgumentList $Arguments
    if ($result.ExitCode -ne 0) {
        throw "PM2 validation command failed with exit code $($result.ExitCode): pm2 $($Arguments -join ' ')`n$($result.Output -join [Environment]::NewLine)"
    }
    return $result
}

function Get-Pm2ValidationPid {
    param([Parameter(Mandatory = $true)][string]$Name)

    $result = Invoke-Pm2ValidationCommand -Arguments @('pid', $Name)
    $pidText = @(
        $result.Output |
            ForEach-Object { ([string]$_).Trim() } |
            Where-Object { $_ -match '^\d+$' }
    ) | Select-Object -Last 1

    if ([string]::IsNullOrWhiteSpace($pidText) -or [int]$pidText -le 0) {
        return $null
    }
    return [int]$pidText
}

$parseErrors = @()
Get-ChildItem -Path $PSScriptRoot -Filter '*.ps1' | ForEach-Object {
    $tokens = $null
    $fileParseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $_.FullName,
        [ref]$tokens,
        [ref]$fileParseErrors
    ) | Out-Null
    foreach ($fileParseError in $fileParseErrors) {
        $parseErrors += "$($_.Name):$($fileParseError.Extent.StartLineNumber): $($fileParseError.Message)"
    }
}
if ($parseErrors.Count -gt 0) {
    throw "PowerShell parser errors:`n$($parseErrors -join [Environment]::NewLine)"
}

$originalPm2Home = $env:PM2_HOME
$originalNoColor = $env:NO_COLOR
$script:Pm2Command = Resolve-Pm2Command
$temporaryRoot = $null
$smokeAppName = $null

try {
    $env:PM2_HOME = [System.IO.Path]::GetFullPath($Pm2Home)
    $env:NO_COLOR = '1'
    Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue
    New-Item -Path $env:PM2_HOME -ItemType Directory -Force | Out-Null

    $versionResult = Invoke-Pm2ValidationCommand -Arguments @('--version')
    $versionText = @(
        $versionResult.Output |
            ForEach-Object { ([string]$_).Trim() } |
            Where-Object { $_ -match '^\d+\.\d+\.\d+$' }
    ) | Select-Object -Last 1
    if ([string]::IsNullOrWhiteSpace($versionText)) {
        throw 'PM2 did not return a semantic version number.'
    }
    if ([version]$versionText -lt [version]'7.0.3') {
        throw "PM2 7.0.3 or newer is required; found $versionText."
    }
    Write-Host "[OK] PM2 $versionText is available at $($script:Pm2Command)."
    Write-Host "[OK] PM2_HOME is writable at $($env:PM2_HOME)."

    if (-not $SmokeTest) {
        return
    }

    $temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "tobeclarify-pm2-smoke-$([guid]::NewGuid().ToString('N'))"
    New-Item -Path $temporaryRoot -ItemType Directory | Out-Null
    $smokeAppName = "tobeclarify-pm2-smoke-$([guid]::NewGuid().ToString('N'))"

    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $smokePort = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()

    $probePath = Join-Path $temporaryRoot 'probe.js'
    $probeSource = @'
const http = require("node:http");
const port = Number.parseInt(process.env.PORT, 10);
http.createServer((request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "ok", pid: process.pid }));
}).listen(port, "127.0.0.1");
'@
    [System.IO.File]::WriteAllText($probePath, $probeSource, (New-Object System.Text.UTF8Encoding($false)))

    $nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
    $ecosystemPath = Join-Path $temporaryRoot 'pm2-smoke.json'
    $ecosystem = [ordered]@{
        apps = @(
            [ordered]@{
                name = $smokeAppName
                script = $probePath
                cwd = $temporaryRoot
                interpreter = $nodeCommand
                instances = 1
                exec_mode = 'fork'
                autorestart = $true
                watch = $false
                restart_delay = 500
                min_uptime = '2s'
                max_restarts = 5
                env = [ordered]@{ PORT = [string]$smokePort }
            }
        )
    }
    $ecosystemJson = $ecosystem | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText(
        $ecosystemPath,
        $ecosystemJson,
        (New-Object System.Text.UTF8Encoding($false)))

    Invoke-Pm2ValidationCommand -Arguments @('start', $ecosystemPath, '--only', $smokeAppName, '--silent') | Out-Null

    $firstPid = $null
    $firstProcessHealthy = $false
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        $firstPid = Get-Pm2ValidationPid -Name $smokeAppName
        if ($null -ne $firstPid) {
            try {
                $response = Invoke-WebRequest -Uri "http://127.0.0.1:$smokePort/" -UseBasicParsing -TimeoutSec 2
                if ($response.StatusCode -eq 200) {
                    $firstProcessHealthy = $true
                    break
                }
            }
            catch {}
        }
        Start-Sleep -Milliseconds 500
    }
    if ($null -eq $firstPid -or -not $firstProcessHealthy) {
        throw 'PM2 smoke process did not become healthy.'
    }

    Stop-Process -Id $firstPid -Force -ErrorAction Stop
    $replacementPid = $null
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        $candidatePid = Get-Pm2ValidationPid -Name $smokeAppName
        if ($null -ne $candidatePid -and $candidatePid -ne $firstPid) {
            try {
                $response = Invoke-WebRequest -Uri "http://127.0.0.1:$smokePort/" -UseBasicParsing -TimeoutSec 2
                if ($response.StatusCode -eq 200) {
                    $replacementPid = $candidatePid
                    break
                }
            }
            catch {}
        }
    }
    if ($null -eq $replacementPid) {
        throw 'PM2 did not restart the intentionally terminated smoke process.'
    }

    Write-Host "[OK] PM2 restarted the isolated smoke process (PID $firstPid -> $replacementPid)."
}
finally {
    if (-not [string]::IsNullOrWhiteSpace($smokeAppName)) {
        $cleanupResult = Invoke-NativeCommand -FilePath $script:Pm2Command -ArgumentList @('delete', $smokeAppName, '--silent')
        if ($cleanupResult.ExitCode -ne 0) {
            Write-Warning "Unable to remove PM2 smoke application ${smokeAppName}: $($cleanupResult.Output -join [Environment]::NewLine)"
        }
    }
    if ($null -ne $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ([string]::IsNullOrWhiteSpace($originalPm2Home)) {
        Remove-Item Env:PM2_HOME -ErrorAction SilentlyContinue
    }
    else {
        $env:PM2_HOME = $originalPm2Home
    }
    if ([string]::IsNullOrWhiteSpace($originalNoColor)) {
        Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue
    }
    else {
        $env:NO_COLOR = $originalNoColor
    }
}
