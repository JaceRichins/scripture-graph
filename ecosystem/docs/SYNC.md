# Sync

Local-first. The device store is the source of truth for your own data; the
backend is the meeting point for shared data.

## Write path

1. Every save writes the annotation to the device store immediately (UI never
   waits on the network).
2. Unless `visibility='local'` (device-only never syncs), an op is appended to
   the pending queue: `{op_id (uuid), kind: upsert_annotation |
   delete_annotation, annotation, base_version, queued_at}`.
3. The queue is flushed on start, every 60 s, and shortly after each write.
   The queue lives in the device store, so **restarting Obsidian offline loses
   nothing** — ops wait until the server is reachable.

## Idempotency

`op_id` is the server's idempotency key. Replaying the same op returns
`duplicate` and changes nothing, so flaky networks + retries are safe.

## Conflicts (rare by design — you mostly edit your own things)

Push carries `base_version` (the server version the client last saw; 0 = new).
If the server row is newer, the result is `conflict` with the server's row:

- the server's version becomes the record (server wins),
- the losing local text is preserved as a **private conflict copy** annotation
  ("⚠ Conflict copy (kept so nothing is lost):") — no user text is ever
  silently discarded (§12).

## Deletes

Soft deletes (tombstones): `deleted_at` set, content cleared. Tombstones flow
through `sync/pull` so other devices remove their copies. Annotation history
rows (`annotation_versions`) record each accepted change for audit.

## Pull

`GET /sync/pull?cursor=…` returns everything visible to you changed since the
cursor (your own + shared, tombstones included) plus `next_cursor`. The
social layer additionally uses `POST /annotations/query` for the anchors on
the open chapter.

## What never syncs

- `visibility='local'` annotations (also rejected server-side if pushed).
- Device state: tokens, AI keys, scope toggles, budget ledger.
- Obsidian Sync (the vault) and this system are independent channels; the
  plugin's `data.json` (server URL + defaults) is the only plugin file that
  rides Obsidian Sync, and it holds no secrets.
