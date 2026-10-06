import { ItemView, Modal, Notice, type TFile, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import type { SGState } from '../state';
import type { ResearchSharing } from '../ai/lessonWorkspace';

export const SHARED_PROJECT_VIEW = 'scripture-graph-shared-project';

/** The author's own research: private until they make it public to the family. */
export function researchSharing(s: SGState): ResearchSharing | undefined {
  if (!s.signedIn) return undefined;
  return {
    status: async path => (await s.api.sharedProjects()).outgoing.find(project => project.path === path)?.id ?? null,
    publish: async path => (await s.api.publishProject(path)).id,
    unpublish: async id => { await s.api.unpublishProject(id); },
  };
}

export async function openSharedProject(s: SGState, id: string) {
  await s.app.workspace.getLeaf(false).setViewState({ type: SHARED_PROJECT_VIEW, state: { id }, active: true });
}

/** Research another family member made public: its report and pages, read only. */
export class SharedProjectView extends ItemView {
  private id = ''; private page: string | null = null; private seq = 0; private title = 'Shared research';
  constructor(leaf: WorkspaceLeaf, private s: SGState, private back: () => void) { super(leaf); this.navigation = true; }
  getViewType() { return SHARED_PROJECT_VIEW; }
  getDisplayText() { return this.title; }
  getIcon() { return 'book-open'; }
  getState() { return { id: this.id }; }
  async setState(state: unknown, result: ViewStateResult) {
    await super.setState(state, result);
    const id = (state as { id?: unknown } | null)?.id;
    this.id = typeof id === 'string' ? id : ''; this.page = null;
    if (this.contentEl.isConnected) await this.render();
  }
  async onOpen() { this.contentEl.addClass('sg-doc', 'sg-shared-lesson'); if (this.id) await this.render(); }
  async onClose() { this.seq++; this.contentEl.empty(); }
  private open(page: string | null) { this.page = page; void this.render(); }
  private async render() {
    if (!this.id) return;
    const seq = ++this.seq;
    const el = this.contentEl;
    try {
      if (this.page) {
        const page = await this.s.api.sharedProjectPage(this.id, this.page);
        if (seq !== this.seq) return;
        el.empty(); this.title = page.title;
        const header = el.createDiv({ cls: 'sg-shared-header' });
        header.createEl('button', { text: '‹ Research home' }).onclick = () => this.open(null);
        header.createEl('button', { text: 'My Work' }).onclick = this.back;
        const body = el.createDiv({ cls: 'sg-shared-body' });
        body.createEl('p', { cls: 'sg-shared-status', text: `Read only · Last saved ${new Date(page.updated_at).toLocaleString()}` });
        renderSharedLesson(body, page.markdown);
      } else {
        const project = await this.s.api.sharedProject(this.id);
        if (seq !== this.seq) return;
        el.empty(); this.title = project.title;
        el.createDiv({ cls: 'sg-shared-header' }).createEl('button', { text: '‹ My Work' }).onclick = this.back;
        const body = el.createDiv({ cls: 'sg-shared-body sg-lesson-workspace' });
        body.createEl('h1', { text: project.title });
        body.createEl('p', { cls: 'sg-shared-status', text: `Research from ${project.owner_name} · Public to the family · Read only` });
        const report = project.files.find(file => !file.folder);
        if (report) {
          const door = body.createEl('button', { cls: 'sg-lesson-door sg-lesson-door-primary' });
          door.createEl('strong', { text: 'Read research report' }); door.createEl('span', { text: 'Start here · The answer, key findings and a guide to every page' });
          door.onclick = () => this.open(report.path);
        }
        const folders = new Map<string, typeof project.files>();
        for (const file of project.files.filter(file => file !== report)) folders.set(file.folder, [...(folders.get(file.folder) ?? []), file]);
        for (const [folder, files] of [...folders].sort(([a], [b]) => a.localeCompare(b))) {
          body.createEl('h2', { text: folder.replace(/\//g, ' / ') || 'Pages' });
          for (const file of files) body.createEl('button', { cls: 'sg-lesson-resource', text: file.title }).onclick = () => this.open(file.path);
        }
      }
      el.scrollTop = 0;
    } catch {
      if (seq !== this.seq) return;
      el.empty();
      el.createEl('button', { text: '‹ My Work' }).onclick = this.back;
      el.createEl('p', { text: 'This research is unavailable or you are offline. Its author may have made it private.' });
      el.createEl('button', { text: 'Retry' }).onclick = () => { void this.render(); };
    }
  }
}

export const SHARED_LESSON_VIEW = 'scripture-graph-shared-lesson';
export const isLesson = (path: string) => /^Library\/Lessons\/[^/]+\/[^/]+\.md$/.test(path);

/** Display the author's text without executing embeds, HTML, or Markdown plugins. */
export function renderSharedLesson(parent: HTMLElement, markdown: string) {
  const body = markdown.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/!\[\[([^\]]+)\]\]/g, '[Attachment: $1]')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, title, label) => label || title)
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+\^[a-z0-9-]+$/gm, '');
  let code = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { code = !code; continue; }
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.+)/.exec(line);
    const tag = code ? 'pre' : heading ? `h${heading[1]!.length}` : /^>/.test(line) ? 'blockquote' : 'p';
    const text = heading?.[2] ?? line.replace(/^>\s?/, '').replace(/^\s*[-*]\s+/, '• ');
    const el = document.createElement(tag); parent.append(el);
    // Keep emphasis useful while all other source markup remains inert text.
    const chunks = text.split(/(\*\*[^*]+\*\*)/g);
    for (const chunk of chunks) {
      if (chunk.startsWith('**') && chunk.endsWith('**')) { const strong = document.createElement('strong'); strong.textContent = chunk.slice(2, -2); el.append(strong); }
      else el.append(document.createTextNode(chunk));
    }
  }
}

export async function openSharedLesson(s: SGState, id: string) {
  await s.app.workspace.getLeaf(false).setViewState({ type: SHARED_LESSON_VIEW, state: { id }, active: true });
}

export class SharedLessonView extends ItemView {
  private id = ''; private seq = 0; private title = 'Shared lesson'; private busy = false;
  private timer?: number;
  constructor(leaf: WorkspaceLeaf, private s: SGState, private back: () => void) { super(leaf); this.navigation = true; }
  getViewType() { return SHARED_LESSON_VIEW; }
  getDisplayText() { return this.title; }
  getIcon() { return 'book-open'; }
  getState() { return { id: this.id }; }
  async setState(state: unknown, result: ViewStateResult) {
    await super.setState(state, result);
    this.id = typeof (state as any)?.id === 'string' ? (state as any).id : '';
    this.seq++; this.busy = false;
    if (this.contentEl.isConnected) await this.refresh();
  }
  async onOpen() {
    this.contentEl.addClass('sg-doc', 'sg-shared-lesson');
    this.timer = window.setInterval(() => { if (document.visibilityState === 'visible' && this.contentEl.isShown()) void this.refresh(); }, 30000);
    this.registerDomEvent(window, 'focus', () => { void this.refresh(); });
    if (this.id) await this.refresh();
  }
  async onClose() { this.seq++; this.busy = false; if (this.timer) window.clearInterval(this.timer); this.contentEl.empty(); }
  private async refresh() {
    if (!this.id || this.busy) return;
    this.busy = true; const seq = ++this.seq;
    try {
      const page = await this.s.api.sharedLesson(this.id);
      if (seq !== this.seq) return;
      const scroll = this.contentEl.scrollTop;
      this.contentEl.empty(); this.title = page.title;
      const header = this.contentEl.createDiv({ cls: 'sg-shared-header' });
      header.createEl('button', { text: '‹ My Work' }).onclick = this.back;
      header.createEl('button', { text: 'Refresh' }).onclick = () => { void this.refresh(); };
      const body = this.contentEl.createDiv({ cls: 'sg-shared-body' });
      body.createEl('h1', { text: page.title });
      body.createEl('p', { cls: 'sg-shared-status', text: `From ${page.owner_name} · Read only · Last saved ${new Date(page.updated_at).toLocaleString()}` });
      renderSharedLesson(body, page.markdown);
      this.contentEl.scrollTop = scroll;
    } catch {
      if (seq !== this.seq) return;
      // Remove previously displayed content if access was revoked or cannot be checked.
      this.contentEl.empty();
      this.contentEl.createEl('button', { text: '‹ My Work' }).onclick = this.back;
      this.contentEl.createEl('p', { text: 'This lesson is unavailable or you are offline. Reconnect and refresh; the author may have stopped sharing.' });
      this.contentEl.createEl('button', { text: 'Refresh' }).onclick = () => { void this.refresh(); };
    } finally { if (seq === this.seq) this.busy = false; }
  }
}

export async function sharedLessonsSection(parent: HTMLElement, s: SGState) {
  if (!s.signedIn) return;
  const slot = parent.createDiv({ cls: 'sg-shared-list' });
  const load = async () => {
    slot.empty();
    try {
      const pages = await s.api.sharedLessons(); if (!slot.isConnected) return;
      if (pages.incoming.length) {
        slot.createEl('h3', { text: 'Shared with me' });
        for (const page of pages.incoming) {
          const button = slot.createEl('button', { cls: 'sg-work-item' });
          const label = button.createSpan(); label.createEl('strong', { text: page.title });
          label.createEl('small', { text: `Read lesson · Shared by ${page.owner_name} · Read only` });
          button.onclick = () => { void openSharedLesson(s, page.id); };
        }
      }
      if (pages.outgoing.length) {
        const details = slot.createEl('details'); details.createEl('summary', { text: 'Lessons I’m sharing' });
        for (const page of pages.outgoing) {
          const row = details.createDiv(); row.createEl('p', { text: `${page.title} — shared with ${page.recipient_name}` });
          const stop = row.createEl('button', { text: 'Stop sharing' });
          stop.onclick = async () => { stop.disabled = true; try { await s.api.revokeLesson(page.id); await load(); } catch { stop.disabled = false; new Notice('Could not stop sharing. Reconnect and try again.'); } };
        }
      }
      try {
        const research = await s.api.sharedProjects(); if (!slot.isConnected) return;
        if (research.incoming.length) {
          slot.createEl('h3', { text: 'Research shared with the family' });
          for (const project of research.incoming) {
            const button = slot.createEl('button', { cls: 'sg-work-item' });
            const label = button.createSpan(); label.createEl('strong', { text: project.title });
            label.createEl('small', { text: `Research · ${project.pages} pages · From ${project.owner_name} · Read only` });
            button.onclick = () => { void openSharedProject(s, project.id); };
          }
        }
        if (research.outgoing.length) {
          const details = slot.createEl('details'); details.createEl('summary', { text: 'Research I’ve made public' });
          for (const project of research.outgoing) {
            const row = details.createDiv(); row.createEl('p', { text: `${project.title} — public to the family` });
            const stop = row.createEl('button', { text: 'Make private' });
            stop.onclick = async () => { stop.disabled = true; try { await s.api.unpublishProject(project.id); await load(); } catch { stop.disabled = false; new Notice('Could not make it private. Reconnect and try again.'); } };
          }
        }
      } catch { /* A family server without shared research still lists shared lessons. */ }
    } catch {
      slot.createEl('p', { text: 'Shared lessons could not be loaded.' });
      slot.createEl('button', { text: 'Retry' }).onclick = () => { void load(); };
    }
  };
  await load();
}

export class ShareLessonModal extends Modal {
  constructor(private s: SGState, private file: TFile) { super(s.app); }
  async onOpen() {
    const c = this.contentEl; c.empty(); c.createEl('h2', { text: 'Share lesson progress' });
    c.createEl('p', { text: `${this.file.basename}: the selected person can read this file’s saved updates. Stop sharing later in My Work.` });
    try {
      const { recipients } = await this.s.api.pageRecipients(); if (!c.isConnected) return;
      const select = c.createEl('select', { attr: { 'aria-label': 'Person to share with' } });
      select.createEl('option', { text: 'Choose a person', value: '' });
      for (const person of recipients) select.createEl('option', { text: person.display_name, value: person.user_id });
      const status = c.createEl('p', { attr: { role: 'status' } });
      const share = c.createEl('button', { text: 'Share read-only access', cls: 'mod-cta' }); share.disabled = true;
      select.onchange = () => { share.disabled = !select.value; };
      share.onclick = async () => { share.disabled = true; try { await this.s.api.shareLesson(this.file.path, select.value); new Notice('Lesson shared.'); this.close(); } catch { status.setText('Sync this lesson first, then try again.'); share.disabled = false; } };
    } catch { c.createEl('p', { text: 'Could not load people. Reconnect and reopen sharing.' }); }
  }
  onClose() { this.contentEl.empty(); }
}
