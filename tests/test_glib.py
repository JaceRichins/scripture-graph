"""Gospel Library layer parser tests on REAL saved API responses."""
import json
from pathlib import Path

from scripturegraph.corpus.glib import (_heading_of, _strip_tags, _toc_child_uris,
                                        chapter_uri, parse_scripture_href)

FIXTURES = Path(__file__).parent / "fixtures"


def test_chapter_uri_builder():
    assert chapter_uri("alma-36") == "/scriptures/bofm/alma/36"
    assert chapter_uri("dc-76") == "/scriptures/dc-testament/dc/76"
    assert chapter_uri("ps-23") == "/scriptures/ot/ps/23"
    assert chapter_uri("jsh-1") == "/scriptures/pgp/js-h/1"
    assert chapter_uri("od-2") == "/scriptures/dc-testament/od/2"


def test_parse_scripture_href():
    got = parse_scripture_href(
        "/study/scriptures/bofm/hel/5?lang=eng&amp;id=p1-p13#p13")
    assert got == ("hel-5", list(range(1, 14)))
    assert parse_scripture_href("/study/scriptures/pgp/moses/6?lang=eng&id=p58#p58") == \
        ("moses-6", [58])
    assert parse_scripture_href("/study/scriptures/ot/isa/53?lang=eng#p5") == ("isa-53", [5])
    assert parse_scripture_href("/study/manual/gospel-topics/faith") is None


def test_heading_and_footnotes_from_real_chapter():
    d = json.loads((FIXTURES / "api-chapter.json").read_text(encoding="utf-8"))
    heading = _heading_of(d["content"]["body"])
    assert heading.startswith("Alma testifies to Helaman")
    fn = d["content"]["footnotes"]
    assert isinstance(fn, dict) and len(fn) > 40
    note = fn["note1_a"]
    refs = [parse_scripture_href(r["href"]) for r in note["referenceUris"]
            if r["type"] == "scripture-ref"]
    assert ("hel-5", list(range(1, 14))) in refs


def test_od_paragraph_extraction():
    import re
    d = json.loads((FIXTURES / "api-od2.json").read_text(encoding="utf-8"))
    body = d["content"]["body"]
    # declaration proper = p1..pN paragraphs (the canonical text)
    paras = [_strip_tags(m.group(2))
             for m in re.finditer(r'<p[^>]*\bid="p(\d+)"[^>]*>(.*?)</p>', body, re.DOTALL)]
    paras = [p for p in paras if len(p) >= 20]
    assert len(paras) >= 10
    joined = " ".join(paras)
    assert "priesthood" in joined and "revelation" in joined
    # the 2013 study introduction is apparatus → becomes the chapter heading
    heading = _heading_of(body)
    assert "all are alike unto God" in heading


def test_toc_child_uris():
    body = ('<a href="/study/manual/gospel-topics-essays/book-of-mormon-translation?lang=eng">x</a>'
            '<a href="/manual/gospel-topics-essays/race-and-the-priesthood">y</a>'
            '<a href="/study/manual/other/thing?lang=eng">z</a>')
    uris = _toc_child_uris(body, "/manual/gospel-topics-essays")
    assert uris == ["/manual/gospel-topics-essays/book-of-mormon-translation",
                    "/manual/gospel-topics-essays/race-and-the-priesthood"]
