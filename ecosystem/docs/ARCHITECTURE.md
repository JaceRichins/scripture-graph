# Scripture Graph Ecosystem — Architecture

*Based on the ACTUAL repository state (per prompt §71), 2026-08-28.*

## What already exists (built by the Scripture Graph engine project)

```
SCRIPTURE GRAPH\                     (repo root, git)
├── Scripture Graph\                 THE SHARED KNOWLEDGE VAULT (Obsidian Sync → phones)
│   ├── Library\                     vault-owner household drafts (My Study pages, Study Hub)
│   ├── AI Library\                  engine-maintained shared knowledge (read-only for humans)
│   │   └── 01 Scriptures\Canonical\ immutable scripture, hash-guarded + self-healed,
│   │                                every verse anchored:  ^alma-36-18
│   └── .scripture-engine\           desktop-engine runtime (config/db/logs; NOT for phones)
├── scripturegraph\                  DESKTOP RESEARCH ENGINE (Python): multi-agent research,
│                                    corpus acquisition, indexes, schedulers — §13/§48 already satisfied
└── ecosystem\                       ← THIS BUILD: plugin suite + collaboration backend
```

Already satisfied by prior work: immutable canonical scripture with integrity
restore (§4), stable verse IDs `{book}-{ch}-{v}` (§4, §39), desktop/mobile
separation (§13-14), AI study guides / topics / evidence-with-scores /
conference / history knowledge (§A data), evidence score vocabulary (§18),
vault-side reader affordances (Annotated views, lenses-as-sections).

Superseded by this build: the `scripture-graph-annotate` v0.2.1 plugin
(vanilla JS; overlay highlights stored in plugin `data.json`). Its data
migrates into the new device-local annotation store on first run — plugin
`data.json` synchronizes with the vault, which is exactly the §5/§34 leak
this build eliminates.

## The three data categories (§3) — where each lives

| Category | Storage | Sync path |
| --- | --- | --- |
| A. Shared knowledge | Markdown in `AI Library/` (+ canonical) | Obsidian Sync (existing) |
| B. Personal user data | Device-local store (`localStorage`, per-device, NEVER in vault files) + optional account-private rows in the backend | Scripture Graph backend only (account-private), or nowhere (local-private) |
| C. Social/collaborative | Backend (SQLite/Postgres): users, groups, memberships, invites, annotations, audit | Scripture Graph backend |

`Library/` markdown remains what it factually is: household draft space
synced to every vault device — documented as such (PRIVACY.md), useful for
the owner's long-form study writing and lesson drafts. True per-user privacy
lives in the annotation system.

## Monorepo

```
ecosystem/
├── packages/core-sdk/      shared TS SDK: zod schemas & types, verse/node anchors,
│                           LocalStore abstraction, offline SyncEngine, ApiClient,
│                           OpenRouter PKCE + model registry + routing + budget,
│                           context-retrieval interfaces
├── plugins/scripture-graph/ ONE mobile-safe Obsidian plugin (esbuild bundle) with
│                           four product modules sharing the SDK (§15 "modular
│                           components of one plugin suite"):
│                           core (reader view + lenses), social (annotations,
│                           highlights, groups, filters, sync), ai (connect/ask/
│                           models/budget), study (bookmarks, trails, flashcards)
├── server/                 ONE Fastify app + ONE relational DB (better-sqlite3
│                           by default; DATABASE_URL→Postgres for hosted):
│                           auth (invite-claim + device tokens), groups/invites,
│                           annotations with SERVER-SIDE visibility enforcement,
│                           idempotent sync push/pull, audit log, rate limiting,
│                           export, admin
└── docs/                   README, PRIVACY, SECURITY, SYNC, AI-PROVIDERS, …
```

One plugin (not four) because install/onboarding on phones must be one
toggle; internal module boundaries + the SDK keep the §15 separation real.

## Identity & auth (§35)

Family-first, zero-developer-help, zero-external-provider-registration:
**invite-claim auth**. The owner (first user, created at server init) mints
invite codes; a family member types the code on their device → account is
created (or an existing account is claimed on a new device) → the device
receives a long-lived, rotatable **device token** (stored device-locally,
never in the vault). Google/Apple/email-magic-link are provider adapters
behind the same session layer, enabled later by configuring provider keys
(documented; they require external app registration the developer performs
once). AI identity/billing is entirely separate (§28): OpenRouter PKCE per
user, key held device-local.

## Annotations (§5-§9, §38-39)

One generic annotation model (highlight | note | question | bookmark |
reaction | study-marker), anchored by stable IDs:
`verse:alma-36-18` (+ optional `start_offset/end_offset/selected_text/
text_hash` for partial-verse), `node:<sg-id>` for non-scripture notes (the
engine now writes `sg-id` frontmatter into topic/person/place/evidence/
question notes so renames never orphan anchors). Visibility:
`local | private | group:<id> | public`; local never leaves the device;
everything else syncs through the backend which enforces scope in SQL.

## Sync (§12, §46)

Write → LocalStore immediately (status `pending_sync`) → durable op queue →
`POST /sync/push` (batch, idempotent by client-generated `op_id`) →
authoritative echo. Pull by per-user cursor with tombstones. Conflict rule:
higher server version wins the record, but the losing text is preserved as a
`conflict_copy` annotation — user text is never silently discarded.

## AI (§24-34)

OpenRouter PKCE (S256) with `obsidian://scripture-graph` callback (works on
desktop + mobile) — the resulting user-scoped key lives in device-local
storage only. Model registry fetched live → friendly tiers (Auto / Fast &
Cheap / Deep Research / Highest Quality / Cheapest / specific) + task-based
routing. Budget: local monthly accounting from response usage + configurable
hard cap that stops new requests; OpenRouter key-status endpoint shown for
ground truth. BYOK adapters (OpenAI/Anthropic/Google) behind Advanced.
Context assembly is retrieval-first from the local vault (chapter text +
study guide sections + linked related/evidence notes + optional personal
annotations), with Focused/Balanced/Deep depth presets; answers cite
`[[wikilinks]]` back into the graph.

## Boundaries enforced in code (§65)

- Highlights/notes never write into canonical or any vault Markdown.
- Private data never enters vault files or plugin data.json.
- Server never returns rows the requester isn't authorized to see (SQL-level
  scoping + tests + security review).
- No master AI key anywhere; AI optional.
- Plugin uses only mobile-safe APIs (no Node/Electron imports).
- The phone never runs the research engine.
