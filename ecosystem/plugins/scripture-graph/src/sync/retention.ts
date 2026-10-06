/** Policy for replaceable shared downloads. Personal and unknown paths are never eligible. */
export const DAY = 86_400_000;
export interface DownloadUse { used: number; pruned?: boolean }
export type Usage = Record<string, DownloadUse>;
export const pinMatches = (path: string, pin: string) => path === pin || (pin.endsWith('/') && path.startsWith(pin));
export function sharedDownload(path: string): boolean {
  return !path.split('/').some(p => !p || p === '..' || p === '.' || p.startsWith('.'))
    && !path.includes('\\') && (path.startsWith('AI Library/') || path.startsWith('_media/'));
}
export function recentConference(path: string, now = Date.now()): boolean {
  const match = /^AI Library\/10 General Conference\/(\d{4})\/(April|October)\//.exec(path);
  if (!match) return false;
  // Keep the entire conference month through its two-year anniversary.
  const end = Date.UTC(Number(match[1]), match[2] === 'April' ? 4 : 10, 0, 23, 59, 59);
  const cutoff = new Date(now); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  return end >= cutoff.getTime();
}
export function essential(path: string, now = Date.now()): boolean {
  return path.startsWith('AI Library/01 Scriptures/') || path.startsWith('AI Library/00 System/')
    || path.startsWith('_media/covers/') || recentConference(path, now)
    || /\/(Family Tree|Family Stories|Family Narration)\.md$/.test(path);
}
export function stale(path: string, usage: Usage, days: number, now = Date.now()): boolean {
  const used = usage[path]?.used;
  return days > 0 && sharedDownload(path) && !essential(path, now)
    && typeof used === 'number' && Number.isFinite(used) && used > 0 && now - used >= days * DAY;
}
/** Verify ownership bytes immediately before removing a single recoverable file.
 * Failed reads/deletes retain the tracking record so cleanup can retry safely. */
export async function removeCachedCopy(path: string, expectedHash: string, io: {
  hash(): Promise<string>; stillEligible(): boolean; remove(): Promise<void>;
}): Promise<boolean> {
  if (!sharedDownload(path) || !expectedHash || !io.stillEligible()) return false;
  try {
    if (await io.hash() !== expectedHash || !io.stillEligible()) return false;
    await io.remove();
    return true;
  } catch { return false; }
}
