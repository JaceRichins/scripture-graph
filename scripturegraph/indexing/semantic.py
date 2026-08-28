"""Semantic candidate discovery + lexical (FTS5) search.

Embedding similarity produces CANDIDATE relationships only (status
'candidate', never rendered into Markdown). Candidates are context for AI
research jobs and for `ask`; the judge decides what becomes a visible link.
With the hash fallback embedder, confidence is capped low by construction.
"""
from __future__ import annotations

import json
from collections import defaultdict

import numpy as np

from scripturegraph.context import Ctx
from scripturegraph.indexing.embeddings import embed_query, get_provider, load_vectors
from scripturegraph.util import now_iso


def chapter_matrix(ctx: Ctx) -> tuple[list[str], np.ndarray] | None:
    """Mean-pooled verse vectors per chapter."""
    loaded = load_vectors(ctx, "verse")
    if loaded is None:
        return None
    owner_ids, mat = loaded
    groups: dict[str, list[int]] = defaultdict(list)
    for i, vslug in enumerate(owner_ids):
        groups[vslug.rsplit("-", 1)[0]].append(i)
    chapters = sorted(groups)
    out = np.zeros((len(chapters), mat.shape[1]), dtype=np.float32)
    for ci, ch in enumerate(chapters):
        v = mat[groups[ch]].mean(axis=0)
        n = float(np.linalg.norm(v))
        out[ci] = v / n if n > 0 else v
    return chapters, out


def run_semantic_candidates(ctx: Ctx, k: int = 8) -> dict:
    db = ctx.db()
    cm = chapter_matrix(ctx)
    if cm is None:
        ctx.log.warn("semantic.no_vectors")
        return {"edges": 0, "skipped": True}
    chapters, mat = cm
    prov = get_provider(ctx)
    weak = prov.name == "hash"
    sims = mat @ mat.T
    np.fill_diagonal(sims, -1.0)
    db.execute("DELETE FROM edges WHERE rel='semantically_related' AND provenance='pass:semantic'")
    n_edges = 0
    for i, ch in enumerate(chapters):
        idx = np.argsort(-sims[i])[:k]
        for j in idx:
            score = float(sims[i, j])
            if score < (0.55 if not weak else 0.35):
                continue
            a, b = ch, chapters[int(j)]
            if a >= b:  # store once, canonical order
                continue
            db.execute(
                "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
                "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(src,dst,rel) DO UPDATE SET confidence=excluded.confidence, "
                "weight=excluded.weight, meta_json=excluded.meta_json, updated_at=excluded.updated_at",
                (f"chapter:{a}", f"chapter:{b}", "semantically_related", "candidate",
                 min(score, 0.45) if weak else score, score,
                 json.dumps({"provider": prov.name, "model": prov.model}),
                 "pass:semantic", now_iso(), now_iso()))
            n_edges += 1
    db.commit()
    ctx.log.info("semantic.done", edges=n_edges, provider=prov.name)
    return {"edges": n_edges, "provider": prov.name}


# ------------------------------------------------------------------ search

def fts_search(ctx: Ctx, query: str, k: int = 20,
               owner_types: tuple[str, ...] | None = None) -> list[dict]:
    db = ctx.db()
    safe = " ".join(t for t in query.replace('"', " ").split() if t)
    if not safe:
        return []
    match = " OR ".join(f'"{t}"' for t in safe.split())
    q = ("SELECT c.owner_type, c.owner_id, c.text, bm25(chunks_fts) AS rank "
         "FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid "
         "WHERE chunks_fts MATCH ? ")
    params: list = [match]
    if owner_types:
        q += f"AND c.owner_type IN ({','.join('?' * len(owner_types))}) "
        params.extend(owner_types)
    q += "ORDER BY rank LIMIT ?"
    params.append(k)
    try:
        rows = db.execute(q, params).fetchall()
    except Exception as e:  # noqa: BLE001 — malformed FTS query
        ctx.log.warn("fts.query_error", error=str(e), query=query)
        return []
    return [dict(r) for r in rows]


def semantic_search(ctx: Ctx, query: str, k: int = 20,
                    owner_type: str = "verse") -> list[dict]:
    loaded = load_vectors(ctx, owner_type)
    if loaded is None:
        return []
    ids, mat = loaded
    qv = embed_query(ctx, query)
    sims = mat @ qv
    order = np.argsort(-sims)[:k]
    return [{"owner_type": owner_type, "owner_id": ids[int(i)], "score": float(sims[int(i)])}
            for i in order]
