# Scripture Graph — public address for the family server, without admin rights.
# Runs a Cloudflare quick tunnel (outbound only; nothing opened on the router)
# in front of the local server and records the address it was given in
# data/public-url.txt, which the server advertises to every device so they
# learn where to reach it from anywhere. The address changes when the tunnel
# restarts; devices that were connected learn the new one the next time they
# reach the server on any address (home Wi-Fi included). Tailscale Funnel
# (a permanent address) replaces this once it is installed on the laptop.
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$log = Join-Path $here "data\tunnel.log"
$urlFile = Join-Path $here "data\public-url.txt"
New-Item -ItemType Directory -Force (Join-Path $here "data") | Out-Null

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $log -Value "[$stamp] starting tunnel" -Encoding utf8
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = Join-Path $here "bin\cloudflared.exe"
  $psi.Arguments = "tunnel --url http://127.0.0.1:8930 --no-autoupdate --protocol http2"
  $psi.RedirectStandardError = $true
  $psi.RedirectStandardOutput = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  while (-not $p.HasExited) {
    $line = $p.StandardError.ReadLine()
    if ($null -eq $line) { break }
    Add-Content -Path $log -Value $line -Encoding utf8
    if ($line -match "(https://[a-z0-9-]+\.trycloudflare\.com)") {
      Set-Content -Path $urlFile -Value $matches[1] -Encoding ascii
      Add-Content -Path $log -Value "[$stamp] public url: $($matches[1])" -Encoding utf8
    }
  }
  try { $p.WaitForExit(5000) | Out-Null } catch {}
  Remove-Item -Force $urlFile -ErrorAction SilentlyContinue
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $log -Value "[$stamp] tunnel exited - restarting in 10s" -Encoding utf8
  Start-Sleep -Seconds 10
}
