/** 🔗 Verse connections — the whole point of a connected scripture project,
 * made visible while reading.
 *
 * The engine (and the family's own pages) cite verses by their permanent
 * block anchors ("[[Alma 36#^alma-36-18]]"). This module indexes those
 * citations per verse from the vault's resolved links, hangs a quiet ⇄ chip
 * on every connected verse, and opens a sheet showing WHO cites it and WHAT
 * they say — evidence dossiers, gospel topics, study guides, other chapters'
 * pages, and your own notes. Annotated mirror pages (which embed every verse)
 * and system docs are excluded as noise. */
import { App, Modal, TFile } from "obsidian";
import { verseDisplay } from "@scripture-graph/core-sdk";
import { SGState } from "../state";

export interface VerseConnection {
  path: string;
  name: string;
  emoji: string;
  rank: number;
}

const EXCLUDED_PREFIXES = [
  "AI Library/00 System/",
  "AI Library/01 Scriptures/Annotated/",
  "AI Library/01 Scriptures/Canonical/",
];

const SECTIONS: [string, string, number][] = [
  ["AI Library/40 Evidence/", "🔎", 1],
  ["AI Library/02 Gospel Topics/", "🏷️", 2],
  ["AI Library/01 Scriptures/Study Guides/", "🧠", 3],
  ["AI Library/03 People/", "🧑", 4],
  ["AI Library/04 Places/", "🗺️", 4],
  ["AI Library/05 Events/", "📅", 4],
  ["AI Library/06 Doctrines/", "📜", 4],
  ["AI Library/10 General Conference/", "🎤", 5],
  ["AI Library/65 Secondary Sources/", "🎙️", 5],
  ["AI Library/30 Church History/", "🏛️", 5],
  ["AI Library/20 Joseph Smith Papers/", "📄", 5],
  ["AI Library/50 Questions/", "❓", 6],
  ["AI Library/60 Scholarship/", "🎓", 6],
  ["Library/", "✍️", 0],
];

function sectionFor(path: string): { emoji: string; rank: number } {
  for (const [prefix, emoji, rank] of SECTIONS) {
    if (path.startsWith(prefix)) return { emoji, rank };
  }
  return { emoji: "🔗", rank: 7 };
}

/** verse-id → citing pages for one chapter; cached briefly because the
 * post-processor re-runs freely while reading */
const cache = new Map<string, { at: number; map: Map<string, VerseConnection[]> }>();

export function connectionsFor(app: App, chapterPath: string, slug: string): Map<string, VerseConnection[]> {
  const hit = cache.get(chapterPath);
  if (hit && Date.now() - hit.at < 60_000) return hit.map;
  const map = new Map<string, VerseConnection[]>();
  const anchorRe = new RegExp(`#\\^(${slug}-\\d+)$`);
  const resolved = app.metadataCache.resolvedLinks;
  for (const src of Object.keys(resolved)) {
    if (!resolved[src]?.[chapterPath]) continue;
    if (src === chapterPath) continue;
    if (EXCLUDED_PREFIXES.some(p => src.startsWith(p))) continue;
    const f = app.vault.getAbstractFileByPath(src);
    if (!(f instanceof TFile)) continue;
    const fc = app.metadataCache.getFileCache(f);
    const seen = new Set<string>();
    for (const l of [...(fc?.links ?? []), ...(fc?.embeds ?? [])]) {
      const m = anchorRe.exec(l.link.trim());
      if (!m) continue;
      const verseId = m[1]!;
      if (seen.has(verseId)) continue;   // one row per page per verse
      seen.add(verseId);
      const { emoji, rank } = sectionFor(src);
      const list = map.get(verseId) ?? [];
      list.push({ path: src, name: f.basename, emoji, rank });
      map.set(verseId, list);
    }
  }
  for (const list of map.values()) list.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  cache.set(chapterPath, { at: Date.now(), map });
  return map;
}

/** the line a page says about this verse, stripped down to plain words */
export async function snippetFor(app: App, conn: VerseConnection, verseId: string): Promise<string | null> {
  const f = app.vault.getAbstractFileByPath(conn.path);
  if (!(f instanceof TFile)) return null;
  try {
    const text = await app.vault.cachedRead(f);
    const line = text.split("\n").find(ln => ln.includes(`#^${verseId}`));
    if (!line) return null;
    const plain = line
      .replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")  // links → their display text
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/[*_=`>#]|\[!\w+\][+-]?/g, "")
      .replace(/^\s*[-•\d.)\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (plain.length < 8) return null;
    return plain.length > 200 ? `${plain.slice(0, 197)}…` : plain;
  } catch {
    return null;
  }
}

export class ConnectionsModal extends Modal {
  constructor(
    private s: SGState,
    private verseId: string,
    private conns: VerseConnection[],
    private openGraph: () => void,
  ) {
    super(s.app);
  }

  onOpen(): void {
    const c = this.contentEl;
    this.modalEl.addClass("sg-conn-modal");
    c.addClass("sg-conn");
    c.createEl("h3", {
      cls: "sg-conn-title",
      text: `⇄ ${verseDisplay(this.verseId) ?? this.verseId}`,
    });
    c.createDiv({
      cls: "sg-conn-sub",
      text: `${this.conns.length} page${this.conns.length === 1 ? "" : "s"} in your library cite this verse`,
    });
    const list = c.createDiv({ cls: "sg-conn-list" });
    for (const conn of this.conns.slice(0, 14)) {
      const row = list.createDiv({ cls: "sg-conn-row" });
      const head = row.createDiv({ cls: "sg-conn-row-head" });
      head.createSpan({ cls: "sg-conn-emoji", text: conn.emoji });
      head.createSpan({ cls: "sg-conn-name", text: conn.name });
      const snip = row.createDiv({ cls: "sg-conn-snippet", text: "…" });
      void snippetFor(this.s.app, conn, this.verseId).then(t => {
        if (t) snip.setText(t);
        else snip.remove();
      });
      row.onclick = () => {
        this.close();
        const f = this.s.app.vault.getAbstractFileByPath(conn.path);
        if (f instanceof TFile) void this.s.app.workspace.getLeaf().openFile(f);
      };
    }
    if (this.conns.length > 14) {
      list.createDiv({ cls: "sg-conn-more", text: `…and ${this.conns.length - 14} more in the graph` });
    }
    const foot = c.createEl("button", { cls: "sg-conn-graph", text: "🕸 See the whole connection graph" });
    foot.onclick = () => { this.close(); this.openGraph(); };
  }

  onClose(): void { this.contentEl.empty(); }
}
