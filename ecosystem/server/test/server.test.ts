/** Backend security + sync matrix (§56, §57): permissions are proven, not assumed. */
import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app";
import { audit, createDevice, createInvite, createUser } from "../src/auth";
import { openDb, type DB } from "../src/db";

let db: DB;
let app: FastifyInstance;

interface TestUser { id: string; token: string; name: string }

function mkUser(name: string, role: "owner" | "member" = "member"): TestUser {
  const id = createUser(db, name, role);
  const dev = createDevice(db, id, `${name}-device`);
  return { id, token: dev.token, name };
}

async function call(method: string, url: string, token: string | null, body?: unknown) {
  const res = await app.inject({
    method: method as "GET", url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: body as never,
  });
  return { status: res.statusCode, json: res.json() as Record<string, never> };
}

function ann(over: Record<string, unknown> = {}) {
  return {
    annotation_id: randomUUID(), author_user_id: null,
    anchor_type: "verse", anchor_id: "alma-36-18", annotation_type: "highlight",
    selected_text: null, start_offset: null, end_offset: null, text_hash: null,
    content: "", color: "yellow", visibility: "private", group_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    deleted_at: null, version: 1, ...over,
  };
}

function op(annotation: Record<string, unknown>, base = 0, kind = "upsert_annotation") {
  return { op_id: randomUUID(), kind, annotation, base_version: base, queued_at: new Date().toISOString() };
}

beforeEach(() => {
  db = openDb(":memory:");
  app = buildApp({ db });
});

describe("auth + invites", () => {
  it("claims an account with a valid invite; garbage is refused", async () => {
    const owner = mkUser("Owner", "owner");
    const inv = createInvite(db, "account", owner.id, { maxUses: 1 });
    const ok = await call("POST", "/auth/claim", null,
      { invite_code: inv.code, display_name: "Mom", device_name: "Mom iPhone" });
    expect(ok.status).toBe(200);
    expect((ok.json as { token: string }).token.startsWith("sgd_")).toBe(true);
    // single-use: second claim fails
    const again = await call("POST", "/auth/claim", null,
      { invite_code: inv.code, display_name: "X", device_name: "Y" });
    expect(again.status).toBe(403);
    const bad = await call("POST", "/auth/claim", null,
      { invite_code: "NOPE-NOPE-NOPE", display_name: "X", device_name: "Y" });
    expect(bad.status).toBe(403);
  });

  it("expired invites are refused", async () => {
    const owner = mkUser("Owner", "owner");
    const inv = createInvite(db, "account", owner.id, { maxUses: 5, ttlHours: 1 });
    db.prepare("UPDATE invites SET expires_at = '2000-01-01T00:00:00Z'").run();
    const r = await call("POST", "/auth/claim", null,
      { invite_code: inv.code, display_name: "X", device_name: "Y" });
    expect(r.status).toBe(403);
  });

  it("account invites can NOT hijack via link-device; device codes can link", async () => {
    const owner = mkUser("Owner", "owner");
    const accountInv = createInvite(db, "account", owner.id, { maxUses: 1 });
    const hijack = await call("POST", "/auth/link-device", null,
      { link_code: accountInv.code, device_name: "evil" });
    expect(hijack.status).toBe(403);
    const deviceInv = createInvite(db, "device", owner.id, { maxUses: 1, ttlHours: 1 });
    const link = await call("POST", "/auth/link-device", null,
      { link_code: deviceInv.code, device_name: "Owner iPhone" });
    expect(link.status).toBe(200);
    expect((link.json as { user: { user_id: string } }).user.user_id).toBe(owner.id);
  });

  it("a code sent to the wrong endpoint is NOT consumed (no invite-burn DoS)", async () => {
    const owner = mkUser("Owner", "owner");
    // an account invite pasted into "join a group" must not burn a use
    const accountInv = createInvite(db, "account", owner.id, { maxUses: 1 });
    const joiner = mkUser("Joiner");
    const wrong = await call("POST", "/invites/accept", joiner.token, { code: accountInv.code });
    expect(wrong.status).toBe(403);
    // the invite still has its use — a real new-account claim works
    const claim = await call("POST", "/auth/claim", null,
      { invite_code: accountInv.code, display_name: "Mom", device_name: "Mom iPhone" });
    expect(claim.status).toBe(200);

    // a shared group code replayed at /auth/claim must not drain its uses
    const a = mkUser("A");
    const g = (await call("POST", "/groups", a.token, { name: "Fam" })).json as { group_id: string };
    const groupInv = (await call("POST", `/groups/${g.group_id}/invites`, a.token,
      { max_uses: 2 })).json as { code: string };
    for (let i = 0; i < 3; i++) {
      const burn = await call("POST", "/auth/claim", null,
        { invite_code: groupInv.code, display_name: "X", device_name: "Y" });
      expect(burn.status).toBe(403);
    }
    const b = mkUser("B");
    const join = await call("POST", "/invites/accept", b.token, { code: groupInv.code });
    expect(join.status).toBe(200); // both group uses intact
  });

  it("revoked device token stops working (logout)", async () => {
    const u = mkUser("A");
    expect((await call("GET", "/me", u.token)).status).toBe(200);
    await call("POST", "/auth/logout", u.token);
    expect((await call("GET", "/me", u.token)).status).toBe(401);
  });

  it("only the owner can mint new-account invites", async () => {
    const member = mkUser("Member");
    const r = await call("POST", "/invites/account", member.token, { max_uses: 1 });
    expect(r.status).toBe(403);
    const link = await call("POST", "/invites/account", member.token, { device_link: true });
    expect(link.status).toBe(200); // device-link for own account is fine
  });
});

describe("groups", () => {
  it("create → invite → join → leave; nonmembers cannot see members", async () => {
    const a = mkUser("A"), b = mkUser("B");
    const g = (await call("POST", "/groups", a.token, { name: "Richins Family" })).json as { group_id: string };
    const inv = (await call("POST", `/groups/${g.group_id}/invites`, a.token, {})).json as { code: string };
    const before = await call("GET", `/groups/${g.group_id}/members`, b.token);
    expect(before.status).toBe(403);
    const join = await call("POST", "/invites/accept", b.token, { code: inv.code });
    expect(join.status).toBe(200);
    const members = (await call("GET", `/groups/${g.group_id}/members`, b.token)).json as
      { members: unknown[] };
    expect(members.members.length).toBe(2);
    await call("POST", `/groups/${g.group_id}/leave`, b.token);
    expect((await call("GET", `/groups/${g.group_id}/members`, b.token)).status).toBe(403);
  });

  it("only group admins can invite or remove members", async () => {
    const a = mkUser("A"), b = mkUser("B");
    const g = (await call("POST", "/groups", a.token, { name: "G" })).json as { group_id: string };
    const inv = (await call("POST", `/groups/${g.group_id}/invites`, a.token, {})).json as { code: string };
    await call("POST", "/invites/accept", b.token, { code: inv.code });
    expect((await call("POST", `/groups/${g.group_id}/invites`, b.token, {})).status).toBe(403);
    expect((await call("DELETE", `/groups/${g.group_id}/members/${a.id}`, b.token)).status).toBe(403);
    expect((await call("DELETE", `/groups/${g.group_id}/members/${b.id}`, a.token)).status).toBe(200);
  });
});

describe("annotation permissions — the heart of privacy (§41)", () => {
  it("private annotations NEVER reach another user", async () => {
    const a = mkUser("A"), b = mkUser("B");
    const mine = ann({ annotation_type: "note", content: "my secret thought" });
    const push = await call("POST", "/sync/push", a.token, { ops: [op(mine)] });
    expect((push.json as { results: { status: string }[] }).results[0]!.status).toBe("applied");
    const q = (await call("POST", "/annotations/query", b.token,
      { anchor_ids: ["alma-36-18"] })).json as { annotations: unknown[] };
    expect(q.annotations.length).toBe(0);
    const pull = (await call("GET", "/sync/pull?cursor=", b.token)).json as { annotations: unknown[] };
    expect(pull.annotations.length).toBe(0);
    // and the author sees it
    const qa = (await call("POST", "/annotations/query", a.token,
      { anchor_ids: ["alma-36-18"] })).json as { annotations: unknown[] };
    expect(qa.annotations.length).toBe(1);
  });

  it("group annotations reach members only; leaving revokes access", async () => {
    const a = mkUser("A"), b = mkUser("B"), c = mkUser("C");
    const g = (await call("POST", "/groups", a.token, { name: "Fam" })).json as { group_id: string };
    const inv = (await call("POST", `/groups/${g.group_id}/invites`, a.token, {})).json as { code: string };
    await call("POST", "/invites/accept", b.token, { code: inv.code });
    await call("POST", "/sync/push", a.token, {
      ops: [op(ann({ visibility: "group", group_id: g.group_id, content: "family note" }))],
    });
    const forB = (await call("POST", "/annotations/query", b.token,
      { anchor_ids: ["alma-36-18"] })).json as { annotations: { content: string }[] };
    expect(forB.annotations[0]!.content).toBe("family note");
    const forC = (await call("POST", "/annotations/query", c.token,
      { anchor_ids: ["alma-36-18"] })).json as { annotations: unknown[] };
    expect(forC.annotations.length).toBe(0);
    await call("POST", `/groups/${g.group_id}/leave`, b.token);
    const afterLeave = (await call("POST", "/annotations/query", b.token,
      { anchor_ids: ["alma-36-18"] })).json as { annotations: unknown[] };
    expect(afterLeave.annotations.length).toBe(0);
  });

  it("public annotations are visible to all authed users", async () => {
    const a = mkUser("A"), b = mkUser("B");
    await call("POST", "/sync/push", a.token,
      { ops: [op(ann({ visibility: "public", content: "for everyone" }))] });
    const forB = (await call("POST", "/annotations/query", b.token,
      { anchor_ids: ["alma-36-18"] })).json as { annotations: unknown[] };
    expect(forB.annotations.length).toBe(1);
  });

  it("cannot post into a group you don't belong to", async () => {
    const a = mkUser("A"), b = mkUser("B");
    const g = (await call("POST", "/groups", a.token, { name: "G" })).json as { group_id: string };
    const r = (await call("POST", "/sync/push", b.token, {
      ops: [op(ann({ visibility: "group", group_id: g.group_id }))],
    })).json as { results: { status: string }[] };
    expect(r.results[0]!.status).toBe("rejected");
  });

  it("cannot edit or delete someone else's annotation", async () => {
    const a = mkUser("A"), b = mkUser("B");
    const shared = ann({ visibility: "public", content: "original" });
    await call("POST", "/sync/push", a.token, { ops: [op(shared)] });
    const edit = (await call("POST", "/sync/push", b.token, {
      ops: [op({ ...shared, content: "vandalized" }, 1)],
    })).json as { results: { status: string }[] };
    expect(edit.results[0]!.status).toBe("rejected");
  });

  it("visibility change private→group is an update, not a move (§7)", async () => {
    const a = mkUser("A");
    const g = (await call("POST", "/groups", a.token, { name: "G" })).json as { group_id: string };
    const note = ann({ annotation_type: "note", content: "thought" });
    await call("POST", "/sync/push", a.token, { ops: [op(note)] });
    const r = (await call("POST", "/sync/push", a.token, {
      ops: [op({ ...note, visibility: "group", group_id: g.group_id }, 1)],
    })).json as { results: { status: string; server_annotation: { visibility: string; version: number } }[] };
    expect(r.results[0]!.status).toBe("applied");
    expect(r.results[0]!.server_annotation.visibility).toBe("group");
    expect(r.results[0]!.server_annotation.version).toBe(2);
    const auditRow = db.prepare(
      "SELECT * FROM audit_events WHERE action='annotation.visibility_changed'").get();
    expect(auditRow).toBeTruthy();
  });
});

describe("sync semantics (§46)", () => {
  it("push is idempotent by op_id", async () => {
    const a = mkUser("A");
    const theOp = op(ann());
    const r1 = (await call("POST", "/sync/push", a.token, { ops: [theOp] })).json as
      { results: { status: string }[] };
    const r2 = (await call("POST", "/sync/push", a.token, { ops: [theOp] })).json as
      { results: { status: string }[] };
    expect(r1.results[0]!.status).toBe("applied");
    expect(r2.results[0]!.status).toBe("duplicate");
    const n = db.prepare("SELECT COUNT(*) n FROM annotations").get() as { n: number };
    expect(n.n).toBe(1);
  });

  it("stale base_version yields conflict with the server row", async () => {
    const a = mkUser("A");
    const note = ann({ annotation_type: "note", content: "v1" });
    await call("POST", "/sync/push", a.token, { ops: [op(note)] });
    await call("POST", "/sync/push", a.token, { ops: [op({ ...note, content: "v2" }, 1)] });
    const stale = (await call("POST", "/sync/push", a.token, {
      ops: [op({ ...note, content: "from old device" }, 1)],
    })).json as { results: { status: string; server_annotation: { content: string } }[] };
    expect(stale.results[0]!.status).toBe("conflict");
    expect(stale.results[0]!.server_annotation.content).toBe("v2");
  });

  it("pull pages with cursor and carries tombstones", async () => {
    const a = mkUser("A");
    const note = ann({ annotation_type: "note", content: "temp" });
    await call("POST", "/sync/push", a.token, { ops: [op(note)] });
    const p1 = (await call("GET", "/sync/pull?cursor=", a.token)).json as
      { annotations: { annotation_id: string }[]; next_cursor: string };
    expect(p1.annotations.length).toBe(1);
    await call("POST", "/sync/push", a.token,
      { ops: [op({ ...note }, 1, "delete_annotation")] });
    const p2 = (await call("GET", `/sync/pull?cursor=${encodeURIComponent(p1.next_cursor)}`, a.token))
      .json as { annotations: { deleted_at: string | null }[] };
    expect(p2.annotations.length).toBe(1);
    expect(p2.annotations[0]!.deleted_at).not.toBeNull();
  });

  it("'local' visibility on the wire is rejected (must never upload)", async () => {
    const a = mkUser("A");
    const r = (await call("POST", "/sync/push", a.token, {
      ops: [op(ann({ visibility: "local" }))],
    }));
    // zod on the server schema excludes 'local' → whole push is invalid,
    // or per-op rejected — either way nothing lands
    const n = db.prepare("SELECT COUNT(*) n FROM annotations").get() as { n: number };
    expect(n.n).toBe(0);
    expect([400, 200]).toContain(r.status);
  });
});

describe("export + deletion (§40, §63)", () => {
  it("export returns exactly my annotations", async () => {
    const a = mkUser("A"), b = mkUser("B");
    await call("POST", "/sync/push", a.token, { ops: [op(ann({ content: "mine" }))] });
    await call("POST", "/sync/push", b.token, { ops: [op(ann({ content: "theirs", visibility: "public" }))] });
    const ex = (await call("GET", "/export", a.token)).json as { annotations: { content: string }[] };
    expect(ex.annotations.length).toBe(1);
    expect(ex.annotations[0]!.content).toBe("mine");
  });

  it("account deletion clears content, revokes devices, removes memberships", async () => {
    const a = mkUser("A");
    await call("POST", "/sync/push", a.token, { ops: [op(ann({ content: "secret", visibility: "public" }))] });
    await call("POST", "/account/delete", a.token);
    expect((await call("GET", "/me", a.token)).status).toBe(401);
    const row = db.prepare("SELECT content, deleted_at FROM annotations").get() as
      { content: string; deleted_at: string | null };
    expect(row.content).toBe("");
    expect(row.deleted_at).not.toBeNull();
  });
});

describe("admin (§61)", () => {
  it("overview is owner-only and content-free", async () => {
    const owner = mkUser("Owner", "owner");
    const member = mkUser("M");
    await call("POST", "/sync/push", member.token,
      { ops: [op(ann({ annotation_type: "note", content: "private words" }))] });
    expect((await call("GET", "/admin/overview", member.token)).status).toBe(403);
    const over = (await call("GET", "/admin/overview", owner.token));
    expect(over.status).toBe(200);
    expect(JSON.stringify(over.json)).not.toContain("private words");
  });
});
