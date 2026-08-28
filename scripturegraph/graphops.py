"""Graph node/edge/alias helpers shared by passes, synthesis, and the Librarian."""
from __future__ import annotations

import json

from scripturegraph.booksdata import BY_SLUG, split_verse_slug
from scripturegraph.context import Ctx
from scripturegraph.util import now_iso


def node_get(ctx: Ctx, node_id: str):
    return ctx.db().execute("SELECT * FROM nodes WHERE id=?", (node_id,)).fetchone()


def node_title(ctx: Ctx, node_id: str) -> str | None:
    row = node_get(ctx, node_id)
    return row["title"] if row else None


def resolve_name(ctx: Ctx, name: str) -> list[dict]:
    """Resolve a surface name to candidate nodes: exact title, then alias."""
    db = ctx.db()
    rows = db.execute("SELECT * FROM nodes WHERE title=?", (name,)).fetchall()
    if rows:
        return [dict(r) for r in rows]
    rows = db.execute(
        "SELECT n.* FROM aliases a JOIN nodes n ON n.id=a.node_id WHERE a.alias=?",
        (name,)).fetchall()
    return [dict(r) for r in rows]


def add_edge(ctx: Ctx, src: str, dst: str, rel: str, status: str,
             confidence: float | None, weight: float | None,
             meta: dict | None, provenance: str) -> None:
    ctx.db().execute(
        "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
        "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(src,dst,rel) DO UPDATE SET status=excluded.status, "
        "confidence=excluded.confidence, weight=excluded.weight, meta_json=excluded.meta_json, "
        "provenance=excluded.provenance, updated_at=excluded.updated_at",
        (src, dst, rel, status, confidence, weight,
         json.dumps(meta or {}, ensure_ascii=False), provenance, now_iso(), now_iso()))


def edges_touching(ctx: Ctx, node_id: str, rel: str | None = None,
                   statuses: tuple[str, ...] = ("accepted", "tentative", "low_visibility")):
    db = ctx.db()
    q = ("SELECT * FROM edges WHERE (src=? OR dst=?) AND status IN "
         f"({','.join('?' * len(statuses))})")
    params: list = [node_id, node_id, *statuses]
    if rel:
        q += " AND rel=?"
        params.append(rel)
    return db.execute(q + " ORDER BY weight DESC", params).fetchall()


def degree(ctx: Ctx, node_id: str) -> int:
    row = ctx.db().execute(
        "SELECT COUNT(*) AS n FROM edges WHERE (src=? OR dst=?) "
        "AND status IN ('accepted','tentative','low_visibility')",
        (node_id, node_id)).fetchone()
    return row["n"]


def verse_display(vslug: str) -> str:
    """'mosiah-14-5' -> 'Mosiah 14:5'."""
    book, ch, v = split_verse_slug(vslug)
    return f"{book.title_prefix} {ch}:{v}"


def chapter_display(cslug: str) -> str:
    book_part, ch = cslug.rsplit("-", 1)
    book = BY_SLUG[book_part]
    return f"{book.title_prefix} {ch}"
