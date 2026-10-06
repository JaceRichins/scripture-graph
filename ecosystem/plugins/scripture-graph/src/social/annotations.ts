/** Annotation service: local-first writes, visibility, social queries,
 * background sync. Rendering decorates the reading view — canonical files
 * are never modified (§4, §65). */
import { Menu, Modal, Notice, Platform, TFile } from "obsidian";
import {
  makePartialAnchor, nowIso, parseVerseId, uuid, verseDisplay,
  type Annotation, type Visibility, parseBookmark,
} from "@scripture-graph/core-sdk";
import { refreshIdentity } from "./identity";
import { CANONICAL_PREFIX, SGState, type SocialAnnotation } from "../state";
import { themeRibbons, themeSpec, themeWash } from "../study/themeLibrary";
import { connectionOf, isConnectionNote } from "../study/connect";
import { fitMobileModal } from '../study/mobileModalViewport';

export const COLORS = ["yellow", "green", "blue", "pink", "orange"] as const;

/** Inline colors — never at the mercy of a stale styles.css on some device. */
export const COLOR_HEX: Record<string, string> = {
  yellow: "#f5d90a", green: "#4cc38a", blue: "#52a9ff",
  pink: "#f76bb0", orange: "#ff9f45",
};
export const MARK_BG: Record<string, string> = {
  yellow: "rgba(245,217,10,0.40)", green: "rgba(76,195,138,0.35)",
  blue: "rgba(82,169,255,0.35)", pink: "rgba(247,107,176,0.35)",
  orange: "rgba(255,159,69,0.40)",
};

export class NoteModal extends Modal {
  private releaseViewport: (() => void) | null = null;
  private focusTimer: number | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  constructor(state: SGState, private refLabel: string,
    private onSubmit: (text: string) => void, private initial = "") {
    super(state.app);
  }
  onOpen() {
    if (Platform.isMobile) this.releaseViewport = fitMobileModal(this.modalEl, 'sg-note-mobile', 'sg-note-keyboard');
    this.contentEl.addClass("sg-note-modal");
    this.contentEl.createEl("h3", { text: `Note on ${this.refLabel}` });
    const ta = this.contentEl.createEl("textarea", {
      attr: { placeholder: "Your thought…", 'aria-label': `Note on ${this.refLabel}` },
    });
    ta.value = this.initial;
    this.inputEl = ta;
    const footer = this.contentEl.createDiv({cls:'sg-note-footer'});
    const btn = footer.createEl("button", { cls:'mod-cta', text: "Save" });
    btn.addEventListener("click", () => {
      const v = ta.value.trim();
      this.close();
      if (v) this.onSubmit(v);
    });
    this.focusTimer = window.setTimeout(() => { if (ta.isConnected) ta.focus(); }, 30);
  }
  onClose() {
    if (this.focusTimer !== null) window.clearTimeout(this.focusTimer);
    this.inputEl?.blur(); this.inputEl = null;
    this.releaseViewport?.(); this.releaseViewport = null;
    this.contentEl.empty();
  }
}

export class AnnotationService {
  private syncTimer: number | null = null;
  /** runs after each successful push and pull, before listeners are told */
  afterSync: () => Promise<void> = async () => {};

  constructor(private s: SGState) {
    s.redecorate = () => this.redecorateOpen();
  }

  /** Refresh decorations on every verse currently rendered, without
   * re-rendering the page (which would scroll the user to the top). */
  async redecorateOpen(): Promise<void> {
    const seen = new Set<HTMLElement>();
    const paras = document.querySelectorAll<HTMLElement>(
      ".markdown-preview-view [data-verse-id], .sg-reader [data-verse-id], [data-sg-study-block]");
    for (const p of Array.from(paras)) {
      if (seen.has(p)) continue;
      seen.add(p);
      const vid = p.getAttribute("data-verse-id") ?? p.getAttribute('data-sg-doc-anchor');
      if (!vid) continue;
      const mine = await this.mine(vid);
      decorateVerse(this.s, this, p, vid, mine, this.social(vid));
    }
  }

  start(): void {
    this.scheduleSync(5_000);
    this.syncTimer = window.setInterval(() => void this.syncNow(), 60_000);
  }
  stop(): void { if (this.syncTimer) window.clearInterval(this.syncTimer); }

  scheduleSync(delayMs = 3_000): void {
    window.setTimeout(() => void this.syncNow(), delayMs);
  }

  async syncNow(strict = false): Promise<void> {
    if (!this.s.signedIn) return;
    try {
      await refreshIdentity(this.s, true);
      await this.s.sync.flush(this.s.api);
      await this.s.sync.pull(this.s.api);
      try { await this.afterSync(); } catch { /* a repair must never stop sync */ }
      this.s.notify();
    } catch (error) { if (strict) throw error; /* offline — queue persists (§12) */ }
  }

  // -------------------------------------------------------------- writes
  private base(anchorId: string, type: Annotation["annotation_type"]): Annotation {
    const vis: Visibility = this.s.settings.defaultVisibility === "local" ? "local" : "private";
    return {
      annotation_id: uuid(),
      author_user_id: this.s.device.userId,
      anchor_type: parseVerseId(anchorId) ? "verse" : anchorId.includes(":") ? "node" : "chapter",
      anchor_id: anchorId,
      annotation_type: type,
      selected_text: null, start_offset: null, end_offset: null, text_hash: null,
      content: "", color: null, style: null, theme: null,
      visibility: vis, group_id: null,
      created_at: nowIso(), updated_at: nowIso(), deleted_at: null, version: 1,
    };
  }

  async addHighlight(anchorId: string, color: string, verseText: string | null,
    selected: string | null, visibility: Visibility, groupId: string | null,
    style: string | null = null, theme: string | null = null): Promise<void> {
    const a = this.base(anchorId, "highlight");
    a.color = color;
    a.style = style;
    a.theme = theme;
    a.visibility = visibility;
    a.group_id = groupId;
    if (selected && verseText) {
      const p = makePartialAnchor(verseText, selected);
      if (p) Object.assign(a, p);
    }
    await this.s.sync.save(a);
    this.scheduleSync();
    this.s.rerenderReading();
  }

  /** A bookmark is one annotation saved once, so the server never receives a note first. */
  async addBookmark(anchorId: string, content: string): Promise<Annotation> {
    const a = this.base(anchorId, "bookmark");
    a.content = content;
    await this.s.sync.save(a);
    this.scheduleSync();
    this.s.rerenderReading();
    return a;
  }

  async addNote(anchorId: string, text: string, quoted: string | null,
    visibility: Visibility, groupId: string | null): Promise<void> {
    const a = this.base(anchorId, "note");
    a.content = quoted ? `> "${quoted}"\n\n${text}` : text;
    a.visibility = visibility;
    a.group_id = groupId;
    await this.s.sync.save(a);
    this.scheduleSync();
    this.s.rerenderReading();
  }

  /** Whole-verse theme tag: tap once to add, tap again to remove (§themes).
   * Returns true when the theme was ADDED. */
  async toggleTheme(anchorId: string, themeName: string, primaryHex: string,
    visibility: Visibility, groupId: string | null): Promise<boolean> {
    const mine = await this.mine(anchorId);
    const existing = mine.find(a => a.annotation_type === "highlight"
      && !a.selected_text && a.theme?.toLowerCase() === themeName.toLowerCase());
    if (existing) {
      await this.remove(existing.annotation_id);
      return false;
    }
    await this.addHighlight(anchorId, primaryHex, null, null, visibility, groupId,
      "theme", themeName);
    return true;
  }

  async setVisibility(id: string, visibility: Visibility, groupId: string | null): Promise<void> {
    const a = await this.s.sync.getAnnotation(id);
    if (!a || a.author_user_id !== this.s.device.userId && a.author_user_id !== null) return;
    const next = { ...a, visibility, group_id: groupId, updated_at: nowIso() };
    await this.s.sync.save(next);
    this.scheduleSync();
    this.s.rerenderReading();
  }

  /** change my note's words; any phrase it quoted is kept, and the sync engine
   * versions the change like every other edit */
  async editNote(id: string, text: string): Promise<void> {
    const a = await this.s.sync.getAnnotation(id);
    if (!a || a.annotation_type !== "note" || a.author_user_id !== this.s.device.userId && a.author_user_id !== null) return;
    const quoted = /^>\s*"[^\n]*"\s*\n+/.exec(a.content)?.[0] ?? "";
    await this.s.sync.save({ ...a, content: `${quoted}${text}`, updated_at: nowIso() });
    this.scheduleSync();
    this.s.rerenderReading();
  }

  async remove(id: string): Promise<void> {
    await this.s.sync.softDelete(id);
    this.scheduleSync();
    this.s.rerenderReading();
  }

  // --------------------------------------------------------------- reads
  /** my annotations (any scope) for an anchor */
  async mine(anchorId: string): Promise<Annotation[]> {
    const all = await this.s.sync.annotationsForAnchor(anchorId);
    return all.filter(a =>
      a.author_user_id === this.s.device.userId || a.author_user_id === null);
  }

  /** others' shared annotations from the social cache (filtered by scopes) */
  social(anchorId: string): SocialAnnotation[] {
    const rows = this.s.socialCache.get(anchorId) ?? [];
    const f = this.s.device.showScopes;
    return rows.filter(a => {
      if (a.author_user_id === this.s.device.userId) return false;
      if (a.visibility === "public") return f.public;
      if (a.visibility === "group" && a.group_id) return f.groups[a.group_id] !== false;
      return false;
    });
  }

  /** refresh the social cache for a chapter's verse anchors */
  async refreshSocial(anchorIds: string[]): Promise<void> {
    if (!this.s.signedIn || anchorIds.length === 0) return;
    try {
      const res = await this.s.api.annotationsFor(anchorIds);
      for (const id of anchorIds) this.s.socialCache.set(id, []);
      for (const a of res.annotations) {
        const arr = this.s.socialCache.get(a.anchor_id) ?? [];
        arr.push(a);
        this.s.socialCache.set(a.anchor_id, arr);
      }
      this.s.notify();
    } catch { /* offline: cached data stands */ }
  }

  // ------------------------------------------------------------ share menu
  visibilityMenu(onPick: (vis: Visibility, groupId: string | null, label: string) => void): Menu {
    const menu = new Menu();
    menu.addItem(i => i.setTitle("🔒 Only me (this device)").onClick(() => onPick("local", null, "Only me — this device")));
    menu.addItem(i => i.setTitle("🔐 Only me (synced)").onClick(() => onPick("private", null, "Only me")));
    for (const g of this.s.groups) {
      menu.addItem(i => i.setTitle(`👥 ${g.name}`).onClick(() => onPick("group", g.group_id, g.name)));
    }
    menu.addItem(i => i.setTitle("🌎 Public (everyone in Scripture Graph)")
      .onClick(() => onPick("public", null, "Public")));
    return menu;
  }
}

// -------------------------------------------------------------- rendering

/** Decorate one verse paragraph with highlights + note markers + social badge. */
export function decorateVerse(
  s: SGState, svc: AnnotationService, p: HTMLElement, verseId: string,
  mine: Annotation[], social: SocialAnnotation[],
): void {
  p.querySelectorAll(".sgh, .sg-badge, .sgh-note-icon, .sg-theme-badges").forEach(el => {
    // re-render safety: unwrap old marks
    if (el.classList.contains("sgh")) {
      const parent = el.parentNode;
      while (el.firstChild) parent?.insertBefore(el.firstChild, el);
    }
    el.remove();
  });
  if (p.hasAttribute("data-sg-themed")) {
    p.removeAttribute("data-sg-themed");
    p.removeClass("sg-themed");
    p.style.backgroundImage = "";
    p.style.boxShadow = "";
    p.style.paddingLeft = "";
  }
  mine = mine.filter(a => !a.deleted_at);
  social = social.filter(a => !a.deleted_at);
  // notes beside the verse: the line is the verse's next sibling, never inside it
  const after = p.nextElementSibling;
  if (after instanceof HTMLElement && after.classList.contains("sg-margin-note") && after.dataset.sgNoteFor === verseId) after.remove();

  const all = [
    ...(s.device.showScopes.mine ? mine : []),
    ...social,
  ].filter(a => a.annotation_type === "highlight");
  // whole-verse THEME layers vs plain text marks
  const themed = all.filter(a => a.theme && !a.selected_text);
  const visible = all.filter(a => !(a.theme && !a.selected_text));

  for (const h of visible) applyMark(p, h);

  if (themed.length) {
    // dedupe by theme name (mine + family may share a theme on the verse)
    const names: string[] = [];
    for (const t of themed) {
      if (t.theme && !names.some(n => n.toLowerCase() === t.theme!.toLowerCase())) {
        names.push(t.theme);
      }
    }
    const specs = names.map(n => themeSpec(n, s.settings.themes ?? [], COLOR_HEX));
    p.setAttribute("data-sg-themed", "1");
    p.addClass("sg-themed");
    const alpha = Math.max(0.06, 0.16 / specs.length); // more layers → subtler each
    p.style.backgroundImage = specs.map(sp => themeWash(sp, alpha)).join(", ");
    p.style.boxShadow = themeRibbons(specs);
    p.style.paddingLeft = `${8 + specs.length * 4}px`;
    const badges = p.createSpan({ cls: "sg-theme-badges" });
    for (const sp of specs) {
      const chip = badges.createSpan({ cls: "sg-theme-badge", text: sp.emoji });
      chip.setAttribute("aria-label", sp.name);
      chip.style.borderBottom = `2px solid ${sp.c1}`;
      chip.onclick = (e) => {
        e.stopPropagation();
        new NotesPopover(s, svc, verseId, p.getAttribute('data-sg-doc-title') ?? undefined).open();
      };
    }
  }

  // every annotation type leaves a visible, tappable trace on its verse
  const openPopover = () => new NotesPopover(s, svc, verseId, p.getAttribute('data-sg-doc-title') ?? undefined).open();
  if (s.device.showScopes.mine) {
    const has = (test: (a: Annotation) => boolean) => mine.some(test);
    const kinds: [(a: Annotation) => boolean, string, string][] = [
      [a => a.annotation_type === "note" && !isConnectionNote(a), "📝", "View your notes on this verse"],
      [a => isConnectionNote(a), "⇄", "Connected to another passage — tap to see"],
      [a => a.annotation_type === "study-marker", "🃏", "View your flashcards on this verse"],
      [a => a.annotation_type === "bookmark", "🔖", "Bookmarked"],
    ];
    for (const [test, glyph, label] of kinds) {
      if (has(test)) {
        const icon = p.createSpan({ cls: `sgh-note-icon${glyph === "⇄" ? " sgh-conn-icon" : ""}`, text: glyph });
        icon.setAttribute("aria-label", p.hasAttribute('data-sg-study-block') ? label.replace('verse', 'passage') : label);
        icon.onclick = openPopover;
      }
    }
  }
  const others = social.filter(a => a.annotation_type !== "bookmark");
  if (others.length) {
    const names = new Set(others.map(a => a.author_name ?? "someone"));
    const badge = p.createSpan({
      cls: "sg-badge",
      text: ` 👥 ${names.size}`,
      attr: { "aria-label": `${names.size} shared this — tap to view` },
    });
    badge.onclick = openPopover;
  }
  // My own words, shown beneath the verse they belong to (Aa: Notes beside
  // verses). Placed after the verse, not in it, so the verse's text -- what is
  // copied, quoted, searched, and matched for highlights -- stays scripture only.
  const notes = s.device.showScopes.mine && p.hasAttribute("data-verse-id")
    ? mine.filter(a => a.annotation_type === "note" && !isConnectionNote(a) && a.content.trim()
      && !a.content.startsWith("Song:") && !a.content.startsWith("⚠ Conflict copy"))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    : [];
  if (notes.length) {
    const line = document.createElement("div");
    line.className = "sg-margin-note";
    line.dataset.sgNoteFor = verseId;
    line.setAttribute("role", "button");
    line.setAttribute("aria-label", `Your note${notes.length > 1 ? "s" : ""} on this verse — tap to open`);
    line.appendChild(document.createTextNode(noteBody(notes[0]!.content)));
    if (notes.length > 1) {
      const more = document.createElement("span");
      more.className = "sg-margin-more";
      more.textContent = `+${notes.length - 1}`;
      line.appendChild(more);
    }
    line.onclick = openPopover;
    p.insertAdjacentElement("afterend", line);
  }
}

/** a note's own words, without the quoted phrase it may begin with */
export function noteBody(content: string): string {
  return content.replace(/^>\s*"[^\n]*"\s*\n+/, "").trim();
}

/** Apply the mark's visual treatment (theme-aware): fill, underline, bold,
 * italic — inline so styling never depends on CSS delivery. */
function styleMark(mark: HTMLElement, h: Annotation): void {
  const color = h.color ?? "yellow";
  const hex = COLOR_HEX[color] ?? "#f5d90a";
  const bg = MARK_BG[color] ?? MARK_BG["yellow"]!;
  mark.style.color = "inherit";
  mark.style.background = "transparent";
  switch (h.style ?? "highlight") {
    case "underline":
      mark.style.borderBottom = `2px solid ${hex}`;
      break;
    case "bold":
      mark.style.fontWeight = "700";
      mark.style.borderBottom = `2px solid ${hex}`;
      break;
    case "italic":
      mark.style.fontStyle = "italic";
      mark.style.borderBottom = `2px dotted ${hex}`;
      break;
    default: // highlight fill
      mark.style.backgroundColor = bg;
  }
  if (h.theme) mark.setAttribute("aria-label", `Theme: ${h.theme}`);
}

function applyMark(p: HTMLElement, h: Annotation): void {
  const cls = `sgh sgh-${h.color ?? "yellow"}`;
  if (!h.selected_text) {
    const strong = p.hasAttribute('data-sg-study-block') ? null : p.querySelector("strong");
    let node = strong ? strong.nextSibling : p.firstChild;
    const mark = document.createElement("mark");
    mark.className = cls;
    styleMark(mark, h);
    const moving: ChildNode[] = [];
    while (node) {
      const el = node as HTMLElement;
      if (!(el.classList?.contains("sgh-note-icon") || el.classList?.contains("sg-badge"))) {
        moving.push(node);
      }
      node = node.nextSibling;
    }
    if (!moving.length) return;
    p.insertBefore(mark, moving[0]!);
    moving.forEach(m => mark.appendChild(m));
    return;
  }
  // the phrase may cross a footnote letter or an earlier mark, so it is
  // found in the verse's joined text and wrapped as a range across nodes
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    if (t.parentElement?.closest(".sg-conn-chip, .sg-fn-chip, .sg-fn-mark, .sgh-note-icon, .sg-badge, .sg-theme-badges")) continue;
    if (!p.hasAttribute('data-sg-study-block') && t.parentElement?.closest('strong')) continue;
    nodes.push(t);
  }
  const joined = nodes.map(n => n.data).join("");
  const idx = joined.indexOf(h.selected_text);
  if (idx < 0) return;
  const locate = (i: number): [Text, number] | null => {
    let left = i;
    for (const n of nodes) { if (left <= n.data.length) return [n, left]; left -= n.data.length; }
    return null;
  };
  const from = locate(idx), to = locate(idx + h.selected_text.length);
  if (!from || !to) return;
  const range = document.createRange();
  range.setStart(from[0], from[1]);
  range.setEnd(to[0], to[1]);
  const mark = document.createElement("mark");
  mark.className = cls;
  styleMark(mark, h);
  try {
    if (from[0] === to[0]) { range.surroundContents(mark); return; }
    const frag = range.extractContents();
    mark.appendChild(frag);
    range.insertNode(mark);
  } catch { /* an element boundary the range can't cut: leave the text unmarked */ }
}

/** Verse popover: my notes + shared notes/highlights, with actions. */
export class NotesPopover extends Modal {
  constructor(private s: SGState, private svc: AnnotationService, private verseId: string, private passageTitle?: string) {
    super(s.app);
  }
  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sg-popover");
    contentEl.createEl("h3", { text: this.passageTitle ?? verseDisplay(this.verseId) ?? this.verseId });
    const mine = await this.svc.mine(this.verseId);
    const social = this.svc.social(this.verseId);
    if (mine.length) {
      contentEl.createEl("h4", { text: "Mine" });
      for (const a of mine) this.row(contentEl, a, true);
    }
    if (social.length) {
      contentEl.createEl("h4", { text: "Shared" });
      for (const a of social) this.row(contentEl, a as Annotation & { author_name?: string }, false);
    }
    if (!mine.length && !social.length) {
      contentEl.createEl("p", {
        text: "No marks on this verse yet — tap the verse and pick a color to highlight it.",
      });
    }
  }
  private row(root: HTMLElement, a: Annotation & { author_name?: string }, isMine: boolean) {
    const div = root.createDiv({ cls: "sg-ann-row" });
    const visLabel = a.visibility === "local" ? "🔒 device" : a.visibility === "private" ? "🔐 me"
      : a.visibility === "group" ? `👥 ${this.s.groups.find(g => g.group_id === a.group_id)?.name ?? "group"}`
        : "🌎 public";
    const kindLabel = a.annotation_type === "study-marker" ? "flashcard"
      : a.annotation_type;
    const themeLabel = a.theme ? ` · 🏷 ${a.theme}` : "";
    div.createEl("div", {
      cls: "sg-ann-meta",
      text: `${isMine ? "You" : a.author_name ?? "someone"} · ${kindLabel}`
        + `${a.color ? ` (${a.color}${a.style && a.style !== "highlight" ? ` ${a.style}` : ""})` : ""}`
        + `${themeLabel} · ${visLabel}`,
    });
    if (a.selected_text) div.createEl("blockquote", { text: a.selected_text });
    if (a.annotation_type === "study-marker") {
      try {
        const d = JSON.parse(a.content) as { front?: string; back?: string };
        div.createEl("p", { text: `🃏 ${d.front ?? "Card"}` });
        if (d.back) div.createEl("p", { cls: "sg-card-back", text: `→ ${d.back}` });
      } catch {
        div.createEl("p", { text: "🃏 Flashcard" });
      }
    } else if (a.annotation_type === "bookmark") {
      div.createEl("p", { text: `🔖 Bookmarked: ${parseBookmark(a.content).title ?? "this page"}` });
    } else if (isConnectionNote(a)) {
      const c = connectionOf(a.content)!;
      const go = div.createEl("button", { cls: "sg-ann-connect", text: `⇄ ${verseDisplay(c.anchor) ?? c.target}` });
      go.onclick = () => { this.close(); void this.s.app.workspace.openLinkText(c.link, ""); };
      if (c.why) div.createEl("p", { cls: "sg-ann-why", text: c.why });
    } else if (a.content) {
      div.createEl("p", { text: a.content });
    }
    if (isMine) {
      const actions = div.createDiv({ cls: "sg-ann-actions" });
      if (a.annotation_type === "note" && !isConnectionNote(a) && !a.content.startsWith("Song:") && !a.content.startsWith("⚠ Conflict copy")) {
        const edit = actions.createEl("button", { text: "Edit" });
        edit.onclick = () => {
          this.close();
          new NoteModal(this.s, "this verse", text => void this.svc.editNote(a.annotation_id, text), noteBody(a.content)).open();
        };
      }
      const share = actions.createEl("button", { text: "Change sharing" });
      share.onclick = (e) => {
        this.svc.visibilityMenu((vis, gid, label) => {
          void this.svc.setVisibility(a.annotation_id, vis, gid);
          new Notice(`Now visible to: ${label}`);
          this.close();
        }).showAtMouseEvent(e as MouseEvent);
      };
      const del = actions.createEl("button", { text: "Remove" });
      del.onclick = async () => {
        del.setAttribute("disabled", "true");
        del.setText("Removing…");
        try {
          await this.svc.remove(a.annotation_id);
          new Notice("Removed");
        } catch (e) {
          new Notice(`Delete failed: ${(e as Error).message}`);
        }
        this.close();
      };
    }
  }
  onClose() { this.contentEl.empty(); }
}
