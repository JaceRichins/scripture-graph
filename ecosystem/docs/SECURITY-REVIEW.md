# Security review (§57)

Date: 2026-08-28. Reviewer: adversarial manual read of the auth, permission,
sync, and credential-handling paths against the family-LAN threat model
(malicious LAN device; curious member with a valid token; someone who obtains
the SQLite file; owner who must NOT be able to read private content). A Codex
CLI pass was attempted for a second opinion but its account was rate-limited;
the manual review below stands, with every invariant pinned by a test.

## Threat model

- Transport: HTTP on a home LAN, no TLS (accepted — see SECURITY.md).
- Attackers: (a) another device on the LAN with no token, (b) a legitimate
  family member with a valid member token trying to read/modify others' data,
  (c) an attacker with a copy of the database file, (d) the owner trying (or
  being tricked) to read members' private notes.

## Findings

### 1. Invite-burn DoS — MEDIUM — FIXED

`consumeInvite` incremented `uses` and only *then* did each endpoint reject on
kind mismatch. So a valid code submitted to the wrong endpoint was permanently
consumed while granting nothing:

- a single-use **account** invite pasted into "Join a group"
  (`/invites/accept`, expects `group`) was burned → the intended new family
  member could no longer use it;
- a shared **group** code (default up to 10 uses, circulated more freely)
  replayed against `/auth/claim` could have all its uses drained, denying
  legitimate joiners. `/auth/claim` is rate-limited 10/min/IP, enough to
  exhaust a 10-use code.

No privilege gain in any case — availability/griefing only.

**Fix:** `consumeInvite(db, code, expectKinds)` now checks the invite kind
*before* incrementing and consumes nothing on mismatch
(`auth.ts:90`). All three call sites pass their expected kind
(`app.ts` claim→`["account"]`, link-device→`["device"]`,
accept→`["group"]`). Regression test: "a code sent to the wrong endpoint is
NOT consumed (no invite-burn DoS)".

## Areas reviewed and found clean

- **Read authorization.** Every annotation read path — `/sync/pull`,
  `/annotations/query` — is scoped by the single `VISIBLE_SQL` predicate
  (author OR public OR group-member-via-subselect); `/export` is
  `author_user_id=?`. No UI-only filtering. Private rows never reach another
  user (tests: private-leak on query/pull/export).
- **Write authorization.** `applyOp` forces `author_user_id` to the existing
  row's author or the caller — client-supplied author is ignored, so identity
  can't be forged. Non-authors are rejected except the audited group-admin
  delete of group-scope rows. `visibility='local'` is rejected on the wire.
  Group writes require real membership. `base_version` mismatch → conflict,
  losing text preserved (SYNC.md).
- **Invite/auth integrity.** Codes and tokens stored only as SHA-256 hashes;
  a DB leak yields no usable credential. Device tokens are 288-bit random.
  `consumeInvite` is atomic (guarded `UPDATE … WHERE uses < max_uses`,
  `changes===1`) — single-writer SQLite + single-threaded Node close the
  SELECT/UPDATE race. Account-invite → link-device hijack is blocked (device
  kind required). Account invites are owner-only.
- **Injection.** All SQL uses parameter binding; the anchors query builds
  `@a0..@aN` named params (no interpolation). Every body is zod-validated;
  extra/unknown fields are stripped before reaching the DB. No template SQL.
- **Secret handling (plugin).** Device token + OpenRouter key live only in the
  device store (localStorage); `data.json` (which Obsidian Sync replicates to
  every vault user) holds only serverUrl + non-secret defaults. Grep confirms
  no secret is written to `data.json`, Markdown, a URL, or a log. PKCE uses a
  fresh verifier per connect and S256.
- **Admin boundary.** `/admin/overview` is owner-only and returns counts only;
  there is deliberately no server path that returns another user's content to
  an admin (test: admin content-free).

## Accepted limitations (documented, not fixed)

- **No TLS on the LAN.** Tokens traverse the local network in cleartext;
  mitigated by LAN-only exposure. Moving off-LAN requires the hosted+TLS path
  in DEPLOYMENT.md.
- **`BuildOpts.trustProxy` is unused.** `req.ip` is the socket peer, so
  X-Forwarded-For cannot spoof the rate-limit key today. If the server is ever
  put behind a reverse proxy, wire `trustProxy` through to Fastify or all
  clients will share one rate-limit bucket. Noted for the hosted move.
- **`/sync/pull` cursor is `updated_at` only.** If >500 rows share one
  timestamp, a page boundary could skip the remainder of that timestamp.
  Impossible at family write volume; revisit with a composite cursor if scale
  changes.
- **Invite-code modulo bias.** `byte % 30` slightly favors the first 16
  symbols; codes are short-lived, rate-limited, and hashed, so the entropy
  loss is immaterial.

## Verdict

**SHIP** for the family-LAN deployment. The one substantive finding
(invite-burn DoS) is fixed and tested; all confidentiality/integrity
invariants hold and are pinned by the 21-test server suite plus the 15-check
HTTP smoke.
