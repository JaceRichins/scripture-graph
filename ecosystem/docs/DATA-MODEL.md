# Data model

Canonical schemas live in `packages/core-sdk/src/schemas.ts` (zod — validated
at every boundary). The server DDL lives in `server/src/db.ts`.

## Identifiers & anchors

- Verse anchor = the vault's permanent block ID: `alma-36-18`
  (`{book-slug}-{chapter}-{verse}`; 88 books incl. Official Declarations,
  generated into the SDK as `books.json` from the Python engine).
- Chapter anchor: `alma-36`. Node anchor: the page's `sg-id` frontmatter
  (`topic:faith`, `evidence:chiasmus`), stamped by the engine so renames never
  break annotations (§39).
- Partial-verse highlights: `selected_text` + `start_offset`/`end_offset` +
  FNV-1a `text_hash` of the verse text at anchor time. Offsets are
  authoritative while the hash matches (canonical text is immutable, so a
  mismatch means corruption, detectable); otherwise a text-search fallback
  renders the mark. **Never line numbers.**

## Annotation (the one shared record type)

```
annotation_id uuid · author_user_id · anchor_type verse|chapter|node ·
anchor_id · annotation_type highlight|note|bookmark|study-marker ·
selected_text? start_offset? end_offset? text_hash? ·
content · color? · visibility local|private|group|public · group_id? ·
created_at · updated_at · deleted_at? · version (int, server-incremented)
```

Flashcards are `study-marker` annotations whose `content` is JSON
(`{front, back, card:{ease,intervalDays,due,reps}}`). Bookmarks are
`bookmark` annotations. One record type keeps sync/permissions uniform.

## Server tables (SQLite, Postgres-compatible columns)

| Table | Purpose |
|---|---|
| `users` | user_id, display_name, role (`owner`/`member`), created_at, deleted_at |
| `devices` | device_id, user_id, name, token_hash (sha256), created_at, last_seen_at, revoked_at |
| `groups` | group_id, name, owner_user_id |
| `group_memberships` | (group_id, user_id), role `admin`/`member` |
| `invites` | code_hash, kind `account`/`group`/`device`, group_id?, max_uses, uses, expires_at, created_by |
| `annotations` | the record above + server `version` |
| `annotation_versions` | append-only history of accepted changes |
| `sync_ops` | op_id → result (idempotency ledger) |
| `audit_events` | actor, action, entity, entity_id, detail, at |

## SyncOp / SyncPushResult

```
SyncOp:        op_id uuid · kind upsert_annotation|delete_annotation ·
               annotation · base_version int (0 = new) · queued_at
SyncPushResult: op_id · status applied|duplicate|conflict|rejected ·
               server_annotation? · reason?
```

## Device store keys (plugin, localStorage `sg:{appId}`)

- `device` — DeviceState (token, userId, displayName, openrouterKey, aiTier,
  aiSpecificModel, aiUsePersonalNotes, showScopes, aiDepth)
- `ann:{annotation_id}` — local annotation records
- `q:{op_id}` — pending sync ops
- `budget` — monthly AI ledger `{month, spentUsd, capUsd}`
- `model_registry` — 24 h cache of OpenRouter models
- `migrated_v02_annotate`, `welcome_shown` — one-time flags

## Moving to Postgres

Column types were chosen to port directly (TEXT/INTEGER/ISO-8601 strings).
Swap `better-sqlite3` for `pg` behind the same prepared-statement call sites;
`VISIBLE_SQL` and all queries are standard SQL.
