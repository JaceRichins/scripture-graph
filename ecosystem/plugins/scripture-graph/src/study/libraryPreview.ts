/** 📖 Library sheet — AI Library content comes to the reader, not the other
 * way around.
 *
 * Clicking a Gospel Topic, a conference talk, a person, or an evidence page
 * used to NAVIGATE into the AI Library — the reader lost their place and
 * found themselves somewhere that looks like the engine's filing cabinet.
 * Now those pages render inside a floating sheet over the page being read:
 * close it and nothing has moved. Links inside the sheet open inside the
 * sheet (with ‹ back); scripture links close the sheet and go to the real
 * reading surface. A quiet "open as page" remains for power users. */
import { App, Component, MarkdownRenderer, Modal, TFile } from "obsidian";
import { ANNOTATED_PREFIX, CANONICAL_PREFIX, LIBRARY_PREFIX, SGState } from "../state";
import { registerSheet, unregisterSheet } from "./sheetRegistry";
import type { Subject } from "./timelineView";

/** host hook: does this page name a timeline subject, and how to focus it */
export interface TimelineHook {
  subjectFor: (name: string) => Subject | null;
  focus: (subject: Subject) => void;
}

/** AI pages that ARE reading surfaces keep real navigation */
const NAVIGATE_PREFIXES = [CANONICAL_PREFIX, ANNOTATED_PREFIX];

/** should this link open as a floating sheet instead of navigating? */
export function sheetTargetFor(app: App, linktext: string, sourcePath: string): TFile | null {
  if (!linktext) return null;
  const base = linktext.split("#")[0]!.trim();
  if (!base) return null;   // pure in-page anchor
  const dest = app.metadataCache.getFirstLinkpathDest(base, sourcePath);
  if (!dest) return null;
  if (!dest.path.startsWith(LIBRARY_PREFIX)) return null;
  if (NAVIGATE_PREFIXES.some(p => dest.path.startsWith(p))) return null;
  return dest;
}

export class LibraryPreviewModal extends Modal {
  private comp = new Component();
  private history: TFile[] = [];
  private current: TFile;
  private bodyEl!: HTMLElement;
  private sheetTitleEl!: HTMLElement;
  private backBtn!: HTMLElement;

  private tlBtn: HTMLElement | null = null;

  constructor(
    private s: SGState,
    file: TFile,
    private subpath: string | null,
    /** null = no open-as-page path at all (family mode) */
    private openAsPage: ((file: TFile) => void) | null,
    /** when the page names someone the timeline knows, offer their thread */
    private timeline: TimelineHook | null = null,
  ) {
    super(s.app);
    this.current = file;
  }

  onOpen(): void {
    registerSheet(this);
    this.modalEl.addClass("sg-lib-modal");
    const c = this.contentEl;
    c.addClass("sg-lib");
    this.comp.load();

    const head = c.createDiv({ cls: "sg-lib-head" });
    this.backBtn = head.createEl("button", { cls: "sg-lib-btn sg-lib-back", text: "‹" });
    this.backBtn.setAttr("aria-label", "Back");
    this.backBtn.onclick = () => {
      const prev = this.history.pop();
      if (prev) void this.show(prev, null);
    };
    this.sheetTitleEl = head.createSpan({ cls: "sg-lib-title" });
    if (this.timeline) {
      const tl = head.createEl("button", { cls: "sg-lib-btn sg-lib-tl", text: "⏳" });
      tl.setAttr("aria-label", "See it in the Timeline");
      tl.onclick = () => {
        const sub = this.timeline?.subjectFor(this.current.basename);
        if (!sub) return;
        const focus = this.timeline!.focus;
        this.close();
        focus(sub);
      };
      this.tlBtn = tl;
      // the subject index may still be warming on the very first sheet
      window.setTimeout(() => this.tlBtn?.toggleClass("sg-lib-tl-off",
        !this.timeline?.subjectFor(this.current.basename)), 450);
    }
    if (this.openAsPage) {
      const asPage = head.createEl("button", { cls: "sg-lib-btn sg-lib-expand", text: "↗" });
      asPage.setAttr("aria-label", "Open as its own page");
      asPage.onclick = () => {
        const f = this.current;
        const open = this.openAsPage!;
        this.close();
        open(f);
      };
    }

    this.bodyEl = c.createDiv({ cls: "sg-lib-body markdown-rendered" });
    // links inside the sheet stay inside the sheet; scripture links leave it
    this.bodyEl.addEventListener("click", (evt) => {
      const a = (evt.target as HTMLElement).closest("a.internal-link");
      if (!(a instanceof HTMLElement)) return;
      const href = a.getAttr("data-href") ?? a.getAttr("href") ?? "";
      if (!href) return;
      evt.preventDefault();
      evt.stopPropagation();
      const next = sheetTargetFor(this.s.app, href, this.current.path);
      if (next) {
        this.history.push(this.current);
        void this.show(next, href.split("#")[1] ?? null);
      } else if (href.includes("#^")) {
        // a verse reference peeks ON TOP — this sheet stays underneath
        void this.s.app.workspace.openLinkText(href, this.current.path);
      } else {
        // a chapter / personal destination: leave the sheet, read for real
        this.close();
        void this.s.app.workspace.openLinkText(href, this.current.path);
      }
    }, { capture: true });

    void this.show(this.current, this.subpath);
  }

  private async show(file: TFile, subpath: string | null): Promise<void> {
    this.current = file;
    this.sheetTitleEl.setText(file.basename);
    this.backBtn.toggleClass("sg-lib-back-off", this.history.length === 0);
    this.tlBtn?.toggleClass("sg-lib-tl-off",
      !this.timeline?.subjectFor(file.basename));
    this.bodyEl.empty();
    try {
      const md = await this.s.app.vault.cachedRead(file);
      await MarkdownRenderer.render(this.s.app, md, this.bodyEl, file.path, this.comp);
      this.bodyEl.scrollTop = 0;
      if (subpath && !subpath.startsWith("^")) {
        const want = subpath.toLowerCase();
        const h = Array.from(this.bodyEl.querySelectorAll("h1,h2,h3,h4,h5,h6"))
          .find(el => (el.textContent ?? "").trim().toLowerCase() === want);
        h?.scrollIntoView({ block: "start" });
      }
    } catch {
      this.bodyEl.setText("This page could not be loaded.");
    }
  }

  onClose(): void {
    unregisterSheet(this);
    this.comp.unload();
    this.contentEl.empty();
  }
}
