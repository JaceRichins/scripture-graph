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

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.token) headers["authorization"] = `Bearer ${this.token}`;
    const res = await this.fetchFn(this.baseUrl.replace(/\/$/, "") + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status >= 400) {
      throw new ApiError(res.status, String((data as { error?: string }).error ?? `HTTP ${res.status}`));
    }
    return data as T;
  }

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
