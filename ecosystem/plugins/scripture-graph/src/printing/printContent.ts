import { App, TFile } from 'obsidian';
import { savedDocumentTitle } from '@scripture-graph/core-sdk';

export interface PrintPage { title: string; markdown: string; path: string; selected?: boolean }
export const lessonFolder = (path: string): string | null => {
  const parts = path.split('/');
  return parts[0] === 'Library' && ['Lessons', 'Study Plans', 'Research'].includes(parts[1]!) && parts.length >= 3 && parts[2]
    ? parts.slice(0, 3).join('/') : null;
};

/** Strip storage metadata, not content; citations must make sense on paper. */
export function printMarkdown(raw: string): string {
  return raw.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/```sg-actions\b[\s\S]*?```/g, '')
    .replace(/\s+\^[a-zA-Z0-9-]+(?=\r?$)/gm, '')
    .replace(/(?<!!)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_all, target: string, alias?: string) => {
      const [path, anchor] = target.split('#');
      let label = (path ?? '').split('/').pop()!.replace(/\.md$/, '');
      const verse = anchor?.startsWith('^') ? /-(\d+)$/.exec(anchor)?.[1] : undefined;
      if (verse) label += `:${verse}`;
      else if (anchor && !anchor.startsWith('^')) label += ` — ${anchor}`;
      return alias && alias !== label ? `${alias} (${label})` : label;
    });
}

export async function lessonPages(app: App, folder: string): Promise<PrintPage[]> {
  if (lessonFolder(folder) !== folder) throw new Error('Open a lesson project first.');
  const files = app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folder + '/'));
  const pages = await Promise.all(files.map(async file => {
    const markdown = await app.vault.read(file);
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const reference = ['reference-copy', 'references'].includes(String(fm.content_type)) || /^Reference(?: - | index$)/i.test(file.basename);
    const order = typeof fm.lesson_order === 'number' ? fm.lesson_order : /prepar/i.test(file.basename) ? 1 : reference ? 3 : 0;
    return { title: savedDocumentTitle(markdown, file.basename), path: file.path, markdown, selected: !reference, order };
  }));
  pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return pages;
}

export async function filePage(app: App, file: TFile): Promise<PrintPage> {
  const markdown = await app.vault.read(file);
  return { title: savedDocumentTitle(markdown, file.basename), path: file.path, markdown, selected: true };
}
