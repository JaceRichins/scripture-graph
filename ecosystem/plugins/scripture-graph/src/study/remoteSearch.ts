export interface LibraryHit { title: string; path: string | null; snippet: string; kind: string }
export interface LibraryResponse { results: LibraryHit[]; suggestion?: string }

/** Starts independently of the local scripture index, including the first query. */
export async function renderRemoteSearch(
  holder: HTMLElement, query: string, search: (q: string) => Promise<LibraryResponse>,
  current: () => boolean, open: (hit: LibraryHit) => void,
  found?: (hits: LibraryHit[]) => void,
  /** optional narrowing (Home's filter chips); absent = every hit, as before */
  keep?: (hit: LibraryHit) => boolean,
): Promise<void> {
  holder.createDiv({ cls: 'sg-nav-sect', text: 'Best matches · whole library' });
  const status = holder.createDiv({ cls: 'sg-nav-progress', text: 'Searching the family library…' });
  try {
    const { results, suggestion } = await search(query);
    if (!current() || !holder.isConnected) return;
    status.remove();
    if (suggestion) holder.createDiv({ cls: 'sg-nav-progress', text: `Including matches for “${suggestion}”` });
    const seen = new Set<string>();
    const unique: LibraryHit[] = [];
    for (const hit of results) {
      const key = hit.path ?? hit.title;
      if (seen.has(key)) continue; seen.add(key);
      unique.push(hit);
    }
    const kept = keep ? unique.filter(keep) : unique;
    let shown = 0;
    const renderMore = () => {
      for (const hit of kept.slice(shown, shown + 6)) {
        const row = holder.createEl('button', { cls: 'sg-nav-row sg-nav-hit' });
        row.style.height = 'auto'; row.style.whiteSpace = 'normal'; row.style.textAlign = 'left';
        const col = row.createDiv({ cls: 'sg-nav-gcol' });
        col.createDiv({ cls: 'sg-nav-name', text: hit.title });
        if (hit.path) col.createDiv({ cls: 'sg-nav-gsub', text: hit.path.split('/').slice(1, -1)
          .map(part => part.replace(/^\d+\s+/, '')).join(' › ') });
        const snippet = col.createDiv({ cls: 'sg-nav-snip' });
        for (const part of hit.snippet.split(/(«[^»]*»)/)) {
          if (part.startsWith('«')) snippet.createEl('mark', { text: part.slice(1, -1) });
          else snippet.appendText(part);
        }
        row.onclick = () => open(hit);
      }
      shown += 6;
      if (shown < kept.length) {
        const more = holder.createEl('button', { cls: 'sg-nav-row', text: 'More library results' });
        more.onclick = () => { if (!current()) return; more.remove(); renderMore(); };
      }
    };
    renderMore();
    found?.(unique);
    if (!seen.size) holder.createDiv({ cls: 'sg-nav-empty', text: 'No matches in the shared library.' });
    else if (!kept.length) holder.createDiv({ cls: 'sg-nav-empty', text: 'No matches of this kind in the shared library.' });
  } catch {
    if (current() && holder.isConnected) status.setText('Server unavailable. These results cover downloaded files only; reconnect to search the whole library.');
  }
}
