param(
    [string]$AppCmdPath = (Join-Path $env:windir 'System32\inetsrv\appcmd.exe')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $AppCmdPath -PathType Leaf)) {
    throw "IIS appcmd.exe was not found: $AppCmdPath"
}

$missingIisPrerequisites = New-Object System.Collections.Generic.List[string]

$rewriteOutput = & $AppCmdPath list module RewriteModule 2>&1
if ($LASTEXITCODE -ne 0 -or -not ($rewriteOutput -match 'RewriteModule')) {
    $missingIisPrerequisites.Add('Microsoft IIS URL Rewrite 2.1 (x64)')
}

$proxyOutput = & $AppCmdPath list config /section:system.webServer/proxy 2>&1
if ($LASTEXITCODE -ne 0) {
    $missingIisPrerequisites.Add('Microsoft Application Request Routing (ARR) 3.0 with IIS proxy support')
}

if ($missingIisPrerequisites.Count -gt 0) {
    throw "Missing IIS prerequisites: $($missingIisPrerequisites -join '; ')"
}

Write-Host 'IIS URL Rewrite and ARR proxy support are available.'
