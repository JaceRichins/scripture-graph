/* Scripture Graph Annotate
 *
 * LDS-Tools-style study marks for the immutable scripture layer:
 *   - select verse text in reading view -> right-click -> highlight color
 *   - attach a note to a verse (saved into that chapter's "My Notes" file)
 *   - highlights are a PERSONAL OVERLAY (plugin data.json), applied at render
 *     time; the canonical scripture files are never modified.
 *   - works in the plain chapter view, the Annotated view, and any embed.
 *   - warns when a canonical scripture file is deleted or modified (the
 *     engine auto-restores it; see OPERATIONS).
 */
"use strict";

const { Plugin, Menu, Modal, Notice, normalizePath } = require("obsidian");

const LIBRARY_PREFIX = "Library/";
const CANONICAL_PREFIX = "Library/01 Scriptures/Canonical/";
const PERSONAL_PREFIX = "80 Personal Notes/";
const COLORS = ["yellow", "green", "blue", "pink", "orange"];

class NoteModal extends Modal {
  constructor(app, refLabel, onSubmit) {
    super(app);
    this.refLabel = refLabel;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sgh-note-modal");
    contentEl.createEl("h3", { text: `Note on ${this.refLabel}` });
    const ta = contentEl.createEl("textarea", {
      attr: { placeholder: "Your thought… (saved into this chapter's My Notes)" },
    });
    const btn = contentEl.createEl("button", { text: "Save note" });
    btn.addEventListener("click", () => {
      const text = ta.value.trim();
      this.close();
      if (text) this.onSubmit(text);
    });
    setTimeout(() => ta.focus(), 30);
  }
  onClose() { this.contentEl.empty(); }
}

module.exports = class ScriptureGraphAnnotate extends Plugin {
  async onload() {
    this.data = Object.assign({ highlights: {}, notes: {} }, await this.loadData());

    // ---- render-time overlay on verse paragraphs -------------------------
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (!ctx.sourcePath || !ctx.sourcePath.startsWith(CANONICAL_PREFIX)) return;
      const fm = this.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter;
      const slug = fm && fm.slug;
      if (!slug) return;
      el.querySelectorAll("p").forEach((p) => {
        const strong = p.querySelector("strong");
        if (!strong) return;
        const n = parseInt(strong.textContent, 10);
        if (!Number.isFinite(n)) return;
        this.decorateVerse(p, `${slug}-${n}`);
      });
    });

    // ---- selection context menu (reading view) ---------------------------
    this.registerDomEvent(document, "contextmenu", (evt) => {
      const hit = this.resolveSelection(evt);
      if (!hit) return;
      evt.preventDefault();
      evt.stopPropagation();
      const menu = new Menu();
      for (const c of COLORS) {
        menu.addItem((i) =>
          i.setTitle(`Highlight ${c}`).setIcon("highlighter")
            .onClick(() => this.addHighlight(hit, c)));
      }
      menu.addSeparator();
      menu.addItem((i) => i.setTitle("Add verse note").setIcon("pencil")
        .onClick(() => this.promptNote(hit)));
      if ((this.data.highlights[hit.vslug] || []).length) {
        menu.addItem((i) => i.setTitle("Remove highlights on this verse")
          .setIcon("eraser").onClick(() => this.clearVerse(hit.vslug)));
      }
      menu.showAtMouseEvent(evt);
    });

    // ---- command-palette / mobile-toolbar commands -----------------------
    // (phones have no right-click; pin these to the mobile toolbar)
    for (const c of COLORS) {
      this.addCommand({
        id: `highlight-${c}`,
        name: `Highlight selection — ${c}`,
        callback: () => {
          const hit = this.resolveSelection(null);
          if (hit) this.addHighlight(hit, c);
          else new Notice("Select scripture text first (reading view)");
        },
      });
    }
    this.addCommand({
      id: "add-verse-note",
      name: "Add verse note",
      callback: () => {
        const hit = this.resolveSelection(null);
        if (hit) this.promptNote(hit);
        else new Notice("Select scripture text first (reading view)");
      },
    });
    this.addCommand({
      id: "remove-verse-highlights",
      name: "Remove highlights on selected verse",
      callback: () => {
        const hit = this.resolveSelection(null);
        if (hit) this.clearVerse(hit.vslug);
      },
    });

    // ---- the Library is read-only for humans -----------------------------
    // Every Library file always opens in reading view (works on phones too,
    // where the filesystem read-only attribute doesn't sync). Highlights and
    // verse notes are the editing surface; prose editing happens in
    // 80 Personal Notes.
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      try {
        const view = leaf && leaf.view;
        if (!view || view.getViewType() !== "markdown" || !view.file) return;
        if (!view.file.path.startsWith(LIBRARY_PREFIX)) return;
        const state = leaf.getViewState();
        if (state.state && state.state.mode !== "preview") {
          state.state.mode = "preview";
          leaf.setViewState(state);
        }
      } catch (e) { /* never break navigation */ }
    }));

    // ---- canonical protection warnings -----------------------------------
    this.registerEvent(this.app.vault.on("delete", (f) => {
      if (f.path && f.path.startsWith(CANONICAL_PREFIX)) {
        new Notice("⚠️ Canonical scripture deleted — the engine will restore it "
          + "automatically (within one study tick).", 8000);
      }
    }));
    this.registerEvent(this.app.vault.on("modify", (f) => {
      if (f.path && f.path.startsWith(CANONICAL_PREFIX)) {
        new Notice("⚠️ Canonical scripture is immutable — this change will be "
          + "reverted by the engine. Use highlights/notes instead.", 8000);
      }
    }));
  }

  // ---- overlay ----------------------------------------------------------
  decorateVerse(p, vslug) {
    const hs = this.data.highlights[vslug] || [];
    for (const h of hs) this.applyMark(p, h);
    if (this.data.notes[vslug]) {
      const icon = p.createSpan({ cls: "sgh-note-icon", text: "📝" });
      icon.setAttr("aria-label", "Open your note (My Notes)");
      icon.addEventListener("click", (e) => {
        e.preventDefault();
        this.openMyNotes(vslug);
      });
    }
  }

  applyMark(p, h) {
    if (!h.text) { // whole verse (skip the leading number)
      const strong = p.querySelector("strong");
      let node = strong ? strong.nextSibling : p.firstChild;
      const mark = document.createElement("mark");
      mark.className = `sgh sgh-${h.color}`;
      const moving = [];
      while (node) { moving.push(node); node = node.nextSibling; }
      if (!moving.length) return;
      p.insertBefore(mark, moving[0]);
      moving.forEach((m) => { if (!m.classList || !m.classList.contains("sgh-note-icon")) mark.appendChild(m); });
      return;
    }
    // substring: find in a single text node (verse bodies are plain text)
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = walker.nextNode())) {
      const idx = t.nodeValue.indexOf(h.text);
      if (idx === -1) continue;
      const range = document.createRange();
      range.setStart(t, idx);
      range.setEnd(t, idx + h.text.length);
      const mark = document.createElement("mark");
      mark.className = `sgh sgh-${h.color}`;
      try { range.surroundContents(mark); } catch (e) { /* crosses nodes — skip */ }
      return;
    }
  }

  // ---- selection resolution ---------------------------------------------
  // evt may be null (command-palette / mobile toolbar): fall back to the
  // current DOM selection instead of the mouse target.
  resolveSelection(evt) {
    const sel = window.getSelection();
    let targetEl = evt && evt.target instanceof Element ? evt.target : null;
    if (!targetEl && sel && sel.anchorNode) {
      targetEl = sel.anchorNode instanceof Element
        ? sel.anchorNode : sel.anchorNode.parentElement;
    }
    if (!targetEl || targetEl.closest(".cm-editor")) return null; // reading view only
    const container = targetEl.closest(".markdown-preview-view, .markdown-embed");
    if (!container) return null;
    const p = targetEl.closest("p") ||
      (sel.anchorNode && sel.anchorNode.parentElement
        ? sel.anchorNode.parentElement.closest("p") : null);
    if (!p) return null;

    let vslug = null;
    // embedded single verse carries the block ref in its src
    const embed = targetEl.closest(".internal-embed[src]");
    const src = embed && embed.getAttribute("src");
    if (src && src.includes("#^")) {
      vslug = src.split("#^")[1].trim();
    } else {
      const strong = p.querySelector("strong");
      const n = strong ? parseInt(strong.textContent, 10) : NaN;
      if (!Number.isFinite(n)) return null;
      let slug = null;
      if (src) { // whole-chapter embed: resolve the embedded file
        const dest = this.app.metadataCache.getFirstLinkpathDest(src.split("#")[0], "");
        slug = dest && this.app.metadataCache.getFileCache(dest)?.frontmatter?.slug;
        if (dest && !dest.path.startsWith(CANONICAL_PREFIX)) return null;
      } else {
        const file = this.app.workspace.getActiveFile();
        if (!file || !file.path.startsWith(CANONICAL_PREFIX)) return null;
        slug = this.app.metadataCache.getFileCache(file)?.frontmatter?.slug;
      }
      if (!slug) return null;
      vslug = `${slug}-${n}`;
    }
    if (!vslug || vslug.split("-").length < 3) return null;
    const text = sel && !sel.isCollapsed ? sel.toString().trim() : "";
    return { vslug, text: text.length >= 3 && text.length <= 600 ? text : null };
  }

  // ---- actions -----------------------------------------------------------
  async addHighlight(hit, color) {
    const arr = (this.data.highlights[hit.vslug] =
      this.data.highlights[hit.vslug] || []);
    arr.push({ color, text: hit.text, created: new Date().toISOString() });
    await this.saveData(this.data);
    this.rerender();
    new Notice(`Highlighted ${this.refLabel(hit.vslug)}`);
  }

  async clearVerse(vslug) {
    delete this.data.highlights[vslug];
    await this.saveData(this.data);
    this.rerender();
  }

  promptNote(hit) {
    new NoteModal(this.app, this.refLabel(hit.vslug), async (text) => {
      await this.appendNote(hit.vslug, hit.text, text);
      this.data.notes[hit.vslug] = (this.data.notes[hit.vslug] || 0) + 1;
      await this.saveData(this.data);
      this.rerender();
      new Notice("Note saved to My Notes");
    }).open();
  }

  // ---- verse slug helpers ------------------------------------------------
  chapterOf(vslug) { return vslug.slice(0, vslug.lastIndexOf("-")); }
  verseOf(vslug) { return vslug.slice(vslug.lastIndexOf("-") + 1); }

  canonicalFileFor(vslug) {
    const cslug = this.chapterOf(vslug);
    const files = this.app.vault.getMarkdownFiles();
    for (const f of files) {
      if (!f.path.startsWith(CANONICAL_PREFIX)) continue;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (fm && fm.slug === cslug) return f;
    }
    return null;
  }

  refLabel(vslug) {
    const f = this.canonicalFileFor(vslug);
    const title = f ? f.basename : this.chapterOf(vslug);
    return `${title}:${this.verseOf(vslug)}`;
  }

  async appendNote(vslug, selText, noteText) {
    const canonical = this.canonicalFileFor(vslug);
    if (!canonical) { new Notice("Could not resolve chapter"); return; }
    const title = canonical.basename;
    const myPath = normalizePath(canonical.path
      .replace(CANONICAL_PREFIX, PERSONAL_PREFIX + "Scriptures/")
      .replace(/\.md$/, " - My Notes.md"));
    let file = this.app.vault.getAbstractFileByPath(myPath);
    if (!file) {
      file = await this.app.vault.create(myPath,
        `---\nownership: personal\nmutable: user\ncontent_type: personal-notes\n---\n\n# ${title} — My Study\n\n## My Notes\n`);
    }
    const quoted = selText ? `> *"${selText}"*\n\n` : "";
    const entry = `\n#### [[${title}#^${vslug}|${this.refLabel(vslug)}]]\n${quoted}${noteText}\n`;
    let content = await this.app.vault.read(file);
    if (!content.includes("\n## Verse Notes")) content += "\n\n## Verse Notes\n";
    content += entry;
    await this.app.vault.modify(file, content);
  }

  openMyNotes(vslug) {
    const canonical = this.canonicalFileFor(vslug);
    if (!canonical) return;
    const myTitle = canonical.basename + " - My Notes";
    this.app.workspace.openLinkText(myTitle, "", false);
  }

  rerender() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view && view.getViewType && view.getViewType() === "markdown"
          && view.previewMode && view.previewMode.rerender) {
        view.previewMode.rerender(true);
      }
    });
  }
};
