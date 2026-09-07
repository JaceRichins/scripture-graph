/** Spotify as the engine, our app as the face.
 *
 * The listener signs in once (PKCE, no secret). From then on a playlist
 * row tells the Spotify app on this phone to play that track; Spotify
 * plays in the background with proper lock-screen controls and our page
 * stays in front. Needs Spotify Premium (Spotify's rule for remote
 * playback) and the family's Client ID in the shared settings. */
import { Notice, requestUrl } from "obsidian";

const AUTH = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";
export const SPOTIFY_CALLBACK = "obsidian://scripture-graph-spotify";
const SCOPES = "user-modify-playback-state user-read-playback-state";

export interface SpotifyTokens { access: string; refresh: string; expires: number }

export interface SpotifyStore {
  clientId(): string;
  get(): SpotifyTokens | null;
  set(t: SpotifyTokens | null): Promise<void>;
}

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export class Spotify {
  private verifier: string | null = null;
  private trackCache = new Map<string, string | null>();

  constructor(private store: SpotifyStore) {}

  get configured(): boolean { return !!this.store.clientId(); }
  get connected(): boolean { return !!this.store.get(); }

  // ------------------------------------------------------------ sign-in
  async beginConnect(): Promise<void> {
    const id = this.store.clientId();
    if (!id) { new Notice("Spotify isn't set up for the family yet (Client ID missing in settings)."); return; }
    const raw = new Uint8Array(48); crypto.getRandomValues(raw);
    this.verifier = b64url(raw.buffer);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(this.verifier)));
    const q = new URLSearchParams({ client_id: id, response_type: "code", redirect_uri: SPOTIFY_CALLBACK,
      code_challenge_method: "S256", code_challenge: challenge, scope: SCOPES });
    window.open(`${AUTH}?${q.toString()}`);
  }

  async completeConnect(code: string): Promise<void> {
    if (!this.verifier) throw new Error("no Spotify sign-in in progress — start again");
    const body = new URLSearchParams({ client_id: this.store.clientId(), grant_type: "authorization_code", code,
      redirect_uri: SPOTIFY_CALLBACK, code_verifier: this.verifier }).toString();
    const r = await requestUrl({ url: TOKEN, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, throw: false });
    if (r.status !== 200) throw new Error(`Spotify sign-in failed (${r.status})`);
    const j = r.json as { access_token: string; refresh_token: string; expires_in: number };
    await this.store.set({ access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in - 60) * 1000 });
    this.verifier = null;
    new Notice("Spotify connected ✓");
  }

  async disconnect(): Promise<void> { await this.store.set(null); }

  private async token(): Promise<string | null> {
    const t = this.store.get();
    if (!t) return null;
    if (Date.now() < t.expires) return t.access;
    const body = new URLSearchParams({ client_id: this.store.clientId(), grant_type: "refresh_token", refresh_token: t.refresh }).toString();
    const r = await requestUrl({ url: TOKEN, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, throw: false });
    if (r.status !== 200) { await this.store.set(null); new Notice("Spotify sign-in expired — connect again in Settings."); return null; }
    const j = r.json as { access_token: string; refresh_token?: string; expires_in: number };
    await this.store.set({ access: j.access_token, refresh: j.refresh_token ?? t.refresh, expires: Date.now() + (j.expires_in - 60) * 1000 });
    return j.access_token;
  }

  private async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
    const tok = await this.token();
    if (!tok) return { status: 401, json: null };
    const r = await requestUrl({ url: `${API}${path}`, method, throw: false,
      headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body) });
    let json: unknown = null;
    try { json = r.text ? JSON.parse(r.text) : null; } catch { /* empty */ }
    return { status: r.status, json };
  }

  // ----------------------------------------------------------- playback
  /** the track uri for a title + artist, remembered per device */
  async find(query: string): Promise<string | null> {
    if (this.trackCache.has(query)) return this.trackCache.get(query)!;
    const r = await this.call("GET", `/search?${new URLSearchParams({ q: query, type: "track", limit: "1" }).toString()}`);
    const items = ((r.json as { tracks?: { items?: { uri: string }[] } })?.tracks?.items) ?? [];
    const uri = items[0]?.uri ?? null;
    this.trackCache.set(query, uri);
    return uri;
  }

  /** play on the Spotify app; wake it once if nothing is active */
  async play(uri: string): Promise<boolean> {
    let r = await this.call("PUT", "/me/player/play", { uris: [uri] });
    if (r.status === 404) {
      // no active device: open the Spotify app, give it a moment, try again
      window.open("spotify:", "_blank");
      await new Promise(res => setTimeout(res, 3500));
      r = await this.call("PUT", "/me/player/play", { uris: [uri] });
    }
    if (r.status === 403) { new Notice("Spotify says this account can't be controlled remotely — Premium is required."); return false; }
    if (r.status === 404) { new Notice("Open Spotify once, then tap the song again."); return false; }
    return r.status < 300;
  }

  async pause(): Promise<void> { await this.call("PUT", "/me/player/pause"); }
  async resume(): Promise<void> { await this.call("PUT", "/me/player/play"); }

  /** what Spotify is doing now — for the mini player and for "next" */
  async state(): Promise<{ playing: boolean; uri: string | null; progress: number; duration: number } | null> {
    const r = await this.call("GET", "/me/player");
    if (r.status !== 200 || !r.json) return null;
    const j = r.json as { is_playing: boolean; progress_ms: number; item?: { uri: string; duration_ms: number } };
    return { playing: j.is_playing, uri: j.item?.uri ?? null, progress: j.progress_ms ?? 0, duration: j.item?.duration_ms ?? 0 };
  }
}
