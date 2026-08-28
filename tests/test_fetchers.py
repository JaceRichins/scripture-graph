"""Parser tests for corpus acquisition, using REAL saved API responses
(tests/fixtures/api-*.json) — no network involved."""
import json
from pathlib import Path

from scripturegraph.corpus.fetchers import _clean, parse_talk_json, parse_toc_talk_uris

FIXTURES = Path(__file__).parent / "fixtures"


def test_clean_normalizes_unicode_spaces():
    assert _clean("Russell M. Nelson") == "Russell M. Nelson"
    assert _clean("Dallin H. Oaks") == "Dallin H. Oaks"
    assert _clean("  plain   text ") == "plain text"


def test_parse_toc_from_real_response():
    toc = json.loads((FIXTURES / "api-toc.json").read_text(encoding="utf-8"))
    uris = parse_toc_talk_uris(toc["content"]["body"], 2024, 4)
    assert len(uris) >= 30
    assert "/general-conference/2024/04/57nelson" in uris
    assert not any(u.endswith("-session") for u in uris)
    assert len(uris) == len(set(uris))


def test_parse_talk_from_real_response():
    data = json.loads((FIXTURES / "api-talk.json").read_text(encoding="utf-8"))
    talk = parse_talk_json(data, 2024, "April", "/general-conference/2024/04/57nelson")
    assert talk is not None
    assert talk["title"] == "Rejoice in the Gift of Priesthood Keys"
    assert talk["speaker"] == "President Russell M. Nelson"
    assert talk["year"] == "2024" and talk["month"] == "April"
    assert len(talk["body"]) > 3000
    assert "priesthood keys" in talk["body"].lower()
    # footnote scripture refs must survive into the body for citation parsing
    from scripturegraph.indexing.citations import find_citations
    cits = find_citations(talk["body"])
    assert len(cits) >= 3, "expected scripture citations from talk footnotes"


def test_parse_talk_rejects_junk():
    assert parse_talk_json({"meta": {}, "content": {}}, 2024, "April", "/x") is None
    assert parse_talk_json({"meta": {"title": "X"}, "content": {"body": "short"}},
                           2024, "April", "/x") is None
