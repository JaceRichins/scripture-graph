import { TFile } from 'obsidian';
import { safeVaultLink, safeMarkdown, renameDocumentMarkdown, personalDocumentPath } from '@scripture-graph/core-sdk';
import type { SGState } from '../state';
export async function renameDocument(s: SGState, context: { path: string; base: string } | undefined, path: string, title: string) {
  if (!context || path !== context.path || !safeVaultLink(path) || !personalDocumentPath(path)) throw new Error('Choose your own saved lesson, study plan, research page, or note to rename.');
  const file = s.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error('The document no longer exists.');
  const renamed = renameDocumentMarkdown(context.base, title);
  await s.app.vault.process(file, current => {
    if (current !== context.base) throw new Error('This document changed while AI was working. Your changes were kept; ask again using the latest version.');
    return renamed;
  });
}
export async function editDocument(s: SGState, context: { path: string; base: string } | undefined, path: string, markdown: string) {
  if (!context || path !== context.path || !safeVaultLink(path) || !personalDocumentPath(path)) throw new Error('The edit must target the document you asked about.');
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('The assistant supplied an empty edit.');
  if (!safeMarkdown(markdown)) throw new Error('The edit contains unsafe markup.');
  const file = s.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error('The document no longer exists.');
  const frontmatter = context.base.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)?.[0] ?? '';
  await s.app.vault.process(file, current => {
    if (current !== context.base) throw new Error('This document changed while AI was working. Your changes were kept; ask again to revise the latest version.');
    return frontmatter + '\n' + markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim() + '\n';
  });
}
