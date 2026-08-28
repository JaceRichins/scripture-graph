import numpy as np

from scripturegraph.indexing.embeddings import HashEmbedder
from scripturegraph.indexing.entities import scan_chapter_mentions, scan_chapter_topics
from scripturegraph.indexing.parallels import run_global_parallels


def test_mention_scan_with_scope_hints(imported_ctx):
    ctx = imported_ctx
    scan_chapter_mentions(ctx, "1ne-1")
    rows = ctx.db().execute(
        "SELECT dst, status FROM edges WHERE src='chapter:1ne-1' AND rel='mentions'").fetchall()
    got = {r["dst"]: r["status"] for r in rows}
    # "Nephi" in a 1 Nephi chapter resolves via scope hint to son of Lehi, accepted
    assert got.get("person:nephi-son-of-lehi") == "accepted"
    assert got.get("place:jerusalem") == "accepted"


def test_topic_keyword_scan(imported_ctx):
    ctx = imported_ctx
    scan_chapter_topics(ctx, "1ne-3")
    rows = ctx.db().execute(
        "SELECT dst, status FROM edges WHERE src='chapter:1ne-3' AND rel='discusses'").fetchall()
    dsts = {r["dst"]: r["status"] for r in rows}
    # anchor "1 Nephi 3:7" belongs to Obedience -> accepted edge
    assert dsts.get("topic:obedience") == "accepted"


def test_global_parallels_finds_planted_quote(imported_ctx):
    ctx = imported_ctx
    stats = run_global_parallels(ctx)
    assert stats["chapter_edges"] >= 1
    row = ctx.db().execute(
        "SELECT * FROM edges WHERE rel='parallel_to' AND "
        "((src='chapter:isa-53' AND dst='chapter:mosiah-14') OR "
        " (src='chapter:mosiah-14' AND dst='chapter:isa-53'))").fetchone()
    assert row is not None, "Mosiah 14 ↔ Isaiah 53 parallel must be detected"
    import json
    meta = json.loads(row["meta_json"])
    assert meta["n_verse_pairs"] >= 2


def test_hash_embedder_deterministic():
    e = HashEmbedder()
    v1 = e.embed(["and it came to pass that"])
    v2 = e.embed(["and it came to pass that"])
    v3 = e.embed(["completely different words entirely"])
    assert np.allclose(v1, v2)
    assert not np.allclose(v1, v3)
    assert abs(float(np.linalg.norm(v1[0])) - 1.0) < 1e-5


def test_embed_store_and_semantic_candidates(imported_ctx):
    from scripturegraph.indexing.embeddings import embed_missing, load_vectors
    from scripturegraph.indexing.semantic import fts_search, run_semantic_candidates
    ctx = imported_ctx
    stats = embed_missing(ctx)
    assert stats["embedded"] == 9
    ids, mat = load_vectors(ctx, "verse")
    assert len(ids) == 9 and mat.shape[1] == 384
    run_semantic_candidates(ctx)  # must not throw; candidates stay non-visible
    cand = ctx.db().execute(
        "SELECT COUNT(*) AS n FROM edges WHERE rel='semantically_related' "
        "AND status='candidate'").fetchone()["n"]
    assert cand >= 1
    hits = fts_search(ctx, "goodly parents", k=5)
    assert hits and hits[0]["owner_id"] == "1ne-1-1"
