# Scripture Graph collaboration backend — resident runner.
# Registered as the "ScriptureGraph Backend" scheduled task (at logon).
# Binds to the LAN so family phones on the same Wi-Fi can sync.
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$env:SG_HOST = "0.0.0.0"
$env:SG_PORT = "8930"
# DB defaults to data\scripturegraph-social.sqlite3 (gitignored)

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
