/** Own artwork first, then borrowed shelf artwork. A local file existing does
 * not mean iOS can decode it; retain bundled alternatives for load failures. */
export function coverPhotoSources(key: string | undefined, fallback: string | undefined,
  local: (key: string) => string | null, bundled: Record<string, string>): string[] {
  const sources: string[] = [];
  for (const name of [key, fallback]) {
    if (!name) continue;
    for (const source of [local(name), bundled[name]]) {
      if (source && !sources.includes(source)) sources.push(source);
    }
  }
  return sources;
}

export function mountCoverPhoto(art: HTMLElement, sources: string[]): void {
  if (!sources.length) return;
  let index = 0;
  const load = () => {
    const src = sources[index++];
    if (!src) return;
    const img = art.ownerDocument.createElement('img');
    img.className = 'sg-nav-cover-photo';
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    // Install callbacks BEFORE src: bundled/cached images may finish at once.
    img.onload = () => { if (img.naturalWidth > 0) art.classList.add('sg-has-photo'); };
    img.onerror = () => { img.onload = null; img.onerror = null; img.remove(); load(); };
    art.appendChild(img);
    img.src = src;
    if (img.complete && img.naturalWidth > 0) art.classList.add('sg-has-photo');
  };
  load();
}
