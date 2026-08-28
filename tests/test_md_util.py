import pytest

from scripturegraph.util import is_legal_filename, sanitize_filename, atomic_write_text
from scripturegraph.vaultgen import md


def test_sanitize_filenames():
    assert sanitize_filename('Alma 36: "study"?') == "Alma 36 study"
    assert sanitize_filename("CON") == "CON_"
    assert sanitize_filename("Joseph Smith—History 1") == "Joseph Smith—History 1"
    assert sanitize_filename("a/b\\c|d") == "abcd"
    assert is_legal_filename("D&C 76")
    assert not is_legal_filename("bad:name")


def test_frontmatter_roundtrip():
    note = md.build_note({"ownership": "system", "chapter": 3}, "# Title\n\nBody")
    fm, body = md.parse_note(note)
    assert fm["ownership"] == "system" and fm["chapter"] == 3
    assert body.strip().startswith("# Title")


def test_markers():
    body = "intro\n" + md.marker_block("overview") + "\nend\n" + md.marker_block("people")
    assert md.markers_balanced(body)
    assert md.section_is_empty(md.get_section(body, "overview"))
    body2 = md.set_section(body, "overview", "Real content here.")
    assert md.get_section(body2, "overview") == "Real content here."
    assert md.get_section(body2, "people") == md.PLACEHOLDER
    with pytest.raises(KeyError):
        md.set_section(body2, "missing", "x")
    with pytest.raises(ValueError):
        md.set_section(body2, "overview", "evil <!-- SG:BEGIN x -->")


def test_wikilinks():
    text = "See [[Alma 36]] and [[Alma 36#^alma-36-22|v22]] plus [[Faith]]."
    links = md.extract_wikilinks(text)
    assert ("Alma 36", "") in links
    assert ("Alma 36", "#^alma-36-22") in links
    assert md.verse_link("Alma 36", "alma-36-22", "Alma 36:22") == \
        "[[Alma 36#^alma-36-22|Alma 36:22]]"


def test_atomic_write(tmp_path):
    p = tmp_path / "x" / "y.md"
    atomic_write_text(p, "hello")
    assert p.read_text(encoding="utf-8") == "hello"
    atomic_write_text(p, "world")
    assert p.read_text(encoding="utf-8") == "world"
