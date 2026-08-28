/** SQLite by default (family-scale, zero fixed cost); the schema is plain SQL
 * so a Postgres adapter is a mechanical port when hosted scale arrives (§36). */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type DB = Database.Database;

const MIGRATIONS: string[] = [
  // ---- v1: full initial schema
  `
  CREATE TABLE users (
    user_id      TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
    created_at   TEXT NOT NULL,
    deleted_at   TEXT
  );
  CREATE TABLE devices (
    device_id   TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(user_id),
    device_name TEXT NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL,
    last_seen   TEXT,
    revoked_at  TEXT
  );
  CREATE TABLE groups (
    group_id      TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    owner_user_id TEXT NOT NULL REFERENCES users(user_id),
    created_at    TEXT NOT NULL,
    deleted_at    TEXT
  );
  CREATE TABLE group_memberships (
    group_id  TEXT NOT NULL REFERENCES groups(group_id),
    user_id   TEXT NOT NULL REFERENCES users(user_id),
    role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
    joined_at TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
  );
  CREATE TABLE invites (
    code_hash  TEXT PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('account','group','device')),
    group_id   TEXT REFERENCES groups(group_id),
    max_uses   INTEGER NOT NULL,
    uses       INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE TABLE annotations (
    annotation_id   TEXT PRIMARY KEY,
    author_user_id  TEXT NOT NULL REFERENCES users(user_id),
    anchor_type     TEXT NOT NULL CHECK (anchor_type IN ('verse','chapter','node')),
    anchor_id       TEXT NOT NULL,
    annotation_type TEXT NOT NULL,
    selected_text   TEXT,
    start_offset    INTEGER,
    end_offset      INTEGER,
    text_hash       TEXT,
    content         TEXT NOT NULL DEFAULT '',
    color           TEXT,
    visibility      TEXT NOT NULL CHECK (visibility IN ('private','group','public')),
    group_id        TEXT REFERENCES groups(group_id),
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    deleted_at      TEXT,
    version         INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX idx_ann_anchor  ON annotations(anchor_id);
  CREATE INDEX idx_ann_author  ON annotations(author_user_id);
  CREATE INDEX idx_ann_group   ON annotations(group_id);
  CREATE INDEX idx_ann_updated ON annotations(updated_at);
  CREATE TABLE annotation_versions (
    annotation_id TEXT NOT NULL,
    version       INTEGER NOT NULL,
    content       TEXT NOT NULL,
    visibility    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    updated_by    TEXT NOT NULL,
    PRIMARY KEY (annotation_id, version)
  );
  CREATE TABLE sync_ops (
    op_id         TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    device_id     TEXT NOT NULL,
    result_status TEXT NOT NULL,
    annotation_id TEXT,
    applied_at    TEXT NOT NULL
  );
  CREATE TABLE audit_events (
    event_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    at            TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    action        TEXT NOT NULL,
    entity        TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    detail        TEXT
  );
  `,
];

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[])
      .map(r => r.version));
  MIGRATIONS.forEach((sql, i) => {
    const v = i + 1;
    if (applied.has(v)) return;
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)")
        .run(v, new Date().toISOString());
    });
    tx();
  });
}
