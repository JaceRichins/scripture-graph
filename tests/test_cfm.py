"""Come, Follow Me: the manual's TOC becomes weeks with dates and the vault's
chapter titles."""
from scripturegraph.corpus.cfm import chapters_of, parse_weeks

URI = "/manual/come-follow-me-for-home-and-church-old-testament-2026"
BODY = (
    f'<a href="/study{URI}/001-conversion?lang=eng">Conversion Is Our Goal</a>'
    f'<a href="/study{URI}/01?lang=eng"><p>December 29–January 4</p><p>Introduction to the Old Testament</p></a>'
    f'<a href="/study{URI}/02?lang=eng"><p>January 5–11</p><p>Moses 1; Abraham 3</p></a>'
    f'<a href="/study{URI}/05?lang=eng"><p>January 26–February 1</p><p>Genesis 5; Moses 6</p></a>'
)


def test_weeks_parse_with_year_boundaries():
    weeks = parse_weeks(2026, BODY, URI)
    assert [w["week"] for w in weeks] == ["01", "02", "05"]
    assert weeks[0]["start"] == "2025-12-29" and weeks[0]["end"] == "2026-01-04"
    assert weeks[1]["dates"] == "January 5–11" and weeks[1]["block"] == "Moses 1; Abraham 3"
    assert weeks[2]["start"] == "2026-01-26" and weeks[2]["end"] == "2026-02-01"


def test_chapters_resolve_to_vault_titles():
    assert chapters_of("Genesis 1–2; Moses 2–3; Abraham 4–5") == [
        "Genesis 1", "Genesis 2", "Moses 2", "Moses 3", "Abraham 4", "Abraham 5"]
    assert chapters_of("Doctrine and Covenants 6–9")[0] == "Doctrine and Covenants 6"
    assert chapters_of("Introduction to the Old Testament") == []
