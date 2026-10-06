import type { App, TFile } from 'obsidian';

export type ProjectKind = 'lesson' | 'study-plan' | 'research';
const SHELVES: Record<string, ProjectKind> = { 'Lessons': 'lesson', 'Study Plans': 'study-plan', 'Research': 'research' };

/** Which kind of saved project a Library path belongs to, if any. */
export function projectKind(path: string): ProjectKind | null {
  const parts = path.split('/');
  return parts[0] === 'Library' ? SHELVES[parts[1] ?? ''] ?? null : null;
}

/** Every descendant belongs to the project root, including old flat reference sets and research subfolders. */
export function lessonRoot(path: string): string | null {
  const parts = path.split('/');
  if (parts.length === 3 && /\.md$/i.test(parts[2]!)) return null;
  return parts[0] === 'Library' && !!SHELVES[parts[1]!] && !!parts[2]
    && !parts.some(part => !part || part.startsWith('.')) ? parts.slice(0, 3).join('/') : null;
}

export function lessonProject(app: App, folder: string) {
  const files = app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folder + '/'));
  const reference = (file: TFile) => ['reference-copy', 'references'].includes(String(app.metadataCache.getFileCache(file)?.frontmatter?.content_type)) || /^Reference\b/i.test(file.basename);
  const preparation = (file: TFile) => /\b(prepar(?:ation|e)|teacher.?s? guide|teaching notes|handout)\b/i.test(file.basename);
  const direct = files.filter(f => f.parent?.path === folder && !reference(f) && !preparation(f));
  const marked = files.filter(f => f.parent?.path === folder && !reference(f) && app.metadataCache.getFileCache(f)?.frontmatter?.lesson_order === 0);
  const exact = direct.find(f => f.basename === folder.split('/').pop());
  const primary = marked.length === 1 ? marked[0]! : exact ?? (direct.length === 1 ? direct[0]! : null);
  const resources = files.filter(f => f !== primary).sort((a,b) => Number(reference(a)) - Number(reference(b)) || a.basename.localeCompare(b.basename));
  return { primary, resources, files, reference };
}
