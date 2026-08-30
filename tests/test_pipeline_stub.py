"""End-to-end multi-agent pipeline in stub mode: researchers → critique →
validation → judge → librarian → git commit. Zero credentials required."""
import json

from scripturegraph import gitops
from scripturegraph.agents.pipeline import run_chapter_job
from scripturegraph.indexing.parallels import run_global_parallels
from scripturegraph.util import read_text
from scripturegraph.vaultgen import md


def test_context_survives_topic_parallel_edges(imported_ctx):
    """parallel_to / semantically_related edges are not chapter-only: a topic
    counterpart fed to chapter_display KeyErrored the whole research job
    (live: num-26 died on KeyError 'exodus-and')."""
    from scripturegraph.agents.pipeline import build_context
    from scripturegraph.util import now_iso
    ctx = imported_ctx
    db = ctx.db()
    topic = db.execute("SELECT id FROM nodes WHERE node_type='topic' LIMIT 1").fetchone()
    for rel in ("parallel_to", "semantically_related"):
        db.execute(
            "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,"
            " provenance,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
            ("chapter:mosiah-14", topic["id"], rel, "accepted", 0.9, 0.9,
             "{}", "test", now_iso(), now_iso()))
    db.commit()

    c = build_context(ctx, "mosiah-14")   # must not raise
    others = [p["other"] for p in c.get("parallels", [])]
    assert all("exodus" not in o.lower() or ":" not in o for o in others)


def test_full_stub_job(imported_ctx):
    ctx = imported_ctx
    run_global_parallels(ctx)
    result = run_chapter_job(ctx, "mosiah-14")
    assert result["mode"] == "stub"
    assert result["git_rev"], "job must commit its changes"

    job = ctx.db().execute("SELECT * FROM jobs WHERE job_id=?",
                           (result["job_id"],)).fetchone()
    assert job["status"] == "applied"

    # workspace isolation artifacts exist
    ws = ctx.jobs_dir / result["job_id"]
    assert (ws / "a" / "proposal.json").exists()
    assert (ws / "b" / "proposal.json").exists()
    assert (ws / "judge" / "decision.json").exists()
    assert (ws / "validation" / "results.json").exists()

    # claims persisted with provenance; stub judge caps at TENTATIVE
    claims = ctx.db().execute(
        "SELECT * FROM claims WHERE node_id='chapter:mosiah-14'").fetchall()
    assert claims
    for c in claims:
        assert c["tier"] in ("TENTATIVE", "REJECT")
        prov = json.loads(c["provenance_json"])
        assert prov["job"] == result["job_id"]

    # deterministic floors: the stub's verified-quote claim survived
    tent = [c for c in claims if c["tier"] == "TENTATIVE"]
    assert tent, "verified claims should be TENTATIVE, not rejected"


def test_stub_job_is_idempotent_on_rerun(imported_ctx):
    ctx = imported_ctx
    run_global_parallels(ctx)
    r1 = run_chapter_job(ctx, "isa-53")
    n1 = ctx.db().execute("SELECT COUNT(*) AS n FROM claims WHERE node_id='chapter:isa-53'"
                          ).fetchone()["n"]
    r2 = run_chapter_job(ctx, "isa-53")
    n2 = ctx.db().execute("SELECT COUNT(*) AS n FROM claims WHERE node_id='chapter:isa-53'"
                          ).fetchone()["n"]
    assert n1 == n2  # content-derived claim ids → no duplicates


def test_git_transaction_rollback(imported_ctx):
    ctx = imported_ctx
    guide_rel = ("AI Library/01 Scriptures/Study Guides/03 Book of Mormon/01 1 Nephi/"
                 "1 Nephi 1 - Study Guide.md")
    baseline = read_text(ctx.vault / guide_rel)
    gitops.commit_all(ctx, "test: pre")
    # simulate an engine write session that goes bad
    gitops.checkpoint(ctx, "test txn")
    (ctx.vault / guide_rel).write_text(baseline + "\nGARBAGE OUTSIDE MARKERS",
                                       encoding="utf-8")
    (ctx.vault / "AI Library/70 AI Study Guides" / "junk.md").write_text("junk", encoding="utf-8")
    gitops.hard_restore(ctx)
    assert read_text(ctx.vault / guide_rel) == baseline
    assert not (ctx.vault / "AI Library/70 AI Study Guides" / "junk.md").exists()
