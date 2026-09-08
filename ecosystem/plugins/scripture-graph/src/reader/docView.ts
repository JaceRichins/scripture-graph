/** 📄 The document page — hard questions and conference talks open as their
 * OWN page, not as a floating sheet.
 *
 * The library sheet (libraryPreview) exists so that a topic or a person can
 * be glanced at without leaving the chapter being read. A hard question or a
 * talk is not a glance: it is the thing being read. On a phone the sheet
 * rendered it as a form-like scroll of plain text with no structure. This
 * view gives it the reader's treatment: a titled page, each `##` section as
 * its own block, an eyebrow that says what kind of page it is, the study
 * themes (Faith, Doubt, Testimony …) applied to the page as a whole, and the
 * same link rules as everywhere else — scripture links travel, verse links
 * peek, other library pages float. */
import { ItemView, MarkdownRenderer, Notice, Platform, TFile, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { LIBRARY_PREFIX, SGState } from "../state";
import { AnnotationService, COLOR_HEX } from "../social/annotations";
import { THEME_LIBRARY, themeSpec, type ThemeSpec } from "../study/themeLibrary";
import { historyBack, recordHistory } from "../study/leafNav";
import { youtubeIdOf } from "../study/youtubeFind";
import { trace } from "../study/trace";

export const DOC_VIEW = "scripture-graph-doc";

/** folders whose pages are reading surfaces of their own (the folder MOC
 * page itself — "Questions", "General Conference" — stays a sheet) */
const DOC_KINDS: { prefix: string; eyebrow: string; moc: string }[] = [
  { prefix: `${LIBRARY_PREFIX}50 Questions/`, eyebrow: "Hard question", moc: "Questions.md" },
  { prefix: `${LIBRARY_PREFIX}10 General Conference/`, eyebrow: "General Conference", moc: "General Conference.md" },
  { prefix: `${LIBRARY_PREFIX}65 Secondary Sources/`, eyebrow: "Podcasts & talks", moc: "Secondary Sources.md" },
  { prefix: `${LIBRARY_PREFIX}30 Church History/`, eyebrow: "Church History", moc: "Church History.md" },
  { prefix: `${LIBRARY_PREFIX}07 Come Follow Me/`, eyebrow: "Come, Follow Me", moc: "Come Follow Me.md" },
];

export function docKindFor(path: string): { eyebrow: string } | null {
  for (const k of DOC_KINDS) {
    if (!path.startsWith(k.prefix)) continue;
    if (path === k.prefix + k.moc) return null;
    return { eyebrow: k.eyebrow };
  }
  return null;
}

const PLACEHOLDER = /^_?Not yet developed\.?_?$/i;

export interface DocHost {
  openAsk: (seed: string) => void;
  openReading: () => void;
  bookmark: (file: TFile) => Promise<void>;
  /** the live bookmark on this file → its id, or null */
  bookmarkId: (file: TFile) => Promise<string | null>;
  unbookmark: (id: string) => Promise<void>;
  /** the Library page — the way back when the tab has no history */
  openLibrary: () => void;
  /** power users only: the raw markdown page */
  openRaw: ((file: TFile) => void) | null;
  /** play a YouTube video in the app's corner player */
  playVideo?: (id: string, title: string, sub: string) => void;
}

export class DocView extends ItemView {
  private path: string | null = null;

  constructor(leaf: WorkspaceLeaf, private s: SGState, private ann: AnnotationService,
    private host: DocHost) {
    super(leaf);
    this.navigation = true;   // a page: back-arrow aware, replaced in place
  }

  getViewType() { return DOC_VIEW; }
  getDisplayText() {
    const f = this.file();
    return f ? f.basename : "Scripture Graph";
  }
  getIcon() { return "file-text"; }

  getState(): Record<string, unknown> { return { path: this.path }; }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const p = (state as { path?: unknown } | null)?.path;
    if (typeof p === "string" && p && p !== this.path) {
      this.path = p;
      if (this.contentEl.hasClass("sg-doc")) await this.render();
    }
  }

  async onOpen() {
    this.contentEl.addClass("sg-doc");
    this.s.onChange.push(() => void this.render());
    if (this.path) await this.render();
  }

  private file(): TFile | null {
    if (!this.path) return null;
    const af = this.app.vault.getAbstractFileByPath(this.path);
    return af instanceof TFile ? af : null;
  }

  /** the page's stable graph anchor: the engine's sg-id when it has one,
   * else the path — either way one id every device agrees on */
  private anchorId(file: TFile): string {
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
    const id = fm["sg-id"];
    return typeof id === "string" && id.includes(":") ? id : `doc:${file.path}`;
  }

  private async render() {
    const root = this.contentEl;
    root.empty();
    const file = this.file();
    if (!file) { root.createEl("p", { text: "This page is not in the vault." }); return; }
    const kind = docKindFor(file.path) ?? { eyebrow: "Library" };
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
    const page = root.createDiv({ cls: "sg-doc-page" });

    // ---- head: the way back, eyebrow, title, status, actions ----
    const head = page.createDiv({ cls: "sg-doc-head" });
    const back = head.createEl("button", { cls: "sg-doc-back", text: "‹ Back" });
    back.onclick = () => {
      // the leaf's own back stack first (recordHistory fed it); the Library
      // page when there is nothing to go back to
      if (!historyBack(this.leaf)) this.host.openLibrary();
    };
    head.createDiv({ cls: "sg-doc-eyebrow", text: kind.eyebrow });
    // "And We Talk of Christ (Elder Gary E. Stevenson, April 2025)": the title
    // is the title; the parenthetical becomes pills beneath it
    const parenMatch = /^(.*\S)\s+\(([^()]+)\)$/.exec(file.basename);
    const title = parenMatch ? parenMatch[1]! : file.basename;
    head.createEl("h1", { cls: "sg-doc-title", text: title });
    const meta = head.createDiv({ cls: "sg-doc-meta" });
    const status = String(fm["status"] ?? "");
    if (status) {
      meta.createSpan({
        cls: `sg-doc-pill sg-doc-pill-${status.split(/\W/)[0]}`,
        text: status.startsWith("developed") ? "Researched dossier"
          : status.startsWith("queued") ? "In the research queue" : "Seeded answer",
      });
    }
    const pills: string[] = [];
    const speaker = typeof fm["speaker"] === "string" ? String(fm["speaker"]) : "";
    if (speaker) pills.push(speaker);
    // "April 2025" reads better as one pill than as "April" and "2025"
    const month = typeof fm["month"] === "string" ? String(fm["month"]) : "";
    const year = typeof fm["year"] === "string" || typeof fm["year"] === "number" ? String(fm["year"]) : "";
    if (month && year) pills.push(`${month} ${year}`);
    else for (const key of ["session", "month", "year", "date"]) {
      const v = fm[key];
      if (typeof v === "string" && v) pills.push(v.replace(/-/g, " "));
    }
    if (typeof fm["scope"] === "string" && fm["scope"]) pills.push(String(fm["scope"]).replace(/-/g, " "));
    // no frontmatter to speak of: the parenthetical itself, split at commas
    if (!pills.length && parenMatch) pills.push(...parenMatch[2]!.split(/,\s*/).map(x => x.trim()).filter(Boolean));
    for (const text of pills) meta.createSpan({ cls: "sg-doc-pill", text });
    // the study actions (notes, themes, Ask AI, bookmark, reading settings)
    // live on the selection bar: select any text and it rises. The head keeps
    // only what belongs to the page itself — a video to watch, the raw file.
    const anchor = this.anchorId(file);
    page.setAttr("data-sg-doc-anchor", anchor);
    page.setAttr("data-sg-doc-path", file.path);
    page.setAttr("data-sg-doc-title", title);
    const actions = head.createDiv({ cls: "sg-doc-actions" });
    // ▶ Watch — a talk, an episode, a review with a video: plays in the corner, keeps playing as you read
    void youtubeIdOf(this.app, file).then(id => {
      if (!id || !this.host.playVideo) return;
      const watch = actions.createEl("button", { cls: "sg-ask-btn sg-doc-watch", text: "▶ Watch" });
      actions.insertBefore(watch, actions.firstChild);
      watch.onclick = () => this.host.playVideo!(id, title, docKindFor(file.path)?.eyebrow ?? "Video");
    });
    if (this.host.openRaw && !Platform.isMobile) {
      const raw = actions.createEl("button", { cls: "sg-ask-btn sg-doc-raw", text: "↗" });
      raw.setAttr("aria-label", "Open the raw page");
      raw.onclick = () => this.host.openRaw!(file);
    }
    head.createDiv({ cls: "sg-doc-hint", text: "Select any text for notes, themes, and Ask AI" });

    // ---- themes: the page as a whole carries study themes (stackable) ----
    const mine = await this.ann.mine(anchor);
    const active = new Set(mine.filter(a => a.annotation_type === "highlight" && a.theme && !a.selected_text)
      .map(a => a.theme!.toLowerCase()));
    const customs = (this.s.settings.themes ?? [])
      .filter(t => !THEME_LIBRARY.some(l => l.name.toLowerCase() === t.name.toLowerCase()))
      .map(t => themeSpec(t.name, this.s.settings.themes ?? [], COLOR_HEX));
    const all: ThemeSpec[] = [...THEME_LIBRARY, ...customs];
    const worn = all.filter(t => active.has(t.name.toLowerCase()));
    if (worn.length) {
      const badges = head.createDiv({ cls: "sg-doc-badges" });
      for (const t of worn) {
        const b = badges.createSpan({ cls: "sg-doc-badge", text: `${t.emoji} ${t.name}` });
        b.style.background = `linear-gradient(135deg, ${t.c1}33, ${t.c2}33)`;
        b.style.borderColor = `${t.c1}88`;
      }
    }
    // ---- body: the page, one block per section ----
    const body = page.createDiv({ cls: "sg-doc-body markdown-rendered" });
    try {
      const md = await this.app.vault.cachedRead(file);
      const scratch = createDiv();
      await MarkdownRenderer.render(this.app, md, scratch, file.path, this);
      this.sectionize(scratch, body, file.basename);
    } catch {
      body.setText("This page could not be loaded.");
    }
    body.addEventListener("click", (evt) => this.onLinkClick(evt, file), { capture: true });
    root.scrollTop = 0;
  }

  /** the flat render becomes blocks: each `##` heading with everything
   * under it, until the next `##`; the `#` title is dropped (the head has
   * it); a placeholder-only section shows as a quiet "not yet developed" */
  private sectionize(from: HTMLElement, to: HTMLElement, title: string): void {
    let sec: HTMLElement | null = null;
    let secBody: HTMLElement | null = null;
    const nodes = Array.from(from.childNodes);
    for (const n of nodes) {
      if (!(n instanceof HTMLElement)) { (secBody ?? to).appendChild(n); continue; }
      if (n.classList.contains("frontmatter") || n.classList.contains("metadata-container")) continue;
      if (n.tagName === "H1" && (n.textContent ?? "").trim().replace(/\?$/, "") === title.replace(/\?$/, "")) continue;
      if (n.tagName === "H1" && !sec) continue;
      if (n.tagName === "H2") {
        sec = to.createDiv({ cls: "sg-doc-sec" });
        const h = sec.createEl("h2", { cls: "sg-doc-sec-h" });
        h.append(...Array.from(n.childNodes));
        secBody = sec.createDiv({ cls: "sg-doc-sec-body" });
        continue;
      }
      (secBody ?? to).appendChild(n);
    }
    // placeholder sections read as a state, not as content
    for (const b of Array.from(to.querySelectorAll<HTMLElement>(".sg-doc-sec-body"))) {
      const text = (b.textContent ?? "").trim();
      if (PLACEHOLDER.test(text)) {
        b.empty();
        b.createDiv({ cls: "sg-doc-empty", text: "Not yet developed — the research pass writes this." });
        b.parentElement?.addClass("sg-doc-sec-empty");
      }
    }
  }

  private onLinkClick(evt: MouseEvent, file: TFile): void {
    const a = (evt.target as HTMLElement).closest("a.internal-link");
    if (!(a instanceof HTMLElement)) return;
    const href = a.getAttr("data-href") ?? a.getAttr("href") ?? "";
    if (!href) return;
    evt.preventDefault();
    evt.stopPropagation();
    const base = href.split("#")[0]!.trim();
    const dest = base ? this.app.metadataCache.getFirstLinkpathDest(base, file.path) : null;
    if (!base && href.startsWith("#")) {
      // an in-page heading
      const want = href.slice(1).toLowerCase();
      const h = Array.from(this.contentEl.querySelectorAll("h2,h3"))
        .find(el => (el.textContent ?? "").trim().toLowerCase() === want);
      h?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (dest && docKindFor(dest.path)) {
      // another question or talk: this page turns into it (one history step)
      recordHistory(this.leaf);
      void this.leaf.setViewState({ type: DOC_VIEW, state: { path: dest.path }, active: true });
      return;
    }
    if (dest && dest.path.startsWith(LIBRARY_PREFIX) && !href.includes("#^")) {
      // the wrapper decides sheet vs travel (scripture travels)
      void this.app.workspace.openLinkText(href, file.path);
      return;
    }
    void this.app.workspace.openLinkText(href, file.path);
  }
}
