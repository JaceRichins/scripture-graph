/** Typed API client for the collaboration backend. fetch is injectable so
 * the Obsidian plugin can pass its own transport and tests can pass mocks. */
import type { Annotation, SessionInfo, SyncOp, SyncPushResult } from "./schemas";

export type FetchLike = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<{ status: number; json(): Promise<unknown> }>;

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export class ApiClient {
  constructor(
    public baseUrl: string,
    private fetchFn: FetchLike,
    private token: string | null = null,
  ) {}

  setToken(t: string | null) { this.token = t; }

  /** other addresses the server has advertised; tried in turn when the
   * current one cannot be reached (home Wi-Fi → tunnel → funnel …) */
  candidates: string[] = [];
  /** called with the address that answered, when it differs from baseUrl */
  onSwitched: ((url: string) => void) | null = null;
  /** called with the list the server advertised in a response */
  onAdvertised: ((urls: string[]) => void) | null = null;

  setCandidates(urls: string[]) { this.candidates = urls.filter(u => u && u !== this.baseUrl); }

  private async fetchWithFallback(path: string, init: { method: string; headers: Record<string, string>; body?: string })
    : Promise<{ status: number; json(): Promise<unknown> }> {
    const tried = [this.baseUrl, ...this.candidates];
    let lastErr: unknown = null;
    for (const base of tried) {
      try {
        // a dead address must fail fast, or the fallback is no faster than a hang
        const ms = base === this.baseUrl ? 6000 : 8000;
        const res = await Promise.race([
          this.fetchFn(base.replace(/\/$/, "") + path, init),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
        ]);
        if (base !== this.baseUrl) { this.baseUrl = base; this.onSwitched?.(base); }
        return res;
      } catch (e) {
        lastErr = e;                                   // unreachable: try the next address
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("server unreachable");
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.token) headers["authorization"] = `Bearer ${this.token}`;
    const res = await this.fetchWithFallback(path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status >= 400) {
      throw new ApiError(res.status, String((data as { error?: string }).error ?? `HTTP ${res.status}`));
    }
    const urls = (data as { urls?: unknown }).urls;
    if (Array.isArray(urls) && urls.every(u => typeof u === "string")) this.onAdvertised?.(urls as string[]);
    return data as T;
  }

  /** ask an address where else the server lives (no login needed) */
  where() { return this.req<{ urls: string[] }>("GET", "/where"); }

  // auth
  claim(invite_code: string, display_name: string, device_name: string) {
    return this.req<SessionInfo>("POST", "/auth/claim", { invite_code, display_name, device_name });
  }
  linkDevice(link_code: string, device_name: string) {
    return this.req<SessionInfo>("POST", "/auth/link-device", { link_code, device_name });
  }
  me() { return this.req<{ user: SessionInfo["user"]; groups: unknown[] }>("GET", "/me"); }
  logoutDevice() { return this.req<{ ok: true }>("POST", "/auth/logout"); }

  // groups
  createGroup(name: string) { return this.req<{ group_id: string; name: string }>("POST", "/groups", { name }); }
  listGroups() {
    return this.req<{ groups: { group_id: string; name: string; role: string; member_count: number }[] }>("GET", "/groups");
  }
  createGroupInvite(group_id: string, max_uses = 10, ttl_hours = 24 * 14) {
    return this.req<{ code: string; expires_at: string }>("POST", `/groups/${group_id}/invites`, { max_uses, ttl_hours });
  }
  createAccountInvite(max_uses = 1, ttl_hours = 24 * 14) {
    return this.req<{ code: string; expires_at: string }>("POST", "/invites/account", { max_uses, ttl_hours });
  }
  createAccountInviteDeviceLink() {
    return this.req<{ code: string; expires_at: string }>("POST", "/invites/account", { device_link: true });
  }
  acceptInvite(code: string) {
    return this.req<{ kind: string; group_id?: string; group_name?: string }>("POST", "/invites/accept", { code });
  }
  leaveGroup(group_id: string) { return this.req<{ ok: true }>("POST", `/groups/${group_id}/leave`); }
  removeMember(group_id: string, user_id: string) {
    return this.req<{ ok: true }>("DELETE", `/groups/${group_id}/members/${user_id}`);
  }
  groupMembers(group_id: string) {
    return this.req<{ members: { user_id: string; display_name: string; role: string }[] }>("GET", `/groups/${group_id}/members`);
  }
  /** what my groups have been studying lately, rolled up per chapter */
  groupActivity() {
    return this.req<{ activity: {
      group_id: string; group_name: string; chapter_slug: string;
      count: number; others: number; latest: string;
    }[] }>("GET", "/activity/groups");
  }

  // sync + annotations
  syncPush(ops: SyncOp[]) {
    return this.req<{ results: SyncPushResult[] }>("POST", "/sync/push", { ops });
  }
  syncPull(cursor: string | null) {
    return this.req<{ annotations: Annotation[]; next_cursor: string }>(
      "GET", `/sync/pull?cursor=${encodeURIComponent(cursor ?? "")}`);
  }
  // vault sync
  vaultVersion() { return this.req<{ version: string; count: number; bytes: number }>("GET", "/vault/version"); }
  vaultManifest() {
    return this.req<{ version: string; count: number; bytes: number; files: { p: string; h: string; s: number; m: number }[] }>(
      "GET", "/vault/manifest");
  }
  vaultBatch(paths: string[]) {
    return this.req<{ files: { p: string; text?: string; b64?: string; h?: string; missing?: boolean }[] }>(
      "POST", "/vault/batch", { paths });
  }
  personalManifest(since?: string) {
    return this.req<{ files: { path: string; hash: string | null; mtime: number; deleted_at: string | null; updated_at: string }[]; now: string }>(
      "GET", `/vault/personal/manifest${since ? `?since=${encodeURIComponent(since)}` : ""}`);
  }
  personalFile(path: string) {
    return this.req<{ path: string; content: string | null; hash: string | null; mtime: number; deleted_at: string | null }>(
      "GET", `/vault/personal/file?path=${encodeURIComponent(path)}`);
  }
  personalPush(files: { path: string; content: string | null; hash: string | null; base_hash: string | null; mtime: number; deleted?: boolean }[]) {
    return this.req<{ results: { path: string; status: "stored" | "conflict" | "rejected"; server?: { content: string | null; hash: string | null; mtime: number } }[]; now: string }>(
      "POST", "/vault/personal/push", { files });
  }

  /** the family server's full-text search over the engine's index */
  search(q: string) {
    return this.req<{ results: { title: string; path: string | null; snippet: string; kind: string }[] }>(
      "GET", `/search?q=${encodeURIComponent(q)}`);
  }
  annotationsFor(anchorIds: string[]) {
    return this.req<{ annotations: (Annotation & { author_name: string })[] }>(
      "POST", "/annotations/query", { anchor_ids: anchorIds });
  }

  // data portability
  exportMyData() {
    return this.req<{ annotations: Annotation[]; groups: unknown[]; exported_at: string }>("GET", "/export");
  }
  deleteAccount() { return this.req<{ ok: true }>("POST", "/account/delete"); }

  // owner admin (content-free counters)
  adminOverview() { return this.req<Record<string, number>>("GET", "/admin/overview"); }
}
