param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,

    [Parameter(Mandatory = $true)]
    [string]$LogPath,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9A-Fa-f]{64}$')]
    [string]$ExpectedSha256
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if ($currentIdentity.User.Value -ne 'S-1-5-18') {
        throw "This one-time installer must run as LocalSystem. Actual identity: $($currentIdentity.Name)"
    }

    $resolvedInstallerPath = (Resolve-Path -LiteralPath $InstallerPath -ErrorAction Stop).Path
    $signature = Get-AuthenticodeSignature -FilePath $resolvedInstallerPath
    if ($signature.Status -ne 'Valid') {
        throw "The installer signature is not valid: $($signature.StatusMessage)"
    }

    $signerSubject = if ($null -eq $signature.SignerCertificate) { '<missing>' } else { $signature.SignerCertificate.Subject }
    if ($signerSubject -notmatch 'Microsoft Corporation') {
        throw "The installer is not signed by Microsoft Corporation: $signerSubject"
    }

    $hash = Get-FileHash -LiteralPath $resolvedInstallerPath -Algorithm SHA256
    if ($hash.Hash -ine $ExpectedSha256) {
        throw "The installer SHA256 does not match the approved package. Actual: $($hash.Hash)"
    }

    $installerService = Get-Service -Name 'msiserver' -ErrorAction Stop
    if ($installerService.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Running) {
        Start-Service -Name 'msiserver'
        $installerService.WaitForStatus(
            [System.ServiceProcess.ServiceControllerStatus]::Running,
            [TimeSpan]::FromSeconds(30)
        )
    }

    $msiexecPath = Join-Path $env:windir 'System32\msiexec.exe'
    $arguments = "/i `"$resolvedInstallerPath`" /qn /norestart /L*v `"$LogPath`""
    $installerProcess = Start-Process `
        -FilePath $msiexecPath `
        -ArgumentList $arguments `
        -WindowStyle Hidden `
        -Wait `
        -PassThru

    exit $installerProcess.ExitCode
}
catch {
    Write-Error $_
    exit 1
}
