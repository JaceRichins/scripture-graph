import json

from scripturegraph.coverage import stats as cov_stats
from scripturegraph.coverage import update_chapter_coverage, weakest_chapters
from scripturegraph.indexing.entities import scan_chapter_mentions, scan_chapter_topics
from scripturegraph.indexing.parallels import run_global_parallels
from scripturegraph.synthesis import synthesize_chapter
from scripturegraph.util import read_text
from scripturegraph.vaultgen import md
from scripturegraph.waves import mark_pass


def test_synthesis_renders_verified_sections(imported_ctx):
    ctx = imported_ctx
    scan_chapter_mentions(ctx, "mosiah-14")
    run_global_parallels(ctx)
    synthesize_chapter(ctx, "mosiah-14")
    guide = ctx.vault / ("AI Library/01 Scriptures/Study Guides/03 Book of Mormon/08 Mosiah/"
                         "Mosiah 14 - Study Guide.md")
    fm, body = md.parse_note(read_text(guide))
    related = md.get_section(body, "related-scriptures")
    assert "Isaiah 53" in related and "parallel verse" in related
    assert fm["corpus_version_reviewed"] == ctx.corpus_version()


def test_topic_dossier_ignores_non_chapter_discusses_edges(imported_ctx):
    """Secondary-source episodes use rel='discusses' too. Treating one as a
    chapter reference crashed the entire topic dossier — and it silently took
    out exactly the topics podcasts cover most (Atonement, Conversion)."""
    from scripturegraph.synthesis import synthesize_topic
    from scripturegraph.util import now_iso
    ctx = imported_ctx
    topic = ctx.db().execute(
        "SELECT id FROM nodes WHERE node_type='topic' AND vault_path IS NOT NULL"
        " LIMIT 1").fetchone()
    assert topic is not None
    ctx.db().execute(
        "INSERT INTO nodes(id,node_type,title,vault_path,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
        ("secitem:4ba4d2762ae0", "secitem", "Some podcast episode", None,
         now_iso(), now_iso()))
    ctx.db().execute(
        "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,"
        " provenance,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        ("secitem:4ba4d2762ae0", topic["id"], "discusses", "accepted", 0.9, 0.9,
         "{}", "test", now_iso(), now_iso()))
    ctx.db().commit()

    # must not raise ValueError: not enough values to unpack
    out = synthesize_topic(ctx, topic["id"])
    assert "skipped" not in out or out.get("anchors") is not None


def test_evidence_scores_survive_stringy_model_output(imported_ctx):
    """A model writing "0.8" (or a word) where a number belongs must not cost
    the chapter its whole research run when the study guide renders."""
    from scripturegraph.synthesis import _evidence_lines
    from scripturegraph.util import now_iso
    ctx = imported_ctx
    ctx.db().execute(
        "INSERT INTO claims (id, node_id, claim_type, text, tier, scores_json,"
        " consensus, sources_json, provenance_json, created_at, updated_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ("claim-stringy", "chapter:mosiah-14", "evidence", "Stringy score.",
         "ACCEPT", json.dumps({"evidence_strength": "0.8",
                               "claim_confidence": "high",
                               "class": "evidence"}),
         None, "[]", "{}", now_iso(), now_iso()))
    ctx.db().commit()

    text = "\n".join(_evidence_lines(ctx, "mosiah-14"))
    assert "strength 0.8" in text      # numeric string coerced and formatted
    assert "confidence high" in text   # non-numeric shown honestly, not dropped


def test_evidence_notes_survive_a_stringy_relevance_score(imported_ctx):
    """The dossier gate compares a model-supplied score against a floor. A
    stringy score there raised inside the write phase — the same rollback that
    cost ps-49/50/51/69/78 their research runs, one function further along."""
    from scripturegraph.agents.pipeline import _create_evidence_notes
    ctx = imported_ctx
    ev = {"text": "Evidence body.", "tier": "ACCEPT", "uid": "claim-relevance",
          "evidence": {"class": "literary"}, "scripture_refs": [], "sources": [],
          "scores": {"study_relevance": "0.94", "claim_confidence": 0.9}}
    ctx.db().execute(
        "INSERT INTO claims (id, node_id, claim_type, text, tier, scores_json,"
        " consensus, sources_json, provenance_json, created_at, updated_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ("claim-relevance", "chapter:mosiah-14", "evidence", "Evidence body.",
         "ACCEPT", json.dumps(ev["scores"]), None, "[]", "{}", "t", "t"))
    ctx.db().commit()

    created = _create_evidence_notes(ctx, "job-test", "mosiah-14", [ev])
    assert created, "a numeric string above the floor must still make its note"

    # a genuinely non-numeric score is below the floor, not an exception
    worded = {**ev, "uid": "claim-relevance", "scores": {"study_relevance": "high"}}
    assert _create_evidence_notes(ctx, "job-test", "mosiah-14", [worded]) == []


def test_coverage_scoring_and_priority(imported_ctx):
    ctx = imported_ctx
    # chapter A gets passes done; chapter B gets nothing
    for pass_name in ("entities", "citations", "topics", "synthesis"):
        mark_pass(ctx, pass_name, "1ne-1", "deterministic")
    a = update_chapter_coverage(ctx, "1ne-1")
    b = update_chapter_coverage(ctx, "1ne-3")
    assert a["completeness"] > b["completeness"]
    assert b["priority"] > a["priority"]
    weakest = weakest_chapters(ctx, 4)
    assert weakest[0]["node_id"] != "chapter:1ne-1"


def test_staleness_lowers_completeness(imported_ctx):
    ctx = imported_ctx
    for pass_name in ("entities", "citations", "topics", "synthesis"):
        mark_pass(ctx, pass_name, "1ne-1", "deterministic")
    before = update_chapter_coverage(ctx, "1ne-1")["completeness"]
    ctx.bump_corpus_version("more corpus")
    after = update_chapter_coverage(ctx, "1ne-1")["completeness"]
    assert after < before  # stale passes earn partial credit only


def test_coverage_stats_shape(imported_ctx):
    ctx = imported_ctx
    for slug in ("1ne-1", "1ne-3", "mosiah-14", "isa-53"):
        update_chapter_coverage(ctx, slug)
    s = cov_stats(ctx)
    assert s["overall"]["n"] == 4
    assert "Book of Mormon" in s["volumes"]
