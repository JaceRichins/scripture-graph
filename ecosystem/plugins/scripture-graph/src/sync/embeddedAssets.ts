/** Local embed references only. Remote images remain the renderer's responsibility. */
export function embeddedAssets(text: string, source: string): { link: string; candidates: string[] }[] {
  const links = [
    ...[...text.matchAll(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)].map(m => m[1]!.trim()),
    ...[...text.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*)?\s*\)/g)]
      .map(m => (m[1] ?? m[2]!).trim()),
  ];
  const result: { link: string; candidates: string[] }[] = [];
  for (const raw of new Set(links)) {
    let link = raw;
    try { link = decodeURIComponent(link); } catch { /* retain literal names */ }
    link = link.split('#')[0]!.replace(/\\/g, '/');
    if (!link || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(link)) continue;
    const parts = [...source.split('/').slice(0, -1)];
    for (const part of link.split('/')) {
      if (part === '..') parts.pop();
      else if (part && part !== '.') parts.push(part);
    }
    const relative = parts.join('/');
    const rooted = /^(?:AI Library|_media)\//.test(link);
    // The caller resolves candidates against the server's shared catalog.
    const candidates = rooted ? [link] : [relative, link];
    result.push({ link, candidates: [...new Set(candidates)] });
  }
  return result;
}

export async function fetchMissingEmbeds(text: string, source: string, io: {
  local(link: string): boolean;
  resolve(candidate: string): string | null;
  refresh(): Promise<void>;
  fetch(path: string): Promise<boolean>;
}): Promise<void> {
  let refreshed = false;
  const fetched = new Set<string>();
  for (const { link, candidates } of embeddedAssets(text, source)) {
    if (io.local(link)) continue;
    const resolve = () => candidates.map(p => io.resolve(p)).find(Boolean);
    let path = resolve();
    if (!path && !refreshed) {
      refreshed = true;
      try { await io.refresh(); } catch { /* cached catalog may still resolve other embeds */ }
      path = resolve();
    }
    if (path && !fetched.has(path)) { fetched.add(path); await io.fetch(path); }
  }
}
