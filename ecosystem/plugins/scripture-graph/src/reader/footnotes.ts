/** ᵃ Footnotes on the verse — the official study apparatus, read from the
 * engine's per-chapter footnote note (`<Chapter> - Footnotes`), shown as a
 * small superscript chip after the verse. Tap: a sheet with each marker and
 * its references; tap a reference and it peeks the way every verse link
 * does; tap the chapter name to travel. */
import { App, Modal, TFile } from "obsidian";
import { SGState } from "../state";

export interface FootnoteRef { c: string | null; t: string | null; v: number[]; l: string }
export interface Footnote { m: string; refs: FootnoteRef[]; x?: string }
export type ChapterFootnotes = Record<string, Footnote[]>;

const cache = new Map<string, Promise<ChapterFootnotes | null>>();

/** the chapter's footnotes, cached per session; null when the engine has
 * not written the note yet */
export function footnotesFor(app: App, chapterTitle: string): Promise<ChapterFootnotes | null> {
  let p = cache.get(chapterTitle);
  if (!p) {
    p = (async () => {
      const f = app.metadataCache.getFirstLinkpathDest(`${chapterTitle} - Footnotes`, "");
      if (!(f instanceof TFile)) return null;
      try {
        const raw = await app.vault.cachedRead(f);
        const m = /```json\s*([\s\S]*?)```/.exec(raw);
        return m ? (JSON.parse(m[1]!) as ChapterFootnotes) : null;
      } catch { return null; }
    })();
    cache.set(chapterTitle, p);
  }
  return p;
}

export function clearFootnoteCache(): void { cache.clear(); }

/** the sheet: markers down the page, references as tappable chips */
export class FootnotesModal extends Modal {
  constructor(private s: SGState, private chapterTitle: string, private verse: string,
    private notes: Footnote[], private sourcePath: string) {
    super(s.app);
  }

  onOpen(): void {
    this.modalEl.addClass("sg-lib-modal");
    const c = this.contentEl;
    c.addClass("sg-fn");
    c.createEl("h2", { cls: "sg-fn-title", text: `${this.chapterTitle}:${this.verse}` });
    c.createDiv({ cls: "sg-fn-sub", text: "Footnotes" });
    for (const n of this.notes) {
      const row = c.createDiv({ cls: "sg-fn-row" });
      row.createSpan({ cls: "sg-fn-marker", text: n.m.replace(/^\d+/, "") || n.m });
      const body = row.createDiv({ cls: "sg-fn-body" });
      if (n.x) body.createDiv({ cls: "sg-fn-text", text: n.x });
      const chips = body.createDiv({ cls: "sg-fn-refs" });
      for (const r of n.refs) {
        const chip = chips.createEl("button", { cls: "sg-fn-ref", text: r.l || (r.t ?? "") });
        if (r.t && r.c && r.v.length) {
          chip.onclick = () => {
            // the wrapper peeks a verse anchor; the chapter itself travels
            void this.s.app.workspace.openLinkText(`${r.t}#^${r.c}-${r.v[0]}`, this.sourcePath);
          };
        } else {
          chip.addClass("sg-fn-ref-plain");
        }
      }
    }
  }

  onClose(): void { this.contentEl.empty(); }
}
