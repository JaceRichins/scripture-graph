from scripturegraph.indexing.citations import find_citations, resolve_reference


def _one(text):
    found = find_citations(text)
    assert len(found) == 1, f"{text!r} -> {found}"
    return found[0]


def test_basic_forms():
    c = _one("As we read in 1 Nephi 3:7, the Lord prepares a way.")
    assert c.chapter_slug == "1ne-3" and c.verse_ranges == [(7, 7)]
    c = _one("See Alma 36:22-24 for the vision.")
    assert c.chapter_slug == "alma-36" and c.verse_ranges == [(22, 24)]
    c = _one("Compare D&C 76:22–24 here.")  # en-dash
    assert c.chapter_slug == "dc-76" and c.verse_ranges == [(22, 24)]


def test_abbreviations_and_lists():
    c = _one("Hel. 5:12 teaches about the foundation.")
    assert c.chapter_slug == "hel-5"
    c = _one("Matt. 5:3, 5, 7 lists blessings.")
    assert c.chapter_slug == "matt-5" and c.verse_ranges == [(3, 3), (5, 5), (7, 7)]
    c = _one("Joseph Smith—History 1:15 records it.")
    assert c.chapter_slug == "jsh-1"
    c = _one("W of M 1:3 explains the small plates.")
    assert c.chapter_slug == "wofm-1"


def test_chapter_only_and_continuation():
    c = _one("The whole of Alma 36 is a chiasm.")
    assert c.chapter_slug == "alma-36" and c.verse_ranges == []
    found = find_citations("Study Alma 5:14; 7:11-13 together.")
    assert [f.chapter_slug for f in found] == ["alma-5", "alma-7"]
    assert found[1].verse_ranges == [(11, 13)]


def test_precedence_and_guards():
    c = _one("Ponder 1 John 4:8 today.")
    assert c.chapter_slug == "1jn-4"  # "1 John" wins over "John"
    assert find_citations("as john 3:16 says") == []  # lowercase → not a citation
    assert find_citations("The Book of Mormon 9 chapters...") == []
    bad = find_citations("See Alma 99:1 for details.")
    assert len(bad) == 1 and not bad[0].valid


def test_resolve_reference():
    assert resolve_reference("Alma 36:22").chapter_slug == "alma-36"
    assert resolve_reference("garbage here") is None
    assert resolve_reference("Psalm 23:1").chapter_slug == "ps-23"
