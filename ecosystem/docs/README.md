# Scripture Graph Ecosystem

The plugin suite + collaboration backend that turns the Scripture Graph vault
into a shared family study platform: private notes, shared highlights, groups,
and an AI study assistant — with the AI research engine (Python) continuing to
maintain the `AI Library/` knowledge base underneath.

## What's in this folder

| Path | What it is |
|---|---|
| `packages/core-sdk` | Shared TypeScript SDK: schemas (zod), verse/node anchors, local store, offline sync engine, API client, OpenRouter OAuth, model routing, budget |
| `plugins/scripture-graph` | The Obsidian plugin suite (one plugin, four areas: CORE, SOCIAL, AI, STUDY) |
| `server` | The collaboration backend: Fastify + SQLite, ~15 endpoints, server-enforced permissions |
| `docs/` | You are here — see the index below |

## The one paragraph that matters

Three kinds of data never mix (see [PRIVACY.md](PRIVACY.md)): **shared
knowledge** is Markdown in the synced vault; **personal data** (highlights,
notes metadata, tokens, AI keys) lives in plugin device storage and the
backend — never as Markdown in the shared vault; **social data** (groups,
shared annotations) lives only in the backend, scoped by server-side SQL.
Canonical scripture is immutable; highlights are rendered decorations, never
edits.

## Docs index

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit, and why
- [PRIVACY.md](PRIVACY.md) — the three data categories, two private modes
- [SECURITY.md](SECURITY.md) — auth, hashing, enforcement, review findings
- [SYNC.md](SYNC.md) — offline-first queue, idempotency, conflicts
- [DATA-MODEL.md](DATA-MODEL.md) — every table and every schema
- [BACKEND.md](BACKEND.md) — running and operating the server
- [AI-PROVIDERS.md](AI-PROVIDERS.md) — user-owned wallets, tiers, routing, budget
- [MOBILE.md](MOBILE.md) — iPhone specifics
- [DEPLOYMENT.md](DEPLOYMENT.md) — this-PC deployment + moving to a host later
- [PLUGIN-DEVELOPMENT.md](PLUGIN-DEVELOPMENT.md) — build, install, extend
- [TESTING.md](TESTING.md) — the three suites + the HTTP smoke
- [USER-SETUP.md](USER-SETUP.md) — family member: join in ~3 minutes
- [ADMIN-SETUP.md](ADMIN-SETUP.md) — owner: bootstrap, invites, operations

## Quick commands

```bash
cd ecosystem
npm install
npm run -ws --if-present typecheck   # all workspaces
npm run -ws --if-present test        # vitest: core-sdk + server
npm run -w @scripture-graph/plugin build
```
