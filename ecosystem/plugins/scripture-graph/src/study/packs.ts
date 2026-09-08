/** The packs: per-book notes the engine writes with the per-chapter
 * apparatus inside (footnotes, cross references, citations), so a phone
 * carries ~270 files instead of ~5,000. Each pack is one JSON block keyed
 * by chapter slug. Read once per book, then kept warm. */
import { App, TFile } from "obsidian";
import { BOOKS } from "@scripture-graph/core-sdk";

export type PackKind = "Footnotes" | "Cross References" | "Citations";

const packs = new Map<string, Promise<Record<string, unknown> | null>>();

function bookNameFor(chapterSlug: string): string | null {
  const bookSlug = chapterSlug.slice(0, chapterSlug.lastIndexOf("-"));
  return BOOKS.find(b => b.slug === bookSlug)?.name ?? null;
}

/** the pack note for a book and kind, parsed (null when the vault has none) */
function pack(app: App, bookName: string, kind: PackKind): Promise<Record<string, unknown> | null> {
  const key = `${kind}:${bookName}`;
  let p = packs.get(key);
  if (!p) {
    p = (async () => {
      const f = app.metadataCache.getFirstLinkpathDest(`${bookName} — ${kind} Pack`, "");
      if (!(f instanceof TFile)) return null;
      try {
        const raw = await app.vault.cachedRead(f);
        const m = /```json\s*([\s\S]*?)```/.exec(raw);
        return m ? (JSON.parse(m[1]!) as Record<string, unknown>) : null;
      } catch { return null; }
    })();
    packs.set(key, p);
    // a pack that isn't there yet (first sync still running) is asked for again later
    void p.then(v => { if (v === null) packs.delete(key); });
  }
  return p;
}

/** one chapter's entry from its book's pack */
export async function packChapter<T>(app: App, chapterSlug: string, kind: PackKind): Promise<T | null> {
  const book = bookNameFor(chapterSlug);
  if (!book) return null;
  const all = await pack(app, book, kind);
  return (all?.[chapterSlug] as T | undefined) ?? null;
}

/** the engine rewrote a pack: read it afresh */
export function clearPackCache(): void { packs.clear(); }
