import os
import stat

from scripturegraph.util import read_text
from scripturegraph.validation import validate_all
from scripturegraph.vaultgen import md


def test_import_and_generation(imported_ctx):
    ctx = imported_ctx
    db = ctx.db()
    assert db.execute("SELECT COUNT(*) AS n FROM chapters").fetchone()["n"] == 4
    assert db.execute("SELECT COUNT(*) AS n FROM verses").fetchone()["n"] == 9
    # canonical file exists with stable block ids + frontmatter contract
    p = ctx.vault / "AI Library/01 Scriptures/Canonical/03 Book of Mormon/01 1 Nephi/1 Nephi 3.md"
    assert p.exists()
    text = read_text(p)
    fm, body = md.parse_note(text)
    assert fm["ownership"] == "canonical" and fm["mutable"] is False
    assert "^1ne-3-7" in body
    # study stub + personal scaffold exist in mirrored trees
    assert (ctx.vault / "AI Library/01 Scriptures/Study Guides/03 Book of Mormon/01 1 Nephi/"
            "1 Nephi 3 - Study Guide.md").exists()
    my = ctx.vault / ("Library/Scriptures/03 Book of Mormon/01 1 Nephi/"
                      "1 Nephi 3 - My Notes.md")
    assert my.exists()
    assert "![[1 Nephi 3]]" in read_text(my)
    # canonical file carries the read-only attribute (best effort — assert here)
    assert not os.access(p, os.W_OK) or not (p.stat().st_mode & stat.S_IWRITE)


def test_regeneration_is_idempotent(imported_ctx):
    from scripturegraph.vaultgen.generate import generate_scriptures
    stats = generate_scriptures(imported_ctx)
    assert stats["scripture_written"] == 0  # nothing changed → nothing rewritten


def test_immutability_guard_and_restore(imported_ctx):
    ctx = imported_ctx
    p = ctx.vault / "AI Library/01 Scriptures/Canonical/03 Book of Mormon/01 1 Nephi/1 Nephi 1.md"
    os.chmod(p, p.stat().st_mode | stat.S_IWRITE)
    tampered = read_text(p).replace("goodly parents", "EVIL EDIT")
    p.write_text(tampered, encoding="utf-8")

    report = validate_all(ctx, repair=False)
    assert any(i.check == "canonical-drift" for i in report.fatal)

    report2 = validate_all(ctx, repair=True)
    assert report2.stats.get("canonical_restored", 0) >= 1
    assert "goodly parents" in read_text(p)
    # clean again afterwards
    report3 = validate_all(ctx, repair=False)
    assert not any(i.check.startswith("canonical") for i in report3.fatal)


def test_validation_catches_bad_links(imported_ctx):
    ctx = imported_ctx
    bad = ctx.vault / "AI Library/70 AI Study Guides" / "Bad Note.md"
    bad.write_text("# Bad\n\nSee [[Alma 36#^alma-36-999]] and [[No Such Note XYZ]].\n",
                   encoding="utf-8")
    from scripturegraph.validation import Report, check_files
    report = Report()
    check_files(ctx, report, paths=["AI Library/70 AI Study Guides/Bad Note.md"])
    checks = {i.check for i in report.issues}
    assert "block-link" in checks and "link" in checks
