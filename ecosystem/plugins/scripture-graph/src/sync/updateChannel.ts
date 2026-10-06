export interface Release { base: string; manifest: { id: string; version: string; [key: string]: unknown } }

export function newerVersion(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number), l = local.split('.').map(Number);
  if (r.some(Number.isNaN) || l.some(Number.isNaN) || !remote) return false;
  for (let i = 0; i < 3; i++) {
    const a = r[i] ?? 0, b = l[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

/** Check every channel: a reachable older release must not hide a newer one. */
export async function newestRelease(channels: (() => Promise<{ base: string; text: string }>)[]): Promise<Release> {
  const results = await Promise.allSettled(channels.map(async load => {
    const { base, text } = await load();
    const manifest = JSON.parse(text.replace(/^\uFEFF/, ''));
    if (manifest.id !== 'scripture-graph' || !/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) throw Error('Invalid plugin release');
    return { base, manifest } as Release;
  }));
  let best: Release | undefined;
  for (const result of results) {
    if (result.status === 'fulfilled' && (!best || newerVersion(result.value.manifest.version, best.manifest.version))) best = result.value;
  }
  if (!best) throw Error('No update channel could be reached with a valid release');
  return best;
}
