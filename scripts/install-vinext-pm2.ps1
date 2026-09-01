param(
    [string]$RunnerAccount = "$env:COMPUTERNAME\show8301",

    [string]$Pm2Root = 'D:\pm2\ToBeClarify-web',

    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Pm2Version = '7.0.3'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'native-command.ps1')

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal -ArgumentList $identity
if (-not $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer from an elevated PowerShell window; current identity is $($identity.Name)."
}

$npmPath = Join-Path $env:ProgramFiles 'nodejs\npm.cmd'
if (-not (Test-Path -LiteralPath $npmPath -PathType Leaf)) {
    $npmCommand = Get-Command npm.cmd -ErrorAction Stop
    $npmPath = $npmCommand.Source
}

$cliRoot = Join-Path $Pm2Root 'cli'
$pm2CommandPath = Join-Path $cliRoot 'node_modules\.bin\pm2.cmd'
New-Item -Path $cliRoot -ItemType Directory -Force | Out-Null

$packageJson = [ordered]@{
    name = 'tobeclarify-web-pm2-runtime'
    private = $true
    version = '1.0.0'
    dependencies = [ordered]@{
        pm2 = $Pm2Version
    }
}
$packageJson |
    ConvertTo-Json -Depth 4 |
    Set-Content -LiteralPath (Join-Path $cliRoot 'package.json') -Encoding UTF8

$npmResult = Invoke-NativeCommand `
    -FilePath $npmPath `
    -ArgumentList @(
        'install',
        '--prefix',
        $cliRoot,
        '--omit=dev',
        '--no-audit',
        '--no-fund',
        '--save-exact'
    )
$npmResult.Output | ForEach-Object { Write-Host $_ }
if ($npmResult.ExitCode -ne 0) {
    throw "Unable to install PM2 $Pm2Version into $cliRoot."
}

if (-not (Test-Path -LiteralPath $pm2CommandPath -PathType Leaf)) {
    throw "The shared PM2 command was not created: $pm2CommandPath"
}

$aclGrant = "${RunnerAccount}:(OI)(CI)M"
$aclResult = Invoke-NativeCommand `
    -FilePath 'icacls.exe' `
    -ArgumentList @($Pm2Root, '/inheritance:e', '/grant:r', $aclGrant)
if ($aclResult.ExitCode -ne 0) {
    throw "Unable to grant $RunnerAccount Modify permission on ${Pm2Root}: $($aclResult.Output -join [Environment]::NewLine)"
}

$installedPackagePath = Join-Path $cliRoot 'node_modules\pm2\package.json'
$installedVersion = (Get-Content -LiteralPath $installedPackagePath -Raw | ConvertFrom-Json).version
if ([version]$installedVersion -lt [version]'7.0.3') {
    throw "PM2 installation verification failed; found $installedVersion."
}

Write-Host "Shared PM2 CLI installed without starting a daemon: $pm2CommandPath"
Write-Host "Installed PM2 version: $installedVersion"
Write-Host "Runner account granted Modify permission: $RunnerAccount"
