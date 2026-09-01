param(
    [string]$Pm2Home = 'D:\pm2\ToBeClarify-web',
    [string]$Pm2CommandPath = 'D:\pm2\ToBeClarify-web\cli\node_modules\.bin\pm2.cmd'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'native-command.ps1')

$nodeCommand = Get-Command node.exe -ErrorAction Stop
$pm2Command = Get-Item -LiteralPath $Pm2CommandPath -ErrorAction Stop
$normalizerPath = Join-Path $PSScriptRoot 'normalize-pm2-jlist.cjs'
if (-not (Test-Path -LiteralPath $normalizerPath -PathType Leaf)) {
    throw "The PM2 normalizer was not found: $normalizerPath"
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "tobeclarify-pm2-validation-$([guid]::NewGuid().ToString('N'))"
New-Item -Path $temporaryRoot -ItemType Directory | Out-Null
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
$originalPm2Home = $env:PM2_HOME

try {
    $env:PM2_HOME = $Pm2Home
    Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue

    # This is read-only with respect to the process list. It validates the exact
    # Windows PowerShell -> PM2 -> Node path used by deployment.
    $jlistResult = Invoke-NativeCommand `
        -FilePath $pm2Command.FullName `
        -ArgumentList @('jlist', '--silent')
    if ($jlistResult.ExitCode -ne 0) {
        throw "PM2 jlist failed: $($jlistResult.Output -join [Environment]::NewLine)"
    }

    $actualJlistPath = Join-Path $temporaryRoot 'actual-jlist.txt'
    [System.IO.File]::WriteAllText(
        $actualJlistPath,
        ($jlistResult.Output -join [Environment]::NewLine),
        $utf8WithoutBom)

    foreach ($appName in @('tobeclarify-web-dev', 'tobeclarify-web-prod')) {
        $normalizationResult = Invoke-NativeCommand `
            -FilePath $nodeCommand.Source `
            -ArgumentList @($normalizerPath, $actualJlistPath, $appName)
        if ($normalizationResult.ExitCode -ne 0) {
            throw "Unable to inspect ${appName}: $($normalizationResult.Output -join [Environment]::NewLine)"
        }

        $appProjection = ($normalizationResult.Output -join [Environment]::NewLine) | ConvertFrom-Json
        if ($null -ne $appProjection -and [string]$appProjection.name -cne $appName) {
            throw "PM2 normalizer returned the wrong application for $appName."
        }
    }

    # Reproduce the original Windows collision explicitly. JavaScript must keep
    # username and USERNAME distinct and emit only the safe deployment fields.
    $duplicateKeyFixturePath = Join-Path $temporaryRoot 'duplicate-keys.json'
    $duplicateKeyFixture = '[{"name":"probe","pm2_env":{"pm_cwd":"D:\\probe","pm_exec_path":"D:\\probe\\cli.js","args":["start","--port","4310"],"status":"online","env":{"username":"lower","USERNAME":"upper"}}}]'
    [System.IO.File]::WriteAllText($duplicateKeyFixturePath, $duplicateKeyFixture, $utf8WithoutBom)
    $fixtureResult = Invoke-NativeCommand `
        -FilePath $nodeCommand.Source `
        -ArgumentList @($normalizerPath, $duplicateKeyFixturePath, 'probe')
    if ($fixtureResult.ExitCode -ne 0) {
        throw "Duplicate-key PM2 fixture failed: $($fixtureResult.Output -join [Environment]::NewLine)"
    }
    $fixtureProjection = ($fixtureResult.Output -join [Environment]::NewLine) | ConvertFrom-Json
    if ($null -eq $fixtureProjection -or [string]$fixtureProjection.pm2_env.status -cne 'online') {
        throw 'Duplicate-key PM2 fixture returned an unexpected projection.'
    }

    # An intentional Node stderr failure must be captured as a result instead
    # of terminating Windows PowerShell before ExitCode can be inspected.
    $global:LASTEXITCODE = 0
    $missingInputResult = Invoke-NativeCommand `
        -FilePath $nodeCommand.Source `
        -ArgumentList @($normalizerPath, (Join-Path $temporaryRoot 'missing.json'), 'probe')
    if (
        $missingInputResult.ExitCode -eq 0 -or
        $missingInputResult.Output.Count -eq 0 -or
        $global:LASTEXITCODE -ne 0
    ) {
        throw 'Native stderr/exit-code capture did not behave as expected.'
    }

    Write-Host '[OK] Windows PowerShell safely captures native stdout, stderr, and exit codes.'
    Write-Host '[OK] PM2 jlist is readable without case-insensitive JSON key collisions.'
    Write-Host '[OK] DEV and PROD PM2 application names remain independently queryable.'
}
finally {
    if ([string]::IsNullOrWhiteSpace($originalPm2Home)) {
        Remove-Item Env:PM2_HOME -ErrorAction SilentlyContinue
    }
    else {
        $env:PM2_HOME = $originalPm2Home
    }
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
}
