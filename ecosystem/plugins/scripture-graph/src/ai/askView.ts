/** Ask AI pane (§24): a right-sidebar chat over curated vault context, with
 * clickable [[wikilink]] citations, streamed answers, and save-as-note. */
import { ItemView, MarkdownRenderer, Menu, Notice, Platform, TFile, WorkspaceLeaf } from "obsidian";
import type { AiTask, AskAllowance } from "@scripture-graph/core-sdk";
import { ApiError, navigationRequest, usesTeam } from "@scripture-graph/core-sdk";
import { researchSharing } from '../social/sharedLessons';
import { safeMarkdown } from '@scripture-graph/core-sdk';
import { PERSONAL_PREFIX, SGState } from "../state";
import type { AnnotationService } from "../social/annotations";
import type { AiService } from "./aiService";
import { assembleContext, contextToMessages } from "./context";
import { perform, snapshot, verseText, type AskHost, type AssistantAction } from "./actions";
import { readingContext } from './readingContext';
import { documentTitle, projectTitle, refersToDocument, newDocumentRequest, documentEditRequest } from './documentContext';
import { lessonRoot, lessonProject } from './lessonProject';
import { renderLessonWorkspace } from './lessonWorkspace';
import { addPrintItems, addLessonPrintItem, PrintModal } from '../printing/printMenu';
import { tidyMenus } from '../study/readingSettings';

export const ASK_VIEW = "scripture-graph-ask";

interface Turn { role: "user" | "assistant"; text: string; model?: string }
interface DocumentDraft { title: string; body: string; path?: string; base?: string }

const ACTION_PRESETS: { label: string; task: AiTask; template: (a: string) => string }[] = [
  { label: "Explain", task: "verse", template: a => `Explain ${a} clearly for serious study.` },
  { label: "Connections", task: "connections", template: a => `What are the most meaningful connections to ${a} across the scriptures and this vault?` },
  { label: "Historical context", task: "history", template: a => `What is the historical context of ${a}?` },
  { label: "Language & text", task: "language", template: a => `What language, translation, or textual observations matter in ${a}?` },
  { label: "Findings", task: "evidence", template: a => `What findings, frameworks and honest counter-considerations relate to ${a}?` },
  { label: "Challenge it", task: "challenge", template: a => `Give the strongest skeptical reading of ${a}, then the strongest response.` },
];

export class AskView extends ItemView {
  private turns: Turn[] = [];
  private anchorChapter: string | null = null;
  private anchorVerse: string | null = null;
  private busy = false;
  /** the next question opens a new thread on the server */
  private freshNext = false;
  private serverOk: boolean | null = null;
  private checkingServer = false;
  private inputEl!: HTMLTextAreaElement;
  private selectedContext: string | null = null;

  private resizeComposer(): void {
    if (!this.inputEl?.style) return;
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = `${Math.min(156, Math.max(72, this.inputEl.scrollHeight))}px`;
  }
  private logEl!: HTMLElement;
  private headerEl!: HTMLElement;
  private modesEl!: HTMLElement;
  private mode: 'chat' | 'research' | 'lesson' | 'study-plan' = 'chat';
  private researchAllowance: AskAllowance | null = null;
  private studyPlanAllowance: AskAllowance | null = null;
  private lessonAllowance: AskAllowance | null = null;
  /** a research, lesson, or study plan team is working; chat stays available */
  private backgroundBusy = false;
  private presetsEl!: HTMLElement;
  private mobilePanel: HTMLElement | null = null;
  private releasePanel: (() => void) | null = null;
  private pageEl!: HTMLElement;
  private showingPage = false;
  private pageLink: string | null = null;
  private previewGeneration = 0;
  private editingDraft = false;
  private draft: DocumentDraft = { title: "", body: "" };
  private draftLoaded = false;
  private draftWrites: Promise<unknown> = Promise.resolve();
  private fileDrawer: HTMLElement | null = null;
  private memoryDraft: { text: string; version: number } | null = null;
  private memoryUserId: string | null = null;
  private documentChat: HTMLElement | null = null;
  private documentPath: string | null = null;
  private workFolder: string | null = null;
  private overlayTarget: string | null = null;
  private documentUser: string | null = null;
  private readOnlyDocument = false;

  openOverlay(path: string | null, readOnly = false) {
    this.readOnlyDocument = readOnly;
    this.documentPath = null; this.documentChat = null;
    this.documentUser = this.s.device.userId;
    this.overlayTarget = path;
    if (path && this.editableDocument(path)) void this.rememberDocument(path);
    this.showChat();
    this.showMobile();
  }

  showMobile() {
    void this.refreshResearchAllowance();
    if (this.mobilePanel) return;
    // Keep an opaque surface under iOS's translucent keyboard even as the
    // interactive panel shrinks to the usable viewport.
    const backdrop = document.body.createDiv({ cls: "sg-ai-backdrop", attr: { "aria-hidden": "true" } });
    backdrop.onclick = () => this.closeMobile();
    // Own the viewport instead of inheriting Obsidian's mobile modal sheet sizing.
    const panel = document.body.createDiv({ cls: "sg-ai-workspace", attr: { role: "dialog", "aria-label": "Scripture Graph assistant", "aria-modal": "true" } });
    const parent = this.contentEl.parentElement;
      panel.appendChild(this.contentEl);
      let fullHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const fit = () => {
        const viewport = window.visualViewport;
        // Obsidian's iOS keyboard overlays the webview without resizing
        // visualViewport. Its native bridge publishes the inset on <html>.
        const keyboard = Math.max(0, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--keyboard-height")) || 0);
        if (!keyboard) fullHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
        const top = viewport?.offsetTop ?? 0;
        backdrop.style.setProperty("height", `${Math.max(fullHeight, window.screen.height)}px`, "important");
        const height = Math.max(0, Math.min(viewport?.height ?? window.innerHeight, window.innerHeight, fullHeight - keyboard - top));
        panel.style.setProperty("height", `${height}px`, "important");
        panel.style.setProperty("top", `${top}px`, "important");
        panel.classList.toggle("sg-ai-keyboard", keyboard > 0 || height < fullHeight * 0.7);
      };
      const keyboardObserver = new MutationObserver(fit);
      keyboardObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
      keyboardObserver.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
      fit();
      window.visualViewport?.addEventListener("resize", fit);
      window.visualViewport?.addEventListener("scroll", fit);
      window.addEventListener("resize", fit);
      const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); this.closeMobile(); } };
      panel.addEventListener("keydown", escape);
      this.releasePanel = () => {
        keyboardObserver.disconnect();
        window.visualViewport?.removeEventListener("resize", fit);
        window.visualViewport?.removeEventListener("scroll", fit);
        window.removeEventListener("resize", fit);
        this.inputEl.blur();
        parent?.appendChild(this.contentEl);
        panel.remove();
        backdrop.remove();
        this.mobilePanel = null;
      };
    this.mobilePanel = panel;
    panel.classList.toggle('sg-overlay-chat', !this.showingPage);
    this.inputEl.blur();
  }

  closeMobile() { this.fileDrawer?.remove(); this.fileDrawer = null; this.releasePanel?.(); this.releasePanel = null; }
  async onClose() { this.closeMobile(); }

  constructor(leaf: WorkspaceLeaf, private s: SGState, private ai: AiService,
    private ann: AnnotationService, private host: AskHost) {
    super(leaf);
    // Navigation happens behind the floating chat. Reveal its destination
    // only after it opens; keep the conversation and any failure visible.
    const navigate = async (open: () => void | Promise<void>) => {
      const panel = this.mobilePanel;
      await open();
      if (this.mobilePanel === panel) this.closeMobile();
    };
    this.host = {
      ...host,
      openNote: link => navigate(() => host.openNote(link)),
      openChapter: title => navigate(() => host.openChapter(title)),
    };
  }

  getViewType() { return ASK_VIEW; }
  getDisplayText() { return "Ask Scripture Graph"; }
  getIcon() { return "sparkles"; }

  setAnchor(chapterTitle: string | null, verseId: string | null, seed?: string) {
    this.anchorChapter = chapterTitle;
    this.anchorVerse = verseId;
    this.renderHeader();
    this.selectedContext = seed?.startsWith('Selected from ') ? seed.replace(/\n\nMy request: $/, '').slice(0, 16000) : null;
    if (seed !== undefined && !this.selectedContext) this.inputEl.value = seed;
    if (this.selectedContext && this.inputEl.value.startsWith('Selected from ')) this.inputEl.value = '';
    this.resizeComposer();
    if (!Platform.isMobile) this.inputEl.focus();
  }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("sg-ask");
    this.headerEl = root.createDiv({ cls: "sg-ask-header" });
    this.logEl = root.createDiv({ cls: "sg-ask-log" });
    this.pageEl = root.createDiv({ cls: "sg-ai-page" });
    this.pageEl.hidden = true;
    // Capture before Obsidian's rendered-link handler can navigate behind AI.
    this.registerDomEvent(root, "click", event => this.followCitation(event), { capture: true });
    const presets = root.createDiv({ cls: "sg-ask-presets" });
    this.presetsEl = presets;
    const presetButtons: HTMLButtonElement[] = [];
    for (const p of ACTION_PRESETS) {
      const b = presets.createEl("button", { text: p.label });
      presetButtons.push(b);
      b.onclick = () => {
        const a = this.anchorVerse
          ? this.anchorVerse.replace(/^(.*)-(\d+)-(\d+)$/, () => `${this.anchorChapter}:${this.anchorVerse!.split("-").pop()}`)
          : this.anchorChapter ?? "this passage";
        void this.send(p.template(a), p.task);
      };
    }
    const inputRow = root.createDiv({ cls: "sg-ask-input" });
    this.inputEl = inputRow.createEl("textarea", {
      attr: { placeholder: "Ask or create anything…", "aria-label": "Your question", rows: "2" },
    });
    const send = inputRow.createEl("button", { text: "↑", attr: { "aria-label": "Send message" }, cls: "sg-ai-send" });
    this.inputEl.addEventListener('input', () => this.resizeComposer());
    const tools = inputRow.createEl("button", { text: "+", attr: { "aria-label": "Study tools", "aria-haspopup": "menu" }, cls: "sg-ai-tools sg-more-btn" });
    tools.onclick = event => {
      const menu = new Menu();
      // Tidy menus: the starter chips show only on an empty chat; here they
      // stay one tap away once the conversation has begun.
      if (tidyMenus() && this.presetsEl.hidden) {
        for (const b of presetButtons) menu.addItem(item => item.setTitle(b.getText()).onClick(() => b.click()));
        menu.addSeparator();
      }
      for (const [label, prompt] of [
        ["Write a lesson", "Help me write a lesson about "],
        ["Brainstorm", "Brainstorm ideas with me about "],
        ["Find scripture", "Find scriptures about "],
        ["Navigate to a page", "Take me to "],
        ["Highlight or take notes", "Help me mark and take notes on "],
      ]) menu.addItem(item => item.setTitle(label!).onClick(() => {
        this.showChat(); this.inputEl.value = prompt!; this.inputEl.focus();
      }));
      menu.addSeparator();
      menu.addItem(item => item.setTitle("All app commands").onClick(() => {
        this.closeMobile();
        (this.app as unknown as { commands?: { executeCommandById(id: string): void } }).commands?.executeCommandById("command-palette:open");
      }));
      menu.showAtMouseEvent(event);
    };
    send.onclick = () => void this.send(this.inputEl.value.trim(),
      this.anchorChapter ? "verse" : "vault");
    this.inputEl.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void this.send(this.inputEl.value.trim(), this.anchorChapter ? "verse" : "vault");
      }
    });
    this.renderHeader();
    this.registerDomEvent(window, 'online', () => { void this.refreshResearchAllowance(); });
    void this.restoreThread();
  }

  /** the last turns of this person's thread, as the server remembers them */
  private async restoreThread() {
    const background = await this.s.store.get<{ userId?: string | null; question: string; body?: { mode?: 'chat' | 'research' | 'lesson' | 'study-plan' } }>("pending_background_job");
    if (background && (background.userId === undefined || background.userId === this.s.device.userId)) {
      const mode = background.body?.mode ?? 'research';
      // Resume watching the team's saved job once any conversation being restored has the composer back.
      void (async () => {
        while (this.busy) await new Promise(resolve => window.setTimeout(resolve, 500));
        void this.send(background.question, "vault", undefined, mode);
      })();
    }
    const pending = await this.s.store.get<{ userId?: string | null; question: string; body?: { mode?: 'chat' | 'research' | 'lesson' | 'study-plan'; state?: { selectedText?: string; currentDocument?: { path: string; markdown: string } } } }>("pending_ask_job");
    if (pending && (pending.userId === undefined || pending.userId === this.s.device.userId)) {
      this.mode = pending.body?.mode ?? 'chat'; this.renderModes();
      this.selectedContext = pending.body?.state?.selectedText ?? null;
      const document = pending.body?.state?.currentDocument;
      if (document) await this.showPage(document.path);
      void this.send(pending.question, "vault", document ? { path: document.path, base: document.markdown } : undefined);
      return;
    }
    const draftUser = this.s.device.userId;
    const unsent = await this.s.store.get<{ question: string; mode: 'chat' | 'research' | 'lesson' | 'study-plan' }>(`ai:unsent-question:${draftUser ?? 'local'}`);
    if (draftUser === this.s.device.userId && unsent && !this.inputEl.value && !this.busy && !this.turns.length) {
      this.inputEl.value = unsent.question; this.mode = unsent.mode; this.resizeComposer();
    }
    const st = await this.ai.serverStatus();
    this.serverOk = st?.available ?? false;
    this.researchAllowance = st?.research ?? null;
    this.studyPlanAllowance = st?.studyPlan ?? null;
    this.lessonAllowance = st?.lesson ?? null;
    this.renderModes();
    if (st?.turns.length && !this.turns.length) {
      for (const t of st.turns.slice(-8)) {
        this.turns.push({ role: t.role, text: t.text });
        const el = this.appendTurn({ role: t.role, text: t.role === "assistant" ? "" : t.text });
        if (t.role === "assistant") await this.renderMarkdown(el, t.text);
      }
    }
    void this.renderStatusLine();
  }

  private renderModes() {
    if (!this.modesEl) return;
    this.modesEl.empty(); this.modesEl.hidden = this.showingPage;
    const choices = [['chat', 'Chat', 'Chat'], ['research', 'Research', 'Research'], ['lesson', 'Lesson preparation', 'Lesson'], ['study-plan', 'Create study plan', 'Study plan']] as const;
    const selected = choices.find(([mode]) => mode === this.mode)!;
    const button = this.modesEl.createEl('button', { cls: 'sg-ai-mode-trigger', attr: { 'aria-label': `Assistant mode: ${selected[1]}`, 'aria-haspopup': 'menu', title: `Change mode: ${selected[1]}` } });
    button.createEl('span', { text: selected[2], cls: 'sg-ai-mode-label' });
    button.createEl('span', { text: '⌄', cls: 'sg-ai-mode-chevron', attr: { 'aria-hidden': 'true' } });
    button.disabled = this.busy;
    button.onclick = event => {
      if (this.busy) return;
      const menu = new Menu();
      for (const [mode, label] of choices) {
        const allowance = mode === 'research' ? this.researchAllowance : mode === 'study-plan' ? this.studyPlanAllowance : mode === 'lesson' ? this.lessonAllowance : null;
        const quota = allowance?.unlimited ? ' · Unlimited' : allowance?.period === 'week' ? ` · ${allowance.remaining} of ${allowance.limit} left this week` : '';
        menu.addItem(item => item.setTitle(label + quota).setChecked(this.mode === mode).onClick(() => {
          if (this.busy) return;
          this.mode = mode; this.renderModes(); void this.refreshResearchAllowance();
        }));
      }
      if ([this.researchAllowance, this.studyPlanAllowance, this.lessonAllowance].some(allowance => allowance && !allowance.unlimited)) {
        menu.addSeparator();
        menu.addItem(item => item.setTitle('Resets Monday, midnight Mountain Time').setDisabled(true));
      }
      menu.showAtMouseEvent(event);
    };
  }

  private async refreshResearchAllowance() {
    if (this.checkingServer) return;
    this.checkingServer = true;
    const user = this.s.device.userId;
    try {
      const status = await this.ai.serverStatus();
      if (user !== this.s.device.userId) return;
      this.serverOk = status?.available ?? false;
      this.researchAllowance = status?.research ?? null;
      this.studyPlanAllowance = status?.studyPlan ?? null;
      this.lessonAllowance = status?.lesson ?? null;
      this.renderModes();
      if (!this.busy) void this.renderStatusLine();
    } finally { this.checkingServer = false; }
  }

  private renderHeader() {
    if (!this.headerEl) return;
    this.headerEl.empty();
    const files = this.headerEl.createEl("button", { text: "My work", attr: { "aria-label": "Open saved lessons and notes" } });
    files.onclick = () => this.showMyWork();
    this.modesEl = this.headerEl.createDiv({ cls: 'sg-ai-modes sg-ask-title' });
    this.renderModes();
    if (this.showingPage) this.headerEl.createSpan({ text: 'Ask AI', cls: 'sg-ask-title' });
    if (this.s.aiConnected) {
      const depth = this.headerEl.createEl("select");
      for (const d of ["focused", "balanced", "deep"] as const) {
        const o = depth.createEl("option", { text: d[0]!.toUpperCase() + d.slice(1), value: d });
        if (d === this.s.device.aiDepth) o.selected = true;
      }
      depth.onchange = () => {
        this.s.device.aiDepth = depth.value as "focused" | "balanced" | "deep";
        void this.s.saveDevice();
      };
    }
    const fresh = async () => {
      if (this.busy) return;
      this.turns = [];
      this.logEl.empty();
      this.presetsEl.hidden = false;
      try { await this.s.api.askReset(); } catch { /* offline: the next question starts fresh anyway */ }
      this.freshNext = true;
      this.mode = 'chat'; this.renderModes();
      this.documentPath = null; this.overlayTarget = null;
      await this.s.store.put(`ai:current-document:${this.s.device.userId ?? 'local'}`, null);
      void this.renderStatusLine();
    };
    const more = this.headerEl.createEl("button", { text: "More", attr: { "aria-label": "Conversation and print options" } });
    more.onclick = event => {
      const menu = new Menu();
      if (this.showingPage) menu.addItem(item => item.setTitle('Return to conversation').setIcon('messages-square').onClick(() => this.showChat()));
      const printTarget = this.documentPath ?? (this.showingPage && !this.workFolder ? this.pageLink : this.overlayTarget);
      const printFile = printTarget ? this.app.metadataCache.getFirstLinkpathDest(printTarget.split('#')[0]!, '') : null;
      if (this.editingDraft) {
        menu.addItem(item => item.setTitle('Print current draft…').setIcon('printer').onClick(() => {
          new PrintModal(this.app, [{ title: this.draft.title || 'My lesson', markdown: this.draft.body, path: this.draft.path ?? '' }]).open();
        }));
      } else if (printFile) addPrintItems(menu, this.app, printFile);
      else if (this.showingPage && this.workFolder) addLessonPrintItem(menu, this.app, this.workFolder);
      if (!this.showingPage) {
        const answer = [...this.turns].reverse().find(t => t.role === 'assistant' && t.text.trim());
        if (answer) menu.addItem(item => item.setTitle('Print latest AI answer…').setIcon('printer').setDisabled(this.busy).onClick(() => {
          new PrintModal(this.app, [{ title: 'Study notes', markdown: answer.text, path: '' }]).open();
        }));
      }
      menu.addSeparator();
      menu.addItem(item => item.setTitle("My memory").onClick(() => void this.showMemory()));
      menu.addItem(item => item.setTitle("New conversation").setDisabled(this.busy).onClick(() => void fresh()));
      menu.addItem(item => item.setTitle("View reading page").onClick(() => void this.showPage()));
      menu.showAtMouseEvent(event);
    };
    if (Platform.isMobile) {
      const close = this.headerEl.createEl("button", { text: "Done", attr: { "aria-label": "Close AI and return to reading" } });
      close.onclick = () => this.closeMobile();
    }
  }

  showMyWork() {
    if (this.host.openMyWork) { this.closeMobile(); this.host.openMyWork(); return; }
    this.fileDrawer?.remove();
    this.fileDrawer = null;
    this.showProjects();
  }

  private showProjects(folder?: string, resources = false) {
    this.overlayTarget = null;
    this.mobilePanel?.classList.remove('sg-overlay-chat');
    ++this.previewGeneration;
    this.documentPath = null; this.documentChat = null;
    this.workFolder = folder ?? null;
    this.showingPage = true; this.editingDraft = false;
    this.inputEl.blur();
    this.logEl.hidden = true; this.presetsEl.hidden = true; this.pageEl.hidden = false;
    this.pageEl.empty(); this.renderHeader();
    this.pageEl.createEl('h1', { text: folder ? projectTitle(this.app, folder) : 'My work' });
    if (folder && lessonRoot(folder)) {
      const root = lessonRoot(folder)!;
      renderLessonWorkspace(this.app, this.pageEl, root, { resources }, this,
        next => { if (next.document) void this.showPage(next.document); else this.showProjects(root, !!next.resources); }, () => this.showMyWork(), researchSharing(this.s));
      return;
    }
    this.pageEl.createEl('p', { text: folder ? 'Open a document to read, edit, or chat with AI.' : 'Your projects, lessons, and notes. Open a folder to continue.' });
    const search = this.pageEl.createEl('input', { type: 'search', cls: 'sg-ai-file-search', attr: { placeholder: 'Search projects and files…', 'aria-label': 'Search projects' } });
    const grid = this.pageEl.createDiv({ cls: 'sg-ai-projects' });
    const files = this.app.vault.getMarkdownFiles().filter(file => this.editableDocument(file.path)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    const render = () => {
      grid.empty();
      const query = search.value.trim().toLowerCase();
      const matched = files.filter(file => (file.path + documentTitle(this.app, file)).toLowerCase().includes(query));
      if (folder) {
        const back = grid.createEl('button', { text: '← All projects', cls: 'sg-ai-project-card' });
        back.onclick = () => this.showProjects();
        for (const file of matched.filter(file => file.path.slice(0, file.path.lastIndexOf('/')) === folder).sort((a,b) => Number(/^Reference/i.test(a.basename)) - Number(/^Reference/i.test(b.basename)))) {
          const button = grid.createEl('button', { cls: 'sg-ai-project-card' });
          button.createEl('strong', { text: documentTitle(this.app, file) });
          button.createEl('span', { text: /^Reference/i.test(file.basename) ? 'Reference' : 'Document · read and chat' });
          button.onclick = async () => { await this.host.openNote(file.path); this.closeMobile(); };
        }
      } else {
        const folders = new Map<string, number>();
        for (const file of matched) { const parent = lessonRoot(file.path) ?? file.path.slice(0, file.path.lastIndexOf('/')); folders.set(parent, (folders.get(parent) ?? 0) + 1); }
        for (const [path, count] of folders) {
          const button = grid.createEl('button', { cls: 'sg-ai-project-card' });
          button.createEl('strong', { text: `▱ ${projectTitle(this.app, path)}` });
          button.createEl('span', { text: `${count} files · Open project` });
          button.onclick = () => this.showProjects(path);
        }
      }
      if (!matched.length) grid.createEl('p', { text: query ? 'No matching projects or files.' : 'Ask AI to create a lesson or notes. Your project will appear here.' });
    };
    search.oninput = render; render();
  }

  private openFileDrawer(selectedFolder?: string) {
    if (this.fileDrawer) { this.fileDrawer.remove(); this.fileDrawer = null; return; }
    const root = this.mobilePanel ?? this.contentEl;
    const overlay = root.createDiv({ cls: "sg-ai-file-overlay" });
    this.fileDrawer = overlay;
    const close = () => { overlay.remove(); this.fileDrawer = null; };
    const scrim = overlay.createEl("button", { cls: "sg-ai-file-scrim", attr: { "aria-label": "Close file explorer" } });
    scrim.onclick = close;
    const drawer = overlay.createDiv({ cls: "sg-ai-file-drawer", attr: { role: "navigation", "aria-label": "Your Markdown files" } });
    const heading = drawer.createDiv({ cls: "sg-ai-file-heading" });
    heading.createEl("strong", { text: selectedFolder ? "Lesson files" : "My work" });
    heading.createEl("button", { text: "Close" }).onclick = close;
    const chat = drawer.createEl("button", { text: "Return to conversation", cls: "sg-ai-file-chat" });
    chat.onclick = () => { close(); this.showChat(); };
    const memory = drawer.createEl("button", { text: "My memory", cls: "sg-ai-file-chat" });
    memory.onclick = () => { close(); void this.showMemory(); };
    drawer.createEl("p", { cls: "sg-ai-file-help", text: "Your lessons and notes stay here, even when you start a new conversation." });
    const search = drawer.createEl("input", { type: "search", cls: "sg-ai-file-search", attr: { placeholder: "Find a lesson or note…", "aria-label": "Search saved work" } });
    const recentKey = `ai:recent-work:${this.s.device.userId ?? 'local'}`;
    if (!selectedFolder) void this.s.store.get<string[]>(recentKey).then(paths => {
      if (this.fileDrawer !== overlay || !paths?.length) return;
      const path = paths.find(p => this.app.vault.getAbstractFileByPath(p));
      if (!path) return;
      const resume = drawer.createEl("button", { text: `Continue: ${path.split('/').pop()!.replace(/\.md$/, '')}`, cls: "sg-ai-resume" });
      resume.onclick = () => { close(); void this.showPage(path); };
      search.before(resume);
    }).catch(() => {});
    const selectedRoot = selectedFolder ? lessonRoot(selectedFolder) ?? selectedFolder : null;
    const files = this.app.vault.getMarkdownFiles().filter(file => this.editableDocument(file.path) && (!selectedRoot || (lessonRoot(file.path) ?? file.parent?.path) === selectedRoot)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    const folders = new Map<string, typeof files>();
    for (const file of files) {
      const folder = lessonRoot(file.path) ?? file.path.slice(0, file.path.lastIndexOf("/"));
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder)!.push(file);
    }
    if (!files.length) drawer.createEl("p", { text: "Ask for a lesson or notes. The folder and its reference files will appear here." });
    for (const [folder, entries] of folders) {
      const group = drawer.createEl("details", { cls: "sg-ai-file-group" });
      group.open = folders.size === 1 || [...folders.keys()][0] === folder;
      group.createEl("summary", { text: projectTitle(this.app, folder) });
      entries.sort((a, b) => Number(/^Reference/i.test(a.basename)) - Number(/^Reference/i.test(b.basename)));
      const sources = group.createEl("details", { cls: "sg-ai-sources" });
      sources.createEl("summary", { text: "Resources" });
      const primary = lessonRoot(folder) ? lessonProject(this.app, folder).primary : null;
      let sourceCount = 0;
      for (const file of entries) {
        const isSource = primary ? file !== primary : /^Reference/i.test(file.basename);
        if (isSource) sourceCount++;
        const button = (isSource ? sources : group).createEl("button", { text: file === primary ? (file.path.startsWith('Library/Study Plans/') ? 'Read study plan' : file.path.startsWith('Library/Research/') ? 'Read research report' : 'Read lesson') : documentTitle(this.app, file), attr: { title: file.path, "aria-current": file.path === this.pageLink ? "page" : "false" } });
        button.onclick = () => { close(); void this.showPage(file.path); };
      }
      if (!sourceCount) sources.remove(); else group.appendChild(sources);
    }
    search.oninput = () => {
      const query = search.value.trim().toLowerCase();
      drawer.querySelectorAll<HTMLElement>('.sg-ai-file-group').forEach(group => {
        const folderMatch = group.querySelector('summary')?.textContent?.toLowerCase().includes(query);
        let matches = 0;
        group.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
          button.hidden = !!query && !folderMatch && !button.textContent?.toLowerCase().includes(query);
          if (!button.hidden) matches++;
        });
        group.hidden = !matches;
        (group as HTMLDetailsElement).open = !!query || group === drawer.querySelector('.sg-ai-file-group');
        group.querySelectorAll<HTMLDetailsElement>('.sg-ai-sources').forEach(source => { source.open = !!query; });
      });
    };
  }

  private async showMemory() {
    this.mobilePanel?.classList.remove('sg-overlay-chat');
    this.documentPath = null; this.documentChat = null;
    if (this.memoryUserId !== this.s.device.userId) this.memoryDraft = null;
    this.memoryUserId = this.s.device.userId;
    const generation = ++this.previewGeneration;
    this.showingPage = true;
    this.editingDraft = false;
    this.logEl.hidden = true;
    this.presetsEl.hidden = true;
    this.pageEl.hidden = false;
    this.pageEl.setText('Loading your memory…');
    this.renderHeader();
    try {
      const memory = this.memoryDraft ?? await this.s.api.askMemory();
      if (generation !== this.previewGeneration) return;
      this.memoryDraft = memory;
      this.pageEl.empty();
      this.pageEl.createEl('h2', { text: 'My memory' });
      this.pageEl.createEl('p', { text: 'Preferences the AI uses across conversations and devices signed into your account. Other family accounts have their own memory.' });
      this.pageEl.createEl('p', { text: 'Tell the chat “Remember that I teach adults and prefer 30-minute lessons,” or edit your preferences below. Nothing is added automatically from ordinary conversations.' });
      const input = this.pageEl.createEl('textarea', { cls: 'sg-ai-memory-input', attr: { 'aria-label': 'Your saved AI preferences', placeholder: 'Audience, lesson length, teaching style…', maxlength: '6000' } });
      input.value = memory.text;
      input.oninput = () => { memory.text = input.value; this.memoryDraft = memory; };
      const save = this.pageEl.createEl('button', { text: 'Save memory', cls: 'mod-cta' });
      save.onclick = async () => {
        save.disabled = true;
        try {
          const saved = await this.s.api.saveAskMemory(input.value, memory.version);
          memory.text = saved.text; memory.version = saved.version;
          this.memoryDraft = null;
          new Notice('Memory saved for future conversations.');
        } catch (error) { if (error instanceof ApiError && error.status === 409) this.memoryDraft = null; new Notice((error as Error).message); }
        finally { save.disabled = false; }
      };
      const clear = this.pageEl.createEl('button', { text: 'Clear text' });
      clear.onclick = () => { input.value = ''; memory.text = ''; this.memoryDraft = memory; input.focus(); };
      this.pageEl.createEl('p', { text: 'To forget everything, clear the text and save. Starting a new conversation does not erase memory.' });
    } catch (error) {
      if (generation === this.previewGeneration) this.pageEl.setText((error as Error).message);
    }
  }

  private async renderStatusLine() {
    this.logEl.querySelectorAll(".sg-ask-status").forEach(e => e.remove());
    if (this.turns.length) return;
    const el = this.logEl.createDiv({ cls: "sg-ask-status" });
    if (this.serverOk === false && !this.s.aiConnected) {
      el.setText(this.ai.statusError ?? 'The AI connection could not be confirmed. You can check again without losing your prompt.');
      const retry = el.createEl('button', { text: 'Check connection' });
      retry.onclick = async () => {
        retry.disabled = true; retry.setText('Checking…');
        await this.refreshResearchAllowance();
        if (retry.isConnected) { retry.disabled = false; retry.setText('Check connection'); }
      };
    } else if (this.s.aiConnected && !this.serverOk) {
      const b = await this.s.budget.state();
      el.setText(`This month: $${b.spentUsd.toFixed(2)}${b.capUsd ? ` / $${b.capUsd.toFixed(2)}` : ""} · your own AI wallet`);
    } else {
      el.setText("What would you like to do? Try “Make a lesson for this week” or “Find scriptures about hope.”");
    }
  }

  private async rememberDocument(path: string) {
    this.documentUser = this.s.device.userId;
    if (this.editableDocument(path)) await this.s.store.put(`ai:current-document:${this.s.device.userId ?? 'local'}`, path);
  }

  private async send(question: string, task: AiTask, resumedDocument?: { path: string; base: string }, modeOverride?: 'chat' | 'research' | 'lesson' | 'study-plan') {
    if (!question || this.busy) return;
    if (question.length > 60000) { new Notice('This prompt exceeds 60,000 characters. Your text is still here; split it into smaller requests.'); return; }
    const requestMode = modeOverride ?? this.mode;
    // Research, and lesson or study-plan creation, work as a background team: one at a time per person.
    if (this.backgroundBusy && !resumedDocument && usesTeam(requestMode, question, !!(this.overlayTarget && this.editableDocument(this.overlayTarget)))) {
      new Notice('Your research, lesson, or study plan is still being prepared. You can keep chatting while it finishes.');
      return;
    }
    if (requestMode !== 'research' && this.readOnlyDocument && documentEditRequest(question)) {
      this.appendTurn({ role: 'assistant', text: 'This shared lesson is read-only. Its author can rename or revise it from their own account.' });
      return;
    }
    this.busy = true;
    this.renderModes();
    const requestUser = this.s.device.userId;
    this.inputEl.blur();
    let documentContext: { path: string; base: string } | undefined;
    const reading = readingContext(this.showingPage ? this.pageLink : this.overlayTarget, this.anchorChapter, this.anchorVerse);
    // Research uses the displayed page as reading context, never the local
    // lesson editor's implicit selection or its prerequisite document picker.
    let documentPath = requestMode === 'research' ? null : resumedDocument?.path ?? (this.documentUser === requestUser ? this.overlayTarget && this.editableDocument(this.overlayTarget) ? this.overlayTarget : this.documentPath : null);
    const followup = requestMode !== 'research' && refersToDocument(question, [...this.turns].reverse().find(t => t.role === 'assistant')?.text);
    if (!resumedDocument && !followup && !this.showingPage && !this.overlayTarget) documentPath = null;
    const unsentKey = `ai:unsent-question:${requestUser ?? 'local'}`;
    try {
      await this.s.store.put(unsentKey, { question, mode: requestMode });
      if (newDocumentRequest(question)) documentPath = null;
      if (!documentPath && followup) {
        const remembered = await this.s.store.get<string>(`ai:current-document:${requestUser ?? 'local'}`);
        if (remembered && this.editableDocument(remembered) && this.app.vault.getAbstractFileByPath(remembered) instanceof TFile) documentPath = remembered;
        // No implicit project scan or blocking picker. The AI receives the
        // request without edit authority and can clarify a genuinely missing target.
      }
      if (this.s.device.userId !== requestUser) throw new Error('Your account changed. Send your request again.');
    } catch (error) { new Notice((error as Error).message); this.busy = false; this.renderModes(); return; }
    const originalDocumentChat = this.documentChat;
    if (documentPath) {
      try {
        const file = this.app.vault.getAbstractFileByPath(documentPath);
        if (!(file instanceof TFile)) throw new Error('This document is no longer available.');
        documentContext = resumedDocument ?? { path: documentPath, base: await this.app.vault.cachedRead(file) };
        await this.rememberDocument(documentPath);
        if (documentContext.base.length > 60000) throw new Error('This document is too long for an inline edit. Split it into smaller documents first.');
      } catch (error) { new Notice((error as Error).message); this.busy = false; this.renderModes(); return; }
    } else this.showChat();
    this.inputEl.value = "";
    this.resizeComposer();
    this.turns.push({ role: "user", text: question });
    const inline = documentContext ? originalDocumentChat : null;
    const addTurn = (turn: Turn) => {
      if (!inline) return this.appendTurn(turn);
      const element = inline.createDiv({ cls: `sg-turn sg-turn-${turn.role}`, text: turn.text });
      element.scrollIntoView({ block: 'end' });
      return element;
    };
    addTurn({ role: "user", text: question });
    const answerEl = addTurn({ role: "assistant", text: "…" });
    const navigation = requestMode === 'research' ? null : navigationRequest(question);
    if (navigation) {
      try {
        if (!(await this.host.ensure(navigation.page))) throw new Error("That chapter isn't available on this device yet.");
        if (navigation.verse && !(await verseText(this.s, this.host, navigation.page, navigation.verse))) {
          throw new Error("That verse wasn't found in the chapter.");
        }
        const result = await perform(this.s, this.ann, this.host, [{ do: "open", ...navigation }]);
        const text = result.join("\n");
        this.turns.push({ role: "assistant", text });
        answerEl.setText(text);
        if (!text.startsWith("Couldn't")) await this.s.store.put(unsentKey, null);
        if (!text.startsWith("Couldn't")) await this.showPage(navigation.page + (navigation.verse ? `#^${navigation.verse}` : ""));
      } catch (e) {
        answerEl.setText(`⚠ ${(e as Error).message}`);
      } finally { this.busy = false; this.renderModes(); }
      return;
    }
    // the family server reads the library and answers; a slow, honest wait
    if (requestMode !== 'chat' || documentContext || this.serverOk !== false || !this.s.aiConnected) {
      const background = usesTeam(requestMode, question, !!documentContext);
      if (background) { this.backgroundBusy = true; this.busy = false; this.renderModes(); }
      const t0 = Date.now();
      let progress = background ? (requestMode === 'research' ? "Starting the research team…" : "Starting your preparation team…") : "Sending your question…";
      const tick = window.setInterval(() => {
        const sec = Math.round((Date.now() - t0) / 1000);
        answerEl.setText(`${progress} ${sec}s`);
      }, 1000);
      try {
        const discussion = documentContext ? await this.s.store.get<Turn[]>(`ai:document-chat:${this.s.device.userId ?? 'local'}:${documentContext.path}`) ?? [] : [];
        const res = await this.ai.askServer(question,
          reading,
          { mode: requestMode, reset: this.freshNext, state: { ...snapshot(this.s, this.host), documentActions: ['edit_document', 'rename_document'], page: reading?.chapterTitle ?? null, selectedText: this.selectedContext, currentDocument: documentContext ? { path: documentContext.path, markdown: documentContext.base, discussion: discussion.slice(-12).map(turn => ({ role: turn.role, text: turn.text.slice(0, 8000) })) } : undefined }, onProgress: text => { progress = text; answerEl.setText(text); } });
        window.clearInterval(tick);
        this.freshNext = false;
        this.serverOk = true;
        if (this.s.device.userId !== requestUser) throw new Error('Your account changed. No document actions were applied.');
        await this.s.store.put(unsentKey, null);
        this.turns.push({ role: "assistant", text: res.text, model: res.model });
        await this.renderMarkdown(answerEl, res.text);
        if (res.actions.length) {
          let documents: string[] = [];
          const did = await perform(this.s, this.ann, this.host, res.actions as AssistantAction[], paths => { documents = paths; }, documentContext, requestMode === 'study-plan' ? 'study-plan' : 'lesson', !background);
          const box = answerEl.createDiv({ cls: "sg-ask-did" });
          for (const line of did) box.createDiv({ text: line });
          if (documentContext && did.length) res.text += '\n\n' + did.join('\n');
          if (documents[0]) {
            const primary = documents[0];
            await this.rememberDocument(primary);
            const read = box.createEl("button", { text: requestMode === 'study-plan' ? 'Open study plan' : requestMode === 'research' ? 'Open research' : 'Open lesson', cls: "sg-ai-result" });
            read.onclick = () => void this.showPage(primary);
            // A team finishing in the background must not pull the reader away from a conversation.
            if (background) new Notice(requestMode === 'research' ? 'Your research is ready in My Work.' : 'Your document is ready in My Work.');
            else await this.showPage(primary);
          }
          if (!documents.length && res.actions.some(a => (a as AssistantAction).do === "open")) {
            const current = this.app.workspace.getActiveFile();
            if (current) { this.pageLink = current.path; this.anchorChapter = current.basename; this.anchorVerse = null; this.renderHeader(); }
          }
        }
        const meta = answerEl.createDiv({ cls: "sg-ask-meta" });
        meta.setText(`${res.model} · ${Math.round(res.ms / 1000)}s`);
        const save = meta.createEl("button", { text: "Save as note" });
        save.onclick = () => void this.saveAsNote(question, res.text);
        if (documentContext) {
          const key = `ai:document-chat:${this.s.device.userId ?? 'local'}:${documentContext.path}`;
          const history = await this.s.store.get<Turn[]>(key) ?? [];
          await this.s.store.put(key, [...history, { role: 'user', text: question }, { role: 'assistant', text: res.text }].slice(-40));
          this.inputEl.blur();
          if (this.documentPath === documentContext.path && this.showingPage) {
            await this.showPage(documentContext.path);
            this.documentChat?.scrollIntoView({ block: 'end' });
          }
        }
        void this.renderStatusLine();
        return;
      } catch (e) {
        const msg = (e as Error).message || "";
        // no server, or no assistant on it: fall through to the wallet if there is one
        if (requestMode !== 'chat' || !this.s.aiConnected || documentContext) {
          const detail = e instanceof ApiError
            ? (e.status === 401 ? "Your sign-in needs reconnecting." : `The server replied, but the assistant couldn't finish: ${msg}`)
            : `${msg || "The connection ended before an answer arrived."} The server may still be processing your request.`;
          answerEl.setText(`⚠ ${detail}`);
          const retry = answerEl.createEl("button", { text: "Retry this question" });
          retry.onclick = () => { if (!this.busy) void this.send(question, task, undefined, requestMode); };
          return;
        }
      } finally {
        window.clearInterval(tick);
        if (background) this.backgroundBusy = false; else this.busy = false;
        this.restAtChat(requestMode);
        this.renderModes();
        if (requestMode !== 'chat') void this.refreshResearchAllowance();
      }
      this.busy = true;
    }
    try {
      const personal = this.s.device.aiUsePersonalNotes
        ? await this.s.sync.allAnnotations() : [];
      if (reading?.chapterTitle) await this.host.ensure(reading.chapterTitle);
      const ctx = await assembleContext(this.s, question,
        reading,
        personal);
      const built = contextToMessages(ctx, question); // [system, user-with-context]
      const history = this.turns.slice(0, -1).slice(-6)
        .map(t => ({ role: t.role, content: t.text }));
      const messages = [built[0]!, ...history, built[1]!];
      let acc = "";
      const res = await this.ai.ask(task, messages, delta => {
        acc += delta;
        answerEl.setText(acc);
      });
      await this.s.store.put(unsentKey, null);
      this.turns.push({ role: "assistant", text: res.text, model: res.model });
      await this.renderMarkdown(answerEl, res.text);
      const meta = answerEl.createDiv({ cls: "sg-ask-meta" });
      meta.setText(`${res.model} · ~$${res.costUsd.toFixed(4)}`);
      const save = meta.createEl("button", { text: "Save as note" });
      save.onclick = () => void this.saveAsNote(question, res.text);
      void this.renderStatusLine();
    } catch (e) {
      answerEl.setText(`⚠ ${(e as Error).message}`);
    } finally {
      this.busy = false;
      this.restAtChat(requestMode);
      this.renderModes();
    }
  }

  /** Research, lesson preparation and study plans are one-shot: when the run
   * has finished — well or badly — the selector goes back to Chat. Leaving a
   * heavy mode selected is how someone spends a week's research allowance on
   * a follow-up they meant as a question. Chat is the resting state; a heavy
   * run is always a deliberate choice, every time. */
  private restAtChat(requestMode: 'chat' | 'research' | 'lesson' | 'study-plan'): void {
    if (requestMode === 'chat' || this.mode === 'chat') return;
    this.mode = 'chat';
    // A draft left over from a failed run must not restore the heavy mode on
    // the next launch either.
    const key = `ai:unsent-question:${this.s.device.userId ?? 'local'}`;
    void this.s.store.get<{ question: string; mode: string }>(key).then(draft => {
      if (draft && draft.mode !== 'chat') return this.s.store.put(key, { ...draft, mode: 'chat' });
    }).catch(() => { /* the selector is already back at Chat */ });
    new Notice('Back to Chat. Pick Research, Lesson or Study plan again when you want another one.', 6000);
  }

  private appendTurn(t: Turn): HTMLElement {
    this.presetsEl.hidden = true;
    this.logEl.querySelectorAll(".sg-ask-status").forEach(e => e.remove());
    const el = this.logEl.createDiv({ cls: `sg-turn sg-turn-${t.role}` });
    el.setText(t.text);
    el.scrollIntoView({ block: "end" });
    return el;
  }

  private async renderMarkdown(el: HTMLElement, text: string) {
    if (!safeMarkdown(text)) { el.setText(text); return; }
    el.empty();
    await MarkdownRenderer.render(this.app, text, el, "", this);
  }

  private showChat() {
    this.mobilePanel?.classList.add('sg-overlay-chat');
    if (this.documentPath && this.documentUser === this.s.device.userId) void this.rememberDocument(this.documentPath);
    this.documentChat = null;
    this.inputEl.placeholder = 'Ask or create anything…';
    this.editingDraft = false;
    this.previewGeneration++;
    this.showingPage = false;
    this.pageEl.hidden = true;
    this.logEl.hidden = false;
    this.presetsEl.hidden = this.turns.length > 0;
    this.renderHeader();
  }

  private showDocuments() {
    this.previewGeneration++;
    this.showingPage = true;
    this.editingDraft = false;
    this.inputEl.blur();
    this.logEl.hidden = true;
    this.presetsEl.hidden = true;
    this.pageEl.hidden = false;
    this.pageEl.empty();
    this.renderHeader();
    const files = this.app.vault.getMarkdownFiles().filter(file => this.editableDocument(file.path)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    this.pageEl.createEl("h3", { text: "Your documents" });
    const ask = this.pageEl.createEl("button", { text: "Ask AI to make something", cls: "mod-cta" });
    ask.onclick = () => { this.showChat(); this.inputEl.focus(); };
    if (!files.length) this.pageEl.createEl("p", { text: "Just ask for a lesson, references, or notes. The finished pages will appear here." });
    for (const file of files) {
      const row = this.pageEl.createDiv({ cls: "sg-ai-document-row" });
      const open = row.createEl("button", { text: documentTitle(this.app, file) });
      open.onclick = () => void this.showPage(file.path);
      const edit = row.createEl("button", { text: "Edit" });
      edit.onclick = () => void this.showDraft(file.path);
    }
  }

  private followCitation(event: MouseEvent) {
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a.internal-link');
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = link.dataset.href ?? link.getAttribute('href');
    if (target) {
      const source = (this.showingPage ? this.pageLink : this.overlayTarget ?? this.anchorChapter)?.split('#')[0] ?? '';
      return this.openLinkedPage(target.startsWith('#') ? source + target : target);
    }
  }

  /** Response links use real page navigation. The host dismisses mobile AI
   * only after opening succeeds, preserving the conversation and draft. */
  private async openLinkedPage(link: string) {
    try {
      await this.host.openNote(link);
      const [path, fragment] = link.split('#');
      this.overlayTarget = this.app.metadataCache.getFirstLinkpathDest(path!, '')?.path ?? path!;
      if (this.editableDocument(this.overlayTarget)) await this.rememberDocument(this.overlayTarget);
      this.anchorChapter = this.overlayTarget.split('/').pop()!.replace(/\.md$/, '');
      this.anchorVerse = fragment?.startsWith('^') ? fragment.slice(1) : null;
    } catch (error) {
      new Notice(`Couldn't open that page: ${(error as Error).message}`);
    }
  }

  /** Explicit editing/reading workspace actions can still show their document. */
  private async showPage(link?: string) {
    if (this.mobilePanel?.classList.contains('sg-overlay-chat') && link) return this.openLinkedPage(link);
    this.documentPath = null; this.documentChat = null;
    this.editingDraft = false;
    const target = link ?? this.app.workspace.getActiveFile()?.path ?? this.anchorChapter ?? this.pageLink;
    if (!target) return void new Notice("Open a page first, or ask me to find a scripture.");
    const generation = ++this.previewGeneration;
    this.pageLink = target;
    this.showingPage = true;
    this.mobilePanel?.classList.remove('sg-overlay-chat');
    this.inputEl.blur();
    this.logEl.hidden = true;
    this.presetsEl.hidden = true;
    this.pageEl.hidden = false;
    this.pageEl.setText("Loading page…");
    this.renderHeader();
    try {
      const [path, fragment] = target.split("#");
      if (!(await this.host.ensure(path!))) throw new Error("This page isn't available on this device yet.");
      let file = this.app.metadataCache.getFirstLinkpathDest(path!, "");
      if (!file) {
        const fetched = this.app.vault.getAbstractFileByPath(this.host.pathFor?.(path!) ?? path!);
        if (fetched instanceof TFile) file = fetched;
      }
      if (!file) throw new Error("Page not found.");
      let raw = await this.app.vault.cachedRead(file);
      // Empty personal placeholders can shadow the actual reference by title.
      if (!raw.trim()) {
        const reference = this.app.vault.getMarkdownFiles().find(candidate => candidate.basename === file!.basename && candidate.path.startsWith("AI Library/"));
        if (reference) { file = reference; raw = await this.app.vault.cachedRead(reference); }
      }
      if (generation !== this.previewGeneration) return;
      this.pageLink = file.path + (fragment ? `#${fragment}` : '');
      this.anchorChapter = file.basename.replace(/ - My Notes$/, '');
      this.anchorVerse = fragment?.startsWith('^') ? fragment.slice(1) : null;
      if (this.editableDocument(file.path)) {
        this.documentPath = file.path;
        await this.rememberDocument(file.path);
        this.inputEl.placeholder = 'Ask about this document or tell AI what to change…';
        const key = `ai:recent-work:${this.s.device.userId ?? 'local'}`;
        void this.s.store.get<string[]>(key).then(paths => this.s.store.put(key, [file!.path, ...(paths ?? []).filter(p => p !== file!.path)].slice(0, 12))).catch(() => {});
      }
      this.pageEl.empty();
      const controls = this.pageEl.createDiv({ cls: "sg-ai-document-controls" });
      if (this.editableDocument(file.path)) {
        const project = controls.createEl('button', { text: '← Project' });
        project.onclick = () => this.showProjects(lessonRoot(file!.path) ?? file!.path.slice(0, file!.path.lastIndexOf('/')));
      }
      const resolvedTarget = file.path + (fragment ? `#${fragment}` : "");
      if (!this.editableDocument(file.path)) {
        const open = controls.createEl("button", { text: "Read full screen" });
        open.onclick = async () => { await this.host.openNote(resolvedTarget); this.closeMobile(); };
      }
      if (this.editableDocument(file.path)) {
        const edit = controls.createEl("button", { text: "Edit", cls: "sg-ai-create-here" });
        edit.onclick = () => void this.showDraft(file!.path);
        const references = controls.createEl("button", { text: "Resources" });
        references.onclick = () => {
          const root = lessonRoot(file!.path);
          if (root) this.showProjects(root, true); else this.openFileDrawer(file!.path.slice(0, file!.path.lastIndexOf('/')));
        };
      }
      const body = this.pageEl.createDiv({ cls: "sg-ai-preview-text" });
      const text = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
      if (!/^#{1,2}\s/.test(text.trimStart())) body.createEl("h1", { text: documentTitle(this.app, file) });
      const block = fragment?.startsWith("^") ? text.split("\n").find(line => line.trimEnd().endsWith(fragment)) : null;
      await MarkdownRenderer.render(this.app, (block ?? text).slice(0, 60000), body, file.path, this);
      if (this.editableDocument(file.path)) {
        const chat = this.pageEl.createDiv({ cls: 'sg-ai-document-chat' });
        this.documentChat = chat;
        chat.createEl('h2', { text: 'Discuss & revise' });
        chat.createEl('p', { text: 'Ask a question or describe a change below. Replies stay with this document.' });
        const history = await this.s.store.get<Turn[]>(`ai:document-chat:${this.s.device.userId ?? 'local'}:${file.path}`) ?? [];
        if (generation !== this.previewGeneration) return;
        for (const turn of history) {
          const message = chat.createDiv({ cls: `sg-turn sg-turn-${turn.role}` });
          await this.renderMarkdown(message, turn.text);
        }
      }
      if (!text.trim()) body.createEl("p", { text: "This page is empty. Choose Create to start a lesson or notes." });
      if (!block && text.length > 60000) body.createEl("p", { text: "Preview shortened. Open in reader for the full page." });
    } catch (error) {
      if (generation === this.previewGeneration) this.pageEl.setText((error as Error).message);
    }
  }

  /** §52: outputs become PERSONAL drafts, intentionally. */
  private async showDraft(documentPath?: string) {
    this.documentPath = null; this.documentChat = null;
    const generation = ++this.previewGeneration;
    if (!this.draftLoaded) {
      try {
        const saved = await this.s.store.get<DocumentDraft>("ai_workspace_draft");
        if (saved) this.draft = saved;
        this.draftLoaded = true;
      } catch { return void new Notice("Couldn't load your saved draft. Please try again."); }
    }
    if (documentPath !== undefined) {
      await this.draftWrites;
      try {
        const previous = { ...this.draft };
        await this.s.store.put(`ai_document_draft:${previous.path ?? "new"}`, previous);
        const buffered = await this.s.store.get<DocumentDraft>(`ai_document_draft:${documentPath || "new"}`);
        if (buffered) this.draft = buffered;
        else if (documentPath) {
          if (!this.editableDocument(documentPath)) throw new Error("Only your personal AI notes and lessons can be edited here.");
          const file = this.app.vault.getAbstractFileByPath(documentPath);
          if (!(file instanceof TFile)) throw new Error("This document is no longer available.");
          const raw = await this.app.vault.read(file);
          this.draft = { path: file.path, title: documentTitle(this.app, file), base: raw, body: raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "") };
        } else this.draft = { title: "", body: "" };
        await this.s.store.put("ai_workspace_draft", { ...this.draft });
      } catch (error) { return void new Notice((error as Error).message); }
    }
    if (generation !== this.previewGeneration) return;
    this.editingDraft = true;
    this.showingPage = true;
    this.logEl.hidden = true;
    this.presetsEl.hidden = true;
    this.pageEl.hidden = false;
    this.pageEl.empty();
    this.inputEl.blur();
    this.renderHeader();
    this.pageEl.createEl("h3", { text: this.draft.title || "Edit document" });
    const pickerLabel = this.pageEl.createEl("label", { text: "Document", cls: "sg-ai-draft-label" });
    const picker = pickerLabel.createEl("select");
    picker.createEl("option", { text: "New document", value: "" });
    for (const file of this.app.vault.getMarkdownFiles().filter(file => this.editableDocument(file.path)).sort((a, b) => b.stat.mtime - a.stat.mtime)) {
      picker.createEl("option", { text: documentTitle(this.app, file), value: file.path });
    }
    picker.value = this.draft.path ?? "";
    picker.onchange = () => void this.showDraft(picker.value);
    const titleLabel = this.pageEl.createEl("label", { text: "Title", cls: "sg-ai-draft-label" });
    const title = titleLabel.createEl("input", { type: "text", attr: { placeholder: "For example: Our family lesson" } });
    title.value = this.draft.title;
    title.readOnly = !!this.draft.path;
    const bodyLabel = this.pageEl.createEl("label", { text: "Your draft", cls: "sg-ai-draft-label" });
    const body = bodyLabel.createEl("textarea", { cls: "sg-ai-draft-body", attr: { placeholder: "Lesson ideas, scriptures, questions, or notes…", rows: "8" } });
    body.value = this.draft.body;
    const status = this.pageEl.createEl("p", { text: this.draft.path ? `Editing ${this.draft.path}. Save changes when ready.` : "Save to create a Markdown file in your library.", cls: "sg-ai-draft-help" });
    const remember = () => {
      this.draft = { ...this.draft, title: title.value, body: body.value };
      const copy = { ...this.draft };
      this.draftWrites = this.draftWrites.then(async () => {
        await this.s.store.put("ai_workspace_draft", copy);
        await this.s.store.put(`ai_document_draft:${copy.path ?? "new"}`, copy);
      }).then(() => {
        status.setText("Unsaved edits kept on this device. Use Save changes to update the file.");
      }).catch(() => { status.setText("Draft could not be saved on this device. Keep this screen open and try Save to my notes."); });
    };
    title.oninput = remember;
    body.oninput = remember;
    const buttons = this.pageEl.createDiv({ cls: "sg-ai-draft-actions" });
    const help = buttons.createEl("button", { text: "Ask AI for help" });
    help.onclick = () => {
      remember();
      this.showChat();
      this.inputEl.value = `Help me develop a lesson or notes${this.anchorChapter ? ` based on ${this.anchorChapter}` : ""}. ${this.draft.title ? `Title: ${this.draft.title}. ` : ""}${this.draft.body ? `Here is my draft:\n${this.draft.body}\n\nSuggest an improved draft.` : "Ask me who it is for and how long it should be."}`;
      this.inputEl.focus();
    };
    const add = buttons.createEl("button", { text: "Add latest AI answer" });
    const latest = [...this.turns].reverse().find(turn => turn.role === "assistant");
    add.disabled = !latest;
    add.onclick = () => { if (latest) { body.value = [body.value.trim(), latest.text].filter(Boolean).join("\n\n"); remember(); } };
    const save = buttons.createEl("button", { text: this.draft.path ? "Save changes" : "Create Markdown file", cls: "mod-cta" });
    const changed = () => { remember(); save.disabled = false; save.setText(this.draft.path ? "Save changes" : "Create Markdown file"); };
    title.oninput = changed;
    body.oninput = changed;
    save.onclick = async () => {
      if (!body.value.trim()) return void new Notice("Write something or add an AI answer first.");
      save.disabled = true;
      title.disabled = true; body.disabled = true; picker.disabled = true;
      remember();
      const copy = { ...this.draft };
      const name = copy.title.replace(/[<>:"/\\|?*#^\[\]]/g, "").trim().slice(0, 80) || "My lesson or notes";
      const folder = `${PERSONAL_PREFIX}AI Notes`;
      try {
        await this.draftWrites;
        if (copy.path) {
          if (!this.editableDocument(copy.path)) throw new Error("This file cannot be edited here.");
          const file = this.app.vault.getAbstractFileByPath(copy.path);
          if (!(file instanceof TFile)) throw new Error("This document was moved or deleted.");
          let updated = "";
          await this.app.vault.process(file, current => {
            if (current !== copy.base) throw new Error("This file changed elsewhere. Your edits are kept here; reopen it from the reader to compare before saving.");
            const frontmatter = current.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)?.[0] ?? "";
            updated = frontmatter + copy.body;
            return updated;
          });
          this.draft.base = updated;
        } else {
        if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
        let path = `${folder}/${name}.md`;
        if (this.app.vault.getAbstractFileByPath(path)) path = `${folder}/${name} (${Date.now()}).md`;
        const markdown = `---\nownership: personal\nmutable: user\ncontent_type: ai-draft\n---\n\n${copy.body.trim()}\n`;
        await this.app.vault.create(path, markdown);
        this.draft = { ...copy, path, base: markdown };
        }
        const path = this.draft.path!;
        await this.s.store.put("ai_workspace_draft", { ...this.draft });
        await this.s.store.put(`ai_document_draft:${path}`, { ...this.draft });
        if (!copy.path) await this.s.store.put("ai_document_draft:new", { title: "", body: "" });
        this.pageLink = path;
        title.readOnly = true;
        if (!copy.path) picker.createEl("option", { text: name, value: path });
        picker.value = path;
        status.setText(`Saved ${path}`);
        new Notice(`Saved “${name}”`);
        save.setText("Saved");
      } catch (error) { status.setText(`Couldn't save: ${(error as Error).message}`); save.disabled = false; }
      finally { title.disabled = false; body.disabled = false; picker.disabled = false; }
    };
  }

  private editableDocument(path: string) {
    return !path.split("/").includes("..") && path.endsWith(".md") &&
      (path.startsWith(`${PERSONAL_PREFIX}Lessons/`) || path.startsWith(`${PERSONAL_PREFIX}Study Plans/`) || path.startsWith(`${PERSONAL_PREFIX}Research/`) || path.startsWith(`${PERSONAL_PREFIX}AI Notes/`));
  }

  private async saveAsNote(question: string, answer: string) {
    const folder = `${PERSONAL_PREFIX}AI Notes`;
    const name = question.slice(0, 60).replace(/[<>:"/\\|?*#^\[\]]/g, "").trim() || "AI note";
    const path = `${folder}/${name} (${new Date().toISOString().slice(0, 10)}).md`;
    try {
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      await this.app.vault.create(path,
        `---\nownership: personal\nmutable: user\ncontent_type: ai-conversation\n---\n\n# ${name}\n\n**Q:** ${question}\n\n${answer}\n`);
      new Notice("Saved to Library/AI Notes");
    } catch (e) {
      new Notice(`Could not save: ${(e as Error).message}`);
    }
  }
}
