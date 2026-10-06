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
import { ItemView, MarkdownRenderer, Menu, Notice, Platform, TFile, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { addPrintItems } from '../printing/printMenu';
import { LIBRARY_PREFIX, SGState } from "../state";
import { AnnotationService, COLOR_HEX } from "../social/annotations";
import { THEME_LIBRARY, themeSpec, type ThemeSpec } from "../study/themeLibrary";
import { historyBack, recordHistory } from "../study/leafNav";
import { youtubeIdOf } from "../study/youtubeFind";
import { trace } from "../study/trace";
import { addSendPageItem, sendPage } from '../social/pageSharing';
import { PageRefresh } from './pageRefresh';
import { documentTitle } from '../ai/documentContext';
import { lessonRoot, lessonProject, projectKind } from '../ai/lessonProject';

export const DOC_VIEW = "scripture-graph-doc";

/** folders whose pages are reading surfaces of their own (the folder MOC
 * page itself — "Questions", "General Conference" — stays a sheet) */
const DOC_KINDS: { prefix: string; eyebrow: string; moc: string }[] = [
  { prefix: `${LIBRARY_PREFIX}05 Events/`, eyebrow: "Event", moc: "Events.md" },
  { prefix: `${LIBRARY_PREFIX}08 Sunday Lessons/`, eyebrow: "Sunday lessons", moc: "Sunday Lessons.md" },
  { prefix: `${LIBRARY_PREFIX}12 Family/Stories/`, eyebrow: "Family story", moc: "Stories.md" },
  { prefix: `${LIBRARY_PREFIX}50 Questions/`, eyebrow: "Hard question", moc: "Questions.md" },
  { prefix: `${LIBRARY_PREFIX}10 General Conference/`, eyebrow: "General Conference", moc: "General Conference.md" },
  { prefix: `${LIBRARY_PREFIX}65 Secondary Sources/`, eyebrow: "Podcasts & talks", moc: "Secondary Sources.md" },
  { prefix: `${LIBRARY_PREFIX}30 Church History/`, eyebrow: "Church History", moc: "Church History.md" },
  { prefix: `${LIBRARY_PREFIX}07 Come Follow Me/`, eyebrow: "Come, Follow Me", moc: "Come Follow Me.md" },
];

export function docKindFor(path: string): { eyebrow: string } | null {
  if (lessonRoot(path) && path.endsWith('.md')) return { eyebrow: 'Lesson' };
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
  openLessonHome?: (folder: string, resources?: boolean) => void;
  openMyWork?: () => void;
  /** power users only: the raw markdown page */
  openRaw: ((file: TFile) => void) | null;
  /** play a YouTube video in the app's corner player */
  playVideo?: (id: string, title: string, sub: string) => void;
}

export class DocView extends ItemView {
  private path: string | null = null;
  private refresh = new PageRefresh();
  private renderedContent: string | null = null;
  private renderedPath: string | null = null;
  private emptyRead: { since: number; timer: number } | null = null;
  private changed = () => { void this.render(); };

  constructor(leaf: WorkspaceLeaf, private s: SGState, private ann: AnnotationService,
    private host: DocHost) {
    super(leaf);
    this.navigation = true;   // a page: back-arrow aware, replaced in place
  }

  getViewType() { return DOC_VIEW; }
  getDisplayText() {
    const f = this.file();
    return f ? documentTitle(this.app, f) : "Scripture Graph";
  }
  getIcon() { return "file-text"; }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);
    const file = this.file();
    if (file) {
      addSendPageItem(menu, this.s, file);
      addPrintItems(menu, this.app, file);
    }
  }

  getState(): Record<string, unknown> { return { path: this.path }; }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const p = (state as { path?: unknown } | null)?.path;
    if (typeof p === "string" && p && p !== this.path) {
      this.clearEmptyRead();
      this.path = p;
      if (this.contentEl.hasClass("sg-doc")) await this.render();
    }
  }

  async onOpen() {
    this.contentEl.addClass("sg-doc");
    this.registerEvent(this.app.metadataCache.on('changed', file => { if (file.path === this.path) this.changed(); }));
    this.s.onChange.push(this.changed);
    if (this.path) await this.render();
  }

  async onClose() {
    this.clearEmptyRead();
    this.refresh.cancel();
    const index = this.s.onChange.indexOf(this.changed);
    if (index >= 0) this.s.onChange.splice(index, 1);
  }

  private file(): TFile | null {
    if (!this.path) return null;
    const af = this.app.vault.getAbstractFileByPath(this.path);
    return af instanceof TFile ? af : null;
  }

  private clearEmptyRead() {
    if (this.emptyRead) window.clearTimeout(this.emptyRead.timer);
    this.emptyRead = null;
  }

  /** the page's stable graph anchor: the engine's sg-id when it has one,
   * else the path — either way one id every device agrees on */
  private anchorId(file: TFile): string {
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
    const id = fm["sg-id"];
    return typeof id === "string" && id.includes(":") ? id : `doc:${file.path}`;
  }

  private async render() {
    const update = this.refresh.begin(this.contentEl, this.path ?? '');
    const root = update.root;
    const file = this.file();
    if (!file) {
      // A sync can briefly make the current file unavailable. Keep the last
      // readable page until it can be refreshed, rather than collapsing it.
      if (this.renderedPath !== null && this.renderedPath === this.path) return;
      root.createEl("p", { text: "This page is not in the vault." });
      if (update.commit()) this.renderedContent = this.renderedPath = null;
      return;
    }
    const kind = docKindFor(file.path) ?? { eyebrow: "Library" };
    const lesson = lessonRoot(file.path);
    this.contentEl.toggleClass('sg-doc-lesson', !!lesson);
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
    const page = root.createDiv({ cls: "sg-doc-page" });

    // ---- head: the way back, eyebrow, title, status, actions ----
    const head = page.createDiv({ cls: "sg-doc-head" });
    const nav = lesson ? head.createDiv({ cls: 'sg-doc-lesson-nav' }) : head;
    const research = !!lesson && projectKind(lesson) === 'research';
    const back = nav.createEl("button", { cls: "sg-doc-back", text: lesson ? (research ? '‹ Research home' : lesson.startsWith('Library/Study Plans/') ? '‹ Study plan home' : '‹ Lesson home') : '‹ Back' });
    back.onclick = () => {
      if (lesson && this.host.openLessonHome) { this.host.openLessonHome(lesson); return; }
      // the leaf's own back stack first (recordHistory fed it); the Library
      // page when there is nothing to go back to
      if (!historyBack(this.leaf)) this.host.openLibrary();
    };
    if (lesson) {
      nav.createEl('button', { cls: 'sg-doc-back', text: research ? 'Research pages' : 'Resources' }).onclick = () => this.host.openLessonHome?.(lesson, true);
      nav.createEl('button', { cls: 'sg-doc-back', text: 'My Work' }).onclick = () => this.host.openMyWork?.();
    }
    const primaryPage = !!lesson && lessonProject(this.app, lesson).primary?.path === file.path;
    head.createDiv({ cls: "sg-doc-eyebrow", text: lesson && !primaryPage ? (research ? 'Research page' : 'Lesson resource') : research ? 'Research report' : kind.eyebrow });
    // "And We Talk of Christ (Elder Gary E. Stevenson, April 2025)": the title
    // is the title; the parenthetical becomes pills beneath it
    const displayTitle = documentTitle(this.app, file);
    const parenMatch = /^(.*\S)\s+\(([^()]+)\)$/.exec(displayTitle);
    const title = parenMatch ? parenMatch[1]! : displayTitle;
    head.createEl("h1", { cls: "sg-doc-title", text: title });
    if (!lesson) {
      const send = head.createEl('button', { cls: 'sg-family-send-button', text: 'Send to family' });
      send.onclick = () => sendPage(this.s, file);
    }
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
    if (!update.current()) return;
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
    let signature: string | null = null;
    try {
      const md = await this.app.vault.cachedRead(file);
      if (!update.current()) return;
      signature = JSON.stringify([file.path, md, fm, worn]);
      // Identity polling and reconnects normally change nothing on this page.
      // Keep its DOM, selection, media and touch scrolling intact in that case.
      if (signature === this.renderedContent) { this.clearEmptyRead(); return; }
      // In-place sync writes can briefly expose an empty file. Confirm an
      // empty result after the write has had time to settle. A genuinely
      // cleared file still updates without erasing the page for a brief read.
      if (!md.trim() && this.renderedPath === file.path) {
        if (!this.emptyRead) {
          this.emptyRead = { since: Date.now(), timer: window.setTimeout(this.changed, 350) };
          return;
        }
        if (Date.now() - this.emptyRead.since < 350) return;
      }
      this.clearEmptyRead();
      const scratch = createDiv();
      await MarkdownRenderer.render(this.app, md, scratch, file.path, this);
      this.sectionize(scratch, body, file.basename);
      if (file.path.startsWith(`${LIBRARY_PREFIX}05 Events/`)) {
        const jumps = page.createEl('nav', { cls: 'sg-doc-event-nav' });
        jumps.setAttr('aria-label', 'On this event page');
        for (const [heading, label] of [['Historical Context', 'History'], ['Historical Sources', 'Sources'], ['Teachings About This Event', 'Teachings']]) {
          const destination = Array.from(body.querySelectorAll<HTMLElement>('.sg-doc-sec-h'))
            .find(h => h.textContent?.trim() === heading);
          if (!destination) continue;
          const jump = jumps.createEl('button', { cls: 'sg-doc-back', text: label });
          jump.onclick = () => destination.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
        page.insertBefore(jumps, body);
      }
    } catch {
      // An error placeholder is shorter than the document and clamps its
      // scroll position to zero. A failed background read must leave it intact.
      if (!update.current() || this.renderedPath === file.path) return;
      signature = null;
      body.setText("This page could not be loaded.");
    }
    body.addEventListener("click", (evt) => this.onLinkClick(evt, file), { capture: true });
    if (update.commit()) {
      this.renderedContent = signature;
      this.renderedPath = signature === null ? null : file.path;
    }
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
