/** Typed API client for the collaboration backend. fetch is injectable so
 * the Obsidian plugin can pass its own transport and tests can pass mocks. */
import type { Annotation, SessionInfo, SyncOp, SyncPushResult } from "./schemas";
import type { PageRecipient, PageInbox, PageOutbox } from './pageSharing';
export interface AskAllowance { limit: number | null; used: number; remaining: number | null; unlimited: boolean; period: 'week'; weekStart: string; nextResetDate: string; day: string; timeZone: string }

export type FetchLike = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<{ status: number; json(): Promise<unknown> }>;

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface SharedLesson { id: string; title: string; owner_name: string; recipient_name: string; updated_at: string }
/** A research project its author made public to the family (everyone who shares a group). */
export interface SharedProject { id: string; path: string; title: string; owner_name: string; updated_at: string; pages: number }
export interface SharedProjectPage { path: string; title: string; folder: string; order: number }

export class ApiClient {
  constructor(
    public baseUrl: string,
    private fetchFn: FetchLike,
    private token: string | null = null,
  ) {}

  setToken(t: string | null) { this.token = t; }

  sharedLessons() { return this.req<{ incoming: SharedLesson[]; outgoing: SharedLesson[] }>('GET', '/lesson-shares'); }
  sharedLesson(id: string) { return this.req<SharedLesson & { markdown: string; hash: string; read_only: true }>('GET', `/lesson-shares/${encodeURIComponent(id)}`); }
  shareLesson(path: string, recipient_id: string) { return this.req<{ id: string }>('POST', '/lesson-shares', { path, recipient_id }); }
  revokeLesson(id: string) { return this.req<{ ok: true }>('DELETE', `/lesson-shares/${encodeURIComponent(id)}`); }

  sharedProjects() { return this.req<{ incoming: SharedProject[]; outgoing: SharedProject[] }>('GET', '/project-shares'); }
  sharedProject(id: string) { return this.req<SharedProject & { files: SharedProjectPage[] }>('GET', `/project-shares/${encodeURIComponent(id)}`); }
  sharedProjectPage(id: string, path: string) {
    return this.req<{ title: string; markdown: string; updated_at: string }>('GET', `/project-shares/${encodeURIComponent(id)}/page?path=${encodeURIComponent(path)}`);
  }
  publishProject(path: string) { return this.req<{ id: string }>('POST', '/project-shares', { path }); }
  unpublishProject(id: string) { return this.req<{ ok: true }>('DELETE', `/project-shares/${encodeURIComponent(id)}`); }

  pageRecipients() { return this.req<{ recipients: PageRecipient[] }>('GET', '/page-shares/recipients'); }
  sendPage(input: { request_id: string; recipients: string[]; path: string; message: string }) {
    return this.req<{ sent: number }>('POST', '/page-shares', input);
  }
  pageInbox(before?: number) { return this.req<PageInbox>('GET', '/page-shares' + (before ? `?before=${before}` : '')); }
  pageSent(before?: number) { return this.req<PageOutbox>('GET', '/page-shares/sent' + (before ? `?before=${before}` : '')); }
  readSharedPage(id: number) { return this.req<{ ok: true }>('POST', `/page-shares/${id}/read`, {}); }

  /** other addresses the server has advertised; tried in turn when the
   * current one cannot be reached (home Wi-Fi → tunnel → funnel …) */
  candidates: string[] = [];
  /** called with the address that answered, when it differs from baseUrl */
  onSwitched: ((url: string) => void) | null = null;
  /** called with the list the server advertised in a response */
  onAdvertised: ((urls: string[]) => void) | null = null;

  setCandidates(urls: string[]) { this.candidates = urls.filter(u => u && u !== this.baseUrl); }

  private async fetchWithFallback(path: string, init: { method: string; headers: Record<string, string>; body?: string },
    options: { timeoutMs?: number; retry?: boolean } = {})
    : Promise<{ status: number; json(): Promise<unknown> }> {
    const tried = options.retry === false ? [this.baseUrl] : [this.baseUrl, ...this.candidates];
    let lastErr: unknown = null;
    for (const base of tried) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // A dead address must fail fast, or the fallback is no faster than a
        // hang. A live one over a tunnel on a phone's mobile data is usually
        // well under a second, but a cold first request is not, so give the
        // address we believe in a little more room than the alternatives.
        const ms = options.timeoutMs ?? (base === this.baseUrl ? 10000 : 8000);
        const res = await Promise.race([
          this.fetchFn(base.replace(/\/$/, "") + path, init),
          new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("The server took too long to answer. Please try again.")), ms); }),
        ]);
        // A failed tunnel can answer with an HTTP gateway error instead of
        // throwing. Try known alternatives for reads without changing the
        // active address to one that only returned an error page.
        if (init.method === 'GET' && [502, 503, 504, 530].includes(res.status)) {
          lastErr = new ApiError(res.status, 'The server connection is temporarily unavailable.');
          continue;
        }
        if (base !== this.baseUrl) { this.baseUrl = base; this.onSwitched?.(base); }
        return res;
      } catch (e) {
        lastErr = e;                                   // unreachable: try the next address
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("server unreachable");
  }

  private async req<T>(method: string, path: string, body?: unknown,
    options: { timeoutMs?: number; retry?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.token) headers["authorization"] = `Bearer ${this.token}`;
    const res = await this.fetchWithFallback(path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }, options);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status >= 400) {
      throw new ApiError(res.status, String((data as { error?: string }).error ?? `HTTP ${res.status}`));
    }
    const urls = (data as { urls?: unknown }).urls;
    if (Array.isArray(urls) && urls.every(u => typeof u === "string")) this.onAdvertised?.(urls as string[]);
    return data as T;
  }

  /** ask an address where else the server lives (no login needed) */
  // Discovery is the way out of a dead address, so it keeps the old quick 6s
  // limit; ordinary requests give the believed address 10s (a cold mobile start).
  where() { return this.req<{ urls: string[] }>("GET", "/where", undefined, { timeoutMs: 6000 }); }

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
  /** the one setup link, for a group I belong to — any member may send one */
  createSetupInvite(group_id?: string | null, max_uses = 5, ttl_hours = 24 * 30) {
    return this.req<{ code: string; expires_at: string; group_id: string; group_name: string;
      url: string | null; max_uses: number }>("POST", "/invites/setup", { group_id, max_uses, ttl_hours });
  }
  /** what a link says before it is spent (no account needed) */
  previewInvite(code: string) {
    return this.req<{ usable: boolean; kind: string; group_name: string | null; from: string | null;
      expires_at: string; uses_left: number }>("GET", `/invites/preview/${encodeURIComponent(code)}`);
  }
  listInvites() {
    return this.req<{ invites: { id: string; kind: string; group_id: string | null; max_uses: number;
      uses: number; expires_at: string; created_at: string; revoked_at: string | null }[] }>("GET", "/invites");
  }
  revokeInvite(id: string) { return this.req<{ ok: true }>("POST", `/invites/${id}/revoke`); }
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
  // ------------------------------------------------------------- ask
  /** the family server's study assistant: a headless ChatGPT turn that reads the library, and may act */
  async ask(body: { question: string; anchor?: { chapterTitle?: string | null; verseId?: string | null; page?: string | null } | null;
      state?: Record<string, unknown>; threadId?: string | null; reset?: boolean }) {
    // Find a reachable address with a cheap read BEFORE starting paid work.
    // Never replay the POST: a transport error does not mean the AI stopped.
    await this.askStatus();
    return this.req<{ ok: boolean; answer: string; actions: unknown[]; threadId: string; ms: number; model: string }>("POST", "/ask", body,
      { timeoutMs: 200_000, retry: false });
  }
  askStatus() {
    return this.req<{ available: boolean; engine: string; threadId: string;
      modes?: ('chat' | 'research' | 'lesson' | 'study-plan')[];
      research?: AskAllowance;
      studyPlan?: AskAllowance;
      lesson?: AskAllowance;
      turns: { role: "user" | "assistant"; text: string; at: string }[] }>("GET", "/ask/status");
  }
  askJob(id: string) { return this.req<AskJob>("GET", `/ask/jobs/${encodeURIComponent(id)}`); }
  startAskJob(id: string, body: unknown) { return this.req<AskJob>("PUT", `/ask/jobs/${encodeURIComponent(id)}`, body); }
  askReset() { return this.req<{ ok: true; threadId: string }>("DELETE", "/ask/thread"); }
  askMemory() { return this.req<{ text: string; version: number }>('GET', '/ask/memory'); }
  saveAskMemory(text: string, version: number) { return this.req<{ text: string; version: number }>('PUT', '/ask/memory', { text, version }); }

  vaultVersion() { return this.req<{ version: string; count: number; bytes: number }>("GET", "/vault/version"); }
  vaultManifest() {
    // Native mobile transport resolves after the entire catalog has arrived.
    // Discovery stays fast; multi-megabyte library reads need a cellular budget.
    return this.req<{ version: string; count: number; bytes: number; files: { p: string; h: string; s: number; m: number }[] }>(
      "GET", "/vault/manifest", undefined, { timeoutMs: 60_000 });
  }
  vaultBatch(paths: string[]) {
    return this.req<{ files: { p: string; text?: string; b64?: string; h?: string; missing?: boolean }[] }>(
      "POST", "/vault/batch", { paths }, { timeoutMs: 90_000 });
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
    return this.req<{ results: { title: string; path: string | null; snippet: string; kind: string }[]; suggestion?: string }>(
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

export interface AskJob {
  id: string;
  status: "queued" | "working" | "finished" | "failed";
  /** while working, `progress` says which stage a team has reached */
  result?: { ok: boolean; answer?: string; error?: string; actions?: unknown[]; model?: string; ms?: number; threadId?: string; progress?: string };
}
