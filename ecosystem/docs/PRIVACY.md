# Privacy model

This is the load-bearing design of the whole ecosystem. Everything else bends
around these rules.

## The three data categories (never mixed)

**A. Shared knowledge** — the vault's Markdown (`AI Library/`, `Library/`).
Synced by Obsidian Sync to every family device. Anything here is readable by
everyone in the vault, so nothing personal-by-default is ever written here by
the plugin.

**B. Personal user data** — highlights, notes, bookmarks, flashcards, study
trails metadata, device tokens, AI keys, budget ledger. Never Markdown in the
shared vault. Lives in:
- the plugin's **device store** (`localStorage`, namespaced `sg:{appId}`) —
  per-device, never synced by Obsidian Sync;
- the **backend database** — scoped to your account, enforced in SQL.

Exception, on purpose: when YOU click "Save as note" (AI answers) or "Save
study trail" or "Export my data", the plugin writes into `Library/…` — your
personal folder — because you asked it to. The vault is shared with your
family, and that's the visibility you chose by saving there.

**C. Social data** — accounts, groups, memberships, shared annotations,
invites, audit log. Backend only.

## Two private modes

| Mode | Icon | Where it lives | Who can ever see it |
|---|---|---|---|
| Device-only | 🔒 | this device's local store, never uploaded anywhere | you, on this device |
| Only me (synced) | 🔐 | backend, `visibility='private'` | you, on your signed-in devices |

`local` is rejected by the server if a client ever tries to push it
(`sync/push` returns `rejected`) — belt and suspenders.

## Visibility levels

`local` → `private` → `group` (named group members) → `public` (everyone on
this backend). Enforced **server-side** in one SQL fragment (`VISIBLE_SQL` in
`server/src/app.ts`) used by every read path — never by UI filtering. Changing
visibility is audited (`annotation.visibility_changed`).

## What the plugin's shared file contains

`.obsidian/plugins/scripture-graph/data.json` syncs to every vault user **by
design** and contains only: `serverUrl`, `defaultVisibility`,
`forceLibraryPreview`. No tokens, no keys, no user content. Everything secret
is in the device store.

## Hard rules (§65)

- Highlights are decorations rendered over canonical scripture; canonical
  files are never modified.
- No private files hidden in the shared vault.
- The AI never rewrites user-authored notes; "let AI read my private notes"
  is off by default and read-only when on.
- The owner/admin sees content-free counters only (`/admin/overview`), never
  other users' notes. There is deliberately no admin read path to content.
- Export (`/export` + the in-plugin exporter) returns your own data only.
- Account delete purges annotation content and versions, revokes devices,
  and removes memberships.
