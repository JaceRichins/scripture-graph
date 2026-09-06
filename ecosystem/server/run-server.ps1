# Scripture Graph collaboration backend — resident runner.
# Registered as the "ScriptureGraph Backend" scheduled task (at logon).
# Binds to the LAN so family phones on the same Wi-Fi can sync.
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$env:SG_HOST = "0.0.0.0"
$env:SG_PORT = "8930"
# DB defaults to data\scripturegraph-social.sqlite3 (gitignored)
# the vault itself, for /vault/* (every device syncs from here; the
# owner's Library/ is mirrored back to disk for the engine)
$env:SG_VAULT = "C:\Users\jacer\repos\SCRIPTURE GRAPH\Scripture Graph"
# the engine's index, read-only, for /search (the phone's library search)
$env:SG_ENGINE_DB = "C:\Users\jacer\repos\SCRIPTURE GRAPH\Scripture Graph\.scripture-engine\database\scripturegraph.sqlite3"

$log = Join-Path $here "data\server.log"
New-Item -ItemType Directory -Force (Join-Path $here "data") | Out-Null

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $log -Value "[$stamp] starting server" -Encoding utf8
  # tsx runs TypeScript from source; npx resolves the workspace-local install
  & npx.cmd tsx src/index.ts *>> $log
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $log -Value "[$stamp] server exited (code $LASTEXITCODE) - restarting in 10s" -Encoding utf8
  Start-Sleep -Seconds 10
}
