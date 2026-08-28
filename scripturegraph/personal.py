"""Personal-notes indexing: read-only integration of user writing.

The engine NEVER writes user files. It reads them, indexes them (FTS +
embeddings), extracts the user's own wikilinks into graph edges, and lets
AI-managed notes link TOWARD them. Deleting a personal note removes its
index entries; the file system remains the single source of truth.
"""
from __future__ import annotations

import hashlib
import json

from scripturegraph.context import Ctx
from scripturegraph.corpus.universal import paragraphs_of
from scripturegraph.graphops import resolve_name
from scripturegraph.indexing.citations import find_citations
from scripturegraph.util import now_iso, read_text, sha256_text
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_PERSONAL


def _note_id(relpath: str) -> str:
    return "pnote:" + hashlib.sha1(relpath.encode()).hexdigest()[:12]


def index_personal_notes(ctx: Ctx) -> dict:
    db = ctx.db()
    root = ctx.vault / FOLDER_PERSONAL
    stats = {"indexed": 0, "unchanged": 0, "removed": 0, "edges": 0}
    seen: set[str] = set()
    if root.exists():
        for p in sorted(root.rglob("*.md")):
            rel = str(p.relative_to(ctx.vault)).replace("\\", "/")
            seen.add(rel)
            try:
                text = read_text(p)
            except OSError:
                continue
            h = sha256_text(text)
            nid = _note_id(rel)
            row = db.execute("SELECT meta_json FROM nodes WHERE id=?", (nid,)).fetchone()
            if row:
                meta = json.loads(row["meta_json"] or "{}")
                if meta.get("hash") == h:
                    stats["unchanged"] += 1
                    continue
            fm, body = md.parse_note(text)
            db.execute(
                "INSERT INTO nodes(id,node_type,title,vault_path,meta_json,created_at,"
                "updated_at) VALUES(?,?,?,?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET title=excluded.title, "
                "vault_path=excluded.vault_path, meta_json=excluded.meta_json, "
                "updated_at=excluded.updated_at",
                (nid, "personal-note", p.stem, rel, json.dumps({"hash": h}),
                 now_iso(), now_iso()))
            db.execute(
                "INSERT INTO file_registry(path,kind,managed_by,node_id,content_hash,"
                "updated_at) VALUES(?,?,?,?,?,?) "
                "ON CONFLICT(path) DO UPDATE SET content_hash=excluded.content_hash, "
                "kind='personal', managed_by='human', updated_at=excluded.updated_at",
                (rel, "personal", "human", nid, h, now_iso()))
            # index only the user's own prose (skip transcluded scaffolding lines)
            own_text = "\n".join(
                line for line in body.splitlines() if not line.strip().startswith("![["))
            db.execute("DELETE FROM chunks WHERE owner_type='note' AND owner_id=?", (rel,))
            for i, para in enumerate(paragraphs_of(own_text, min_len=40)):
                db.execute(
                    "INSERT INTO chunks(owner_type,owner_id,seq,text,text_hash) "
                    "VALUES('note',?,?,?,?)", (rel, i, para, sha256_text(para)))
            # user's own links + scripture refs → edges
            db.execute("DELETE FROM edges WHERE src=? AND provenance='pass:personal'", (nid,))
            n_edges = 0
            for target, _anchor in md.extract_wikilinks(own_text):
                for m in resolve_name(ctx, target)[:1]:
                    if m["id"] == nid:
                        continue
                    db.execute(
                        "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,"
                        "provenance,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
                        "ON CONFLICT(src,dst,rel) DO UPDATE SET updated_at=excluded.updated_at",
                        (nid, m["id"], "references", "accepted", 1.0, 1.0, "{}",
                         "pass:personal", now_iso(), now_iso()))
                    n_edges += 1
            for cit in find_citations(own_text):
                if cit.valid and db.execute("SELECT 1 FROM chapters WHERE slug=?",
                                            (cit.chapter_slug,)).fetchone():
                    db.execute(
                        "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,"
                        "provenance,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
                        "ON CONFLICT(src,dst,rel) DO UPDATE SET updated_at=excluded.updated_at",
                        (nid, f"chapter:{cit.chapter_slug}", "cites", "accepted", 1.0, 1.0,
                         "{}", "pass:personal", now_iso(), now_iso()))
                    n_edges += 1
            stats["indexed"] += 1
            stats["edges"] += n_edges
    # cleanup for deleted personal notes
    for r in db.execute("SELECT id, vault_path FROM nodes WHERE node_type='personal-note'").fetchall():
        if r["vault_path"] not in seen:
            db.execute("DELETE FROM nodes WHERE id=?", (r["id"],))
            db.execute("DELETE FROM chunks WHERE owner_type='note' AND owner_id=?",
                       (r["vault_path"],))
            stats["removed"] += 1
    db.commit()
    if stats["indexed"] or stats["removed"]:
        ctx.log.info("personal.indexed", **stats)
    return stats
