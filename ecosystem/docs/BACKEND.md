# Backend operations

One boring Fastify + SQLite service. No framework magic, no ORM.

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | — | liveness |
| `POST /auth/claim` | invite | new account from an `account` invite |
| `POST /auth/link-device` | `device` invite | new device token for an existing account |
| `POST /auth/logout` | token | revoke this device token |
| `GET /me` | token | identity + groups |
| `POST /groups` · `GET /groups` | token | create / list my groups |
| `GET /groups/:id/members` | member | roster |
| `POST /groups/:id/invites` | group admin | group invite code |
| `POST /invites/account` | owner | account invite (`{device_link:true}` → device-link code) |
| `POST /invites/accept` | token | join a group by code |
| `POST /groups/:id/leave` · `DELETE /groups/:id/members/:uid` | member / admin | leave / remove |
| `POST /sync/push` | token | apply ops (idempotent) |
| `GET /sync/pull?cursor=` | token | changes visible to me |
| `POST /annotations/query` | token | annotations for a set of anchors (+author_name) |
| `GET /export` | token | all my data |
| `POST /account/delete` | token | purge my content, revoke devices |
| `GET /admin/overview` | owner | content-free counters |

## Configuration (env)

| Var | Default | |
|---|---|---|
| `SG_DB` | `data/scripturegraph-social.sqlite3` | SQLite path |
| `SG_PORT` | `8930` | listen port |
| `SG_HOST` | `127.0.0.1` | `0.0.0.0` for LAN (the scheduled task sets this) |

## Running

Dev: `npm run -w @scripture-graph/server dev` (tsx, from source).
Production on this PC: the **"ScriptureGraph Backend"** scheduled task runs
`server/run-server.ps1` at logon — binds `0.0.0.0:8930`, restart loop, log at
`server/data/server.log`.

```powershell
Start-ScheduledTask -TaskName "ScriptureGraph Backend"   # start now
Stop-ScheduledTask  -TaskName "ScriptureGraph Backend"   # then kill node if needed
Get-Content "ecosystem\server\data\server.log" -Tail 30
Invoke-RestMethod http://127.0.0.1:8930/health
```

## Bootstrap / re-bootstrap

`npm run -w @scripture-graph/server init -- "Owner Name" "Group Name"` —
refuses to run if users already exist. Output (owner token + 5 account
invites) is printed once; the deployed instance's copy is in the gitignored
`server/data/OWNER-BOOTSTRAP.txt` — **delete that file once the owner device
is signed in.**

## Backup

Copy `server/data/*.sqlite3` (WAL mode: also `-wal`/`-shm`, or use
`sqlite3 .backup`). Everything else is reproducible.
