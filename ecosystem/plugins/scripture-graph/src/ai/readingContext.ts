/** Capture the displayed reading target before the composer switches to chat. */
export function readingContext(page: string | null, chapter: string | null, verse: string | null) {
  const [path, fragment] = (page ?? '').split('#');
  const title = (path?.split('/').pop()?.replace(/\.md$/i, '') || chapter)?.replace(/ - My Notes$/, '') ?? null;
  if (!title) return null;
  return { chapterTitle: title, page: path || null, verseId: fragment?.startsWith('^') ? fragment.slice(1) : verse };
}
