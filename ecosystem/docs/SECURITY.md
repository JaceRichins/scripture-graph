# Security

## Authentication

- **No passwords.** Identity is claimed with single-use invite codes and held
  by per-device bearer tokens (`sgd_` + 48 random bytes, base64url).
- Tokens and invite codes are stored **only as SHA-256 hashes**. A database
  leak reveals no usable credential. Bootstrap prints secrets exactly once.
- Invite kinds are strict: `account` creates a new user (may bundle a group),
  `group` adds an existing user to a group, `device` links a new device to an
  existing account. `/auth/link-device` accepts **only** `device` invites —
  an account invite can never be replayed into an account takeover (regression
  test covers this).
- `/auth/logout` revokes the presented device token immediately.

## Authorization

- Every read path is scoped by one SQL fragment (`VISIBLE_SQL`): author,
  `public`, or `group` via a membership subselect. There is no UI-only
  filtering anywhere.
- Writes: only the author may edit an annotation. Group admins may delete
  (moderate) group-visible annotations in their group — that's the single
  exception, and it's audited.
- Pushing `visibility='group'` requires actual membership of that group.
- `visibility='local'` is rejected on the wire (must never leave a device).
- Owner-only surfaces: creating account invites, `/admin/overview` (returns
  counters only — deliberately no content).

## Transport & injection

- The plugin talks through Obsidian's `requestUrl` (native layer).
- All SQL uses prepared statements with named/positional parameters; the
  annotations query builds `@a0..@aN` named params — no string interpolation.
- All request bodies are zod-validated before touching the database.
- Rate limiting on auth endpoints (per-IP) and sync (per-device).
- CORS allowlist: `app://obsidian.md`, `capacitor://localhost`,
  `http://localhost` dev origins.

## Secrets handling

- OpenRouter keys and device tokens live only in the plugin's device store
  (`localStorage`), never in `data.json`, never in Markdown, never logged.
- `ecosystem/server/data/` (DB + bootstrap output) and `.env` files are
  gitignored.
- The AI conversation flow sends context to OpenRouter only when the user
  asks a question; personal notes are included only with the explicit
  "Let AI read my private notes" toggle.

## Known limitations (accepted for a LAN family deployment)

- HTTP on the LAN (no TLS). Tokens ride the local network in cleartext.
  Mitigation: LAN-only exposure; move to a TLS host (see DEPLOYMENT.md) if
  the server ever leaves the house.
- No token rotation UI yet (revoke = sign out that device; every device has
  its own token, so loss is contained).
- SQLite single-writer is fine at family scale; Postgres port is a
  documented column-compatible move (see DATA-MODEL.md).

## Review process

§57 review: the server test suite pins the invariants above (20 tests,
including hijack, cross-user edit, private-leak, admin-content-free). An
adversarial pass over auth/visibility/sync is recorded in
[SECURITY-REVIEW.md](SECURITY-REVIEW.md) with findings and fixes.
