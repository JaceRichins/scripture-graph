from scripturegraph import booksdata as bd


def test_registry_counts():
    assert len(bd.BOOKS) == 88  # 87 json-corpus books + Official Declarations (api)
    assert bd.EXPECTED_TOTAL_CHAPTERS == 1582
    assert bd.TOTAL_CHAPTERS_WITH_API == 1584
    assert sum(b.chapters for b in bd.BOOKS if b.volume == bd.OT) == 929
    assert sum(b.chapters for b in bd.BOOKS if b.volume == bd.NT) == 260
    assert sum(b.chapters for b in bd.BOOKS if b.volume == bd.BM) == 239


def test_official_declarations_book():
    od = bd.BY_SLUG["od"]
    assert od.volume == bd.DC and od.source == "api" and od.chapters == 2
    assert bd.chapter_title(od, 2) == "Official Declaration 2"
    assert bd.find_chapter_by_title("Official Declaration 1")[0].slug == "od"
    assert bd.find_chapter_by_title("OD 2")[0].slug == "od"


def test_slugs_unique_and_dashless():
    slugs = [b.slug for b in bd.BOOKS]
    assert len(set(slugs)) == 88
    assert all("-" not in s for s in slugs)


def test_stable_ids():
    ne1 = bd.BY_LDS_SLUG["1-ne"]
    assert ne1.slug == "1ne"
    assert bd.chapter_slug(ne1, 3) == "1ne-3"
    assert bd.verse_slug(ne1, 3, 7) == "1ne-3-7"
    book, ch, v = bd.split_verse_slug("1ne-3-7")
    assert (book.name, ch, v) == ("1 Nephi", 3, 7)
    aof = bd.BY_LDS_SLUG["a-of-f"]
    assert bd.verse_slug(aof, 1, 8) == "aoff-1-8"


def test_display_titles():
    ps = bd.BY_SLUG["ps"]
    assert bd.chapter_title(ps, 23) == "Psalm 23"
    dc = bd.BY_SLUG["dc"]
    assert bd.chapter_title(dc, 76) == "D&C 76"


def test_find_chapter_by_title():
    assert bd.find_chapter_by_title("Alma 36")[0].slug == "alma"
    assert bd.find_chapter_by_title("D&C 76")[0].slug == "dc"
    assert bd.find_chapter_by_title("Psalm 23")[0].slug == "ps"
    assert bd.find_chapter_by_title("Psalms 23")[0].slug == "ps"
    assert bd.find_chapter_by_title("1 Ne 3")[0].slug == "1ne"
    assert bd.find_chapter_by_title("Nonsense 5") is None
