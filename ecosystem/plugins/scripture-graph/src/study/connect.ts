/** 🔗 Connect — one passage tied to another, by hand.
 *
 * Select a verse or a phrase, tap Connect, then find the other end: type a
 * few words or a reference, or drill down volume → book → chapter → verse.
 * Pick it, say why (optional), done. The link is a note on BOTH passages:
 *
 *     Connect: [[1 Nephi 12#^1ne-12-19]] — the same seed, the same warning
 *
 * so either verse shows ⇄ and opens the other. Notes are ordinary
 * annotations: they sync, share by the usual scopes, and delete like any
 * other mark. Nothing is written into the scriptures themselves. */
import { App, Modal, Notice, TFile } from "obsidian";
import { BOOKS, chapterTitle, parseCanonicalVerses, parseVerseId, verseDisplay, type BookInfo } from "@scripture-graph/core-sdk";
import type { SGState } from "../state";
import type { AnnotationService } from "../social/annotations";
import { buildSearchIndex, searchIndexReady, smartSearch } from "./search";
import { VOLUMES } from "./navigator";
import { navIcon } from "./navIcons";
import { trace } from "./trace";

/** what a connection note carries: the other end, and the reason */
export interface ConnectionLink { link: string; target: string; anchor: string; why: string }

const CONNECT_RE = /Connect:\s*\[\[([^\]|#]+)#\^([a-z0-9]+(?:-\d+)+)\]\](?:\s*[—-]\s*(.*))?/;

export function connectionOf(content: string): ConnectionLink | null {
  const m = CONNECT_RE.exec(content);
  if (!m) return null;
  return { link: `${m[1]!.trim()}#^${m[2]!}`, target: m[1]!.trim(), anchor: m[2]!, why: (m[3] ?? "").trim() };
}

export function isConnectionNote(a: { annotation_type: string; content: string }): boolean {
  return a.annotation_type === "note" && CONNECT_RE.test(a.content);
}

/** where a page anchor lives: a verse's chapter, or the page itself */
function linkFor(app: App, anchor: string): string | null {
  const r = parseVerseId(anchor);
  if (r) { const t = chapterTitle(r.bookSlug, r.chapter); return t ? `${t}#^${anchor}` : null; }
  if (anchor.startsWith("doc:")) return anchor.slice(4).replace(/\.md$/, "");
  // engine ids ("topic:faith"): the page that carries that sg-id
  for (const f of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined;
    if (fm?.["sg-id"] === anchor) return f.basename;
  }
  return null;
}

export interface ConnectSource { anchor: string; label: string; quoted: string | null }

type View =
  | { kind: "start" }
  | { kind: "books"; volume: string }
  | { kind: "chapters"; book: BookInfo }
  | { kind: "verses"; title: string }
  | { kind: "confirm"; verseId: string; text: string };

export class ConnectModal extends Modal {
  private view: View = { kind: "start" };
  private trail: View[] = [];
  private q = "";
  private seq = 0;
  private timer: number | null = null;

  constructor(private s: SGState, private ann: AnnotationService, private source: ConnectSource,
    private onDone: () => void) {
    super(s.app);
  }

  onOpen(): void { this.modalEl.addClass("sg-connect-modal"); this.render(); }
  onClose(): void { if (this.timer !== null) window.clearTimeout(this.timer); this.contentEl.empty(); }

  private go(v: View): void { this.trail.push(this.view); this.view = v; this.render(); }
  private back(): void { const p = this.trail.pop(); if (p) { this.view = p; this.render(); } }

  private render(): void {
    const c = this.contentEl;
    c.empty();
    c.addClass("sg-connect");
    const head = c.createDiv({ cls: "sg-connect-head" });
    if (this.trail.length) {
      const b = head.createEl("button", { cls: "sg-connect-back", text: "‹" });
      b.onclick = () => this.back();
    }
    const titles = head.createDiv({ cls: "sg-connect-titles" });
    titles.createDiv({ cls: "sg-connect-eyebrow", text: "Connect" });
    titles.createDiv({ cls: "sg-connect-from", text: this.source.label });
    if (this.source.quoted) titles.createDiv({ cls: "sg-connect-quote", text: `“${this.source.quoted.length > 80 ? this.source.quoted.slice(0, 78) + "…" : this.source.quoted}”` });
    const v = this.view;
    if (v.kind === "confirm") { this.renderConfirm(c, v.verseId, v.text); return; }

    // the search box rides every browsing screen: words or a reference
    const inp = c.createEl("input", { cls: "sg-nav-filter sg-connect-search",
      attr: { type: "search", placeholder: "Words or a reference (Alma 36:3)…" } });
    inp.value = this.q;
    const body = c.createDiv({ cls: "sg-connect-body" });
    inp.oninput = () => {
      this.q = inp.value;
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.renderBody(body), 160);
    };
    inp.onkeydown = (e) => { if (e.key === "Escape") { inp.value = ""; this.q = ""; this.renderBody(body); } };
    this.renderBody(body);
    if (v.kind === "start") window.setTimeout(() => inp.focus(), 60);
  }

  private renderBody(body: HTMLElement): void {
    body.empty();
    const q = this.q.trim();
    if (q.length >= 2) { this.renderSearch(body, q); return; }
    const v = this.view;
    if (v.kind === "start") {
      body.createDiv({ cls: "sg-connect-hint", text: "Search above, or find it by hand:" });
      for (const vol of VOLUMES) this.row(body, vol.icon, vol.name, () => this.go({ kind: "books", volume: vol.name }));
    } else if (v.kind === "books") {
      body.createDiv({ cls: "sg-nav-sect", text: v.volume });
      for (const b of BOOKS.filter(x => x.volume === v.volume)) this.row(body, "verse", b.name, () => this.go({ kind: "chapters", book: b }));
    } else if (v.kind === "chapters") {
      body.createDiv({ cls: "sg-nav-sect", text: v.book.name });
      const grid = body.createDiv({ cls: "sg-nav-chapters" });
      for (let n = 1; n <= v.book.chapters; n++) {
        const btn = grid.createEl("button", { cls: "sg-nav-ch", text: String(n) });
        btn.onclick = () => this.go({ kind: "verses", title: `${v.book.prefix} ${n}` });
      }
    } else if (v.kind === "verses") {
      body.createDiv({ cls: "sg-nav-sect", text: v.title });
      const f = this.s.app.metadataCache.getFirstLinkpathDest(v.title, "");
      if (!(f instanceof TFile)) { body.createDiv({ cls: "sg-nav-empty", text: "That chapter isn't in the vault." }); return; }
      void this.s.app.vault.cachedRead(f).then(raw => {
        if (!body.isConnected) return;
        for (const line of parseCanonicalVerses(raw)) {
          if (line.verseId === this.source.anchor) continue;   // not to itself
          const r = body.createDiv({ cls: "sg-connect-verse" });
          r.createSpan({ cls: "sg-connect-vn", text: String(line.verse) });
          r.createSpan({ cls: "sg-connect-vt", text: line.text });
          r.onclick = () => this.go({ kind: "confirm", verseId: line.verseId, text: line.text });
        }
      });
    }
  }

  private renderSearch(body: HTMLElement, q: string): void {
    const seq = ++this.seq;
    if (!searchIndexReady()) body.createDiv({ cls: "sg-nav-progress", text: "Reading the scriptures…" });
    void buildSearchIndex(this.s.app).then(index => {
      if (seq !== this.seq || !body.isConnected) return;
      body.empty();
      const res = smartSearch(q, index);
      let n = 0;
      if (res.reference) {
        const ref = res.reference;
        if (ref.anchor && ref.verse !== null) {
          const vid = ref.anchor;
          this.row(body, "target", `${ref.title}:${ref.verse}`, () => void this.confirmVerse(vid));
        } else {
          this.row(body, "target", `${ref.title} — pick the verse`, () => this.go({ kind: "verses", title: ref.title }));
        }
        n++;
      }
      for (const hit of res.verses.slice(0, 40)) {
        if (hit.anchor === this.source.anchor) continue;
        const r = body.createDiv({ cls: "sg-connect-verse" });
        r.createSpan({ cls: "sg-connect-vn", text: `${hit.chapter}:${hit.verse}` });
        const t = r.createSpan({ cls: "sg-connect-vt" });
        let at = 0;
        for (const rg of hit.ranges) {
          if (rg.start > at) t.appendText(hit.snippet.slice(at, rg.start));
          t.createEl("b", { text: hit.snippet.slice(rg.start, rg.end) });
          at = rg.end;
        }
        if (at < hit.snippet.length) t.appendText(hit.snippet.slice(at));
        r.onclick = () => void this.confirmVerse(hit.anchor);
        n++;
      }
      if (!n) body.createDiv({ cls: "sg-nav-empty", text: "No verse matches. Try fewer words, or browse below by clearing the search." });
    });
  }

  /** a verse chosen by reference or search: fetch its words for the confirm screen */
  private async confirmVerse(verseId: string): Promise<void> {
    const r = parseVerseId(verseId);
    const title = r ? chapterTitle(r.bookSlug, r.chapter) : null;
    const f = title ? this.s.app.metadataCache.getFirstLinkpathDest(title, "") : null;
    let text = "";
    if (f instanceof TFile) {
      const raw = await this.s.app.vault.cachedRead(f);
      text = parseCanonicalVerses(raw).find(l => l.verseId === verseId)?.text ?? "";
    }
    this.go({ kind: "confirm", verseId, text });
  }

  private renderConfirm(c: HTMLElement, verseId: string, text: string): void {
    const box = c.createDiv({ cls: "sg-connect-confirm" });
    box.createDiv({ cls: "sg-connect-eyebrow", text: "to" });
    box.createDiv({ cls: "sg-connect-to", text: verseDisplay(verseId) ?? verseId });
    if (text) box.createDiv({ cls: "sg-connect-totext", text });
    const why = box.createEl("textarea", { cls: "sg-connect-why", attr: { rows: "2", placeholder: "Why do these connect? (optional)" } });
    const actions = box.createDiv({ cls: "sg-connect-actions" });
    const cancel = actions.createEl("button", { text: "Back" });
    cancel.onclick = () => this.back();
    const go = actions.createEl("button", { cls: "mod-cta", text: "⇄ Connect" });
    go.onclick = () => void this.save(verseId, why.value.trim(), go);
    window.setTimeout(() => why.focus(), 80);
  }

  private async save(targetId: string, why: string, btn: HTMLButtonElement): Promise<void> {
    btn.setAttribute("disabled", "true"); btn.setText("Connecting…");
    const app = this.s.app;
    const toTarget = linkFor(app, targetId);
    const toSource = linkFor(app, this.source.anchor);
    if (!toTarget || !toSource) { new Notice("Couldn't work out where that passage lives."); btn.removeAttribute("disabled"); btn.setText("⇄ Connect"); return; }
    const { visibility, groupId } = this.s.device.lastShareScope;
    const tail = why ? ` — ${why}` : "";
    // both ends carry the link, so either passage shows ⇄ and opens the other
    await this.ann.addNote(this.source.anchor, `Connect: [[${toTarget}]]${tail}`, this.source.quoted, visibility, groupId);
    await this.ann.addNote(targetId, `Connect: [[${toSource}]]${tail}`, null, visibility, groupId);
    trace("connect.save", { from: this.source.anchor, to: targetId, why: !!why });
    new Notice(`⇄ ${this.source.label} ↔ ${verseDisplay(targetId) ?? targetId}`);
    this.close();
    this.onDone();
  }

  private row(body: HTMLElement, icon: Parameters<typeof navIcon>[1], label: string, onTap: () => void): void {
    const r = body.createDiv({ cls: "sg-nav-row" });
    navIcon(r, icon);
    r.createSpan({ cls: "sg-nav-name", text: label });
    r.createSpan({ cls: "sg-nav-chev", text: "›" });
    r.onclick = onTap;
  }
}
