"""Evidence recalibration in stub mode: a group of evidence notes is rewritten
into the nine-layer form with a named proposition and weight, the claim behind
each note follows, the canonical issue registry is written, and review-only
mode lands nothing."""
import json

from scripturegraph.agents.calibrate import (CALIBRATION_VERSION, REGISTRY_NOTE, SECTIONS,
                                             TARGET_PREFIX, evidence_notes, group_ids,
                                             pending_groups, run_calibration_job)
from scripturegraph.util import now_iso, read_text
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.patch import apply_ops
from scripturegraph.waves import PASS_DEFS, pending_targets


def _seed_note(ctx, title, subfolder="Book of Mormon/Literary", es=0.9):
    res = apply_ops(ctx, [{
        "op": "create_note", "kind": "evidence", "title": title, "subfolder": subfolder,
        "frontmatter": {"evidence_class": "literary parallel", "claim_confidence": 0.95,
                        "evidence_strength": es, "study_relevance": 0.8, "source_quality": 0.9,
                        "consensus_status": "accepted observation / disputed interpretation"},
        "sections": {"summary": "The chapter shares phrasing with Isaiah.\n"
                                "**Does not establish:** antiquity.\n"
                                "**Scripture:** [[1 Nephi 1#^1-ne-1-1|1 Nephi 1:1]]"},
    }], actor="test")
    path = res.created_paths[0]
    node = ctx.db().execute("SELECT id FROM nodes WHERE vault_path=?", (path,)).fetchone()
    # the judged claim this note came from
    ctx.db().execute(
        "INSERT INTO claims(id,node_id,claim_type,text,tier,scores_json,consensus,sources_json,"
        "provenance_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        ("clm-" + title.lower().replace(" ", "-"), "chapter:1-ne-1", "evidence",
         "Shared phrasing with Isaiah.", "ACCEPT",
         json.dumps({"evidence_strength": es, "claim_confidence": 0.95, "class": "literary parallel"}),
         None, "[]", json.dumps({"job": "test", "evidence_note": title}), now_iso(), now_iso()))
    ctx.db().commit()
    return node["id"], path


def test_calibrate_is_a_registered_ai_pass():
    assert PASS_DEFS["calibrate"]["mode"] == "ai"
    assert PASS_DEFS["calibrate"]["scope"] == "calibration"


def test_pending_groups_cover_uncalibrated_notes_only(imported_ctx):
    ctx = imported_ctx
    assert pending_groups(ctx, ["Book of Mormon"]) == []
    a, _ = _seed_note(ctx, "Parallel Alpha in 1 Nephi 1")
    b, _ = _seed_note(ctx, "Parallel Beta in 1 Nephi 1")
    _seed_note(ctx, "Bible Parallel in Isaiah 53", subfolder="Bible/Literary")
    groups = pending_groups(ctx, ["Book of Mormon"])
    assert len(groups) == 1 and groups[0].startswith(TARGET_PREFIX)
    assert set(group_ids(groups[0])) == {a, b}
    assert pending_targets(ctx, "calibrate") == groups   # the wave sees the same targets
    assert len(pending_groups(ctx, ["Bible"])) == 1, "the Bible is grouped separately"


def test_full_stub_calibration_job(imported_ctx):
    ctx = imported_ctx
    a, pa = _seed_note(ctx, "Parallel Alpha in 1 Nephi 1", es=0.9)
    b, pb = _seed_note(ctx, "Parallel Beta in 1 Nephi 1", es=0.85)
    target = pending_groups(ctx, ["Book of Mormon"])[0]
    result = run_calibration_job(ctx, target, apply=True)
    assert result["mode"] == "stub" and result["git_rev"] and result["notes"] == 2
    for path in (pa, pb):
        fm, body = md.parse_note(read_text(ctx.vault / path))
        for name, _heading in SECTIONS:
            assert not md.section_is_empty(md.get_section(body, name)), name
        assert md.markers_balanced(body)
        assert fm["calibration_version"] == CALIBRATION_VERSION
        assert fm["evidence_strength"] == 0.3 and fm["weight_label"] == "weak"
        assert fm["issue"].startswith("stub-") and fm["proposition"]
        assert "Canonical assessment: [[Evidence Assessments#" in md.get_section(body, "weight")
    # the claim behind the note follows the note
    row = ctx.db().execute("SELECT scores_json FROM claims WHERE id=?",
                           ("clm-parallel-alpha-in-1-nephi-1",)).fetchone()
    scores = json.loads(row["scores_json"])
    assert scores["evidence_strength"] == 0.3 and scores["calibration"]["job"] == result["job_id"]
    # the registry holds one canonical assessment shared by both notes
    issues = ctx.db().execute("SELECT * FROM issues").fetchall()
    assert len(issues) == 1 and set(json.loads(issues[0]["notes_json"])) == {
        "Parallel Alpha in 1 Nephi 1", "Parallel Beta in 1 Nephi 1"}
    assert (ctx.vault / REGISTRY_NOTE).exists()
    assert "Parallel Alpha in 1 Nephi 1" in read_text(ctx.vault / REGISTRY_NOTE)
    # done means done
    assert all(n["calibrated"] for n in evidence_notes(ctx, "Book of Mormon"))
    assert pending_groups(ctx, ["Book of Mormon"]) == []
    # the touched chapter is queued for re-synthesis
    q = ctx.db().execute("SELECT COUNT(*) AS n FROM work_queue WHERE pass_name='synthesis' "
                         "AND target='1-ne-1'").fetchone()["n"]
    assert q == 1


def test_review_only_lands_nothing(imported_ctx):
    ctx = imported_ctx
    _, path = _seed_note(ctx, "Bible Parallel in Isaiah 53", subfolder="Bible/Literary", es=0.9)
    before = read_text(ctx.vault / path)
    target = pending_groups(ctx, ["Bible"])[0]
    result = run_calibration_job(ctx, target, apply=False)
    assert result["reviewed"] == 1 and result["decisions"][0]["after"] == 0.3
    assert read_text(ctx.vault / path) == before, "review-only must not touch the vault"
    assert ctx.db().execute("SELECT COUNT(*) AS n FROM issues").fetchone()["n"] == 0
    assert not (ctx.vault / REGISTRY_NOTE).exists()
    report = read_text(result["report"])
    assert "Nothing below has been applied" in report and "Bible Parallel in Isaiah 53" in report
    assert pending_groups(ctx, ["Bible"]) == [target], "still owed after a review"
