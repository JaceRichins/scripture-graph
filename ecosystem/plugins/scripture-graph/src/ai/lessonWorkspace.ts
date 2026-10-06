import { Notice, type App, type Component, type TFile } from 'obsidian';
import { documentTitle } from './documentContext';
import { lessonProject, projectKind, type ProjectKind } from './lessonProject';

export type LessonDestination = { resources?: boolean; document?: string };
/** Research is private until its author makes it public to the family. */
export interface ResearchSharing { status(path: string): Promise<string | null>; publish(path: string): Promise<string>; unpublish(id: string): Promise<void> }

const LABELS: Record<ProjectKind, { read: string; start: string; back: string; home: string; pages: string; count: (n: number) => string; find: string }> = {
  lesson: { read: 'Read lesson', start: 'Start here · Your teaching plan and discussion questions', back: 'Return to your teaching plan', home: '‹ Lesson home', pages: 'Resources', count: n => `${n} supporting pages · Preparation and references`, find: 'Find a resource…' },
  'study-plan': { read: 'Read study plan', start: 'Start here · Your reading schedule and reflections', back: 'Return to your reading schedule', home: '‹ Study plan home', pages: 'Resources', count: n => `${n} supporting pages · Preparation and references`, find: 'Find a resource…' },
  research: { read: 'Read research report', start: 'Start here · The answer, key findings and a guide to every page', back: 'Return to the research report', home: '‹ Research home', pages: 'Research pages', count: n => `${n} pages · Organized in folders`, find: 'Find a research page…' },
};

export function renderLessonWorkspace(app: App, parent: HTMLElement, folder: string, destination: LessonDestination,
  owner: Component, go: (destination: LessonDestination) => void, myWork: () => void, sharing?: ResearchSharing) {
  // Document reading belongs to DocView, never an embedded workspace panel.
  if (destination.document) { go({ document: destination.document }); return; }
  const project = lessonProject(app, folder);
  const kind = projectKind(folder) ?? 'lesson';
  const labels = LABELS[kind];
  const root = parent.createDiv({ cls: 'sg-lesson-workspace' });
  const navigation = root.createDiv({ cls: 'sg-lesson-navigation', attr: { 'aria-label': 'Project navigation' } });
  if (destination.resources || destination.document) navigation.createEl('button', { text: labels.home }).onclick = () => go({});
  navigation.createEl('button', { text: destination.resources || destination.document ? 'My Work' : '‹ My Work' }).onclick = myWork;
  const card = (title: string, description: string, action: () => void, primary = false) => {
    const button = root.createEl('button', { cls: `sg-lesson-door${primary ? ' sg-lesson-door-primary' : ''}` });
    button.createEl('strong', { text: title }); button.createEl('span', { text: description }); button.onclick = action;
  };
  if (!destination.resources) {
    if (project.primary) card(labels.read, labels.start, () => go({ document: project.primary!.path }), true);
    else {
      root.createEl('p', { text: 'Choose the document you want to read.' });
      for (const file of project.files.filter(f => !project.reference(f))) card(documentTitle(app, file), 'Open document', () => go({ document: file.path }), true);
    }
    card(labels.pages, labels.count(project.resources.length), () => go({ resources: true }));
    if (kind === 'research') renderVisibility(root, folder, sharing);
    return;
  }
  if (project.primary) card(labels.read, labels.back, () => go({ document: project.primary!.path }), true);
  const search = root.createEl('input', { type: 'search', cls: 'sg-work-search', attr: { placeholder: labels.find, 'aria-label': labels.find.replace('…', '') } });
  const list = root.createDiv({ cls: 'sg-lesson-resources' });
  const order = (file: TFile) => { const value: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.lesson_order; return typeof value === 'number' ? value : 99; };
  const render = () => {
    list.empty();
    const query = search.value.toLowerCase().trim();
    const matched = project.resources.filter(f => documentTitle(app, f).toLowerCase().includes(query));
    // Research keeps the folders its team chose; lessons keep preparation apart from references.
    const groups: [string, TFile[]][] = kind === 'research'
      ? [...matched.reduce((folders, file) => {
          const name = (file.parent?.path ?? folder).slice(folder.length + 1).replace(/\//g, ' / ') || 'Pages';
          folders.set(name, [...(folders.get(name) ?? []), file]);
          return folders;
        }, new Map<string, TFile[]>())].sort(([a], [b]) => a.localeCompare(b))
          .map(([name, files]) => [name, files.sort((a, b) => order(a) - order(b) || documentTitle(app, a).localeCompare(documentTitle(app, b)))])
      : [['Preparation & handouts', matched.filter(f => !project.reference(f))], ['Scriptures & references', matched.filter(f => project.reference(f))]];
    for (const [title, files] of groups) {
      if (!files.length) continue;
      list.createEl('h2', { text: title });
      for (const file of files) list.createEl('button', { text: documentTitle(app, file).replace(/^Reference - /i, ''), cls: 'sg-lesson-resource' }).onclick = () => go({ document: file.path });
    }
    if (!matched.length) list.createEl('p', { text: query ? 'No matching pages.' : 'No supporting pages have been added yet.' });
  };
  search.oninput = render; render();
}

function renderVisibility(parent: HTMLElement, folder: string, sharing?: ResearchSharing) {
  const row = parent.createDiv({ cls: 'sg-shared-status' });
  if (!sharing) { row.createSpan({ text: 'Private · Only you can read this research. Sign in to the family server to make it public.' }); return; }
  const status = row.createSpan({ text: 'Private · Checking sharing…' });
  const button = row.createEl('button');
  button.hidden = true;
  let shareId: string | null = null, confirming = false;
  const show = () => {
    button.hidden = false; button.disabled = false;
    status.setText(shareId ? 'Public to the family · Everyone in your family groups can read these pages. ' : 'Private · Only you can read this research. ');
    button.setText(shareId ? 'Make private' : confirming ? 'Confirm: make public to family' : 'Make public to family');
  };
  button.onclick = async () => {
    if (!shareId && !confirming) { confirming = true; show(); return; }
    button.disabled = true;
    try {
      if (shareId) { await sharing.unpublish(shareId); shareId = null; new Notice('This research is private again.'); }
      else { shareId = await sharing.publish(folder); new Notice('This research is now public to your family.'); }
    } catch (error) { new Notice((error as Error).message || 'Sharing could not be changed. Reconnect and try again.'); }
    confirming = false; show();
  };
  sharing.status(folder).then(id => { shareId = id; show(); }, () => { status.setText('Private · Sharing status is unavailable offline.'); });
}
