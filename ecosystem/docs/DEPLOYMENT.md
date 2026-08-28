# Deployment

## Current: this PC, LAN-only (deployed)

| Piece | Where |
|---|---|
| Backend | scheduled task **"ScriptureGraph Backend"** → `server/run-server.ps1` → `0.0.0.0:8930`, SQLite in `server/data/` |
| Plugin | installed at `Scripture Graph/.obsidian/plugins/scripture-graph/` (rides Obsidian Sync to all devices) |
| Server URL | `http://192.168.1.59:8930` in the plugin's shared `data.json` |
| Engine | unchanged — its own scheduled tasks (study every 30 min, nightly acquisition, weekly gardener) |

The task is battery-proof (`AllowStartIfOnBatteries`, `DontStopIfGoingOnBatteries`,
`StartWhenAvailable`), runs a restart loop, and logs to `server/data/server.log`.

### Firewall

Inbound works today because node.exe already has an any-port allow rule on
the **Public** profile and this network is Public. If the network is ever
switched to **Private**, add (elevated PowerShell):

```powershell
New-NetFirewallRule -DisplayName "Scripture Graph Backend (LAN only)" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8930 `
  -Profile Private -RemoteAddress LocalSubnet
```

### If the PC's IP changes

`192.168.1.59` is a DHCP address. If phones stop syncing after a router
restart, check `ipconfig` and update **Settings → Scripture Graph → Server
address** on any device (it syncs to everyone via `data.json`). Better:
reserve the IP for this PC in the router's DHCP settings (recommended).

## Later: hosted (when family leaves the LAN)

The server is dependency-light (Fastify + better-sqlite3) and runs anywhere
Node runs:

1. **Render/Railway/Fly + Postgres or a persistent disk.** Set `SG_DB` to a
   persistent path (or port to Postgres — see DATA-MODEL.md), `SG_HOST=0.0.0.0`,
   `SG_PORT` from the platform. TLS comes free; update the plugin server URL
   to `https://…` once. This mirrors the Construction project's Render setup.
2. **Cloudflare Tunnel from this PC** (`cloudflared tunnel --url
   http://127.0.0.1:8930`): zero hosting cost, HTTPS URL, but the URL is
   ephemeral unless you set up a named tunnel.

Moving is: copy the SQLite file (or migrate to Postgres), start the server
there, change one URL in settings. Tokens keep working (they're server-side
hashes, not tied to the host).

## Updating the plugin

```bash
cd ecosystem && npm run -w @scripture-graph/plugin build
```
then copy `plugins/scripture-graph/dist/main.js` (+ `manifest.json`,
`styles.css` if changed) into
`Scripture Graph/.obsidian/plugins/scripture-graph/`. The engine's
`write_obsidian_config` also does this automatically on full vault
generation. Obsidian Sync distributes it; other devices reload the plugin
(or restart Obsidian) to pick it up.
