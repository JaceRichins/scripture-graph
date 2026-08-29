/** Annotation service: local-first writes, visibility, social queries,
 * background sync. Rendering decorates the reading view — canonical files
 * are never modified (§4, §65). */
import { Menu, Modal, Notice, TFile } from "obsidian";
import {
  makePartialAnchor, nowIso, parseVerseId, uuid, verseDisplay,
  type Annotation, type Visibility,
} from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, SGState, type SocialAnnotation } from "../state";

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
  constructor(state: SGState, private refLabel: string,
    private onSubmit: (text: string) => void) {
    super(state.app);
  }
  onOpen() {
    this.contentEl.addClass("sg-note-modal");
    this.contentEl.createEl("h3", { text: `Note on ${this.refLabel}` });
    const ta = this.contentEl.createEl("textarea", {
      attr: { placeholder: "Your thought…" },
    });
    const btn = this.contentEl.createEl("button", { text: "Save" });
    btn.addEventListener("click", () => {
      const v = ta.value.trim();
      this.close();
      if (v) this.onSubmit(v);
    });
    setTimeout(() => ta.focus(), 30);
  }
  onClose() { this.contentEl.empty(); }
}

export class AnnotationService {
  private syncTimer: number | null = null;

  constructor(private s: SGState) {
    s.redecorate = () => this.redecorateOpen();
  }

  /** Refresh decorations on every verse currently rendered, without
   * re-rendering the page (which would scroll the user to the top). */
  async redecorateOpen(): Promise<void> {
    const seen = new Set<HTMLElement>();
    const paras = document.querySelectorAll<HTMLElement>(
      ".markdown-preview-view [data-verse-id], .sg-reader [data-verse-id]");
    for (const p of Array.from(paras)) {
      if (seen.has(p)) continue;
      seen.add(p);
      const vid = p.getAttribute("data-verse-id");
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

  async syncNow(): Promise<void> {
    if (!this.s.signedIn) return;
    try {
      await this.s.sync.flush(this.s.api);
      await this.s.sync.pull(this.s.api);
      this.s.notify();
    } catch { /* offline — queue persists (§12) */ }
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

  async setVisibility(id: string, visibility: Visibility, groupId: string | null): Promise<void> {
    const a = await this.s.sync.getAnnotation(id);
    if (!a || a.author_user_id !== this.s.device.userId && a.author_user_id !== null) return;
    const next = { ...a, visibility, group_id: groupId, updated_at: nowIso() };
    await this.s.sync.save(next);
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
  p.querySelectorAll(".sgh, .sg-badge, .sgh-note-icon").forEach(el => {
    // re-render safety: unwrap old marks
    if (el.classList.contains("sgh")) {
      const parent = el.parentNode;
      while (el.firstChild) parent?.insertBefore(el.firstChild, el);
    }
    el.remove();
  });
  mine = mine.filter(a => !a.deleted_at);
  social = social.filter(a => !a.deleted_at);

  const visible = [
    ...(s.device.showScopes.mine ? mine : []),
    ...social,
  ].filter(a => a.annotation_type === "highlight");

  for (const h of visible) applyMark(p, h);

  // every annotation type leaves a visible, tappable trace on its verse
  const openPopover = () => new NotesPopover(s, svc, verseId).open();
  if (s.device.showScopes.mine) {
    const kinds: [string, string][] = [
      ["note", "📝"], ["study-marker", "🃏"], ["bookmark", "🔖"],
    ];
    for (const [kind, glyph] of kinds) {
      if (mine.some(a => a.annotation_type === kind)) {
        const icon = p.createSpan({ cls: "sgh-note-icon", text: glyph });
        icon.setAttribute("aria-label", "View your marks on this verse");
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
    const strong = p.querySelector("strong");
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
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let t: Node | null;
  while ((t = walker.nextNode())) {
    const idx = t.nodeValue?.indexOf(h.selected_text) ?? -1;
    if (idx === -1) continue;
    const range = document.createRange();
    range.setStart(t, idx);
    range.setEnd(t, idx + h.selected_text.length);
    const mark = document.createElement("mark");
    mark.className = cls;
    styleMark(mark, h);
    try { range.surroundContents(mark); } catch { /* spans nodes */ }
    return;
  }
}

/** Verse popover: my notes + shared notes/highlights, with actions. */
export class NotesPopover extends Modal {
  constructor(private s: SGState, private svc: AnnotationService, private verseId: string) {
    super(s.app);
  }
  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sg-popover");
    contentEl.createEl("h3", { text: verseDisplay(this.verseId) ?? this.verseId });
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
      div.createEl("p", { text: `🔖 ${a.content || "Bookmark"}` });
    } else if (a.content) {
      div.createEl("p", { text: a.content });
    }
    if (isMine) {
      const actions = div.createDiv({ cls: "sg-ann-actions" });
      const share = actions.createEl("button", { text: "Change sharing" });
      share.onclick = (e) => {
        this.svc.visibilityMenu((vis, gid, label) => {
          void this.svc.setVisibility(a.annotation_id, vis, gid);
          new Notice(`Now visible to: ${label}`);
          this.close();
        }).showAtMouseEvent(e as MouseEvent);
      };
      const del = actions.createEl("button", { text: "Delete" });
      del.onclick = async () => {
        del.setAttribute("disabled", "true");
        del.setText("Deleting…");
        try {
          await this.svc.remove(a.annotation_id);
          new Notice("Deleted");
        } catch (e) {
          new Notice(`Delete failed: ${(e as Error).message}`);
        }
        this.close();
      };
    }
  }
  onClose() { this.contentEl.empty(); }
}
