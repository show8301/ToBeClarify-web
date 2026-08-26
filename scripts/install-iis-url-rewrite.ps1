param(
    [string]$InstallerUri = 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi',

    [ValidatePattern('^[0-9A-Fa-f]{64}$')]
    [string]$ExpectedSha256 = '37342FF2F585F263F34F48E9DE59EB1051D61015A8E967DBDE4075716230A32A'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$appcmdPath = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'
if (-not (Test-Path -LiteralPath $appcmdPath -PathType Leaf)) {
    throw "IIS appcmd.exe was not found: $appcmdPath"
}

function Test-UrlRewriteModule {
    $moduleOutput = & $appcmdPath list module RewriteModule 2>&1
    return ($LASTEXITCODE -eq 0 -and ($moduleOutput -match 'RewriteModule'))
}

if (Test-UrlRewriteModule) {
    Write-Host 'IIS URL Rewrite is already installed.'
    exit 0
}

if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'The DEV server is not a 64-bit Windows installation.'
}

$installerPath = Join-Path $env:RUNNER_TEMP 'rewrite_amd64_en-US.msi'
$logPath = Join-Path $env:RUNNER_TEMP 'iis-url-rewrite-install.log'

if (Test-Path -LiteralPath $installerPath) {
    Remove-Item -LiteralPath $installerPath -Force
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Write-Host "Downloading Microsoft IIS URL Rewrite from: $InstallerUri"
    Invoke-WebRequest -Uri $InstallerUri -OutFile $installerPath -UseBasicParsing

    $installer = Get-Item -LiteralPath $installerPath
    if ($installer.Length -lt 1MB) {
        throw "The downloaded URL Rewrite installer is unexpectedly small: $($installer.Length) bytes"
    }

    $signature = Get-AuthenticodeSignature -FilePath $installerPath
    if ($signature.Status -ne 'Valid') {
        throw "The URL Rewrite installer signature is not valid: $($signature.StatusMessage)"
    }
    $signerSubject = if ($null -eq $signature.SignerCertificate) { '<missing>' } else { $signature.SignerCertificate.Subject }
    if ($signerSubject -notmatch 'Microsoft Corporation') {
        throw "The URL Rewrite installer is not signed by Microsoft Corporation: $signerSubject"
    }

    $hash = Get-FileHash -LiteralPath $installerPath -Algorithm SHA256
    if ($hash.Hash -ine $ExpectedSha256) {
        throw "The URL Rewrite installer SHA256 does not match the approved package. Actual: $($hash.Hash)"
    }
    Write-Host "Verified Microsoft signature and approved SHA256: $($hash.Hash)"

    $msiexecPath = Join-Path $env:windir 'System32\msiexec.exe'
    $arguments = "/i `"$installerPath`" /qn /norestart /L*v `"$logPath`""
    $installerProcess = Start-Process `
        -FilePath $msiexecPath `
        -ArgumentList $arguments `
        -WindowStyle Hidden `
        -Wait `
        -PassThru

    if ($installerProcess.ExitCode -ne 0 -and $installerProcess.ExitCode -ne 3010) {
        throw "URL Rewrite installation failed with MSI exit code $($installerProcess.ExitCode). Log: $logPath"
    }

    if (-not (Test-UrlRewriteModule)) {
        if ($installerProcess.ExitCode -eq 3010) {
            throw "URL Rewrite installation requires a server restart before the module is available. Log: $logPath"
        }
        throw "URL Rewrite installation completed, but IIS does not list RewriteModule. Log: $logPath"
    }

    if ($installerProcess.ExitCode -eq 3010) {
        Write-Warning 'The installer requested a restart, but RewriteModule is already available to IIS.'
    }

    Write-Host 'Microsoft IIS URL Rewrite was installed and verified.'
}
finally {
    if (Test-Path -LiteralPath $installerPath) {
        Remove-Item -LiteralPath $installerPath -Force
    }
}
