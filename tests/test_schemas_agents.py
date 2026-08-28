import pytest

from scripturegraph.agents import schemas


GOOD_PROPOSAL = {
    "claims": [{"id": "c1", "type": "observation", "confidence": 0.8,
                "text": "The chapter opens with a first-person colophon.",
                "scripture_refs": ["1 Nephi 1:1"],
                "quotes": [{"ref": "1 Nephi 1:1", "quote": "born of goodly parents"}]}],
    "candidate_links": [{"target": "Isaiah 53", "rel": "parallel_to"}],
    "study_sections": {"overview": "A short overview."},
}


def test_schema_accepts_good_proposal():
    schemas.validate(GOOD_PROPOSAL, "proposal")


def test_schema_rejects_bad_proposal():
    bad = {"claims": [{"id": "c1", "type": "vibes", "text": "??", "confidence": 2}],
           "candidate_links": [], "study_sections": {}}
    with pytest.raises(schemas.SchemaError):
        schemas.validate(bad, "proposal")
    with pytest.raises(schemas.SchemaError):
        schemas.validate({"study_sections": {}}, "proposal")  # missing required


def test_extract_json_variants():
    import json
    payload = json.dumps(GOOD_PROPOSAL)
    assert schemas.extract_json(payload)["claims"][0]["id"] == "c1"
    assert schemas.extract_json(f"Here you go:\n```json\n{payload}\n```\nDone!")[
        "claims"][0]["id"] == "c1"
    assert schemas.extract_json(f"preamble {{not json}} …{payload} trailing")[
        "candidate_links"][0]["rel"] == "parallel_to"
    with pytest.raises(schemas.SchemaError):
        schemas.extract_json("no json here at all")


def test_judgment_schema():
    good = {"decisions": [{"claim_id": "A:c1", "outcome": "TENTATIVE"}],
            "section_approvals": {"overview": {"use": "merged", "merged_text": "ok"}}}
    schemas.validate(good, "judgment")
    with pytest.raises(schemas.SchemaError):
        schemas.validate({"decisions": [{"claim_id": "x", "outcome": "MAYBE"}]},
                         "judgment")
