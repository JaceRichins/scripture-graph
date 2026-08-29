/** The purpose-built chapter reader (§16): canonical text + lenses over the
 * study guide + social layer + Ask AI — one clean, mobile-friendly surface. */
import { ItemView, MarkdownRenderer, Menu, TFile, WorkspaceLeaf } from "obsidian";
import {
  chapterIdFromTitle, parseCanonicalVerses, parseFrontmatter, sectionIsEmpty, sections,
} from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, SGState } from "../state";
import { AnnotationService, decorateVerse } from "../social/annotations";

export const READER_VIEW = "scripture-graph-reader";

const LENSES: { key: string; icon: string; label: string; sections: string[] }[] = [
  { key: "doctrine", icon: "📖", label: "Doctrine", sections: ["overview", "doctrines", "topics"] },
  { key: "history", icon: "🏺", label: "History", sections: ["structure", "history"] },
  { key: "language", icon: "א", label: "Language", sections: ["language"] },
  { key: "literary", icon: "🔀", label: "Literary", sections: ["literary"] },
  { key: "evidence", icon: "🔬", label: "Evidence", sections: ["evidence"] },
  { key: "conference", icon: "🎙", label: "Conference", sections: ["conference"] },
  { key: "related", icon: "🔗", label: "Related", sections: ["related-scriptures"] },
  { key: "media", icon: "🎧", label: "Media", sections: ["secondary-sources"] },
  { key: "questions", icon: "❓", label: "Questions", sections: ["questions", "further-study"] },
];

export class ReaderView extends ItemView {
  private chapterTitle: string | null = null;
  private activeLenses = new Set<string>(["doctrine", "related"]);
  private familyLens = true;

  constructor(leaf: WorkspaceLeaf, private s: SGState, private ann: AnnotationService,
    private openAsk: (chapter: string | null, verse: string | null, seed?: string) => void) {
    super(leaf);
  }

  getViewType() { return READER_VIEW; }
  getDisplayText() { return this.chapterTitle ?? "Scripture Graph"; }
  getIcon() { return "book-open"; }

  async setChapter(title: string) {
    this.chapterTitle = title;
    await this.render();
  }

  async onOpen() {
    this.contentEl.addClass("sg-reader");
    // taps + right-clicks are handled by the plugin-wide StudyBar/context menu
    this.s.onChange.push(() => void this.render());
    if (this.chapterTitle) await this.render();
    else this.contentEl.createEl("p", { text: "Open a chapter with “Open in Scripture Graph reader”." });
  }

  private canonicalFile(): TFile | null {
    if (!this.chapterTitle) return null;
    const f = this.app.metadataCache.getFirstLinkpathDest(this.chapterTitle, "");
    return f && f.path.startsWith(CANONICAL_PREFIX) ? f : null;
  }

  private async render() {
    const root = this.contentEl;
    root.empty();
    const file = this.canonicalFile();
    if (!file || !this.chapterTitle) return;
    const raw = await this.app.vault.cachedRead(file);
    const { frontmatter, body } = parseFrontmatter(raw);
    const slug = String(frontmatter["slug"] ?? chapterIdFromTitle(this.chapterTitle) ?? "");
    const verses = parseCanonicalVerses(body);

    // ---- top bar ----
    const bar = root.createDiv({ cls: "sg-reader-bar" });
    bar.createEl("h2", { text: this.chapterTitle });
    const graphBtn = bar.createEl("button", { cls: "sg-ask-btn", text: "🕸" });
    graphBtn.setAttribute("aria-label", "Connections graph");
    graphBtn.onclick = () => {
      void import("../study/studyBar").then(m =>
        m.openLocalGraphFor(this.s, this.chapterTitle));
    };
    const myBtn = bar.createEl("button", { cls: "sg-ask-btn", text: "✏️ My notes" });
    myBtn.onclick = () => {
      const companion = `${this.chapterTitle} - My Notes`;
      if (this.app.metadataCache.getFirstLinkpathDest(companion, "")) {
        void this.app.workspace.openLinkText(companion, "");
      }
    };
    const askBtn = bar.createEl("button", { cls: "sg-ask-btn", text: "✨ Ask AI" });
    askBtn.onclick = () => this.openAsk(this.chapterTitle, null);

    const lensBar = root.createDiv({ cls: "sg-lens-bar" });
    for (const l of LENSES) {
      const b = lensBar.createEl("button", {
        cls: `sg-lens ${this.activeLenses.has(l.key) ? "on" : ""}`,
        text: `${l.icon} ${l.label}`,
      });
      b.onclick = () => {
        this.activeLenses.has(l.key) ? this.activeLenses.delete(l.key) : this.activeLenses.add(l.key);
        void this.render();
      };
    }
    const fam = lensBar.createEl("button", {
      cls: `sg-lens ${this.familyLens ? "on" : ""}`, text: "👥 Family",
    });
    fam.onclick = () => { this.familyLens = !this.familyLens; void this.render(); };

    // ---- scripture ----
    const scriptureEl = root.createDiv({ cls: "sg-reader-scripture" });
    const anchors: string[] = [];
    for (const v of verses) {
      anchors.push(v.verseId);
      const p = scriptureEl.createEl("p", { attr: { "data-verse-id": v.verseId } });
      p.createEl("strong", { text: String(v.verse) });
      p.appendText(" " + v.text);
      const mine = await this.ann.mine(v.verseId);
      const social = this.familyLens ? this.ann.social(v.verseId) : [];
      decorateVerse(this.s, this.ann, p, v.verseId, mine, social);
    }
    void this.ann.refreshSocial(anchors);

    // ---- lens sections from the study guide ----
    const guide = this.app.metadataCache.getFirstLinkpathDest(
      `${this.chapterTitle} - Study Guide`, "");
    if (guide) {
      const gBody = parseFrontmatter(await this.app.vault.cachedRead(guide)).body;
      const secs = sections(gBody);
      const secWrap = root.createDiv({ cls: "sg-reader-sections" });
      for (const l of LENSES) {
        if (!this.activeLenses.has(l.key)) continue;
        for (const name of l.sections) {
          const content = secs[name];
          if (sectionIsEmpty(content)) continue;
          const box = secWrap.createEl("details", { cls: "sg-section", attr: { open: "" } });
          box.createEl("summary", { text: `${l.icon} ${pretty(name)}` });
          const bodyEl = box.createDiv();
          await MarkdownRenderer.render(this.app, content!, bodyEl,
            `${CANONICAL_PREFIX}x.md`, this);
        }
      }
    }
  }
}

function pretty(section: string): string {
  return section.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
