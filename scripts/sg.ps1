# Scripture Graph CLI shim — forwards to the venv installation.
# Usage:  .\scripts\sg.ps1 status
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }
& $py -m scripturegraph --root $root @args
exit $LASTEXITCODE
