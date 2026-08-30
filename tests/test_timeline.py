"""The chronology dataset must stay internally honest."""
import json
import re

from scripturegraph.timeline import (BOOK_YEARS, EVENTS, _century_span,
                                     build_timeline)
from scripturegraph.util import read_text


def test_dataset_shape():
    ids = [e["id"] for e in EVENTS]
    assert len(ids) == len(set(ids)), "event ids must be unique"
    assert len(EVENTS) >= 90
    for e in EVENTS:
        assert e["lane"] in ("ow", "nw", "rs"), e["id"]
        assert e["dating"] in ("traditional", "approximate", "internal", "historical"), e["id"]
        assert e["imp"] in (1, 2, 3), e["id"]
        assert -4200 <= e["y0"] <= e["y1"] <= 2100, e["id"]
        assert e["cat"], e["id"]


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
    assert second == {"skipped": "unchanged"}
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
    assert data["version"] == 1
    assert len(data["events"]) == len(EVENTS)
    assert data["book_years"]["1ne"] == -595
