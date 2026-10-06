import type { App, TFile } from 'obsidian';
import { validDocumentTitle } from '@scripture-graph/core-sdk';
import { lessonProject, lessonRoot } from './lessonProject';

export function documentTitle(app: App, file: TFile): string {
  const title: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.sg_title;
  return typeof title === 'string' && validDocumentTitle(title) ? title : file.basename;
}

export function projectTitle(app: App, folder: string): string {
  if (lessonRoot(folder) === folder) {
    const primary = lessonProject(app, folder).primary;
    return primary ? documentTitle(app, primary) : folder.split('/').pop()!;
  }
  const files = app.vault.getMarkdownFiles().filter(f => f.parent?.path === folder);
  const primary = files.find(f => app.metadataCache.getFileCache(f)?.frontmatter?.lesson_order === 0)
    ?? files.find(f => f.basename === folder.split('/').pop());
  return primary ? documentTitle(app, primary) : folder.split('/').pop()!;
}

export const personalDocument = (path: string) => /^Library\/(Lessons|Study Plans|Research|AI Notes)\/.+\.md$/.test(path) && !path.split('/').some(p => p.startsWith('.'));
export const newDocumentRequest = (question: string) => /\b(?:create|make|write|start|plan|prepare)\b.{0,35}\b(?:new|another|different)\b.{0,20}\b(?:lesson|document|note|study plan)\b/i.test(question)
  || /\b(?:create|make|write|build|prepare)\s+(?:me\s+)?(?:a|an|another|new)\b.{0,35}\bstudy plan\b/i.test(question);
export function refersToDocument(question: string, previousAnswer = ''): boolean {
  return !newDocumentRequest(question) && (documentEditRequest(question)
    || (question.length <= 80 && !/[\n?]/.test(question) && /(?:what|which)[^?\n]{0,60}(?:title|name)[^?\n]*\?\s*$/i.test(previousAnswer)));
}

/** Only a direct editing request may resume a remembered personal document. */
export function documentEditRequest(question: string): boolean {
  return /^(?:(?:please|okay|ok)[,\s]+)?(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:rename|retitle|edit|revise|shorten|expand|update|change|call|name)\s+(?:my|this|that|the|our|current|saved|it)\b/i.test(question.trim());
}
