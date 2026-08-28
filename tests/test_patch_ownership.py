import pytest

from scripturegraph.util import read_text
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.patch import PatchViolation, apply_ops


GUIDE = "01 Scriptures/Study Guides/Book of Mormon/1 Nephi/1 Nephi 1 - Study Guide.md"
CANON = "01 Scriptures/Canonical/Book of Mormon/1 Nephi/1 Nephi 1.md"
PERSONAL = "80 Personal Notes/Scriptures/Book of Mormon/1 Nephi/1 Nephi 1 - My Notes.md"


def test_set_section_works_on_system_files(imported_ctx):
    ctx = imported_ctx
    result = apply_ops(ctx, [{"op": "set_section", "path": GUIDE,
                              "section": "overview", "content": "An overview."}],
                       actor="test")
    assert result.changed_paths == [GUIDE]
    _, body = md.parse_note(read_text(ctx.vault / GUIDE))
    assert md.get_section(body, "overview") == "An overview."


def test_canonical_scripture_is_rejected(imported_ctx):
    with pytest.raises(PatchViolation, match="IMMUTABLE"):
        apply_ops(imported_ctx, [{"op": "set_section", "path": CANON,
                                  "section": "overview", "content": "x"}], actor="test")


def test_personal_notes_are_rejected(imported_ctx):
    with pytest.raises(PatchViolation, match="PERSONAL"):
        apply_ops(imported_ctx, [{"op": "set_section", "path": PERSONAL,
                                  "section": "anything", "content": "x"}], actor="test")
    with pytest.raises(PatchViolation, match="PERSONAL"):
        apply_ops(imported_ctx, [{"op": "add_alias", "path": PERSONAL,
                                  "alias": "Sneaky"}], actor="test")


def test_create_note_and_duplicate_guard(imported_ctx):
    ctx = imported_ctx
    ops = [{"op": "create_note", "kind": "evidence", "title": "Test Evidence Item",
            "subfolder": "Book of Mormon/Literary",
            "sections": {"summary": "A modest observation."}}]
    result = apply_ops(ctx, ops, actor="test")
    assert result.created_paths == [
        "40 Evidence/Book of Mormon/Literary/Test Evidence Item.md"]
    # duplicate title refused
    with pytest.raises(PatchViolation, match="already"):
        apply_ops(ctx, ops, actor="test")
    # duplicate via the alias table: "Atonement" is an alias of the canonical
    # topic even though no file has that exact name
    with pytest.raises(PatchViolation, match="already in use"):
        apply_ops(ctx, [{"op": "create_note", "kind": "topic", "title": "Atonement",
                         "sections": {}}], actor="test")


def test_unknown_op_and_fm_whitelist(imported_ctx):
    with pytest.raises(PatchViolation, match="unknown patch op"):
        apply_ops(imported_ctx, [{"op": "delete_everything"}], actor="test")
    with pytest.raises(PatchViolation, match="not whitelisted"):
        apply_ops(imported_ctx, [{"op": "set_fm_field", "path": GUIDE,
                                  "field": "ownership", "value": "hacked"}], actor="test")
