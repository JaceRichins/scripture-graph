"""The chronology dataset must stay internally honest."""
import json
import re

from scripturegraph.timeline import (BOOK_YEARS, EVENTS, _century_span,
                                     build_timeline)
from scripturegraph.util import read_text


def test_dataset_shape():
    from scripturegraph.timeline import THREADS
    ids = [e["id"] for e in EVENTS]
    assert len(ids) == len(set(ids)), "event ids must be unique"
    assert len(EVENTS) >= 90
    thread_ids = {t["id"] for t in THREADS}
    for e in EVENTS:
        assert e["lane"] in ("ow", "nw", "rs"), e["id"]
        assert e["dating"] in ("traditional", "approximate", "internal", "historical"), e["id"]
        assert e["imp"] in (1, 2, 3), e["id"]
        assert -4200 <= e["y0"] <= e["y1"] <= 2100, e["id"]
        assert e["cat"], e["id"]
        if "thread" in e:
            assert e["thread"] in thread_ids, e["id"]
    # every thread's branch point exists, and threads sit on their own lane
    for t in THREADS:
        assert t["lane"] in ("ow", "nw", "rs")
        if t["branch"]:
            assert t["branch"] in ids, t["id"]
        members = [e for e in EVENTS if e.get("thread") == t["id"]]
        assert members, f"thread {t['id']} has no events"
        assert all(e["lane"] == t["lane"] for e in members), t["id"]


def test_century_buckets():
    assert _century_span(-600) == (-600, -501)
    assert _century_span(-501) == (-600, -501)
    assert _century_span(-500) == (-500, -401)
    assert _century_span(-4) == (-100, -1)
    assert _century_span(34) == (1, 100)
    assert _century_span(1820) == (1801, 1900)


def test_book_years_cover_all_slugs():
    from scripturegraph.booksdata import BOOKS
    missing = [b.slug for b in BOOKS if b.slug not in BOOK_YEARS]
    assert not missing, f"books without a timeline year: {missing}"


def test_organic_rebuild_only_on_change(mini_ctx):
    """The scheduled runs call maybe_build_timeline every night — it must be
    a no-op while the chronology is unchanged, and rebuild the moment the
    dataset (or its output) isn't what's on disk."""
    from scripturegraph.timeline import maybe_build_timeline
    first = maybe_build_timeline(mini_ctx)
    assert first.get("rebuilt") is True
    second = maybe_build_timeline(mini_ctx)
    assert second.get("skipped") == "unchanged"
    # dataset changes (simulated via the stored fingerprint) trigger a rebuild
    mini_ctx.meta_set("timeline:hash", "stale")
    third = maybe_build_timeline(mini_ctx)
    assert third.get("rebuilt") is True
    # a missing output file also heals, even with a current fingerprint
    (mini_ctx.vault / "AI Library" / "90 Timeline" / "_data.md").unlink()
    fourth = maybe_build_timeline(mini_ctx)
    assert fourth.get("rebuilt") is True


def test_build_writes_pages_and_data(mini_ctx):
    stats = build_timeline(mini_ctx)
    assert stats["events"] == len(EVENTS)
    root = mini_ctx.vault / "AI Library" / "90 Timeline"
    # the 600-501 BC page carries BOTH worlds — Jeremiah's Jerusalem and Lehi's trail
    page = read_text(root / "600-501 BC.md")
    assert "In the Old World" in page and "In the Book of Mormon lands" in page
    assert "Lehi" in page and "Jerusalem" in page
    # the plugin dataset parses
    data_md = read_text(root / "_data.md")
    m = re.search(r"```json\n(.*)\n```", data_md, re.S)
    assert m
    data = json.loads(m.group(1))
    assert data["version"] == 2
    assert len(data["events"]) == len(EVENTS)
    assert data["book_years"]["1ne"] == -595
    assert any(t["id"] == "nw-zeniff" for t in data["threads"])


def _prop(items):
    return {"claims": [], "candidate_links": [], "study_sections": {},
            "chronology": items}


def test_chronology_ingest_gate(mini_ctx):
    """Research may PROPOSE events; the deterministic gate decides. Dates the
    model invented (wrong window, wrong dating idiom, duplicates of the
    curated roster) never reach the dataset."""
    from scripturegraph.timeline import (dataset_hash, ingest_chronology,
                                         maybe_build_timeline, merged_events)
    base_hash = dataset_hash(mini_ctx)
    maybe_build_timeline(mini_ctx)

    good = {"title": "Alma names the church at Sidom", "year_start": -82,
            "year_end": -82, "dating": "internal", "cat": ["turning"],
            "basis": "the year markers around Alma 15 place this in the 10th "
                     "year of the judges", "people": ["Alma the Younger"],
            "places": ["Sidom"]}
    wrong_dating = dict(good, title="Zeezrom healed of his burning fever",
                        dating="historical")
    wrong_window = dict(good, title="A completely different later event",
                        year_start=600, year_end=600)
    dupe = {"title": "The Anti-Nephi-Lehies bury their swords and weapons",
            "year_start": -84, "year_end": -80, "dating": "internal",
            "cat": ["turning"], "basis": "internal year markers in Alma 24"}
    stats = ingest_chronology(
        mini_ctx, "alma-15", [_prop([good, wrong_dating, wrong_window]), _prop([dupe])])
    assert stats["stored"] == 1 and stats["rejected"] == 3

    # the stored proposal joins the merged roster as a detail-tier moment
    extra = [e for e in merged_events(mini_ctx) if e.get("src") == "research"]
    assert len(extra) == 1 and extra[0]["imp"] == 3
    assert extra[0]["t"] == good["title"]

    # the fingerprint moved, so the next scheduled check rebuilds organically
    assert dataset_hash(mini_ctx) != base_hash
    assert maybe_build_timeline(mini_ctx).get("rebuilt") is True

    # per-chapter cap: a second valid, distinct proposal fits; a third never
    more = [{"title": "Aminadab points the Lamanites to prayer",
             "year_start": -81, "year_end": -81, "dating": "internal",
             "cat": ["visions"], "basis": "the year markers of the same span"},
            {"title": "A third proposal past the cap for this chapter",
             "year_start": -80, "year_end": -80, "dating": "internal",
             "cat": ["records"], "basis": "internal year markers once more"}]
    stats2 = ingest_chronology(mini_ctx, "alma-15", [_prop(more)])
    assert stats2["stored"] == 1 and stats2["rejected"] == 1


def test_entity_sections_sync(mini_ctx):
    """Entity pages the chronology touches grow a maintained timeline
    section — plural subject names resolve to their singular page, writes
    are diff-gated, markers stay balanced."""
    from scripturegraph.timeline import sync_entity_sections
    from scripturegraph.util import now_iso, read_text
    from scripturegraph.vaultgen import md
    from scripturegraph.vaultgen.generate import record_file

    db = mini_ctx.db()
    nid, rel = "person:anti-nephi-lehi", "AI Library/30 People/Anti-Nephi-Lehi.md"
    db.execute("INSERT INTO nodes(id,node_type,title,vault_path,created_at,updated_at) "
               "VALUES(?,?,?,?,?,?)",
               (nid, "person", "Anti-Nephi-Lehi", rel, now_iso(), now_iso()))
    db.execute("INSERT INTO aliases(alias,node_id) VALUES(?,?)",
               ("Anti-Nephi-Lehi", nid))
    db.commit()
    note = md.build_note({"ownership": "system", "mutable": "ai"},
                         "# Anti-Nephi-Lehi\n\n## Overview\n"
                         + md.marker_block("overview") + "\n")
    record_file(mini_ctx, rel, "person", "librarian", nid, note)

    stats = sync_entity_sections(mini_ctx)
    assert stats["updated"] == 1
    body = read_text(mini_ctx.vault / rel)
    assert "## ⏳ In the Timeline" in body
    assert "[[Alma 24]]" in body            # the buried-swords covenant
    assert md.markers_balanced(md.parse_note(body)[1])

    # unchanged world → no rewrite (organic runs stay quiet)
    assert sync_entity_sections(mini_ctx)["updated"] == 0
