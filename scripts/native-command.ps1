function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$ArgumentList = @()
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $previousLastExitCodeVariable = Get-Variable -Name LASTEXITCODE -Scope Global -ErrorAction SilentlyContinue
    $previousLastExitCode = if ($null -eq $previousLastExitCodeVariable) {
        0
    }
    else {
        [int]$previousLastExitCodeVariable.Value
    }

    try {
        # Windows PowerShell 5.1 converts native stderr into ErrorRecord values.
        # Capture those values without allowing the caller's Stop preference to
        # terminate before LASTEXITCODE can be inspected.
        $ErrorActionPreference = 'Continue'
        $commandOutput = @(& $FilePath @ArgumentList 2>&1)
        $commandExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        $global:LASTEXITCODE = $previousLastExitCode
    }

    return [pscustomobject]@{
        ExitCode = [int]$commandExitCode
        Output = @($commandOutput | ForEach-Object { [string]$_ })
    }
}

function Resolve-Pm2Command {
    param(
        [string]$SharedCommandPath = 'D:\pm2\ToBeClarify-web\cli\node_modules\.bin\pm2.cmd'
    )

    $globalCommand = Get-Command pm2.cmd -ErrorAction SilentlyContinue
    if ($null -ne $globalCommand) {
        return $globalCommand.Source
    }

    if (Test-Path -LiteralPath $SharedCommandPath -PathType Leaf) {
        return (Get-Item -LiteralPath $SharedCommandPath -ErrorAction Stop).FullName
    }

    throw "PM2 is unavailable to the runner. Neither global pm2.cmd nor the shared CLI exists at $SharedCommandPath."
}
