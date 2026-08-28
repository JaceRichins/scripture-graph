"""Importer for the standard works from the public-domain scriptures-json corpus.

Source: https://github.com/bcbooks/scriptures-json (KJV + LDS standard works
text, public domain). Files live in sources/downloads/scriptures-json/.

Scripture text is IMMUTABLE once imported: verses are stored verbatim (only
whitespace-normalized) and every downstream representation is derived from
these rows. A changed source file triggers a re-import and a corpus version
bump; nothing else may modify verse text.
"""
from __future__ import annotations

from pathlib import Path

from scripturegraph import booksdata
from scripturegraph.booksdata import BY_LDS_SLUG, Book, chapter_slug, chapter_title, verse_slug
from scripturegraph.context import Ctx
from scripturegraph.util import json_read, normalize_ws, now_iso, sha256_file, sha256_text

VOLUME_FILES = {
    "old-testament.json": booksdata.OT,
    "new-testament.json": booksdata.NT,
    "book-of-mormon.json": booksdata.BM,
    "doctrine-and-covenants.json": booksdata.DC,
    "pearl-of-great-price.json": booksdata.PGP,
}

SOURCE_ID = "standard-works-json"


def default_dir(ctx: Ctx) -> Path:
    return ctx.downloads_dir / "scriptures-json"


def _iter_books(data: dict) -> list[tuple[str, list[dict]]]:
    """Yield (lds_slug, chapters[]) pairs for one volume file."""
    out = []
    if "books" in data:
        for b in data["books"]:
            out.append((b["lds_slug"], b["chapters"]))
    elif "sections" in data:
        chapters = [{"chapter": s["section"], "verses": s["verses"]} for s in data["sections"]]
        out.append(("dc", chapters))
    return out


def _chapter_content_hash(verses: list[tuple[int, str]]) -> str:
    return sha256_text("\n".join(f"{v}\t{t}" for v, t in verses))


def import_standard_works(ctx: Ctx, src_dir: Path | None = None, force: bool = False,
                          strict: bool = True) -> dict:
    """Import (or re-import) all available volume files. Returns stats.
    strict=False skips volume-total sanity checks (test fixtures)."""
    src_dir = Path(src_dir or default_dir(ctx))
    db = ctx.db()
    stats = {"volumes": 0, "books": 0, "chapters": 0, "verses": 0, "changed": False,
             "missing_files": []}

    file_hashes = {}
    for fname in VOLUME_FILES:
        p = src_dir / fname
        if p.exists():
            file_hashes[fname] = sha256_file(p)
        else:
            stats["missing_files"].append(fname)

    combined = sha256_text("|".join(f"{k}:{v}" for k, v in sorted(file_hashes.items())))
    prev = db.execute("SELECT content_hash FROM sources WHERE source_id=?", (SOURCE_ID,)).fetchone()
    unchanged = prev is not None and prev["content_hash"] == combined
    have_rows = db.execute("SELECT COUNT(*) AS n FROM verses").fetchone()["n"] > 0
    if unchanged and have_rows and not force:
        ctx.log.info("scriptures.import.skip", reason="unchanged")
        stats["skipped"] = True
        return stats

    for fname, volume in VOLUME_FILES.items():
        p = src_dir / fname
        if not p.exists():
            continue
        data = json_read(p)
        stats["volumes"] += 1
        for lds_slug, chapters in _iter_books(data):
            book = BY_LDS_SLUG.get(lds_slug)
            if book is None:
                ctx.log.warn("scriptures.import.unknown_book", lds_slug=lds_slug, file=fname)
                continue
            _import_book(ctx, book, chapters, stats)
            stats["books"] += 1

    # sanity: chapter totals per imported volume
    if strict:
        for volume, expected in booksdata.EXPECTED_VOLUME_CHAPTERS.items():
            got = db.execute(
                "SELECT COUNT(*) AS n FROM chapters c JOIN books b ON b.slug=c.book_slug "
                "WHERE b.volume=?", (volume,)).fetchone()["n"]
            if got and got != expected:
                raise RuntimeError(
                    f"import sanity check failed: {volume} has {got} chapters, expected {expected}")

    db.execute(
        "INSERT INTO sources(source_id,name,type,provider,authority_category,license_notes,"
        "acquisition_method,local_path,source_url,last_imported,content_hash,status,coverage,notes) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(source_id) DO UPDATE SET last_imported=excluded.last_imported, "
        "content_hash=excluded.content_hash, status=excluded.status, local_path=excluded.local_path",
        (SOURCE_ID, "Standard Works (scriptures-json)", "scripture", "bcbooks/scriptures-json", 1,
         "Public-domain scripture text (KJV; LDS standard works text)", "download",
         str(src_dir), "https://github.com/bcbooks/scriptures-json", now_iso(), combined,
         "imported", "OT, NT, BoM, D&C 1-138, PoGP",
         "Official Declarations 1-2 and chapter study aids are not in this corpus."))
    db.commit()
    stats["chapters"] = db.execute("SELECT COUNT(*) AS n FROM chapters").fetchone()["n"]
    stats["verses"] = db.execute("SELECT COUNT(*) AS n FROM verses").fetchone()["n"]
    stats["changed"] = True
    ctx.log.info("scriptures.import.done", **{k: v for k, v in stats.items() if k != "missing_files"})
    return stats


def _import_book(ctx: Ctx, book: Book, chapters: list[dict], stats: dict) -> None:
    db = ctx.db()
    db.execute(
        "INSERT INTO books(slug,lds_slug,volume,name,position,num_chapters) VALUES(?,?,?,?,?,?) "
        "ON CONFLICT(slug) DO UPDATE SET num_chapters=excluded.num_chapters",
        (book.slug, book.lds_slug, book.volume, book.name, book.order, len(chapters)))
    db.execute(
        "INSERT INTO nodes(id,node_type,title,created_at,updated_at) VALUES(?,?,?,?,?) "
        "ON CONFLICT(id) DO NOTHING",
        (f"book:{book.slug}", "book", book.name, now_iso(), now_iso()))
    if len(chapters) != book.chapters:
        ctx.log.warn("scriptures.import.chapter_count", book=book.name,
                     got=len(chapters), expected=book.chapters)

    for ch in chapters:
        n = int(ch["chapter"])
        cslug = chapter_slug(book, n)
        title = chapter_title(book, n)
        verses = []
        for v in ch["verses"]:
            vn = int(v["verse"])
            text = normalize_ws(str(v["text"]))
            verses.append((vn, text))
        db.execute(
            "INSERT INTO chapters(slug,book_slug,chapter,title,num_verses,text_hash) "
            "VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(slug) DO UPDATE SET num_verses=excluded.num_verses, "
            "text_hash=excluded.text_hash",
            (cslug, book.slug, n, title, len(verses), _chapter_content_hash(verses)))
        db.execute(
            "INSERT INTO nodes(id,node_type,title,created_at,updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(id) DO NOTHING",
            (f"chapter:{cslug}", "chapter", title, now_iso(), now_iso()))
        for vn, text in verses:
            vslug = verse_slug(book, n, vn)
            db.execute(
                "INSERT INTO verses(slug,chapter_slug,verse,text) VALUES(?,?,?,?) "
                "ON CONFLICT(slug) DO UPDATE SET text=excluded.text",
                (vslug, cslug, vn, text))
            db.execute(
                "INSERT INTO chunks(owner_type,owner_id,seq,text,text_hash) VALUES(?,?,?,?,?) "
                "ON CONFLICT(owner_type,owner_id,seq) DO UPDATE SET "
                "text=excluded.text, text_hash=excluded.text_hash",
                ("verse", vslug, 0, text, sha256_text(text)))
    db.commit()
