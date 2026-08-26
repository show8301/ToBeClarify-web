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

function Start-WindowsInstallerService {
    $serviceName = 'msiserver'
    $serviceRegistryPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
    $service = Get-Service -Name $serviceName -ErrorAction Stop
    $serviceConfiguration = Get-ItemProperty -LiteralPath $serviceRegistryPath -Name Start -ErrorAction Stop

    if ($serviceConfiguration.Start -eq 4) {
        Write-Host 'Windows Installer service is disabled; changing it to Manual startup.'
        Set-Service -Name $serviceName -StartupType Manual
    }

    $service.Refresh()
    if ($service.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Running) {
        Write-Host 'Starting Windows Installer service.'
        Start-Service -Name $serviceName
        $service.WaitForStatus(
            [System.ServiceProcess.ServiceControllerStatus]::Running,
            [TimeSpan]::FromSeconds(30)
        )
    }

    $service.Refresh()
    if ($service.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Running) {
        throw "Windows Installer service did not reach the Running state. Current state: $($service.Status)"
    }

    Write-Host 'Windows Installer service is running.'
}

function Test-WindowsInstallerComRegistration {
    try {
        $installerCom = New-Object -ComObject WindowsInstaller.Installer
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($installerCom)
        Write-Host 'Windows Installer COM registration is accessible.'
    }
    catch {
        $hresult = '0x{0:X8}' -f ($_.Exception.HResult -band 0xffffffffL)
        Write-Warning "Windows Installer COM registration check failed ($hresult): $($_.Exception.Message)"
    }
}

function Write-InstallerLogTail {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Warning "Windows Installer did not create the expected verbose log: $Path"
        return
    }

    Write-Host '::group::Windows Installer verbose log tail'
    Get-Content -LiteralPath $Path -Tail 160 | ForEach-Object { Write-Host $_ }
    Write-Host '::endgroup::'
}

function Install-UrlRewriteAsLocalSystem {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallerPath,

        [Parameter(Mandatory = $true)]
        [string]$LogPath,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedHash
    )

    $systemInstallerScript = Join-Path $PSScriptRoot 'invoke-signed-msi-as-system.ps1'
    if (-not (Test-Path -LiteralPath $systemInstallerScript -PathType Leaf)) {
        throw "The one-time LocalSystem installer script was not found: $systemInstallerScript"
    }

    $taskName = 'ToBeClarify-UrlRewrite-' + [guid]::NewGuid().ToString('N')
    $powershellPath = Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $actionArguments = @(
        '-NoLogo'
        '-NoProfile'
        '-NonInteractive'
        '-ExecutionPolicy Bypass'
        "-File `"$systemInstallerScript`""
        "-InstallerPath `"$InstallerPath`""
        "-LogPath `"$LogPath`""
        "-ExpectedSha256 `"$ExpectedHash`""
    ) -join ' '

    $action = New-ScheduledTaskAction -Execute $powershellPath -Argument $actionArguments
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5)
    $principal = New-ScheduledTaskPrincipal `
        -UserId 'S-1-5-18' `
        -LogonType ServiceAccount `
        -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries

    try {
        Write-Host "Registering one-time LocalSystem installer task: $taskName"
        Register-ScheduledTask `
            -TaskName $taskName `
            -Action $action `
            -Trigger $trigger `
            -Principal $principal `
            -Settings $settings `
            -ErrorAction Stop | Out-Null

        Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
        $deadline = (Get-Date).AddMinutes(10)
        do {
            Start-Sleep -Seconds 2
            $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
            $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction Stop
            $hasRun = $taskInfo.LastRunTime.Year -gt 2000
        } while ((-not $hasRun -or $task.State -eq 'Running') -and (Get-Date) -lt $deadline)

        if (-not $hasRun -or $task.State -eq 'Running') {
            throw "The one-time LocalSystem installer task did not finish within 10 minutes: $taskName"
        }

        return [int]$taskInfo.LastTaskResult
    }
    finally {
        if ($null -ne (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
            Write-Host "Removed one-time LocalSystem installer task: $taskName"
        }
    }
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

    Start-WindowsInstallerService
    Test-WindowsInstallerComRegistration

    $installerExitCode = Install-UrlRewriteAsLocalSystem `
        -InstallerPath $installerPath `
        -LogPath $logPath `
        -ExpectedHash $ExpectedSha256

    if ($installerExitCode -ne 0 -and $installerExitCode -ne 3010) {
        Write-InstallerLogTail -Path $logPath
        throw "URL Rewrite installation failed with MSI exit code $installerExitCode. Log: $logPath"
    }

    if (-not (Test-UrlRewriteModule)) {
        if ($installerExitCode -eq 3010) {
            throw "URL Rewrite installation requires a server restart before the module is available. Log: $logPath"
        }
        throw "URL Rewrite installation completed, but IIS does not list RewriteModule. Log: $logPath"
    }

    if ($installerExitCode -eq 3010) {
        Write-Warning 'The installer requested a restart, but RewriteModule is already available to IIS.'
    }

    Write-Host 'Microsoft IIS URL Rewrite was installed and verified.'
}
finally {
    if (Test-Path -LiteralPath $installerPath) {
        Remove-Item -LiteralPath $installerPath -Force
    }
}
