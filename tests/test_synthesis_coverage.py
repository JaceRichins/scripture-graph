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
    guide = ctx.vault / ("Library/01 Scriptures/Study Guides/Book of Mormon/Mosiah/"
                         "Mosiah 14 - Study Guide.md")
    fm, body = md.parse_note(read_text(guide))
    related = md.get_section(body, "related-scriptures")
    assert "Isaiah 53" in related and "parallel verse" in related
    assert fm["corpus_version_reviewed"] == ctx.corpus_version()


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
