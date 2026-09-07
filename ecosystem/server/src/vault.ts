/** Vault sync — the family server hands every device the shared vault and
 * carries each person's own notes, so nobody pays for a copy service.
 *
 * SHARED tree (read-only for devices): everything the engine writes —
 * scriptures, study guides, the library, findings, questions, covers, the
 * plugin build. A manifest lists every file with a content hash; devices
 * diff it against what they hold and fetch only what changed, in batches.
 * Hashes are cached per (path, size, mtime), so a manifest costs a
 * directory walk, not a re-read of 125 MB.
 *
 * PERSONAL tree (`Library/`): two-way, per user, in the server database.
 * A push carries the file's hash and the hash it was edited from; the
 * server accepts when nothing moved underneath, and hands back its copy
 * when something did (the device keeps both). The owner's files are
 * mirrored to the vault on disk so the engine keeps reading them. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, sep } from "node:path";
import type { DB } from "./db";

export interface ManifestEntry { p: string; h: string; s: number; m: number }
export interface Manifest { version: string; count: number; bytes: number; files: ManifestEntry[] }

/** what devices never receive */
const EXCLUDED_TOP = new Set([".git", ".scripture-engine", ".trash", "Library", "sources"]);
/** inside .obsidian only the plugin build travels (workspace/layout is per device) */
const OBSIDIAN_ALLOWED = ".obsidian/plugins/scripture-graph/";
const TEXT_EXT = new Set([".md", ".json", ".css", ".js", ".txt", ".csv", ".yaml", ".yml", ".svg"]);

const hashCache = new Map<string, { size: number; mtime: number; h: string }>();

function sha(buf: Buffer): string { return createHash("sha256").update(buf).digest("hex").slice(0, 24); }

function walk(root: string, rel: string, out: ManifestEntry[]): void {
  let names: string[];
  try { names = readdirSync(join(root, rel)); } catch { return; }
  for (const name of names) {
    const r = rel ? posix.join(rel, name) : name;
    if (!rel && EXCLUDED_TOP.has(name)) continue;
    if (r.startsWith(".obsidian/") && !(r + "/").startsWith(OBSIDIAN_ALLOWED) && !OBSIDIAN_ALLOWED.startsWith(r + "/")) continue;
    let st;
    try { st = statSync(join(root, r)); } catch { continue; }
    if (st.isDirectory()) { walk(root, r, out); continue; }
    if (!st.isFile() || name.startsWith("~$") || name.endsWith(".tmp")) continue;
    const mtime = Math.floor(st.mtimeMs);
    const cached = hashCache.get(r);
    let h: string;
    if (cached && cached.size === st.size && cached.mtime === mtime) h = cached.h;
    else {
      try { h = sha(readFileSync(join(root, r))); } catch { continue; }
      hashCache.set(r, { size: st.size, mtime, h });
    }
    out.push({ p: r, h, s: st.size, m: mtime });
  }
}

let manifestCache: { at: number; m: Manifest } | null = null;

/** the live channel saw the tree change: the next manifest walks again */
export function invalidateManifest(): void { manifestCache = null; }

/** the shared tree's manifest (cached for a few seconds under load) */
export function manifest(root: string): Manifest {
  const now = Date.now();
  if (manifestCache && now - manifestCache.at < 5_000) return manifestCache.m;
  const files: ManifestEntry[] = [];
  walk(root, "", files);
  files.sort((a, b) => (a.p < b.p ? -1 : 1));
  const v = createHash("sha256");
  let bytes = 0;
  for (const f of files) { v.update(f.p); v.update(f.h); bytes += f.s; }
  const m: Manifest = { version: v.digest("hex").slice(0, 16), count: files.length, bytes, files };
  manifestCache = { at: now, m };
  return m;
}

function safe(root: string, p: string): string | null {
  if (!p || p.includes("..") || p.startsWith("/") || p.startsWith("\\")) return null;
  const top = p.split("/")[0]!;
  if (EXCLUDED_TOP.has(top)) return null;
  if (p.startsWith(".obsidian/") && !p.startsWith(OBSIDIAN_ALLOWED)) return null;
  const abs = join(root, ...p.split("/"));
  if (relative(root, abs).startsWith("..")) return null;
  return abs;
}

export function isText(p: string): boolean {
  const i = p.lastIndexOf(".");
  return i >= 0 && TEXT_EXT.has(p.slice(i).toLowerCase());
}

/** one file, as the device will store it: text as-is, binary as base64 */
export function readShared(root: string, p: string): { p: string; text?: string; b64?: string; h: string } | null {
  const abs = safe(root, p);
  if (!abs || !existsSync(abs)) return null;
  const buf = readFileSync(abs);
  const h = sha(buf);
  return isText(p) ? { p, text: buf.toString("utf8"), h } : { p, b64: buf.toString("base64"), h };
}

// ----------------------------------------------------------- personal

export function ensurePersonalTables(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS personal_files (
      user_id     TEXT NOT NULL,
      path        TEXT NOT NULL,
      content     TEXT,
      hash        TEXT,
      mtime       INTEGER NOT NULL,
      deleted_at  TEXT,
      updated_at  TEXT NOT NULL,
      device_id   TEXT,
      PRIMARY KEY (user_id, path)
    );
    CREATE INDEX IF NOT EXISTS idx_personal_user_updated ON personal_files(user_id, updated_at);
  `);
}

export interface PersonalRow { path: string; hash: string | null; mtime: number; deleted_at: string | null; updated_at: string }

export function personalManifest(db: DB, userId: string, since?: string): PersonalRow[] {
  return (since
    ? db.prepare("SELECT path, hash, mtime, deleted_at, updated_at FROM personal_files WHERE user_id=? AND updated_at>? ORDER BY updated_at")
      .all(userId, since)
    : db.prepare("SELECT path, hash, mtime, deleted_at, updated_at FROM personal_files WHERE user_id=? ORDER BY path")
      .all(userId)) as PersonalRow[];
}

export function personalGet(db: DB, userId: string, path: string): (PersonalRow & { content: string | null }) | undefined {
  return db.prepare("SELECT path, content, hash, mtime, deleted_at, updated_at FROM personal_files WHERE user_id=? AND path=?")
    .get(userId, path) as (PersonalRow & { content: string | null }) | undefined;
}

export interface PushItem { path: string; content: string | null; hash: string | null; base_hash: string | null; mtime: number; deleted?: boolean }
export interface PushResult { path: string; status: "stored" | "conflict" | "rejected"; server?: { content: string | null; hash: string | null; mtime: number } }

/** accept what was edited from what the server holds; hand back the
 * server's copy when the base moved (the device keeps both) */
export function personalPush(db: DB, userId: string, deviceId: string, items: PushItem[], now: string,
  mirror: ((path: string, content: string | null) => void) | null): PushResult[] {
  const out: PushResult[] = [];
  const up = db.prepare(`INSERT INTO personal_files(user_id,path,content,hash,mtime,deleted_at,updated_at,device_id)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,path) DO UPDATE SET content=excluded.content, hash=excluded.hash,
    mtime=excluded.mtime, deleted_at=excluded.deleted_at, updated_at=excluded.updated_at, device_id=excluded.device_id`);
  for (const it of items) {
    const p = it.path.replace(/\\/g, "/");
    if (!p.startsWith("Library/") || p.includes("..") || p.length > 400) { out.push({ path: p, status: "rejected" }); continue; }
    const cur = personalGet(db, userId, p);
    const curHash = cur?.deleted_at ? null : (cur?.hash ?? null);
    if (cur && curHash !== (it.base_hash ?? null) && curHash !== it.hash) {
      out.push({ path: p, status: "conflict", server: { content: cur.content, hash: curHash, mtime: cur.mtime } });
      continue;
    }
    up.run(userId, p, it.deleted ? null : it.content, it.deleted ? null : it.hash, it.mtime,
      it.deleted ? now : null, now, deviceId);
    if (mirror) mirror(p, it.deleted ? null : it.content);
    out.push({ path: p, status: "stored" });
  }
  return out;
}

/** the owner's personal notes on the engine's disk, so the vault stays whole */
export function mirrorToDisk(root: string) {
  return (p: string, content: string | null): void => {
    const abs = join(root, ...p.split("/"));
    if (relative(root, abs).startsWith("..") || !p.startsWith("Library/")) return;
    try {
      if (content === null) { if (existsSync(abs)) unlinkSync(abs); return; }
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    } catch { /* the mirror is best-effort; the database is the record */ }
  };
}

/** seed the owner's personal store from the disk once, so the laptop's
 * Library/ is the starting point for the owner's other devices */
export function seedPersonalFromDisk(db: DB, root: string, userId: string, now: string): number {
  const lib = join(root, "Library");
  if (!existsSync(lib)) return 0;
  const files: ManifestEntry[] = [];
  const walkLib = (rel: string) => {
    for (const name of readdirSync(join(root, rel))) {
      const r = posix.join(rel, name);
      const st = statSync(join(root, r));
      if (st.isDirectory()) walkLib(r);
      else if (st.isFile() && isText(r)) files.push({ p: r, h: "", s: st.size, m: Math.floor(st.mtimeMs) });
    }
  };
  walkLib("Library");
  const up = db.prepare(`INSERT INTO personal_files(user_id,path,content,hash,mtime,deleted_at,updated_at,device_id)
    VALUES(?,?,?,?,?,NULL,?,NULL) ON CONFLICT(user_id,path) DO NOTHING`);
  let n = 0;
  for (const f of files) {
    const buf = readFileSync(join(root, f.p));
    if (up.run(userId, f.p, buf.toString("utf8"), sha(buf), f.m, now).changes) n++;
  }
  return n;
}

export const pathSep = sep;
