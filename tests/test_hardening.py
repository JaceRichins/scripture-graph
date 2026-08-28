"""Tests for the hardening applied after the Codex adversarial review."""
import pytest

from scripturegraph import gitops
from scripturegraph.util import read_text
from scripturegraph.vaultgen.patch import PatchViolation, apply_ops


def test_path_traversal_and_absolute_are_rejected(imported_ctx):
    ctx = imported_ctx
    for evil in ("../outside.md",
                 "AI Library/01 Scriptures/Study Guides/../../../evil.md",
                 "C:/Windows/evil.md",
                 "/etc/evil.md",
                 "00 System/notes.txt"):
        with pytest.raises(PatchViolation):
            apply_ops(ctx, [{"op": "set_section", "path": evil,
                             "section": "overview", "content": "x"}], actor="test")


def test_case_variant_bypass_rejected(imported_ctx):
    ctx = imported_ctx
    for evil in ("library/Scriptures/03 Book of Mormon/01 1 Nephi/1 Nephi 1 - My Notes.md",
                 "AI AI LIBRARY/01 Scriptures/Canonical/03 Book of Mormon/01 1 Nephi/1 Nephi 1.md"):
        with pytest.raises(PatchViolation):
            apply_ops(ctx, [{"op": "set_section", "path": evil,
                             "section": "overview", "content": "x"}], actor="test")


def test_hard_restore_spares_personal_notes(imported_ctx):
    ctx = imported_ctx
    gitops.commit_all(ctx, "test: baseline for restore")
    guide = ctx.vault / ("AI Library/01 Scriptures/Study Guides/03 Book of Mormon/01 1 Nephi/"
                         "1 Nephi 1 - Study Guide.md")
    baseline = read_text(guide)
    # simulate: user writes a personal note AFTER the checkpoint, while the
    # engine damages a system file
    gitops.checkpoint(ctx, "test txn")
    personal_new = ctx.vault / "Library" / "Post-checkpoint thought.md"
    personal_new.write_text("# Mine\n\nWritten during the engine's txn.\n", encoding="utf-8")
    tracked_personal = ctx.vault / ("Library/Scriptures/03 Book of Mormon/"
                                    "01 1 Nephi/1 Nephi 1 - My Notes.md")
    user_edit = read_text(tracked_personal) + "\nMy new insight!\n"
    tracked_personal.write_text(user_edit, encoding="utf-8")
    guide.write_text(baseline + "\nGARBAGE", encoding="utf-8")

    gitops.hard_restore(ctx)
    assert read_text(guide) == baseline                       # system file restored
    assert personal_new.exists()                              # new personal note SURVIVES
    assert read_text(tracked_personal) == user_edit           # user edit SURVIVES


def test_engine_lock_single_instance(mini_ctx):
    from scripturegraph.lockfile import EngineBusy, engine_lock
    with engine_lock(mini_ctx):
        with pytest.raises(EngineBusy):
            with engine_lock(mini_ctx):
                pass
    # released → can acquire again
    with engine_lock(mini_ctx):
        pass


def test_failed_job_rolls_back_db_outcomes(imported_ctx):
    from scripturegraph.agents.pipeline import _rollback_job_outcomes
    from scripturegraph.graphops import add_edge
    ctx = imported_ctx
    ctx.db().execute(
        "INSERT INTO claims(id,node_id,claim_type,text,tier,provenance_json,"
        "created_at,updated_at) VALUES('clm-test','chapter:1ne-1','evidence','t',"
        "'ACCEPT','{\"job\": \"job-test-123\"}','x','x')")
    add_edge(ctx, "chapter:1ne-1", "topic:faith", "discusses", "accepted",
             0.9, 1.0, {}, "job:job-test-123")
    ctx.db().commit()
    _rollback_job_outcomes(ctx, "job-test-123")
    assert ctx.db().execute("SELECT tier FROM claims WHERE id='clm-test'").fetchone()[
        "tier"] == "QUARANTINE"
    assert ctx.db().execute(
        "SELECT 1 FROM edges WHERE provenance='job:job-test-123'").fetchone() is None
