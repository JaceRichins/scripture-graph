---
ownership: system
mutable: user
content_type: system-doc
---
# Study Tools — highlights, notes, and protection

## One-time setup (10 seconds)

Obsidian ships with community plugins off. Go to **Settings → Community
plugins → Turn on community plugins**. The bundled **Scripture Graph
Annotate** plugin is pre-enabled after that — no install needed.

## Highlighting a verse

In any scripture view (plain chapter, **(Annotated)**, or the embedded text
inside your *My Notes* page), in **reading view**:

1. Select the words you want (or select nothing to mark the whole verse).
2. **Right-click** → *Highlight yellow / green / blue / pink / orange*.
3. The highlight appears instantly, everywhere that verse is shown.

*Remove:* right-click the verse → *Remove highlights on this verse*.

## Adding a verse note

Right-click on a verse → **Add verse note** → type → Save. The note is
written into that chapter's **My Notes** file under *Verse Notes*, with a
clickable link back to the exact verse (and your selected words quoted). A
📝 marker appears at the verse; click it to jump to your notes.

## Where your marks live (and why that's safe)

Highlights are a **personal overlay** (`.obsidian/plugins/
scripture-graph-annotate/data.json`) applied at render time; notes are plain
Markdown in `80 Personal Notes`. The canonical scripture files are **never
modified** — which is why your marks survive every engine regeneration, and
why the scripture text can be trusted byte-for-byte.

## Why you can't lose scripture text

Four independent guards:

1. Canonical files carry the Windows **read-only attribute** — Obsidian
   refuses to save edits to them.
2. The plugin **warns instantly** if a canonical file is modified or deleted.
3. The engine **verifies every canonical file's hash and auto-restores** any
   damage — on every 30-minute study tick, so the maximum damage window is
   about half an hour (or run `scripturegraph validate --repair` for now).
4. **Git history** keeps every prior state of everything.

Read in **reading view** (pencil/book icon top-right of a pane toggles it);
editing view on canonical files will refuse to save by design.

## Syncing to your phone

Sync ONLY the vault folder (`Scripture Graph`), never the repo root, and
exclude `.scripture-engine` (machine-local database/logs).

**Recommended — Obsidian Sync** (official, end-to-end encrypted, iOS+Android):
PC: Settings → Sync → set up a remote vault → in Sync options enable
*Installed community plugins*, *Vault configuration*, and *Appearance
settings*; add `.scripture-engine` to *Excluded folders*; leave *Sync all
other types* off. Phone: install Obsidian → sign in → *Connect to remote
vault* → let the first sync finish → turn on community plugins (per-device)
→ done. Highlights, notes, and settings flow both ways.

**Free alternative — Syncthing** (Android; iPhone via Möbius Sync): share
the `Scripture Graph` folder between devices; add ignore patterns for
`.scripture-engine` and `.obsidian/workspace*`.

On the phone use **select text → command palette / toolbar → "Highlight
selection"** (add the highlight + note commands to the mobile toolbar under
Settings → Toolbar). The engine runs only on the PC; anything the phone
breaks in canonical text is auto-restored on the next study tick and syncs
back fixed.
