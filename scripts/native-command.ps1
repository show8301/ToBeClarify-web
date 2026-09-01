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
        # Windows PowerShell 5.1 turns native stderr into ErrorRecord objects.
        # With the caller's Stop preference those records terminate the script
        # before LASTEXITCODE can be inspected, so capture them under Continue.
        $ErrorActionPreference = 'Continue'
        $commandOutput = @(& $FilePath @ArgumentList 2>&1)
        $commandExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        # A handled native failure must not poison the exit status of the
        # caller (including the GitHub Actions PowerShell host).
        $global:LASTEXITCODE = $previousLastExitCode
    }

    return [pscustomobject]@{
        ExitCode = [int]$commandExitCode
        Output = @($commandOutput | ForEach-Object { [string]$_ })
    }
}
