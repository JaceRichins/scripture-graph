"""Footnote notes: one per chapter with apparatus, carrying a compact JSON
block the phone reads and a readable list with verse links."""
import json

from scripturegraph.util import read_text
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.footnotes import footnote_path, write_footnote_notes


def test_footnote_note_from_apparatus(imported_ctx):
    ctx = imported_ctx
    ctx.db().execute(
        "INSERT INTO chapter_apparatus(chapter_slug, heading, footnotes_json, fetched_at) VALUES(?,?,?,?)",
        ("1ne-1", "Nephi begins the record of his people.",
         json.dumps({"1": [{"marker": "1a", "refs": [{"chapter": "mosiah-14", "verses": [3, 4], "label": "Mosiah 14:3"}]},
                           {"marker": "1b", "refs": []}],
                     "2": [{"marker": "2a", "refs": [{"chapter": "isa-1", "verses": [1], "label": "Isa. 1:1"}]}]}),
         "now"))
    ctx.db().commit()
    n = write_footnote_notes(ctx)
    assert n == 1
    rel = footnote_path("1ne-1")
    assert rel and rel.endswith("1 Nephi 1 - Footnotes.md") and "Footnotes/" in rel
    fm, body = md.parse_note(read_text(ctx.vault / rel))
    assert fm["content_type"] == "footnotes" and fm["slug"] == "1ne-1" and fm["verses"] == 2
    block = json.loads(body.split("```json")[1].split("```")[0])
    assert block["1"][0]["m"] == "1a" and block["1"][0]["refs"][0]["t"] == "Mosiah 14"
    assert "1b" not in json.dumps(block), "a marker with no references is dropped"
    assert "[[Mosiah 14#^mosiah-14-3|Mosiah 14:3]]" in body
    assert write_footnote_notes(ctx) == 0, "unchanged notes are not rewritten"
