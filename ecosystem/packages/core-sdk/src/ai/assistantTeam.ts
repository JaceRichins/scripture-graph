/** Which assistant requests run as a server-coordinated team of agents.
 * Chat is always one conversational agent. Research always uses a team.
 * Creating a lesson or study plan uses a team; a question about one, or a
 * revision of the open document, stays one conversational agent. */
export type AskMode = 'chat' | 'research' | 'lesson' | 'study-plan';

export function usesTeam(mode: AskMode | undefined, question: string, hasDocument: boolean): boolean {
  if (mode === 'research') return true;
  if (mode !== 'lesson' && mode !== 'study-plan') return false;
  return !hasDocument && !/\?\s*$/.test(question.trim());
}

const UNSAFE_NAME = /[<>:"\\|?*#^[\]\x00-\x1f\x7f]/;

/** A folder chosen by AI inside a research project: plain names, at most two levels. */
export function validProjectFolder(value: string): boolean {
  if (value === '') return true;
  if (value.length > 160) return false;
  const parts = value.split('/');
  return parts.length <= 2 && parts.every(part => part.length > 0 && part.length <= 80 && part === part.trim()
    && !UNSAFE_NAME.test(part) && !part.startsWith('.') && !part.endsWith('.'));
}

/** A page title that is also a safe file name and wikilink target. */
export function validPageTitle(value: string): boolean {
  return value.length > 0 && value.length <= 150 && value === value.trim() && !value.includes('/')
    && !UNSAFE_NAME.test(value) && !value.startsWith('.') && !value.endsWith('.');
}
