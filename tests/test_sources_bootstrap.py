import json

from scripturegraph.bootstrap import get_state, run_bootstrap
from scripturegraph.corpus.registry import ensure_registry, scan_drop
from scripturegraph.graphops import resolve_name
from scripturegraph.util import read_text
from scripturegraph.vaultgen import md


def _drop_talk(ctx, body_extra=""):
    talk = {"title": "The Power of Small Things", "speaker": "Elder Example",
            "year": 2025, "month": "April", "url": "https://example.org/talk",
            "body": "I testify of what 1 Nephi 3:7 teaches: the Lord prepares a way. "
                    "As Isaiah 53 foretold, the Savior bore our griefs." + body_extra}
    p = ctx.drop_dir / "conference" / "2025-04-example.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(talk), encoding="utf-8")
    return p


def test_source_change_detection_and_conference_flow(imported_ctx):
    ctx = imported_ctx
    ensure_registry(ctx)
    cv0 = ctx.corpus_version()
    _drop_talk(ctx)
    stats = scan_drop(ctx)
    assert stats["imported"] == 1
    assert ctx.corpus_version() == cv0 + 1  # corpus bump on import

    # unchanged file → skipped, no bump
    stats2 = scan_drop(ctx)
    assert stats2["imported"] == 0 and stats2["skipped"] >= 1
    assert ctx.corpus_version() == cv0 + 1

    # explicit citation edges talk→chapter
    edge = ctx.db().execute(
        "SELECT * FROM edges WHERE rel='cites' AND dst='chapter:1ne-3' "
        "AND src LIKE 'talk:%'").fetchone()
    assert edge is not None

    # talk vault note exists with metadata (not full text)
    note = ctx.vault / ("AI Library/10 General Conference/2025/April/"
                        "The Power of Small Things (Elder Example, April 2025).md")
    assert note.exists()
    text = read_text(note)
    assert "Elder Example" in text and "1 Nephi 3" in text

    # conference pass renders the chapter's conference section
    from scripturegraph.corpus.conference import render_conference_section
    render_conference_section(ctx, "1ne-3")
    guide = ctx.vault / ("AI Library/01 Scriptures/Study Guides/03 Book of Mormon/01 1 Nephi/"
                         "1 Nephi 3 - Study Guide.md")
    _, body = md.parse_note(read_text(guide))
    conf = md.get_section(body, "conference")
    assert "explicit citation" in conf and "The Power of Small Things" in conf

    # modified file → re-imported, another bump
    _drop_talk(ctx, body_extra=" Also see Mosiah 14.")
    stats3 = scan_drop(ctx)
    assert stats3["imported"] == 1
    assert ctx.corpus_version() == cv0 + 2


def test_alias_canonicalization(imported_ctx):
    ctx = imported_ctx
    for surface in ("Atonement", "Atonement of Christ", "Atonement of Jesus Christ"):
        matches = resolve_name(ctx, surface)
        assert len(matches) == 1
        assert matches[0]["id"] == "topic:atonement-of-jesus-christ"


def test_bootstrap_state_machine_resumes(mini_ctx):
    ctx = mini_ctx
    assert get_state(ctx) == "NOT_INITIALIZED"
    run_bootstrap(ctx, until="SCRIPTURES_IMPORTED")
    assert get_state(ctx) == "SCRIPTURES_IMPORTED"
    # resume continues, never restarts
    run_bootstrap(ctx, until="GLOBAL_INDEX_BUILT")
    assert get_state(ctx) == "GLOBAL_INDEX_BUILT"
    assert ctx.db().execute("SELECT COUNT(*) AS n FROM chapters").fetchone()["n"] == 4
    # full run to steady state on the mini corpus
    run_bootstrap(ctx)
    assert get_state(ctx) == "STEADY_STATE"
    assert (ctx.vault / "AI Library/00 System" / "Status.md").exists()
    assert (ctx.vault / "AI Library/00 System" / "Graph Health.md").exists()
    assert (ctx.vault / "AI Library/00 System" / "AI-CONSTITUTION.md").exists()


def test_personal_notes_indexed_never_touched(imported_ctx):
    ctx = imported_ctx
    from scripturegraph.personal import index_personal_notes
    note = ctx.vault / "Library" / "My Insight.md"
    original = ("# My Insight\n\nI love [[Faith]] and what 1 Nephi 3:7 teaches "
                "about obedience.\n")
    note.write_text(original, encoding="utf-8")
    stats = index_personal_notes(ctx)
    assert stats["indexed"] >= 1
    node = ctx.db().execute(
        "SELECT id FROM nodes WHERE node_type='personal-note' AND title='My Insight'"
    ).fetchone()
    assert node is not None
    edges = ctx.db().execute(
        "SELECT dst FROM edges WHERE src=? AND provenance='pass:personal'",
        (node["id"],)).fetchall()
    dsts = {e["dst"] for e in edges}
    assert "topic:faith" in dsts and "chapter:1ne-3" in dsts
    # the file is byte-identical after indexing — engine never writes personal files
    assert note.read_text(encoding="utf-8") == original
