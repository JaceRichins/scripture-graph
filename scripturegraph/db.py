"""SQLite schema and connection management.

The database is an INDEX, not the source of truth. Markdown in the vault plus
the imported source files are the durable layer; the database is reproducible
from them (`scripturegraph index --rebuild`). WAL mode, FTS5 lexical index.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA_VERSION = 1

_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS corpus_version_log (
    version    INTEGER PRIMARY KEY,
    reason     TEXT,
    created_at TEXT
);

-- ------------------------------------------------------------- scripture
CREATE TABLE IF NOT EXISTS books (
    slug         TEXT PRIMARY KEY,      -- compact slug, e.g. '1ne'
    lds_slug     TEXT UNIQUE,
    volume       TEXT NOT NULL,
    name         TEXT NOT NULL,
    position     INTEGER NOT NULL,
    num_chapters INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
    slug       TEXT PRIMARY KEY,        -- '1ne-3'
    book_slug  TEXT NOT NULL REFERENCES books(slug),
    chapter    INTEGER NOT NULL,
    title      TEXT NOT NULL,           -- '1 Nephi 3'
    num_verses INTEGER NOT NULL,
    text_hash  TEXT NOT NULL,           -- canonical scripture body hash
    file_path  TEXT,                    -- vault-relative path of scripture note
    UNIQUE(book_slug, chapter)
);
CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_slug);

CREATE TABLE IF NOT EXISTS verses (
    slug         TEXT PRIMARY KEY,      -- '1ne-3-7' (Obsidian block id)
    chapter_slug TEXT NOT NULL REFERENCES chapters(slug),
    verse        INTEGER NOT NULL,
    text         TEXT NOT NULL,
    UNIQUE(chapter_slug, verse)
);
CREATE INDEX IF NOT EXISTS idx_verses_chapter ON verses(chapter_slug);

-- ------------------------------------------------------------- sources
CREATE TABLE IF NOT EXISTS sources (
    source_id          TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    type               TEXT NOT NULL,      -- scripture|conference|jsp|history|reference|scholarship|other
    provider           TEXT,
    authority_category INTEGER,            -- 1 (canon) .. 9 (AI inference); see SOURCE-POLICY
    license_notes      TEXT,
    acquisition_method TEXT,               -- download|drop-folder|manual|api|builtin
    local_path         TEXT,
    source_url         TEXT,
    last_imported      TEXT,
    content_hash       TEXT,
    status             TEXT NOT NULL DEFAULT 'available',
        -- available|imported|update_available|manual_download_required|unavailable|blocked_by_terms|deprecated
    coverage           TEXT,
    notes              TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    doc_id       TEXT PRIMARY KEY,
    source_id    TEXT NOT NULL REFERENCES sources(source_id),
    doc_type     TEXT NOT NULL,          -- talk|jsp-document|history|reference-entry|article|package-file
    title        TEXT,
    author       TEXT,
    date         TEXT,
    url          TEXT,
    local_path   TEXT,
    content_hash TEXT,
    meta_json    TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_id);

-- ------------------------------------------------------------- index layer
CREATE TABLE IF NOT EXISTS chunks (
    id         INTEGER PRIMARY KEY,
    owner_type TEXT NOT NULL,            -- verse|chapter|document|note
    owner_id   TEXT NOT NULL,            -- verse slug / chapter slug / doc_id / vault relpath
    seq        INTEGER NOT NULL DEFAULT 0,
    text       TEXT NOT NULL,
    text_hash  TEXT NOT NULL,
    meta_json  TEXT,
    UNIQUE(owner_type, owner_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_chunks_owner ON chunks(owner_type, owner_id);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    text, content='chunks', content_rowid='id', tokenize='unicode61'
);
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
    INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.id, old.text);
    INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
END;

CREATE TABLE IF NOT EXISTS embeddings (
    chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model    TEXT NOT NULL,
    dim      INTEGER NOT NULL,
    vector   BLOB NOT NULL,              -- float32 array
    PRIMARY KEY (chunk_id, provider, model)
);

-- ------------------------------------------------------------- graph
CREATE TABLE IF NOT EXISTS nodes (
    id             TEXT PRIMARY KEY,     -- 'chapter:1ne-3' | 'topic:faith' | 'person:alma-the-younger' …
    node_type      TEXT NOT NULL,        -- chapter|verse|book|topic|person|place|event|talk|document|evidence|question|note
    title          TEXT NOT NULL,        -- canonical note title
    vault_path     TEXT,                 -- vault-relative markdown path (if it has a note)
    meta_json      TEXT,
    created_at     TEXT,
    updated_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_title ON nodes(title);

CREATE TABLE IF NOT EXISTS aliases (
    alias   TEXT NOT NULL,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (alias, node_id)
);
CREATE INDEX IF NOT EXISTS idx_aliases_node ON aliases(node_id);

CREATE TABLE IF NOT EXISTS edges (
    id         INTEGER PRIMARY KEY,
    src        TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    dst        TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    rel        TEXT NOT NULL,            -- mentions|cites|parallel_to|semantically_related|discusses|supports|challenges|…
    status     TEXT NOT NULL DEFAULT 'accepted',
        -- candidate|accepted|low_visibility|tentative|rejected
    confidence REAL,
    weight     REAL,
    meta_json  TEXT,
    provenance TEXT,                     -- job id / pass name
    created_at TEXT,
    updated_at TEXT,
    UNIQUE(src, dst, rel)
);
CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src, rel, status);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges(dst, rel, status);

CREATE TABLE IF NOT EXISTS claims (
    id          TEXT PRIMARY KEY,
    node_id     TEXT,                    -- primary node the claim attaches to
    claim_type  TEXT,                    -- observation|interpretation|connection|evidence
    text        TEXT NOT NULL,
    tier        TEXT NOT NULL,           -- ACCEPT|ACCEPT_LOW_VISIBILITY|TENTATIVE|REJECT|QUARANTINE
    scores_json TEXT,                    -- claim_confidence / evidence_strength / study_relevance / source_quality
    consensus   TEXT,
    sources_json TEXT,
    provenance_json TEXT,                -- job, models, prompt versions, validation results
    created_at  TEXT,
    updated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_claims_node ON claims(node_id);

-- ------------------------------------------------------------- work / passes
CREATE TABLE IF NOT EXISTS passes (
    name           TEXT NOT NULL,        -- entities|citations|parallels|topics|semantic|synthesis|research|…
    target         TEXT NOT NULL,        -- chapter slug | node id | '__global__'
    corpus_version INTEGER NOT NULL,
    mode           TEXT NOT NULL,        -- deterministic|ai|mixed
    completed_at   TEXT,
    PRIMARY KEY (name, target)
);

CREATE TABLE IF NOT EXISTS work_queue (
    id           INTEGER PRIMARY KEY,
    task_type    TEXT NOT NULL,          -- pass|job|maintenance
    pass_name    TEXT,
    target       TEXT NOT NULL,
    priority     REAL NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'pending',  -- pending|running|done|failed|dead
    attempts     INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT,
    error        TEXT,
    created_at   TEXT,
    updated_at   TEXT,
    UNIQUE(task_type, pass_name, target, status) ON CONFLICT IGNORE
);
CREATE INDEX IF NOT EXISTS idx_queue_status ON work_queue(status, priority DESC);

CREATE TABLE IF NOT EXISTS jobs (
    job_id         TEXT PRIMARY KEY,
    job_type       TEXT NOT NULL,
    target         TEXT,
    status         TEXT NOT NULL,        -- created|research|critique|judge|librarian|applied|failed|quarantined
    workspace      TEXT,
    corpus_version INTEGER,
    providers_json TEXT,
    cost_json      TEXT,
    result_json    TEXT,
    created_at     TEXT,
    updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS runs (
    id          INTEGER PRIMARY KEY,
    kind        TEXT NOT NULL,           -- bootstrap|frequent|nightly|weekly|manual
    started_at  TEXT,
    finished_at TEXT,
    status      TEXT,
    stats_json  TEXT,
    git_rev     TEXT
);

-- ------------------------------------------------------------- vault files
CREATE TABLE IF NOT EXISTS file_registry (
    path         TEXT PRIMARY KEY,       -- vault-relative, forward slashes
    kind         TEXT NOT NULL,          -- scripture|study-guide|book-index|moc|topic|person|place|event|evidence|question|talk|system|personal|source-note
    managed_by   TEXT NOT NULL,          -- generator|librarian|human
    node_id      TEXT,
    content_hash TEXT,
    updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS coverage (
    node_id                  TEXT PRIMARY KEY,
    completeness             REAL,
    confidence               REAL,
    citation_health          REAL,
    connectivity             REAL,
    dims_json                TEXT,
    passes_completed         INTEGER,
    last_reviewed_at         TEXT,
    corpus_version_at_review INTEGER,
    priority                 REAL
);

CREATE TABLE IF NOT EXISTS response_cache (
    key        TEXT PRIMARY KEY,         -- sha256(provider|model|prompt)
    provider   TEXT,
    model      TEXT,
    response   TEXT,
    cost_usd   REAL,
    created_at TEXT
);
"""


def connect(db_path: str | Path) -> sqlite3.Connection:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=60)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    migrate(conn)
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)
    cur = conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
    if cur is None:
        conn.execute("INSERT INTO meta(key,value) VALUES('schema_version',?)", (str(SCHEMA_VERSION),))
    conn.commit()


def rebuild_fts(conn: sqlite3.Connection) -> None:
    conn.execute("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')")
    conn.commit()
