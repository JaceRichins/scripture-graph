/** ⌂ The dock — Gospel Library's bottom bar, done for this vault.
 *
 * GL's bar is five fixed doors (Home · Library · Search · Bookmarks · Tabs)
 * and a round audio button floating beside it. Obsidian's own mobile navbar
 * is a browser toolbar (‹ › search + tabs ☰): built for notes, not for
 * reading. This replaces it on phones with the same five doors, and goes a
 * little further:
 *   - ‹ appears only when the current tab has somewhere to go back to, and
 *     walks the same history the pages record (leafNav) — one bar, no
 *     dead arrows.
 *   - 🎧 Listen reads the open chapter aloud with the phone's own voice;
 *     tap again to stop.
 *   - long-press Tabs for tab management, long-press Home for Obsidian's
 *     ribbon menu — the two things the old bar had that this one folds away.
 * Everything here calls surfaces that already exist; the dock is a door,
 * not a room. */
import { App, Modal, Notice, Platform, TFile, TFolder } from "obsidian";
import { chapterIdFromTitle, parseCanonicalVerses, parseFrontmatter } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, PERSONAL_PREFIX, SGState } from "../state";
import { historyBack } from "./leafNav";
import { trace } from "./trace";

export interface DockHost {
  openHome: () => void;
  openLibrary: () => void;
  openSearch: () => void;
  openTabs: () => void;
  tabsMenu: (evt: MouseEvent) => void;
  ribbonMenu: (evt: MouseEvent) => void;
  reviewFlashcards: () => void;
  openPath: (path: string) => void;
}

interface ObsidianInternals {
  mobileTabSwitcher?: { show: () => void; showTabManagementMenu: (e: MouseEvent) => void };
  mobileNavbar?: { showRibbonMenu: (e: MouseEvent) => void; tabButtonEl?: HTMLElement };
}

/** Obsidian's own tab switcher / ribbon menu, when the build exposes them */
export function obsidianInternals(app: App): ObsidianInternals {
  return app as unknown as ObsidianInternals;
}

export class Dock {
  private el: HTMLElement | null = null;
  private backBtn: HTMLElement | null = null;
  private tabsCount: HTMLElement | null = null;
  private slots = new Map<string, HTMLElement>();
  private listen = new Listener();
  private listenBtn: HTMLElement | null = null;

  constructor(private s: SGState, private host: DockHost) {}

  mount(): void {
    if (this.el) return;
    const el = document.body.createDiv({ cls: "sg-dock" });
    const bar = el.createDiv({ cls: "sg-dock-bar" });
    this.backBtn = this.slot(bar, "back", "‹", "Back", () => {
      const leaf = this.s.app.workspace.activeLeaf;
      if (!leaf || !historyBack(leaf)) this.host.openHome();
    });
    this.backBtn.addClass("sg-dock-back");
    const home = this.slot(bar, "home", ICON.home, "Home", () => this.host.openHome());
    longPress(home, e => this.host.ribbonMenu(e));
    this.slot(bar, "library", ICON.library, "Library", () => this.host.openLibrary());
    this.slot(bar, "search", ICON.search, "Search", () => this.host.openSearch());
    this.slot(bar, "saved", ICON.saved, "Saved", () => new SavedModal(this.s, this.host).open());
    const tabs = this.slot(bar, "tabs", ICON.tabs, "Tabs", () => this.host.openTabs());
    this.tabsCount = tabs.createSpan({ cls: "sg-dock-count" });
    longPress(tabs, e => this.host.tabsMenu(e));
    this.listenBtn = el.createEl("button", { cls: "sg-dock-round", attr: { "aria-label": "Listen" } });
    this.listenBtn.innerHTML = ICON.listen;
    this.listenBtn.onclick = () => this.toggleListen();
    this.el = el;
    document.body.addClass("sg-dock-on");
    this.refresh();
  }

  unmount(): void {
    this.listen.stop();
    this.el?.remove();
    this.el = null;
    document.body.removeClass("sg-dock-on");
  }

  /** what is lit, whether ‹ has anywhere to go, how many tabs */
  refresh(): void {
    if (!this.el) return;
    try {
      const ws = this.s.app.workspace;
      const leaf = ws.activeLeaf;           // may be null before the first page
      const type = leaf?.view?.getViewType?.() ?? "";
      const h = (leaf as unknown as { history?: { backHistory?: unknown[] } } | null)?.history;
      this.backBtn?.toggleClass("sg-dock-back-on", !!h?.backHistory?.length);
      const f = ws.getActiveFile();
      const lit = type === "sg-library" ? "library"
        : type === "markdown" && !!f && f.path.startsWith(PERSONAL_PREFIX) && f.basename === "Study Hub" ? "home" : "";
      for (const [k, b] of this.slots) b.toggleClass("sg-dock-on-slot", k === lit);
      let n = 0;
      ws.iterateRootLeaves(() => { n++; });
      if (this.tabsCount) this.tabsCount.setText(n > 1 ? String(n) : "");
      this.listenBtn?.toggleClass("sg-dock-round-on", this.listen.playing);
      this.listenBtn?.toggleClass("sg-dock-round-off", !this.listen.canRead(this.s.app));
    } catch (e) {
      console.warn("scripture-graph: dock refresh", e);
    }
  }

  private slot(bar: HTMLElement, key: string, icon: string, label: string, onTap: () => void): HTMLElement {
    const b = bar.createEl("button", { cls: `sg-dock-slot sg-dock-${key}`, attr: { "aria-label": label } });
    b.innerHTML = icon;
    b.onclick = (e) => { e.preventDefault(); trace("dock.tap", { key }); onTap(); };
    this.slots.set(key, b);
    return b;
  }

  private toggleListen(): void {
    if (this.listen.playing) { this.listen.stop(); this.refresh(); return; }
    const ok = this.listen.start(this.s.app);
    if (!ok) new Notice("Open a chapter to listen to it");
    this.refresh();
  }
}

/** a press held ~450 ms — the way GL and Obsidian both hide their menus */
function longPress(el: HTMLElement, fn: (e: MouseEvent) => void): void {
  let t: number | null = null;
  const start = (e: PointerEvent) => {
    t = window.setTimeout(() => { t = null; fn(e as unknown as MouseEvent); }, 450);
  };
  const cancel = () => { if (t !== null) { window.clearTimeout(t); t = null; } };
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("contextmenu", e => { e.preventDefault(); fn(e); });
}

// ------------------------------------------------------------- 🎧 listen

/** the open chapter read aloud by the system voice (Web Speech). No
 * download, no account, works offline on iOS/Android; stops on navigation. */
class Listener {
  playing = false;
  private utter: SpeechSynthesisUtterance | null = null;

  /** the chapter behind the open page: canonical, or the My Notes twin */
  private text(app: App): { title: string; file: TFile } | null {
    const f = app.workspace.getActiveFile();
    if (!f) return null;
    let file: TFile | null = f;
    if (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes")) {
      const dest = app.metadataCache.getFirstLinkpathDest(f.basename.replace(/ - My Notes$/, ""), "");
      if (dest?.path.startsWith(CANONICAL_PREFIX)) file = dest;
    }
    if (!file || !file.path.startsWith(CANONICAL_PREFIX) || !chapterIdFromTitle(file.basename)) return null;
    return { title: file.basename, file };
  }

  canRead(app: App): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && this.text(app) !== null;
  }

  start(app: App): boolean {
    const t = this.text(app);
    if (!t || !("speechSynthesis" in window)) return false;
    void app.vault.cachedRead(t.file).then(raw => {
      const { body } = parseFrontmatter(raw);
      const verses = parseCanonicalVerses(body);
      const speech = [t.title, ...verses.map(v => `${v.verse}. ${v.text}`)].join("\n");
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(speech);
      u.rate = 0.96;
      u.onend = () => { this.playing = false; this.utter = null; document.body.removeClass("sg-listening"); };
      u.onerror = u.onend;
      this.utter = u;
      this.playing = true;
      document.body.addClass("sg-listening");
      window.speechSynthesis.speak(u);
      trace("listen.start", { chapter: t.title, verses: verses.length });
    });
    return true;
  }

  stop(): void {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    this.playing = false;
    this.utter = null;
    document.body.removeClass("sg-listening");
  }
}

// ------------------------------------------------------------- 🔖 saved

/** bookmarks, study trails, flashcards due, recent chapters — one sheet */
class SavedModal extends Modal {
  constructor(private s: SGState, private host: DockHost) { super(s.app); }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("sg-lib-modal");
    const c = this.contentEl;
    c.addClass("sg-saved");
    c.createEl("h2", { text: "Saved" });
    const all = await this.s.sync.allAnnotations();
    const marks = all.filter(a => !a.deleted_at && a.annotation_type === "bookmark")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const due = all.filter(a => {
      if (a.deleted_at || a.annotation_type !== "study-marker") return false;
      try { return (JSON.parse(a.content) as { card: { due: string } }).card.due <= new Date().toISOString(); }
      catch { return false; }
    }).length;

    const sect = (label: string) => c.createDiv({ cls: "sg-nav-sect", text: label });
    const row = (parent: HTMLElement, icon: string, name: string, sub: string, onTap: () => void) => {
      const r = parent.createDiv({ cls: "sg-nav-row" });
      r.createSpan({ cls: "sg-saved-ico", text: icon });
      const col = r.createDiv({ cls: "sg-nav-gcol" });
      col.createDiv({ cls: "sg-nav-name", text: name });
      if (sub) col.createDiv({ cls: "sg-nav-gsub", text: sub });
      r.onclick = () => { this.close(); onTap(); };
    };

    sect("Continue");
    const recent = this.s.device.recentChapters ?? [];
    const list0 = c.createDiv({ cls: "sg-nav-list" });
    if (!recent.length) list0.createDiv({ cls: "sg-nav-empty", text: "Nothing read yet." });
    for (const r of recent.slice(0, 4)) {
      row(list0, "📖", r.title, new Date(r.at).toLocaleDateString(),
        () => this.host.openPath(`${r.title} - My Notes`));
    }

    sect(`Bookmarks${marks.length ? ` · ${marks.length}` : ""}`);
    const list1 = c.createDiv({ cls: "sg-nav-list" });
    if (!marks.length) list1.createDiv({ cls: "sg-nav-empty", text: "Bookmark a page from its ⋯ menu or the command palette." });
    for (const m of marks.slice(0, 40)) {
      const title = /\[\[([^\]|]+)/.exec(m.content)?.[1] ?? m.anchor_id;
      row(list1, "🔖", title, new Date(m.created_at).toLocaleDateString(), () => this.host.openPath(title));
    }

    sect("Flashcards");
    const list2 = c.createDiv({ cls: "sg-nav-list" });
    row(list2, "🃏", due ? `${due} card${due === 1 ? "" : "s"} due` : "Nothing due", "Review with spaced repetition",
      () => this.host.reviewFlashcards());

    const trails = this.s.app.vault.getAbstractFileByPath(`${PERSONAL_PREFIX}Study Trails`);
    if (trails instanceof TFolder && trails.children.length) {
      sect("Study trails");
      const list3 = c.createDiv({ cls: "sg-nav-list" });
      for (const f of trails.children.slice(0, 20)) {
        if (f instanceof TFile) row(list3, "👣", f.basename, "", () => this.host.openPath(f.path));
      }
    }
  }

  onClose(): void { this.contentEl.empty(); }
}

// ------------------------------------------------------------- icons (GL's line style)
const ICON = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg>`,
  library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="4" height="16" rx="0.8"/><rect x="9.5" y="4" width="4" height="16" rx="0.8"/><path d="m15.5 5.2 3.9-.9 3.1 14.6-3.9.9z"/><path d="M3.5 8h4M9.5 8h4"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="m15.5 15.5 5 5"/></svg>`,
  saved: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>`,
  tabs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 15V6a2 2 0 0 1 2-2h9"/></svg>`,
  listen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v5a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2z"/><path d="M20 13v5a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2z"/></svg>`,
};

export const isPhone = (): boolean => Platform.isMobile;
