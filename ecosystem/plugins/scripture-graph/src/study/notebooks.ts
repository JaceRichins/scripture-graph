/** 📓 Notebooks — the study journal, organised by theme.
 *
 * GL's notebooks are folders you file notes into. Here the filing already
 * happened: every highlight carries a theme (Faith, Covenant, Testimony …),
 * every note sits on a verse or a page. A notebook is one theme's entries
 * across the whole canon — the verse, your words, and a tap back to the
 * place — plus a "Notes" notebook for everything you wrote and a "Marks"
 * one for plain highlights. Nothing new to maintain; a new way to read what
 * you already kept. */
import { App, Modal } from "obsidian";
import type { Annotation } from "@scripture-graph/core-sdk";
import { verseDisplay } from "@scripture-graph/core-sdk";
import { SGState } from "../state";
import { buildSearchIndex, searchIndexReady } from "./search";
import { THEME_LIBRARY, themeSpec } from "./themeLibrary";
import { COLOR_HEX } from "../social/annotations";

export interface Notebook { key: string; title: string; emoji: string; hex: string; entries: Annotation[] }

/** the notebooks, from my live annotations */
export async function notebooks(s: SGState): Promise<Notebook[]> {
  const all = (await s.sync.allAnnotations()).filter(a => !a.deleted_at);
  const customs = (s.settings.themes ?? [])
    .filter(t => !THEME_LIBRARY.some(l => l.name.toLowerCase() === t.name.toLowerCase()))
    .map(t => themeSpec(t.name, s.settings.themes ?? [], COLOR_HEX));
  const specs = [...THEME_LIBRARY, ...customs];
  const out: Notebook[] = [];
  for (const sp of specs) {
    const entries = all.filter(a => a.theme?.toLowerCase() === sp.name.toLowerCase());
    if (entries.length) out.push({ key: `theme:${sp.name}`, title: sp.name, emoji: sp.emoji, hex: sp.c1, entries });
  }
  const notes = all.filter(a => a.annotation_type === "note" && a.content.trim());
  if (notes.length) out.unshift({ key: "notes", title: "Notes", emoji: "📝", hex: "#e9c46a", entries: notes });
  const marks = all.filter(a => a.annotation_type === "highlight" && !a.theme);
  if (marks.length) out.push({ key: "marks", title: "Highlights", emoji: "🖍", hex: "#f5d90a", entries: marks });
  return out;
}

export class NotebookModal extends Modal {
  constructor(private s: SGState, private nb: Notebook, private openLink: (link: string) => void) { super(s.app); }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("sg-lib-modal");
    const c = this.contentEl;
    c.addClass("sg-nb");
    c.createEl("h2", { cls: "sg-nb-title", text: `${this.nb.emoji} ${this.nb.title}` });
    c.createDiv({ cls: "sg-nb-sub", text: `${this.nb.entries.length} entr${this.nb.entries.length === 1 ? "y" : "ies"}` });
    const list = c.createDiv({ cls: "sg-nb-list" });
    const prog = list.createDiv({ cls: "sg-nav-progress", text: searchIndexReady() ? "" : "Reading the scriptures…" });
    const index = await buildSearchIndex(this.s.app);
    prog.remove();
    const byAnchor = new Map(index.verses.map(v => [v.anchor, v]));
    const sorted = [...this.nb.entries].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    for (const a of sorted) {
      const v = byAnchor.get(a.anchor_id);
      const row = list.createDiv({ cls: "sg-nb-entry" });
      row.setAttr("role", "button");
      row.setAttr("tabindex", "0");
      row.style.borderLeftColor = a.color && COLOR_HEX[a.color] ? COLOR_HEX[a.color]! : this.nb.hex;
      const ref = v ? `${v.chapter}:${v.verse}` : (verseDisplay(a.anchor_id) ?? a.anchor_id.replace(/^node:/, ""));
      row.createDiv({ cls: "sg-nb-ref", text: ref });
      const quoted = a.selected_text || v?.text;
      if (quoted) row.createDiv({ cls: "sg-nb-verse", text: quoted.length > 260 ? quoted.slice(0, 257) + "…" : quoted });
      if (a.content.trim() && !a.content.startsWith("Bookmark: ")) row.createDiv({ cls: "sg-nb-note", text: a.content.trim() });
      row.createDiv({ cls: "sg-nb-when", text: new Date(a.updated_at).toLocaleDateString() });
      const go = () => {
        this.close();
        if (v) this.openLink(`${v.chapter}#^${v.anchor}`);
        else if (a.anchor_id.startsWith("node:")) this.openLink(a.anchor_id.slice(5));
        else this.openLink(a.anchor_id);
      };
      row.onclick = go;
      row.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    }
  }

  onClose(): void { this.contentEl.empty(); }
}

/** the whole journal as a note you can keep: one Markdown page, by theme */
export async function exportJournal(app: App, s: SGState): Promise<string> {
  const nbs = await notebooks(s);
  const index = await buildSearchIndex(app);
  const byAnchor = new Map(index.verses.map(v => [v.anchor, v]));
  const lines = ["# Study journal", "", `Exported ${new Date().toLocaleDateString()}.`, ""];
  for (const nb of nbs) {
    lines.push(`## ${nb.emoji} ${nb.title}`, "");
    for (const a of nb.entries) {
      const v = byAnchor.get(a.anchor_id);
      const ref = v ? `[[${v.chapter}#^${v.anchor}|${v.chapter}:${v.verse}]]` : a.anchor_id;
      lines.push(`- ${ref}` + (a.selected_text ? ` — "${a.selected_text}"` : "") + (a.content.trim() ? `\n  ${a.content.trim()}` : ""));
    }
    lines.push("");
  }
  return lines.join("\n");
}
