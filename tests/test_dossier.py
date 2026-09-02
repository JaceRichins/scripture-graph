"""The subject-dossier pass: gated on the whole canon being read, prioritised
by how much the graph already knows about a subject, and landed through the
same researcher → skeptic → validation → judge → librarian transaction as
chapter research (stub mode, zero credentials)."""
import json

from scripturegraph.agents.dossier import (build_subject_context, pending_subjects,
                                           research_progress, resolve_subject,
                                           run_dossier_job, subject_context_markdown)
from scripturegraph.util import now_iso, read_text
from scripturegraph.vaultgen import md
from scripturegraph.waves import PASS_DEFS, mark_pass, pending_targets


def _read_everything(ctx):
    for r in ctx.db().execute("SELECT slug FROM chapters"):
        mark_pass(ctx, "research", r["slug"], "ai")


def _scan_mentions(ctx):
    from scripturegraph.indexing.entities import scan_chapter_mentions
    for r in ctx.db().execute("SELECT slug FROM chapters"):
        scan_chapter_mentions(ctx, r["slug"])


def test_dossier_is_a_registered_ai_pass():
    assert PASS_DEFS["dossier"]["mode"] == "ai"
    assert PASS_DEFS["dossier"]["scope"] == "subject"


def test_gate_waits_for_the_whole_canon(imported_ctx):
    ctx = imported_ctx
    assert not research_progress(ctx)["complete"]
    assert pending_targets(ctx, "dossier") == []
    slugs = [r["slug"] for r in ctx.db().execute("SELECT slug FROM chapters")]
    for s in slugs[:-1]:
        mark_pass(ctx, "research", s, "ai")
    # one chapter short is still not read
    assert pending_targets(ctx, "dossier") == []
    mark_pass(ctx, "research", slugs[-1], "ai")
    assert research_progress(ctx)["complete"]
    pend = pending_targets(ctx, "dossier")
    assert pend
    assert all(p.split(":", 1)[0] in ("question", "person", "place", "topic") for p in pend)
    # a manual run may look past the gate
    assert pending_subjects(ctx, ignore_gate=True)


def test_read_once_gate_survives_a_corpus_bump(imported_ctx):
    ctx = imported_ctx
    _read_everything(ctx)
    ctx.bump_corpus_version("new talks arrived")
    assert research_progress(ctx)["complete"], "read once is read; a bump must not re-close"


def test_priority_follows_what_the_graph_knows(imported_ctx):
    ctx = imported_ctx
    _read_everything(ctx)
    _scan_mentions(ctx)
    db = ctx.db()
    connected = {r["id"] for r in db.execute(
        "SELECT DISTINCT n.id FROM nodes n JOIN edges e ON e.dst=n.id "
        "WHERE n.node_type='person' AND e.status IN ('accepted','tentative')")}
    assert connected, "the mini canon names Nephi; mentions must have been indexed"
    people = [p for p in pending_subjects(ctx) if p.startswith("person:")]
    seen_unconnected = False
    for p in people:
        if p in connected:
            assert not seen_unconnected, "a subject the graph knows must outrank one it doesn't"
        else:
            seen_unconnected = True
    # a finished dossier drops out of the queue …
    first = people[0]
    mark_pass(ctx, "dossier", first, "ai")
    assert first not in pending_subjects(ctx)
    # … and is not reopened by a corpus bump alone (it is fresh)
    ctx.bump_corpus_version("more documents")
    assert first not in pending_subjects(ctx)


def test_resolve_subject_by_id_title_alias(imported_ctx):
    ctx = imported_ctx
    nid = ctx.db().execute("SELECT id FROM nodes WHERE title='Nephi (son of Lehi)'").fetchone()["id"]
    assert resolve_subject(ctx, nid) == nid
    assert resolve_subject(ctx, "Nephi (son of Lehi)") == nid
    assert resolve_subject(ctx, "chapter:mosiah-14") is None   # chapters are not subjects
    assert resolve_subject(ctx, "nobody at all") is None


def test_context_gathers_the_canon_and_the_findings(imported_ctx):
    ctx = imported_ctx
    _scan_mentions(ctx)
    db = ctx.db()
    nid = db.execute("SELECT id FROM nodes WHERE title='Nephi (son of Lehi)'").fetchone()["id"]
    first = next(ch for ch in build_subject_context(ctx, nid)["chapters"]
                 if ch["title"] == "1 Nephi 1")
    # a finding the chapter reading left on 1 Nephi 1
    db.execute(
        "INSERT INTO claims(id,node_id,claim_type,text,tier,scores_json,consensus,"
        "sources_json,provenance_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        ("clm-test-1", f"chapter:{first['slug']}", "observation",
         "Nephi opens his record by naming his parents and his own hand as the writer.",
         "ACCEPT", "{}", None, "[]", "{}", now_iso(), now_iso()))
    db.commit()
    c = build_subject_context(ctx, nid)
    assert c["kind"] == "person" and c["title"] == "Nephi (son of Lehi)"
    assert c["verses"] and all("Nephi" in v["text"] for v in c["verses"])
    assert c["verses"][0]["ref"].startswith("1 Nephi ")
    assert c["findings"] and "record" in c["findings"][0]["text"]
    assert c["findings"][0]["where"] == "1 Nephi 1"
    assert c["prose_sections"] == ["overview", "scripture-profile", "conference", "related"]
    text = subject_context_markdown(c)
    assert "Person: Nephi (son of Lehi)" in text
    assert "Sections to write" in text and "`overview`" in text
    assert "What the chapter-by-chapter reading found" in text


def test_context_matches_names_by_word_not_substring(imported_ctx):
    """'Abel' must not be found inside 'label', nor 'Eden' inside 'Sweden'."""
    from scripturegraph.agents.dossier import _name_pattern
    rx = _name_pattern("person", "Abel", [], {})
    assert rx.search("Abel offered a lamb") and not rx.search("an unlabeled record")
    rx = _name_pattern("person", "Nephi (son of Lehi)", [], {})
    assert rx.search("I, Nephi, having been born")
    rx = _name_pattern("topic", "Faith", ["Faith in Jesus Christ"], {"keywords": ["faithful"]})
    assert rx.search("the faithful saints") and rx.search("FAITH is")


def test_full_stub_dossier_job(imported_ctx):
    ctx = imported_ctx
    _read_everything(ctx)
    _scan_mentions(ctx)
    db = ctx.db()
    nid = db.execute("SELECT id FROM nodes WHERE title='Nephi (son of Lehi)'").fetchone()["id"]
    result = run_dossier_job(ctx, nid)
    assert result["mode"] == "stub"
    assert result["git_rev"], "a dossier must commit its changes"
    assert result["kind"] == "person" and result["target"] == nid

    job = db.execute("SELECT * FROM jobs WHERE job_id=?", (result["job_id"],)).fetchone()
    assert job["status"] == "applied" and job["job_type"] == "dossier" and job["target"] == nid
    ws = ctx.jobs_dir / result["job_id"]
    for part in ("a/proposal.json", "b/proposal.json", "judge/decision.json",
                 "validation/results.json", "librarian/patch.json", "source/context.md"):
        assert (ws / part).exists(), part

    # claims land on the SUBJECT, not on a chapter; stub judge caps at TENTATIVE
    claims = db.execute("SELECT * FROM claims WHERE node_id=?", (nid,)).fetchall()
    assert claims
    for c in claims:
        assert c["tier"] in ("TENTATIVE", "REJECT")
        assert json.loads(c["provenance_json"])["job"] == result["job_id"]

    # the deterministic mentions ledger is on the page, the review stamp in frontmatter
    path = db.execute("SELECT vault_path FROM nodes WHERE id=?", (nid,)).fetchone()["vault_path"]
    fm, body = md.parse_note(read_text(ctx.vault / path))
    mentions = md.get_section(body, "mentions") or ""
    assert "[[1 Nephi 1]]" in mentions
    assert fm["corpus_version_reviewed"] == ctx.corpus_version()
    # and the pass is recorded only by the queue (mark_pass is the caller's job)
    assert "sections" in result
