"""The corpus-level cumulative assessment: a registry with enough contested
issues makes the corpus pending; the stub pipeline writes the page with the
deterministic registry table and the judged prose; the page is then required
reading for the corpus's hard questions; and it is redone only when the
registry has moved enough."""
import json

from scripturegraph.agents.cumulative import (CORPUS_BY_SCOPE, SECTIONS, build_corpus_context,
                                              context_markdown, page_path, page_title,
                                              pending_corpora, registry_signature,
                                              run_cumulative_job)
from scripturegraph.util import now_iso, read_text
from scripturegraph.vaultgen import md
from scripturegraph.waves import PASS_DEFS, mark_pass, pending_targets


def _issue(ctx, key, corpus="Book of Mormon", es=0.4, note=None):
    ctx.db().execute(
        "INSERT INTO issues(issue_key,corpus,title,proposition,weight_label,evidence_strength,"
        "direction,assessment,notes_json,history_json,updated_by,updated_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(issue_key) DO UPDATE SET "
        "evidence_strength=excluded.evidence_strength, updated_at=excluded.updated_at",
        (key, corpus, f"Issue {key}", f"proposition for {key}", "moderate", es, "supports",
         f"assessment of {key}", json.dumps([note] if note else []), "[]", "test", now_iso()))
    ctx.db().commit()


def test_cumulative_is_a_registered_corpus_pass():
    assert PASS_DEFS["cumulative"]["mode"] == "ai" and PASS_DEFS["cumulative"]["scope"] == "corpus"
    assert CORPUS_BY_SCOPE["book-of-mormon"] == "Book of Mormon"


def test_pending_needs_a_registry_then_a_moved_registry(imported_ctx):
    ctx = imported_ctx
    assert pending_corpora(ctx) == []                      # nothing contested yet
    for i in range(3):
        _issue(ctx, f"bom-issue-{i}")
    assert pending_corpora(ctx) == ["Book of Mormon"]
    assert pending_targets(ctx, "cumulative") == ["Book of Mormon"]
    # a written page at this signature is current
    (ctx.vault / page_path("Book of Mormon")).parent.mkdir(parents=True, exist_ok=True)
    (ctx.vault / page_path("Book of Mormon")).write_text("# x", encoding="utf-8")
    mark_pass(ctx, "cumulative", "Book of Mormon", registry_signature(ctx, "Book of Mormon"))
    assert pending_corpora(ctx) == []
    # one changed weight is not enough; five new issues are
    _issue(ctx, "bom-issue-0", es=0.9)
    assert pending_corpora(ctx) == []
    for i in range(3, 8):
        _issue(ctx, f"bom-issue-{i}")
    assert pending_corpora(ctx) == ["Book of Mormon"]


def test_full_stub_cumulative_job_writes_the_page(imported_ctx):
    ctx = imported_ctx
    from scripturegraph.vaultgen.patch import apply_ops
    res = apply_ops(ctx, [{"op": "create_note", "kind": "evidence", "title": "Chiastic Form in 1 Nephi 1",
                           "subfolder": "Book of Mormon/Chiasmus",
                           "sections": {"summary": "s", "models": "- **ancient source** — predicts: x. Fit: *consistent*."}}],
                    actor="test")
    assert res.created_paths
    for i in range(4):
        _issue(ctx, f"bom-issue-{i}", note="Chiastic Form in 1 Nephi 1" if i == 0 else None)
    c = build_corpus_context(ctx, "Book of Mormon")
    assert c["by_category"].get("Chiasmus"), "the category comes from the finding's folder"
    assert c["frameworks"] and c["frameworks"][0]["issue"] == "bom-issue-0"
    text = context_markdown(c)
    assert "Sections to write" in text and "`frameworks`" in text
    result = run_cumulative_job(ctx, "Book of Mormon", apply=True)
    assert result["mode"] == "stub" and result["git_rev"] and result["sections"] == len(SECTIONS)
    assert result["pass_mode"] == registry_signature(ctx, "Book of Mormon")
    fm, body = md.parse_note(read_text(ctx.vault / page_path("Book of Mormon")))
    assert fm["content_type"] == "assessment" and fm["issues"] == 4
    for key, _heading in SECTIONS:
        assert not md.section_is_empty(md.get_section(body, key)), key
    table = md.get_section(body, "registry")
    assert "[[Assessments#bom-issue-0|" in table and "**Chiasmus**" in table
    assert "not here to prove or disprove" in body and md.markers_balanced(body)
    # the page is a node-less MOC the registry knows about
    row = ctx.db().execute("SELECT kind FROM file_registry WHERE path=?",
                           (page_path("Book of Mormon"),)).fetchone()
    assert row and row["kind"] == "moc"
    mark_pass(ctx, "cumulative", "Book of Mormon", result["pass_mode"])
    assert pending_corpora(ctx) == [], "written at this signature: nothing pending"


def test_question_context_reads_the_corpus_page(imported_ctx):
    """A Book of Mormon-scoped hard question carries the cumulative page as
    required reading, and may wiki-link it."""
    from scripturegraph.agents.dossier import build_subject_context, subject_context_markdown
    from scripturegraph.bootstrap import install_seed_notes
    ctx = imported_ctx
    install_seed_notes(ctx)
    for i in range(3):
        _issue(ctx, f"bom-issue-{i}")
    run_cumulative_job(ctx, "Book of Mormon", apply=True)
    q = ctx.db().execute("SELECT id, vault_path FROM nodes WHERE node_type='question' "
                         "AND title LIKE 'Does DNA evidence%'").fetchone()
    assert q, "the DNA question is seeded"
    p = ctx.vault / q["vault_path"]
    fm, body = md.parse_note(read_text(p))
    fm["scope"] = "book-of-mormon"
    p.write_text(md.build_note(fm, body), encoding="utf-8")
    c = build_subject_context(ctx, q["id"])
    assert c["cumulative"] and c["cumulative"]["title"] == page_title("Book of Mormon")
    assert "frameworks" in c["prose_sections"]
    assert page_title("Book of Mormon") in c["vocabulary"]
    text = subject_context_markdown(c)
    assert "REQUIRED READING" in text and "`frameworks`" in text


def test_review_only_lands_nothing(imported_ctx):
    ctx = imported_ctx
    for i in range(3):
        _issue(ctx, f"bom-issue-{i}")
    result = run_cumulative_job(ctx, "Book of Mormon", apply=False)
    assert result["sections"] == len(SECTIONS) and "Nothing below has been applied" in read_text(result["report"])
    assert not (ctx.vault / page_path("Book of Mormon")).exists()
