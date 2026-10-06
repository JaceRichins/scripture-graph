/** Search filters, recent and saved searches for the Home search box.
 *
 * Filters only narrow what the existing searches already found -- the local
 * index and the server's /search are asked exactly as before, with the same
 * words, so ranking, precision, spelling help and the offline fallback are
 * unchanged. "All" (the default) shows precisely what it always showed. */
import { BOOKS } from "@scripture-graph/core-sdk";
import type { SearchResults } from "./search";
import type { LibraryHit } from "./remoteSearch";

export type SearchScope = "all" | "scripture" | "people" | "places" | "topics" | "talks" | "history";
export const SEARCH_SCOPES: { key: SearchScope; label: string; folders?: string[] }[] = [
  { key: "all", label: "All" },
  { key: "scripture", label: "Scripture", folders: ["AI Library/01 Scriptures/"] },
  { key: "people", label: "People", folders: ["AI Library/03 People/"] },
  { key: "places", label: "Places", folders: ["AI Library/04 Places/"] },
  { key: "topics", label: "Topics", folders: ["AI Library/02 Gospel Topics/", "AI Library/06 Doctrines/"] },
  { key: "talks", label: "Talks", folders: ["AI Library/10 General Conference/", "AI Library/20 Words of the Prophets/"] },
  { key: "history", label: "History", folders: ["AI Library/30 Church History/"] },
];
export const VOLUMES = ["Old Testament", "New Testament", "Book of Mormon", "Doctrine and Covenants", "Pearl of Great Price"] as const;
export type Volume = typeof VOLUMES[number];

/** which scope a vault path belongs to, if any */
export function pathScope(path: string | null | undefined): SearchScope | null {
  if (!path) return null;
  return SEARCH_SCOPES.find(s => s.folders?.some(f => path.startsWith(f)))?.key ?? null;
}

const BOOK_VOLUME = new Map<string, string>(BOOKS.flatMap(b => [[b.prefix, b.volume], [b.name, b.volume]]));
/** "Alma 36" -> "Book of Mormon" */
export function chapterVolume(chapter: string): string | null {
  return BOOK_VOLUME.get(chapter.replace(/\s+\d+$/, "")) ?? null;
}
function pathVolume(path: string): string | null {
  return VOLUMES.find(v => path.includes(`/${v}/`) || new RegExp(`/\\d+ ${v}/`).test(path)) ?? null;
}

export function keepHit(hit: LibraryHit, scope: SearchScope, volume: Volume | null): boolean {
  if (scope === "all") return true;
  const where = hit.kind === "scripture" ? "scripture" : pathScope(hit.path);
  if (where !== scope) return false;
  return scope !== "scripture" || !volume || (!!hit.path && pathVolume(hit.path) === volume);
}

export function filterLocal(res: SearchResults, scope: SearchScope, volume: Volume | null): SearchResults {
  if (scope === "all") return res;
  if (scope === "scripture") {
    const inVolume = (chapter: string) => !volume || chapterVolume(chapter) === volume;
    return { ...res, pages: [], verses: res.verses.filter(v => inVolume(v.chapter)), chapters: res.chapters.filter(c => inVolume(c.title)),
      reference: res.reference && inVolume(res.reference.title) ? res.reference : undefined };
  }
  return { ...res, reference: undefined, verses: [], chapters: [], pages: res.pages.filter(p => pathScope(p.path) === scope) };
}

/** most recent first, no repeats (case-insensitive), at most `max` */
export function rememberSearch(list: readonly string[], query: string, max = 8): string[] {
  const q = query.trim();
  if (q.length < 2) return [...list];
  return [q, ...list.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, max);
}
