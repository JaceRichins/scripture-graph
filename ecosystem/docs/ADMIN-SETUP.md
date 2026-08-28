# Owner / admin guide (Jace)

## One-time: claim the owner account (do this next)

1. The bootstrap already ran. Open
   `ecosystem/server/data/OWNER-BOOTSTRAP.txt` — it holds your owner device
   token (`sgd_…`) and 5 family invite codes. This file is gitignored and
   local-only.
2. In Obsidian (this PC): Settings → Scripture Graph → **Join…** → paste the
   **owner token** into the invite-code field → Join. (The plugin recognizes
   `sgd_` tokens.)
3. Hand each family member one invite code (they follow USER-SETUP.md).
   Each code is single-use, 30 days, and auto-joins the *Richins Family*
   group.
4. **Delete `OWNER-BOOTSTRAP.txt`** once you're signed in and the codes are
   distributed (the server keeps only hashes; spare codes can be re-created
   in settings anytime).

## Everyday admin (all inside Obsidian settings)

As owner you get an **Owner admin** section in Settings → Scripture Graph:

- *New family account invite* — mint more single-use codes.
- Backend counters (users / devices / groups / annotations). By design you
  can NOT read anyone's notes — there is no admin content endpoint at all.

Group admin (per group): *Invite…* creates group codes; members can be
removed from the roster; leaving a group immediately revokes that group's
shared content.

## Operating the backend

- Runs as scheduled task **"ScriptureGraph Backend"** (starts at logon,
  restarts on crash). Log: `ecosystem/server/data/server.log`.
- Health check: `http://127.0.0.1:8930/health`.
- Phones use `http://192.168.1.59:8930` — if the PC's LAN IP ever changes,
  fix it in Settings → Scripture Graph → *Server address* (syncs to
  everyone), and consider a DHCP reservation in the router (DEPLOYMENT.md).
- Backup: copy `ecosystem/server/data/scripturegraph-social.sqlite3`
  occasionally (your family's shared highlights/notes). Vault content is
  separately covered by git + Obsidian Sync.

## Boundaries to keep in mind

- Your owner role is administrative, not omniscient: private means private,
  including from you.
- Account invites are owner-only on the server — nobody else can mint
  family accounts even if they find the endpoint.
- The engine (Python) and the backend are independent; restarting one never
  breaks the other. The plugin works offline against its queue if the
  backend is down — nothing is lost.
