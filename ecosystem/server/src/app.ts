/** The collaboration backend (§36): one Fastify app, one relational DB.
 * SECURITY CORE: every annotation read is scoped IN SQL — private rows only
 * to their author, group rows only to members, tombstones included so
 * clients converge. Nothing relies on UI hiding (§41). */
import { setupHtml } from "./setupPage";
import { ytHtml } from "./ytPage";
import { ytAudio } from "./ytAudio";
import { Live } from "./live";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Annotation, SyncOp } from "@scripture-graph/core-sdk";
import { audit, authenticate, consumeInvite, createDevice, createInvite, createUser, now, type AuthedDevice } from "./auth";
import type { DB } from "./db";
import Database from "better-sqlite3";
import { ensurePersonalTables, manifest, mirrorToDisk, personalGet, personalManifest, personalPush,
  readShared, seedPersonalFromDisk, type PushItem } from "./vault";

const MAX_OPS_PER_PUSH = 200;
const PULL_LIMIT = 500;

// ---- naive in-memory rate limiter (per key per window) --------------------
class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  allow(key: string, limit: number, windowMs: number): boolean {
    const t = Date.now();
    const cur = this.hits.get(key);
    if (!cur || cur.reset < t) {
      this.hits.set(key, { n: 1, reset: t + windowMs });
      return true;
    }
    cur.n++;
    return cur.n <= limit;
  }
}

/** Scoped visibility predicate — used by every annotation read. */
const VISIBLE_SQL = `(
  a.author_user_id = @me
  OR a.visibility = 'public'
  OR (a.visibility = 'group' AND a.group_id IN (
       SELECT gm.group_id FROM group_memberships gm WHERE gm.user_id = @me))
)`;

export interface BuildOpts { db: DB; trustProxy?: boolean }

export function buildApp({ db, trustProxy }: BuildOpts): FastifyInstance {
  // 8 MB: a personal-notes push can carry a long page, a batch request a
  // long list of paths. trustProxy: behind Tailscale Funnel / Cloudflare
  // every phone arrives from the proxy's address; the real client IP rides
  // X-Forwarded-For, and the per-IP limits must see it.
  const app = Fastify({ logger: false, bodyLimit: 8_000_000, trustProxy: !!trustProxy });
  ensurePersonalTables(db);
  const limiter = new RateLimiter();

  const ALLOWED_ORIGINS = new Set(
    (process.env["SG_CORS_ORIGINS"] ??
      "app://obsidian.md,capacitor://localhost,http://localhost").split(","));

  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-headers", "authorization,content-type");
      reply.header("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") return reply.code(204).send();
  });

  const authed = (req: FastifyRequest, reply: FastifyReply): AuthedDevice | null => {
    const who = authenticate(db, req.headers.authorization);
    if (!who) {
      reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    if (!limiter.allow(`d:${who.device_id}`, 240, 60_000)) {
      reply.code(429).send({ error: "rate limited" });
      return null;
    }
    return who;
  };

  const isGroupAdmin = (groupId: string, userId: string): boolean => {
    const m = db.prepare(
      "SELECT role FROM group_memberships WHERE group_id=? AND user_id=?")
      .get(groupId, userId) as { role: string } | undefined;
    return m?.role === "admin";
  };
  const isMember = (groupId: string, userId: string): boolean =>
    !!db.prepare("SELECT 1 FROM group_memberships WHERE group_id=? AND user_id=?")
      .get(groupId, userId);

  // ------------------------------------------------------------------ auth
  app.post("/auth/claim", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:claim`, 10, 60_000)) {
      return reply.code(429).send({ error: "rate limited" });
    }
    const body = z.object({
      invite_code: z.string().min(4).max(64),
      display_name: z.string().min(1).max(80),
      device_name: z.string().min(1).max(120),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid request" });
    const invite = consumeInvite(db, body.data.invite_code, ["account"]);
    if (!invite) {
      return reply.code(403).send({ error: "invalid or expired invite code" });
    }
    const userId = createUser(db, body.data.display_name, "member");
    const dev = createDevice(db, userId, body.data.device_name);
    if (invite.group_id) {
      db.prepare("INSERT OR IGNORE INTO group_memberships(group_id,user_id,role,joined_at) VALUES (?,?,?,?)")
        .run(invite.group_id, userId, "member", now());
    }
    audit(db, userId, "account.claimed", "user", userId, body.data.device_name);
    const user = db.prepare("SELECT user_id, display_name, role, created_at FROM users WHERE user_id=?").get(userId);
    return { user, device_id: dev.device_id, token: dev.token };
  });

  /** Sign an EXISTING account into a new device using a device-link code
   * (an account invite minted by that user from a signed-in device). */
  app.post("/auth/link-device", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:link`, 10, 60_000)) {
      return reply.code(429).send({ error: "rate limited" });
    }
    const body = z.object({
      link_code: z.string().min(4).max(64),
      device_name: z.string().min(1).max(120),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid request" });
    // ONLY 'device' invites may bind a new device to an existing account —
    // an 'account' invite must never be replayable into an account takeover,
    // and a mismatched kind is rejected without consuming a use.
    const invite = consumeInvite(db, body.data.link_code, ["device"]);
    if (!invite) {
      return reply.code(403).send({ error: "invalid or expired code" });
    }
    const owner = db.prepare(
      "SELECT user_id, display_name, role, created_at FROM users WHERE user_id=? AND deleted_at IS NULL")
      .get(invite.created_by) as { user_id: string } | undefined;
    if (!owner) return reply.code(403).send({ error: "invalid code" });
    const dev = createDevice(db, owner.user_id, body.data.device_name);
    audit(db, owner.user_id, "device.linked", "device", dev.device_id, body.data.device_name);
    return { user: owner, device_id: dev.device_id, token: dev.token };
  });

  app.post("/auth/logout", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    db.prepare("UPDATE devices SET revoked_at=? WHERE device_id=?").run(now(), who.device_id);
    return { ok: true };
  });

  app.get("/me", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const groups = db.prepare(`
      SELECT g.group_id, g.name, gm.role,
             (SELECT COUNT(*) FROM group_memberships x WHERE x.group_id=g.group_id) AS member_count
      FROM group_memberships gm JOIN groups g ON g.group_id=gm.group_id
      WHERE gm.user_id=? AND g.deleted_at IS NULL`).all(who.user_id);
    const user = db.prepare("SELECT user_id, display_name, role, created_at FROM users WHERE user_id=?")
      .get(who.user_id);
    return { user, groups, device_id: who.device_id, urls: publicUrls() };
  });

  // ---------------------------------------------------------------- groups
  app.post("/groups", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const body = z.object({ name: z.string().min(1).max(80) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid request" });
    const group_id = randomUUID();
    db.prepare("INSERT INTO groups(group_id, name, owner_user_id, created_at) VALUES (?,?,?,?)")
      .run(group_id, body.data.name, who.user_id, now());
    db.prepare("INSERT INTO group_memberships(group_id,user_id,role,joined_at) VALUES (?,?, 'admin', ?)")
      .run(group_id, who.user_id, now());
    audit(db, who.user_id, "group.created", "group", group_id, body.data.name);
    return { group_id, name: body.data.name };
  });

  app.get("/groups", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const groups = db.prepare(`
      SELECT g.group_id, g.name, gm.role,
             (SELECT COUNT(*) FROM group_memberships x WHERE x.group_id=g.group_id) AS member_count
      FROM group_memberships gm JOIN groups g ON g.group_id=gm.group_id
      WHERE gm.user_id=? AND g.deleted_at IS NULL`).all(who.user_id);
    return { groups };
  });

  app.get("/groups/:id/members", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const groupId = (req.params as { id: string }).id;
    if (!isMember(groupId, who.user_id)) return reply.code(403).send({ error: "not a member" });
    const members = db.prepare(`
      SELECT u.user_id, u.display_name, gm.role FROM group_memberships gm
      JOIN users u ON u.user_id=gm.user_id WHERE gm.group_id=?`).all(groupId);
    return { members };
  });

  /** What each of MY groups has been studying lately — recent group-shared
   * annotations rolled up per (group, chapter). Strictly scoped to the
   * caller's own memberships; content never leaves, only counts. */
  app.get("/activity/groups", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const since = new Date(Date.now() - 21 * 86_400_000).toISOString();
    const rows = db.prepare(`
      SELECT a.anchor_id, a.anchor_type, a.group_id, g.name AS group_name,
             a.updated_at, a.author_user_id
      FROM annotations a JOIN groups g ON g.group_id = a.group_id
      WHERE a.visibility = 'group' AND a.deleted_at IS NULL AND g.deleted_at IS NULL
        AND a.updated_at > ?
        AND a.group_id IN (
          SELECT gm.group_id FROM group_memberships gm WHERE gm.user_id = ?)
      ORDER BY a.updated_at DESC LIMIT 500`).all(since, who.user_id) as {
        anchor_id: string; anchor_type: string; group_id: string;
        group_name: string; updated_at: string; author_user_id: string;
      }[];
    const agg = new Map<string, {
      group_id: string; group_name: string; chapter_slug: string;
      count: number; others: number; latest: string;
    }>();
    for (const r of rows) {
      const chapter = r.anchor_type === "verse" ? r.anchor_id.replace(/-\d+$/, "")
        : r.anchor_type === "chapter" ? r.anchor_id : null;
      if (!chapter) continue;
      const key = `${r.group_id}|${chapter}`;
      const cur = agg.get(key) ?? {
        group_id: r.group_id, group_name: r.group_name, chapter_slug: chapter,
        count: 0, others: 0, latest: r.updated_at,
      };
      cur.count += 1;
      if (r.author_user_id !== who.user_id) cur.others += 1;
      if (r.updated_at > cur.latest) cur.latest = r.updated_at;
      agg.set(key, cur);
    }
    const activity = [...agg.values()]
      .sort((a, b) => b.latest.localeCompare(a.latest))
      .slice(0, 12);
    return { activity };
  });

  app.post("/groups/:id/invites", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const groupId = (req.params as { id: string }).id;
    if (!isGroupAdmin(groupId, who.user_id)) return reply.code(403).send({ error: "admin only" });
    const body = z.object({
      max_uses: z.number().int().min(1).max(100).default(10),
      ttl_hours: z.number().int().min(1).max(24 * 90).default(24 * 14),
    }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid request" });
    const inv = createInvite(db, "group", who.user_id,
      { groupId, maxUses: body.data.max_uses, ttlHours: body.data.ttl_hours });
    audit(db, who.user_id, "invite.created", "group", groupId);
    return inv;
  });

  app.post("/invites/account", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const body = z.object({
      max_uses: z.number().int().min(1).max(50).default(1),
      ttl_hours: z.number().int().min(1).max(24 * 90).default(24 * 14),
      for_group: z.string().uuid().nullish(),
      device_link: z.boolean().default(false),
    }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid request" });
    // device-link codes: any user, for their own account. New-account invites: owner only (§61).
    if (!body.data.device_link && who.role !== "owner") {
      return reply.code(403).send({ error: "owner only" });
    }
    if (body.data.for_group && !isGroupAdmin(body.data.for_group, who.user_id) && who.role !== "owner") {
      return reply.code(403).send({ error: "not group admin" });
    }
    const inv = createInvite(db, body.data.device_link ? "device" : "account", who.user_id, {
      groupId: body.data.for_group ?? null,
      maxUses: body.data.device_link ? 1 : body.data.max_uses,
      ttlHours: body.data.device_link ? 1 : body.data.ttl_hours,
    });
    audit(db, who.user_id, body.data.device_link ? "devicelink.created" : "invite.account_created",
      "invite", "-");
    return inv;
  });

  app.post("/invites/accept", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const body = z.object({ code: z.string().min(4).max(64) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid request" });
    if (!limiter.allow(`u:${who.user_id}:accept`, 10, 60_000)) {
      return reply.code(429).send({ error: "rate limited" });
    }
    const invite = consumeInvite(db, body.data.code, ["group"]);
    if (!invite || !invite.group_id) {
      return reply.code(403).send({ error: "invalid or expired invite code" });
    }
    db.prepare("INSERT OR IGNORE INTO group_memberships(group_id,user_id,role,joined_at) VALUES (?,?,?,?)")
      .run(invite.group_id, who.user_id, "member", now());
    const g = db.prepare("SELECT name FROM groups WHERE group_id=?").get(invite.group_id) as { name: string };
    audit(db, who.user_id, "group.joined", "group", invite.group_id);
    return { kind: "group", group_id: invite.group_id, group_name: g?.name };
  });

  app.post("/groups/:id/leave", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const groupId = (req.params as { id: string }).id;
    db.prepare("DELETE FROM group_memberships WHERE group_id=? AND user_id=?")
      .run(groupId, who.user_id);
    audit(db, who.user_id, "group.left", "group", groupId);
    return { ok: true };
  });

  app.delete("/groups/:id/members/:uid", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const { id: groupId, uid } = req.params as { id: string; uid: string };
    if (!isGroupAdmin(groupId, who.user_id)) return reply.code(403).send({ error: "admin only" });
    db.prepare("DELETE FROM group_memberships WHERE group_id=? AND user_id=?").run(groupId, uid);
    audit(db, who.user_id, "group.member_removed", "group", groupId, uid);
    return { ok: true };
  });

  // ------------------------------------------------------------------ sync
  app.post("/sync/push", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const body = z.object({ ops: z.array(SyncOp).max(MAX_OPS_PER_PUSH) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid ops" });
    const results = body.data.ops.map(op => applyOp(db, who, op));
    return { results };
  });

  app.get("/sync/pull", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const cursor = String((req.query as { cursor?: string }).cursor ?? "");
    const rows = db.prepare(`
      SELECT a.* FROM annotations a
      WHERE a.updated_at > @cursor AND ${VISIBLE_SQL}
      ORDER BY a.updated_at ASC, a.annotation_id ASC
      LIMIT ${PULL_LIMIT}`).all({ me: who.user_id, cursor }) as Annotation[];
    const next = rows.length ? rows[rows.length - 1]!.updated_at : (cursor || "");
    return { annotations: rows, next_cursor: next };
  });

  app.post("/annotations/query", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const body = z.object({ anchor_ids: z.array(z.string().min(2).max(200)).min(1).max(400) })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid request" });
    // named params only (better-sqlite3 cannot mix named + positional)
    const params: Record<string, string> = { me: who.user_id };
    const placeholders = body.data.anchor_ids.map((id, i) => {
      params[`a${i}`] = id;
      return `@a${i}`;
    }).join(",");
    const rows = db.prepare(`
      SELECT a.*, u.display_name AS author_name FROM annotations a
      JOIN users u ON u.user_id = a.author_user_id
      WHERE a.deleted_at IS NULL AND a.anchor_id IN (${placeholders})
        AND ${VISIBLE_SQL}
    `).all(params);
    return { annotations: rows };
  });

  // -------------------------------------------------------- export/delete
  app.get("/export", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const annotations = db.prepare(
      "SELECT * FROM annotations WHERE author_user_id=? AND deleted_at IS NULL").all(who.user_id);
    const groups = db.prepare(`
      SELECT g.group_id, g.name, gm.role FROM group_memberships gm
      JOIN groups g ON g.group_id=gm.group_id WHERE gm.user_id=?`).all(who.user_id);
    audit(db, who.user_id, "data.exported", "user", who.user_id);
    return { annotations, groups, exported_at: now() };
  });

  app.post("/account/delete", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const t = db.transaction(() => {
      db.prepare(`UPDATE annotations SET content='', selected_text=NULL, deleted_at=?,
                  updated_at=?, version=version+1 WHERE author_user_id=?`)
        .run(now(), now(), who.user_id);
      db.prepare("DELETE FROM group_memberships WHERE user_id=?").run(who.user_id);
      db.prepare("UPDATE devices SET revoked_at=? WHERE user_id=?").run(now(), who.user_id);
      db.prepare("UPDATE users SET deleted_at=?, display_name='(deleted user)' WHERE user_id=?")
        .run(now(), who.user_id);
    });
    t();
    audit(db, who.user_id, "account.deleted", "user", who.user_id);
    return { ok: true };
  });

  // ----------------------------------------------------------------- admin
  app.get("/admin/overview", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    if (who.role !== "owner") return reply.code(403).send({ error: "owner only" });
    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    // §61: counts + health only. NEVER private content.
    return {
      users: count("SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL"),
      devices: count("SELECT COUNT(*) n FROM devices WHERE revoked_at IS NULL"),
      groups: count("SELECT COUNT(*) n FROM groups WHERE deleted_at IS NULL"),
      annotations: count("SELECT COUNT(*) n FROM annotations WHERE deleted_at IS NULL"),
      audit_events: count("SELECT COUNT(*) n FROM audit_events"),
    };
  });

  app.get("/health", async () => ({ ok: true, at: now() }));

  // ------------------------------------------------- plugin update channel
  // The family server hands out the latest plugin build directly — devices
  // self-update with one tap instead of waiting on vault-config sync.
  // Fixed filename allowlist: no traversal, nothing else served.
  const PLUGIN_FILES: Record<string, string> = {
    "manifest.json": "application/json",
    "main.js": "application/javascript",
    "styles.css": "text/css",
  };
  // ------------------------------------------------------ public addresses
  // Every address this server can be reached at: the LAN one, a Cloudflare
  // quick tunnel (data/public-url.txt, rewritten whenever the tunnel comes
  // up), a permanent Tailscale Funnel or any other (SG_PUBLIC_URL, comma-
  // separated). Devices learn the list from any successful call and fall
  // back through it, so a moved address never strands a phone.
  const publicUrls = (): string[] => {
    const out = new Set<string>();
    for (const u of (process.env["SG_PUBLIC_URL"] ?? "").split(",")) if (u.trim()) out.add(u.trim());
    try {
      const f = join(process.env["SG_DATA_DIR"] ?? "data", "public-url.txt");
      if (existsSync(f)) { const u = readFileSync(f, "utf8").trim(); if (u) out.add(u); }
    } catch { /* no tunnel */ }
    for (const u of (process.env["SG_LAN_URL"] ?? "http://192.168.1.59:8930").split(",")) if (u.trim()) out.add(u.trim());
    return [...out];
  };
  // ------------------------------------------------------------ live channel
  // one held request per device; answered the instant a new plugin build
  // or a vault change lands (fs.watch), or after `wait` seconds
  const live = new Live(process.env["SG_PLUGIN_DIR"] ?? "plugin-release", process.env["SG_VAULT"] ?? "");
  app.addHook("onClose", async () => live.close());
  app.get("/live", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:live`, 240, 60_000)) return reply.code(429).send({ error: "rate limited" });
    const q = req.query as { plugin?: string; vault?: string; wait?: string };
    const wait = Math.min(25, Math.max(0, Number(q.wait ?? 20) || 0));
    const cur = await live.wait(q.plugin ?? "", q.vault ?? "", wait * 1000);
    reply.header("cache-control", "no-store");
    return { ...cur, urls: publicUrls() };
  });

  // the sound of a YouTube video, streamed plain so a locked phone keeps playing it
  app.get("/yt/audio", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:ytaudio`, 600, 60_000)) return reply.code(429).send({ error: "rate limited" });
    return ytAudio(req, reply);
  });
  // the YouTube player page: a real website for YouTube's embed rules; the app frames it
  app.get("/yt", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:yt`, 240, 60_000)) return reply.code(429).send({ error: "rate limited" });
    reply.header("content-type", "text/html; charset=utf-8");
    reply.header("cache-control", "public, max-age=3600");
    return ytHtml();
  });

  // the family setup page (invite rides in the query string, read client-side)
  app.get("/setup", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:setup`, 60, 60_000)) return reply.code(429).send({ error: "rate limited" });
    reply.header("content-type", "text/html; charset=utf-8");
    reply.header("cache-control", "no-store");
    return setupHtml();
  });

  // unauthenticated on purpose: a device that only knows one address must be
  // able to ask "where else are you?" before it can log in
  app.get("/where", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:where`, 60, 60_000)) return reply.code(429).send({ error: "rate limited" });
    return { urls: publicUrls() };
  });

  // ------------------------------------------------------------- vault sync
  // The shared tree, read-only, for every device; each person's Library/
  // two-way. SG_VAULT names the vault folder on this machine.
  const vaultRoot = process.env["SG_VAULT"] ?? "";
  const haveVault = () => !!vaultRoot && existsSync(vaultRoot);
  const mirror = haveVault() && process.env["SG_OWNER_MIRROR"] !== "0" ? mirrorToDisk(vaultRoot) : null;
  const isOwner = (userId: string): boolean =>
    (db.prepare("SELECT role FROM users WHERE user_id=?").get(userId) as { role?: string } | undefined)?.role === "owner";
  let seeded = false;
  app.get("/vault/version", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    if (!haveVault()) return reply.code(503).send({ error: "no vault on this server" });
    const m = manifest(vaultRoot);
    return { version: m.version, count: m.count, bytes: m.bytes, urls: publicUrls() };
  });
  app.get("/vault/manifest", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    if (!haveVault()) return reply.code(503).send({ error: "no vault on this server" });
    const m = manifest(vaultRoot);
    if (req.headers["if-none-match"] === m.version) return reply.code(304).send();
    reply.header("etag", m.version);
    return m;
  });
  app.post("/vault/batch", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    if (!haveVault()) return reply.code(503).send({ error: "no vault on this server" });
    const paths = ((req.body as { paths?: unknown })?.paths ?? []) as unknown[];
    if (!Array.isArray(paths) || paths.length > 400) return reply.code(400).send({ error: "paths: up to 400" });
    const files = [];
    let bytes = 0;
    for (const p of paths) {
      if (typeof p !== "string") continue;
      const f = readShared(vaultRoot, p);
      if (!f) { files.push({ p, missing: true }); continue; }
      files.push(f);
      bytes += (f.text ?? f.b64 ?? "").length;
      if (bytes > 6_000_000) break;              // the device asks again for the rest
    }
    return { files };
  });
  app.get("/vault/file", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    if (!haveVault()) return reply.code(503).send({ error: "no vault on this server" });
    const p = String((req.query as { path?: string }).path ?? "");
    const f = readShared(vaultRoot, p);
    if (!f) return reply.code(404).send({ error: "not found" });
    return f;
  });
  // ---- personal: Library/ per user
  app.get("/vault/personal/manifest", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    if (!seeded && haveVault() && isOwner(who.user_id)) {
      seeded = true;
      seedPersonalFromDisk(db, vaultRoot, who.user_id, now());
    }
    const since = (req.query as { since?: string }).since;
    return { files: personalManifest(db, who.user_id, since || undefined), now: now() };
  });
  app.get("/vault/personal/file", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const p = String((req.query as { path?: string }).path ?? "");
    const row = personalGet(db, who.user_id, p);
    if (!row) return reply.code(404).send({ error: "not found" });
    return row;
  });
  app.post("/vault/personal/push", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const items = ((req.body as { files?: unknown })?.files ?? []) as PushItem[];
    if (!Array.isArray(items) || items.length > 200) return reply.code(400).send({ error: "files: up to 200" });
    const results = personalPush(db, who.user_id, who.device_id, items, now(),
      isOwner(who.user_id) ? mirror : null);
    return { results, now: now() };
  });

  // ------------------------------------------------------------ search
  // The engine's full-text index (chunks_fts over every indexed passage:
  // scripture, talks, teachings, periodicals, questions) answered for the
  // phone, which cannot open the engine database itself. Read-only; the
  // engine keeps writing underneath. SG_ENGINE_DB names the file.
  let engine: Database.Database | null = null;
  const engineDb = (): Database.Database | null => {
    if (engine) return engine;
    const p = process.env["SG_ENGINE_DB"];
    if (!p || !existsSync(p)) return null;
    try {
      engine = new Database(p, { readonly: true, fileMustExist: true });
      engine.pragma("query_only = 1");
      return engine;
    } catch { return null; }
  };
  app.get("/search", async (req, reply) => {
    const who = authed(req, reply); if (!who) return;
    const q = String((req.query as { q?: string }).q ?? "").trim();
    if (q.length < 2) return { results: [] };
    const db2 = engineDb();
    if (!db2) return reply.code(503).send({ error: "library index not available on this server" });
    const terms = q.replace(/["*()]/g, " ").split(/\s+/).filter(t => t.length > 1).slice(0, 8);
    if (!terms.length) return { results: [] };
    const quoted = terms.map(t => `"${t}"`);
    const run = (match: string) => db2.prepare(`
      SELECT c.owner_type AS kind, c.owner_id AS owner,
             snippet(chunks_fts, 0, '\u00ab', '\u00bb', ' \u2026 ', 14) AS snippet,
             bm25(chunks_fts) AS rank
      FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid
      WHERE chunks_fts MATCH ? ORDER BY rank LIMIT 24`).all(match) as
      { kind: string; owner: string; snippet: string; rank: number }[];
    let rows: { kind: string; owner: string; snippet: string; rank: number }[] = [];
    try { rows = run(quoted.join(" AND ")); } catch { rows = []; }
    if (rows.length < 6) { try { rows = rows.concat(run(quoted.join(" OR ")).filter(r => !rows.some(x => x.owner === r.owner))); } catch { /* keep */ } }
    const title = db2.prepare("SELECT title, vault_path FROM nodes WHERE id=? OR id=? OR id=? LIMIT 1");
    const chapter = db2.prepare("SELECT c.slug, n.title, n.vault_path FROM chapters c JOIN nodes n ON n.id = 'chapter:' || c.slug WHERE c.slug=?");
    const seen = new Set<string>();
    const results: { title: string; path: string | null; snippet: string; kind: string }[] = [];
    for (const r of rows) {
      let t: { title: string; vault_path: string | null } | undefined;
      let kind = r.kind;
      if (r.kind === "verse") {
        const cs = r.owner.replace(/-\d+$/, "");
        t = chapter.get(cs) as { title: string; vault_path: string | null } | undefined;
        kind = "scripture";
      } else {
        t = title.get(r.owner, `doc:${r.owner}`, `talk:${r.owner}`) as { title: string; vault_path: string | null } | undefined;
      }
      if (!t) continue;
      const key = `${t.title}|${r.snippet.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ title: t.title, path: t.vault_path, snippet: r.snippet, kind });
      if (results.length >= 20) break;
    }
    return { results };
  });

  // one zip with the plugin folder inside, for phones: unzip in the Files
  // app, move the folder into the vault's .obsidian/plugins/. Stored, not
  // compressed -- 800 KB, and no zip library needed.
  app.get("/plugin/scripture-graph.zip", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:plugin`, 60, 60_000)) return reply.code(429).send({ error: "rate limited" });
    const dir = process.env["SG_PLUGIN_DIR"] ?? "plugin-release";
    const names = ["manifest.json", "main.js", "styles.css"].filter(n => existsSync(join(dir, n)));
    if (!names.length) return reply.code(404).send({ error: "no build published" });
    const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const parts: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
    for (const n of names) {
      const data = Buffer.from(readFileSync(join(dir, n), "utf8").replace(/^﻿/, ""), "utf8");
      const name = Buffer.from(`scripture-graph/${n}`, "utf8");
      const crc = crc32(data);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
      local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10);
      cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
      cd.writeUInt16LE(name.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36);
      cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
      parts.push(local, name, data); central.push(cd, name);
      offset += local.length + name.length + data.length;
    }
    const cdBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(names.length, 8);
    end.writeUInt16LE(names.length, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
    reply.header("content-type", "application/zip");
    reply.header("content-disposition", 'attachment; filename="scripture-graph.zip"');
    return Buffer.concat([...parts, cdBuf, end]);
  });

  app.get("/plugin/:file", async (req, reply) => {
    if (!limiter.allow(`ip:${req.ip}:plugin`, 60, 60_000)) {
      return reply.code(429).send({ error: "rate limited" });
    }
    const file = (req.params as { file: string }).file;
    const type = PLUGIN_FILES[file];
    if (!type) return reply.code(404).send({ error: "not found" });
    const dir = process.env["SG_PLUGIN_DIR"] ?? "plugin-release";
    const p = join(dir, file);
    if (!existsSync(p)) return reply.code(404).send({ error: "no build published" });
    reply.header("content-type", type);
    // Windows editors love UTF-8 BOMs; a BOM in manifest.json breaks every
    // JSON parser downstream — strip it at the door
    return readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  });

  return app;
}

// --------------------------------------------------------------- op apply

function applyOp(db: DB, who: AuthedDevice, op: SyncOp) {
  // idempotency: replay returns the recorded outcome's current state
  const prior = db.prepare("SELECT result_status, annotation_id FROM sync_ops WHERE op_id=?")
    .get(op.op_id) as { result_status: string; annotation_id: string | null } | undefined;
  if (prior) {
    const current = prior.annotation_id
      ? (db.prepare("SELECT * FROM annotations WHERE annotation_id=?").get(prior.annotation_id) as Annotation | undefined)
      : undefined;
    return { op_id: op.op_id, status: "duplicate" as const, server_annotation: current ?? null };
  }

  const record = (status: string, annotationId: string | null) =>
    db.prepare("INSERT INTO sync_ops(op_id,user_id,device_id,result_status,annotation_id,applied_at) VALUES (?,?,?,?,?,?)")
      .run(op.op_id, who.user_id, who.device_id, status, annotationId, now());

  const a = op.annotation;
  // never trust client identity or the 'local' scope on the wire
  if ((a.visibility as string) === "local") {
    record("rejected", null);
    return { op_id: op.op_id, status: "rejected" as const, server_annotation: null, reason: "local scope is device-only" };
  }
  if (a.visibility === "group") {
    if (!a.group_id) {
      record("rejected", null);
      return { op_id: op.op_id, status: "rejected" as const, server_annotation: null, reason: "group_id required" };
    }
    const member = db.prepare("SELECT 1 FROM group_memberships WHERE group_id=? AND user_id=?")
      .get(a.group_id, who.user_id);
    if (!member) {
      record("rejected", null);
      return { op_id: op.op_id, status: "rejected" as const, server_annotation: null, reason: "not a group member" };
    }
  }

  const existing = db.prepare("SELECT * FROM annotations WHERE annotation_id=?")
    .get(a.annotation_id) as Annotation | undefined;

  // only the author may modify/delete their annotation (group admins may
  // delete group-scope annotations in their group — §62)
  if (existing && existing.author_user_id !== who.user_id) {
    const adminDelete = op.kind === "delete_annotation"
      && existing.visibility === "group" && existing.group_id
      && (db.prepare("SELECT role FROM group_memberships WHERE group_id=? AND user_id=?")
        .get(existing.group_id, who.user_id) as { role?: string } | undefined)?.role === "admin";
    if (!adminDelete) {
      record("rejected", null);
      return { op_id: op.op_id, status: "rejected" as const, server_annotation: null, reason: "not your annotation" };
    }
  }

  if (existing && existing.version !== op.base_version) {
    record("conflict", a.annotation_id);
    return { op_id: op.op_id, status: "conflict" as const, server_annotation: existing };
  }

  const ts = now();
  const version = (existing?.version ?? 0) + 1;
  const author = existing?.author_user_id ?? who.user_id;
  const deleted = op.kind === "delete_annotation" ? ts : null;
  const row: Annotation = {
    ...a,
    author_user_id: author,
    version,
    updated_at: ts,
    created_at: existing?.created_at ?? a.created_at ?? ts,
    deleted_at: deleted,
    content: deleted && existing && existing.author_user_id !== who.user_id ? "" : a.content,
  };
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO annotations(annotation_id, author_user_id, anchor_type, anchor_id,
        annotation_type, selected_text, start_offset, end_offset, text_hash, content, color,
        style, theme, visibility, group_id, created_at, updated_at, deleted_at, version)
      VALUES (@annotation_id,@author_user_id,@anchor_type,@anchor_id,@annotation_type,
        @selected_text,@start_offset,@end_offset,@text_hash,@content,@color,@style,@theme,
        @visibility,@group_id,@created_at,@updated_at,@deleted_at,@version)
      ON CONFLICT(annotation_id) DO UPDATE SET
        annotation_type=excluded.annotation_type, selected_text=excluded.selected_text,
        start_offset=excluded.start_offset, end_offset=excluded.end_offset,
        text_hash=excluded.text_hash, content=excluded.content, color=excluded.color,
        style=excluded.style, theme=excluded.theme,
        visibility=excluded.visibility, group_id=excluded.group_id,
        updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, version=excluded.version`)
      .run(row as unknown as Record<string, unknown>);
    db.prepare(`INSERT OR REPLACE INTO annotation_versions(annotation_id, version, content, visibility, updated_at, updated_by)
                VALUES (?,?,?,?,?,?)`)
      .run(row.annotation_id, version, row.content, row.visibility, ts, who.user_id);
    record("applied", row.annotation_id);
    const action = op.kind === "delete_annotation" ? "annotation.deleted"
      : existing
        ? (existing.visibility !== row.visibility ? "annotation.visibility_changed" : "annotation.updated")
        : "annotation.created";
    const detail = existing && existing.visibility !== row.visibility
      ? `${existing.visibility}->${row.visibility}` : undefined;
    audit(db, who.user_id, action, "annotation", row.annotation_id, detail);
  });
  tx();
  return { op_id: op.op_id, status: "applied" as const, server_annotation: row };
}
