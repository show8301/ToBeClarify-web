param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactPath,

    [Parameter(Mandatory = $true)]
    [string]$DeployPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$artifactRoot = (Resolve-Path -LiteralPath $ArtifactPath).Path
$deployRoot = (Resolve-Path -LiteralPath $DeployPath).Path
$deployRoot = $deployRoot.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar)

if ((Split-Path -Leaf $deployRoot) -ine 'ToBeClarify_web') {
    throw "Refusing to deploy to unexpected directory: $deployRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $artifactRoot 'index.html') -PathType Leaf)) {
    throw "The Web artifact does not contain index.html: $artifactRoot"
}

$webConfigPath = Join-Path $deployRoot 'web.config'
if (-not (Test-Path -LiteralPath $webConfigPath -PathType Leaf)) {
    throw "The IIS web.config file was not found: $webConfigPath"
}

$backupRoot = Join-Path $env:RUNNER_TEMP 'tobeclarify-web-rollback'
if (Test-Path -LiteralPath $backupRoot) {
    Remove-Item -LiteralPath $backupRoot -Recurse -Force
}
New-Item -Path $backupRoot -ItemType Directory | Out-Null

$existingItems = Get-ChildItem -LiteralPath $deployRoot -Force |
    Where-Object { $_.Name -ine 'web.config' }

foreach ($item in $existingItems) {
    Copy-Item -LiteralPath $item.FullName -Destination $backupRoot -Recurse -Force
}

try {
    foreach ($item in $existingItems) {
        Remove-Item -LiteralPath $item.FullName -Recurse -Force
    }

    foreach ($item in (Get-ChildItem -LiteralPath $artifactRoot -Force)) {
        Copy-Item -LiteralPath $item.FullName -Destination $deployRoot -Recurse -Force
    }

    if (-not (Test-Path -LiteralPath (Join-Path $deployRoot 'index.html') -PathType Leaf)) {
        throw 'Deployment verification failed because index.html is missing.'
    }

    Write-Host "Web deployment completed: $deployRoot"
}
catch {
    Write-Warning 'Web deployment failed. Restoring the previous files.'

    Get-ChildItem -LiteralPath $deployRoot -Force |
        Where-Object { $_.Name -ine 'web.config' } |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }

    foreach ($item in (Get-ChildItem -LiteralPath $backupRoot -Force)) {
        Copy-Item -LiteralPath $item.FullName -Destination $deployRoot -Recurse -Force
    }

    throw
}
