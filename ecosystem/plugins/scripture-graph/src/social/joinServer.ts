/** Where the family laptop is allowed to say it lives.
 *
 * Discovery reads a published address, so the address must be constrained or a
 * bad release body could point every phone at someone else's server. Allowed:
 * the Cloudflare tunnels the laptop actually uses (quick ones today, which is
 * why devices keep going stale), a Tailscale Funnel name, and the family's own
 * permanent hostname once there is one.
 *
 * ADD THE PERMANENT HOSTNAME HERE when the named tunnel is set up — the exact
 * host, e.g. 'scripture.example.org'. It is not a secret and belongs in the
 * build so a phone can trust it; the tunnel TOKEN never appears in this repo. */
export const FAMILY_HOSTS: string[] = [];

export function familyAddressAllowed(address: string): boolean {
  let url: URL;
  try { url = new URL(address); } catch { return false; }
  if (url.protocol !== 'https:' || url.port || url.pathname !== '/' || url.search || url.hash) return false;
  const host = url.hostname.toLowerCase();
  if (FAMILY_HOSTS.includes(host)) return true;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(host)
    || /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9-]+\.ts\.net$/.test(host);
}

/** Bootstrap only the mobile localhost default. Explicit server choices stay put.
 * Discovery requests never contain an invite, account token, or personal data. */
export async function mobileJoinServer(current: string, mobile: boolean,
  read: (url: string) => Promise<unknown>): Promise<string> {
  if (!mobile) return current;
  let host: string;
  try { host = new URL(current).hostname; } catch { return current; }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return current;
  return familyServerAddress(read);
}

/** Where the family laptop is answering TODAY.
 *
 * The tunnel's address is regenerated whenever it restarts, so a device that
 * saved the old one is stranded: every request fails and nothing on the phone
 * knows to look again. The laptop publishes its current address to a fixed
 * release, so a stranded device can ask — no invite, no token, no personal
 * data in the request, and the same strict checks as first-time setup. */
export async function familyServerAddress(read: (url: string) => Promise<unknown>): Promise<string> {
  const release = await read('https://api.github.com/repos/JaceRichins/scripture-graph/releases/tags/family-connection') as any;
  if (!release || release.tag_name !== 'family-connection' || release.draft || typeof release.body !== 'string') {
    throw Error('Family connection information is unavailable');
  }
  const server = JSON.parse(release.body).server;
  if (typeof server !== 'string' || !familyAddressAllowed(server)) {
    throw Error('Family connection address is invalid');
  }
  const health = await read(server + '/health') as any;
  if (health?.ok !== true) throw Error('The family laptop is not reachable');
  return server;
}
