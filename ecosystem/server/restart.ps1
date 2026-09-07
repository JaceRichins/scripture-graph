# Restart the family backend (scheduled task "ScriptureGraph Backend").
# The tunnel (cloudflared) is a separate process and is left alone.
Stop-ScheduledTask -TaskName 'ScriptureGraph Backend' -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -notlike '*cloudflared*' } | Stop-Process -Force
Start-Sleep 2
Start-ScheduledTask -TaskName 'ScriptureGraph Backend'
Start-Sleep 8
try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8930/plugin/manifest.json).Content } catch { "server not up yet: $_" }
