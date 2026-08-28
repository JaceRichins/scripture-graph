# Testing

Three suites + one live smoke. All must be green before shipping.

## 1. SDK unit tests (vitest) — `npm run -w @scripture-graph/core-sdk test`

17 tests: anchor round-trips (incl. multi-word books, D&C, Psalm),
partial-anchor resolve with hash mismatch fallback, sync engine
(local-never-uploads, offline retry keeps the queue, conflict → private
conflict copy, tombstone), tier routing + cheapest + fallback, budget cap
gate, markdown parsing (frontmatter, SG sections, canonical verses, context
trimming).

## 2. Server tests (vitest + real SQLite) — `npm run -w @scripture-graph/server test`

20 tests pinning the §56 matrix over `app.inject` (no network, real DB):

- invites: claim, expiry, single-use, owner-only account invites
- **account-invite → link-device hijack is rejected** (device kind required)
- logout revokes; cross-user edit rejected; group-admin delete allowed
- private never appears in another user's query/pull/export
- group visibility requires membership; leaving revokes access
- public visible to all; visibility changes audited
- idempotent push (duplicate), stale `base_version` → conflict with server row
- tombstones flow through pull; `local` rejected on the wire
- export scoped to self; account delete purges; admin overview content-free

## 3. Engine tests (pytest) — `.venv\Scripts\python -m pytest -q`

64 tests for the Python research engine (waves, patch jail, canonical
immutability, rollback, apparatus, lockfile, validation, …).

## 4. HTTP smoke (real server, throwaway DB)

`scratchpad/smoke.mjs` (kept out of the repo) boots the real listener on a
temp SQLite DB, then runs 15 end-to-end checks over actual HTTP: health,
owner identity, invite claim → auto group join, private-leak, group
visibility with author names, idempotent replay, `local` rejection, pull
scoping, export scoping, admin owner-only + content-free. Last run:
**15/15 PASS** (2026-08-28).

## What is deliberately NOT mocked

Server tests run the real Fastify app against a real SQLite file; sync tests
run the real queue logic. Only the network transport and OpenRouter are
faked (`FetchLike` injection).

## Before every release

```bash
cd ecosystem
npm run -ws --if-present typecheck && npm run -ws --if-present test
cd .. && .venv\Scripts\python -m pytest -q
```
