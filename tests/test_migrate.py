"""The Evidence → Findings rename: the folder moves, the registry and the
graph follow, managed links are re-pointed, the old titles survive as
aliases, and a second run is a no-op."""
import shutil

from scripturegraph.agents.calibrate import REGISTRY_NOTE
from scripturegraph.util import read_text
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_EVIDENCE
from scripturegraph.vaultgen.migrate import (NEW_FOLDER, OLD_FOLDER, findings_rename_needed,
                                             rename_findings_folder)
from scripturegraph.vaultgen.patch import apply_ops


def test_rename_moves_everything_and_keeps_old_titles_as_aliases(imported_ctx):
    ctx = imported_ctx
    res = apply_ops(ctx, [{"op": "create_note", "kind": "evidence", "title": "Parallel Alpha in 1 Nephi 1",
                           "subfolder": "Book of Mormon/Literary",
                           "sections": {"summary": "See [[Evidence Assessments#x|x]] and [[Book of Mormon Evidence]]."}}],
                    actor="test")
    note_new = res.created_paths[0]
    assert note_new.startswith(NEW_FOLDER)
    # put the vault back on the OLD name, as a live vault is
    shutil.move(str(ctx.vault / NEW_FOLDER), str(ctx.vault / OLD_FOLDER))
    old_note = note_new.replace(NEW_FOLDER, OLD_FOLDER)
    ctx.db().execute("UPDATE file_registry SET path=replace(path, ?, ?)", (NEW_FOLDER, OLD_FOLDER))
    ctx.db().execute("UPDATE nodes SET vault_path=replace(vault_path, ?, ?)", (NEW_FOLDER, OLD_FOLDER))
    ctx.db().commit()
    (ctx.vault / OLD_FOLDER / "Evidence.md").write_text("# Evidence\n", encoding="utf-8")
    assert findings_rename_needed(ctx)

    stats = rename_findings_folder(ctx)
    assert stats["moved"] >= 1 and stats["commit"]
    assert not (ctx.vault / OLD_FOLDER).exists() and (ctx.vault / note_new).exists()
    assert ctx.db().execute("SELECT COUNT(*) AS n FROM file_registry WHERE path LIKE ?",
                            (OLD_FOLDER + "%",)).fetchone()["n"] == 0
    assert ctx.db().execute("SELECT vault_path FROM nodes WHERE title='Parallel Alpha in 1 Nephi 1'"
                            ).fetchone()["vault_path"] == note_new
    body = read_text(ctx.vault / note_new)
    assert "[[Assessments#x|x]]" in body and "[[Book of Mormon Findings]]" in body
    assert "Evidence Assessments" not in body
    # the MOCs carry the old titles as aliases, so personal links still resolve
    fm, _ = md.parse_note(read_text(ctx.vault / FOLDER_EVIDENCE / "Findings.md"))
    assert fm["aliases"] == ["Evidence"]
    fm, _ = md.parse_note(read_text(ctx.vault / FOLDER_EVIDENCE / "Book of Mormon" / "Book of Mormon Findings.md"))
    assert fm["aliases"] == ["Book of Mormon Evidence"]
    assert not (ctx.vault / FOLDER_EVIDENCE / "Evidence.md").exists()
    assert REGISTRY_NOTE.endswith("40 Findings/Assessments.md")
    # idempotent
    again = rename_findings_folder(ctx)
    assert again.get("skipped")
