/** Identity + sessions (§35): invite-claim accounts, hashed device tokens,
 * hashed invite codes. Tokens/codes are shown once and stored only as
 * SHA-256 hashes — a database leak does not leak credentials. */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { DB } from "./db";

export const now = () => new Date().toISOString();

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function newDeviceToken(): string {
  return "sgd_" + randomBytes(36).toString("base64url");
}

export function newInviteCode(): string {
  // 12 chars, unambiguous alphabet — easy to type on a phone
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let code = "";
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code.slice(0, 4) + "-" + code.slice(4, 8) + "-" + code.slice(8, 12);
}

export interface AuthedDevice {
  user_id: string;
  device_id: string;
  display_name: string;
  role: "owner" | "member";
}

export function authenticate(db: DB, authHeader: string | undefined): AuthedDevice | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token.startsWith("sgd_") || token.length < 40) return null;
  const row = db.prepare(`
    SELECT d.device_id, d.user_id, d.token_hash, u.display_name, u.role
    FROM devices d JOIN users u ON u.user_id = d.user_id
    WHERE d.token_hash = ? AND d.revoked_at IS NULL AND u.deleted_at IS NULL
  `).get(sha256(token)) as
    { device_id: string; user_id: string; token_hash: string; display_name: string; role: "owner" | "member" } | undefined;
  if (!row) return null;
  // defense in depth: constant-time re-compare
  const a = Buffer.from(row.token_hash, "hex");
  const b = Buffer.from(sha256(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  db.prepare("UPDATE devices SET last_seen = ? WHERE device_id = ?").run(now(), row.device_id);
  return { user_id: row.user_id, device_id: row.device_id, display_name: row.display_name, role: row.role };
}

export function createUser(db: DB, displayName: string, role: "owner" | "member"): string {
  const id = randomUUID();
  db.prepare("INSERT INTO users(user_id, display_name, role, created_at) VALUES (?,?,?,?)")
    .run(id, displayName, role, now());
  return id;
}

export function createDevice(db: DB, userId: string, deviceName: string): { device_id: string; token: string } {
  const token = newDeviceToken();
  const device_id = randomUUID();
  db.prepare("INSERT INTO devices(device_id, user_id, device_name, token_hash, created_at) VALUES (?,?,?,?,?)")
    .run(device_id, userId, deviceName.slice(0, 120), sha256(token), now());
  return { device_id, token };
}

export function createInvite(
  db: DB, kind: "account" | "group" | "device", createdBy: string,
  opts: { groupId?: string | null; maxUses?: number; ttlHours?: number } = {},
): { code: string; expires_at: string } {
  const code = newInviteCode();
  const expires_at = new Date(Date.now() + (opts.ttlHours ?? 24 * 14) * 3600_000).toISOString();
  db.prepare(`INSERT INTO invites(code_hash, kind, group_id, max_uses, uses, expires_at, created_by, created_at)
              VALUES (?,?,?,?,0,?,?,?)`)
    .run(sha256(normalizeCode(code)), kind, opts.groupId ?? null, opts.maxUses ?? 1, expires_at, createdBy, now());
  return { code, expires_at };
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export interface InviteRow {
  code_hash: string; kind: "account" | "group" | "device"; group_id: string | null;
  max_uses: number; uses: number; expires_at: string; revoked_at: string | null;
  created_by: string;
}

/** Atomically consume one use of an invite. Returns the row or null. */
export function consumeInvite(db: DB, rawCode: string): InviteRow | null {
  const hash = sha256(normalizeCode(rawCode));
  const row = db.prepare("SELECT * FROM invites WHERE code_hash = ?").get(hash) as InviteRow | undefined;
  if (!row) return null;
  if (row.revoked_at || row.uses >= row.max_uses || row.expires_at < now()) return null;
  const r = db.prepare(
    "UPDATE invites SET uses = uses + 1 WHERE code_hash = ? AND uses < max_uses AND revoked_at IS NULL")
    .run(hash);
  return r.changes === 1 ? row : null;
}

export function audit(db: DB, actor: string, action: string, entity: string, entityId: string, detail?: string): void {
  db.prepare("INSERT INTO audit_events(at, actor_user_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?)")
    .run(now(), actor, action, entity, entityId, detail ?? null);
}
