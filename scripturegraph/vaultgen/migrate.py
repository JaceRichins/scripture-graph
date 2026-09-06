"""One-off vault migrations that software can do safely — inside a git
transaction, with the file registry and the graph kept in step.

The first one: `40 Evidence` → `40 Findings` (2026-09-06). "Evidence" is a
verdict word — evidence is *for* or *against* something — and most of what
the folder holds is illumination that makes no such claim. The folder, its
MOC pages and the registry note are renamed; the old titles stay as aliases
so a `[[Evidence]]` link in anyone's personal notes still resolves, because
the engine never rewrites personal notes.
"""
from __future__ import annotations

import os
import re
import shutil

from scripturegraph import gitops
from scripturegraph.context import Ctx
from scripturegraph.util import atomic_write_text, now_iso, read_text
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import (FOLDER_EVIDENCE, FOLDER_JSP, FOLDER_LIBRARY,
                                              FOLDER_PROPHETS, FOLDER_QUESTIONS,
                                              generate_framework, record_file)

OLD_FOLDER = f"{FOLDER_LIBRARY}/40 Evidence"
NEW_FOLDER = FOLDER_EVIDENCE            # .../40 Findings
OLD_MOCS = {"Evidence.md": "Findings.md",
            "Book of Mormon/Book of Mormon Evidence.md": "Book of Mormon/Book of Mormon Findings.md",
            "Bible/Bible Evidence.md": "Bible/Bible Findings.md",
            "Restoration/Restoration Evidence.md": "Restoration/Restoration Findings.md",
            "Evidence Assessments.md": "Assessments.md"}
# wiki-link targets whose pages were renamed (old title → new title)
LINK_RENAMES = {"Evidence": "Findings", "Book of Mormon Evidence": "Book of Mormon Findings",
                "Bible Evidence": "Bible Findings", "Restoration Evidence": "Restoration Findings",
                "Evidence Assessments": "Assessments"}
_LINK_RE = re.compile(r"\[\[(" + "|".join(re.escape(k) for k in LINK_RENAMES) + r")(?=[\]|#])")


def _relink(text: str) -> str:
    return _LINK_RE.sub(lambda m: "[[" + LINK_RENAMES[m.group(1)], text)


def findings_rename_needed(ctx: Ctx) -> bool:
    return (ctx.vault / OLD_FOLDER).exists() and not (ctx.vault / NEW_FOLDER).exists()


def rename_findings_folder(ctx: Ctx) -> dict:
    """Move `40 Evidence` to `40 Findings`; re-point the file registry, the
    graph's vault paths and every managed wiki-link; regenerate the MOCs.
    Idempotent: a vault already on the new name is left alone. Caller holds
    the engine lock."""
    db = ctx.db()
    stats = {"moved": 0, "registry": 0, "nodes": 0, "relinked": 0, "mocs_removed": 0}
    if not findings_rename_needed(ctx):
        return {**stats, "skipped": "already on the new name" if (ctx.vault / NEW_FOLDER).exists()
                else "no findings folder"}
    gitops.checkpoint(ctx, "before findings rename")
    try:
        src, dst = ctx.vault / OLD_FOLDER, ctx.vault / NEW_FOLDER
        # the old MOC pages are regenerated under their new names below
        for old in OLD_MOCS:
            p = src / old
            if p.exists():
                p.unlink()
                db.execute("DELETE FROM file_registry WHERE path=?", (f"{OLD_FOLDER}/{old}",))
                stats["mocs_removed"] += 1
        shutil.move(str(src), str(dst))
        stats["moved"] = sum(1 for _r, _d, files in os.walk(dst) for f in files if f.endswith(".md"))
        old_prefix, new_prefix = OLD_FOLDER + "/", NEW_FOLDER + "/"
        stats["registry"] = db.execute(
            "UPDATE file_registry SET path = ? || substr(path, ?) WHERE path LIKE ?",
            (new_prefix, len(old_prefix) + 1, old_prefix + "%")).rowcount
        stats["nodes"] = db.execute(
            "UPDATE nodes SET vault_path = ? || substr(vault_path, ?), updated_at=? WHERE vault_path LIKE ?",
            (new_prefix, len(old_prefix) + 1, now_iso(), old_prefix + "%")).rowcount
        # managed pages that link to the renamed titles: the findings notes
        # themselves (every calibrated note cites the registry), the question
        # pages and the home note. Personal notes are never touched.
        targets = [p for p in dst.rglob("*.md")]
        qdir = ctx.vault / FOLDER_QUESTIONS
        if qdir.exists():
            targets += list(qdir.glob("*.md"))
        home = ctx.vault / "Scripture Graph Home.md"
        if home.exists():
            targets.append(home)
        for p in targets:
            text = read_text(p)
            new = _relink(text).replace(OLD_FOLDER, NEW_FOLDER)
            if new != text:
                atomic_write_text(p, new)
                rel = p.relative_to(ctx.vault).as_posix()
                row = db.execute("SELECT path FROM file_registry WHERE path=?", (rel,)).fetchone()
                if row:
                    from scripturegraph.vaultgen.patch import refresh_registry_hash
                    refresh_registry_hash(ctx, rel)
                stats["relinked"] += 1
        db.commit()
        generate_framework(ctx)          # the new MOCs, with the old titles as aliases
        from scripturegraph.agents.calibrate import REGISTRY_NOTE, render_registry_note
        if db.execute("SELECT COUNT(*) AS n FROM issues").fetchone()["n"]:
            record_file(ctx, REGISTRY_NOTE, "moc", "librarian", None,
                        mdkit.build_note({"ownership": "system", "mutable": "ai", "content_type": "moc",
                                          "aliases": ["Evidence Assessments"]},
                                         render_registry_note(ctx)))
        db.commit()
    except Exception as e:  # noqa: BLE001 — roll back BOTH stores
        gitops.hard_restore(ctx)
        db.rollback()
        raise RuntimeError(f"findings rename failed and was rolled back: {e}") from e
    stats["commit"] = gitops.commit_all(
        ctx, f"vault: 40 Evidence → 40 Findings ({stats['moved']} notes; old titles kept as aliases)")
    ctx.log.info("vault.findings_renamed", **{k: v for k, v in stats.items() if k != "commit"})
    return stats


# ---------------------------------------------- Joseph Smith Papers -> Words of the Prophets

OLD_JSP = f"{FOLDER_LIBRARY}/20 Joseph Smith Papers"


def prophets_rename_needed(ctx: Ctx) -> bool:
    return (ctx.vault / OLD_JSP).exists() and not (ctx.vault / FOLDER_PROPHETS).exists()


def rename_prophets_folder(ctx: Ctx) -> dict:
    """`20 Joseph Smith Papers` becomes one shelf inside `20 Words of the
    Prophets`. The eight reference records move; the registry and the graph
    follow; the new MOC is generated. Idempotent; caller holds the lock."""
    db = ctx.db()
    stats = {"moved": 0, "registry": 0, "nodes": 0}
    if not prophets_rename_needed(ctx):
        return {**stats, "skipped": "already on the new name" if (ctx.vault / FOLDER_PROPHETS).exists()
                else "no JSP folder"}
    gitops.checkpoint(ctx, "before words-of-the-prophets rename")
    try:
        dst = ctx.vault / FOLDER_JSP
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(ctx.vault / OLD_JSP), str(dst))
        stats["moved"] = sum(1 for _r, _d, files in os.walk(dst) for f in files if f.endswith(".md"))
        old_prefix, new_prefix = OLD_JSP + "/", FOLDER_JSP + "/"
        stats["registry"] = db.execute(
            "UPDATE file_registry SET path = ? || substr(path, ?) WHERE path LIKE ?",
            (new_prefix, len(old_prefix) + 1, old_prefix + "%")).rowcount
        stats["nodes"] = db.execute(
            "UPDATE nodes SET vault_path = ? || substr(vault_path, ?), updated_at=? WHERE vault_path LIKE ?",
            (new_prefix, len(old_prefix) + 1, now_iso(), old_prefix + "%")).rowcount
        db.commit()
        generate_framework(ctx)
        db.commit()
    except Exception as e:  # noqa: BLE001
        gitops.hard_restore(ctx)
        db.rollback()
        raise RuntimeError(f"prophets rename failed and was rolled back: {e}") from e
    stats["commit"] = gitops.commit_all(
        ctx, "vault: 20 Joseph Smith Papers → 20 Words of the Prophets (JSP records one shelf inside)")
    ctx.log.info("vault.prophets_renamed", **{k: v for k, v in stats.items() if k != "commit"})
    return stats
