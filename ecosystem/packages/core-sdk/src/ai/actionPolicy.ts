import { z } from 'zod';
import { validDocumentTitle } from './documentTitle';
import { validPageTitle, validProjectFolder } from './assistantTeam';
/** Paths are vault links, never OS paths, hidden files, or external launch URLs. */
export function safeVaultLink(value: string): boolean {
  if (!value || value.length > 500 || /[\\:%\x00-\x1f]/.test(value) || value.startsWith('/')) return false;
  const path = value.split('#')[0]!;
  return !!path && path.split('/').every(part => !!part && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith(' '));
}
export function safeMarkdown(value: string): boolean {
  if (/<\/?[a-z][^>]*>/i.test(value) || /!\[/.test(value)) return false;
  for (const match of value.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) if (!safeVaultLink(match[1]!)) return false;
  for (const match of value.matchAll(/\]\(([^\s)]+)/g)) {
    const target = match[1]!;
    if (!/^https?:\/\//i.test(target) && !target.startsWith('#') && !safeVaultLink(target)) return false;
  }
  return !/\]\s*:\s*(?:file|obsidian|javascript|data|command):/i.test(value);
}
const link = z.string().refine(safeVaultLink, 'Only normal vault page links are allowed');
const verse = z.string().regex(/^[a-z0-9][a-z0-9-]{0,100}$/);
const markdown = z.string().min(1).max(100000).refine(safeMarkdown, 'Executable markup and embedded resources are not allowed');
const ref = z.object({ chapter: link, verse: verse.nullish() }).strict();
/** Personal documents the assistant may revise or rename in place. */
export const personalDocumentPath = (path: string) => /^Library\/(Lessons|Study Plans|Research|AI Notes)\/.+\.md$/.test(path);
const pageTitle = z.string().refine(validPageTitle, 'Use a plain page title');
const researchPage = z.object({ folder: z.string().refine(validProjectFolder, 'Use plain folder names, at most two levels deep'), title: pageTitle, markdown }).strict();
/** The Aa reading settings the assistant may change (22 Sep 2026), each with
 * the only values it may take. The app holds them to the same ranges. */
export const READING_SETTINGS = {
  readingSize: { range: [0.8, 1.6] },
  lineSpacing: { range: [1.3, 2.1] },
  typeface: { choices: ['sans', 'serif', 'book'] },
  readingTheme: { choices: ['scene', 'paper', 'sepia', 'night'] },
  pageWidth: { choices: ['normal', 'wide'] },
  focusMode: { flag: true },
  marginNotes: { flag: true },
} as const;
const READING_SETTING_KEYS = Object.keys(READING_SETTINGS) as (keyof typeof READING_SETTINGS)[];
function readingSettingIssue(key: string, value: unknown): string | null {
  const rule = (READING_SETTINGS as Record<string, { range?: readonly number[]; choices?: readonly string[]; flag?: boolean }>)[key];
  if (!rule) return null;
  if (rule.range) return typeof value === 'number' && value >= rule.range[0]! && value <= rule.range[1]! ? null : `${key} must be a number from ${rule.range[0]} to ${rule.range[1]}`;
  if (rule.choices) return typeof value === 'string' && rule.choices.includes(value) ? null : `${key} must be one of ${rule.choices.join(', ')}`;
  return typeof value === 'boolean' ? null : `${key} must be true or false`;
}
const action = z.discriminatedUnion('do', [
  z.object({ do: z.literal('open'), page: link, verse: verse.nullish() }).strict(),
  z.object({ do: z.literal('highlight'), chapter: link, verse, color: z.string().max(30).nullish(), style: z.string().max(30).nullish(), theme: z.string().max(100).nullish(), selected: z.string().max(5000).nullish() }).strict(),
  z.object({ do: z.literal('note'), chapter: link, verse, text: markdown }).strict(),
  z.object({ do: z.literal('connect'), from: ref, to: ref, why: z.string().max(2000).refine(safeMarkdown).nullish() }).strict(),
  z.object({ do: z.literal('setting'), key: z.enum(['scene','fontScale','font','swipeNav','backgroundVisibility', ...READING_SETTING_KEYS]), value: z.union([z.string().max(100).regex(/^[\w ,.-]*$/), z.number().finite(), z.boolean(), z.null()]) }).strict(),
  z.object({ do: z.literal('lesson'), title: z.string().min(1).max(150), markdown }).strict(),
  z.object({ do: z.literal('edit_document'), path: link.refine(personalDocumentPath), markdown }).strict(),
  z.object({ do: z.literal('rename_document'), path: link.refine(personalDocumentPath), title: z.string().refine(validDocumentTitle) }).strict(),
  z.object({ do: z.literal('research'), title: pageTitle, pages: z.array(researchPage).min(1).max(12) }).strict(),
]).superRefine((value, ctx) => {
  if (value.do === 'setting') {
    const issue = readingSettingIssue(value.key, value.value);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue, path: ['value'] });
  }
  if (value.do === 'setting' && value.key === 'backgroundVisibility'
    && (typeof value.value !== 'number' || value.value < 0 || value.value > 100)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Background visibility must be a number from 0 to 100', path: ['value'] });
  }
  if (value.do === 'research') {
    // The report opens the project; every other page lives in a folder beneath it.
    if (value.pages[0]?.folder !== '' || value.pages.slice(1).some(page => page.folder === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The main report is the only page at the project root', path: ['pages'] });
    }
    const titles = value.pages.map(page => page.title.toLowerCase());
    if (new Set(titles).size !== titles.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Research page titles must be unique', path: ['pages'] });
  }
});
export function approvedActions(value: unknown) { return z.array(action).max(12).parse(value); }

/** approvedActions, except that a malformed SETTING cannot sink an answer: each
 * setting is checked on its own and a bad one is dropped (and counted), while
 * every other action keeps the all-or-nothing rule exactly as before -- one bad
 * open, note, lesson or edit still rejects the whole list. */
export function approvedActionsKeepingSettings(value: unknown): { actions: ReturnType<typeof approvedActions>; dropped: number } {
  if (!Array.isArray(value)) return { actions: approvedActions(value), dropped: 0 };
  const isSetting = (a: unknown) => !!a && typeof a === 'object' && (a as { do?: unknown }).do === 'setting';
  approvedActions(value.filter(a => !isSetting(a)));          // throws, as ever, on anything else
  const kept: unknown[] = [];
  let dropped = 0;
  for (const a of value) {
    if (!isSetting(a)) { kept.push(a); continue; }
    if (action.safeParse(a).success) kept.push(a); else dropped++;
  }
  return { actions: approvedActions(kept), dropped };
}
