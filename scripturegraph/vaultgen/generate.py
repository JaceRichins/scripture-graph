"""Vault generation: canonical scripture, study-guide stubs, personal scaffolds,
MOCs, and Obsidian config.

CONTENT OWNERSHIP CLASSES (see 00 System/AI-CONSTITUTION.md):

1. CANONICAL   — 01 Scriptures/Canonical/…    ownership: canonical, mutable: false
   Pure verified scripture text + structural metadata + block IDs. Derived
   only from the immutable database text; hash-tracked; best-effort Windows
   read-only attribute; auto-restored from the verified source on drift.
   No AI patch may ever touch these files (enforced in patch layer + validation).

2. SYSTEM      — study guides, entity/topic/evidence/question notes, MOCs
   ownership: system, mutable: ai. The engine maintains them autonomously;
   librarian patches may only rewrite marker interiors.

3. PERSONAL    — 80 Personal Notes/…           ownership: personal, mutable: user
   Sacred user data. The engine creates one-time chapter scaffolds
   (transcluding scripture + study guide) and after that NEVER writes here.
   Personal notes are still read, indexed, embedded, and linked TO.
"""
from __future__ import annotations

import importlib.resources as res
import os
import stat
from pathlib import Path

from scripturegraph.booksdata import BOOKS, VOLUMES, Book, chapter_title
from scripturegraph.context import Ctx
from scripturegraph.util import atomic_write_text, now_iso, read_text, sha256_text
from scripturegraph.vaultgen import md

# Everything the engine maintains lives under ONE root folder so vault
# navigation (especially mobile) is: your space ("Library") + the engine's
# "AI Library". Humans read the AI Library; only the engine writes it.
FOLDER_LIBRARY = "AI Library"
FOLDER_SCRIPTURES = f"{FOLDER_LIBRARY}/01 Scriptures"
FOLDER_CANONICAL = f"{FOLDER_SCRIPTURES}/Canonical"
FOLDER_GUIDES = f"{FOLDER_SCRIPTURES}/Study Guides"
FOLDER_TOPICS = f"{FOLDER_LIBRARY}/02 Gospel Topics"
FOLDER_PEOPLE = f"{FOLDER_LIBRARY}/03 People"
FOLDER_PLACES = f"{FOLDER_LIBRARY}/04 Places"
FOLDER_EVENTS = f"{FOLDER_LIBRARY}/05 Events"
FOLDER_DOCTRINES = f"{FOLDER_LIBRARY}/06 Doctrines"
FOLDER_CFM = f"{FOLDER_LIBRARY}/07 Come Follow Me"
FOLDER_CONFERENCE = f"{FOLDER_LIBRARY}/10 General Conference"
# Words of the Prophets: teachings, journals and writings, periodicals, the
# JSP reference records, historical blessings -- everything the prophets said
# that the vault may keep (corpus/prophets.py). Renamed from "20 Joseph Smith
# Papers" 2026-09-06; the JSP records are one shelf inside it.
# ...and it lives under Church History: one door on the shelf, tiles inside
# (owner's direction, 2026-09-06). Saints has its own folder for its volumes.
FOLDER_PROPHETS = f"{FOLDER_LIBRARY}/30 Church History/Words of the Prophets"
FOLDER_JSP = f"{FOLDER_PROPHETS}/Joseph Smith Papers"
FOLDER_SAINTS = f"{FOLDER_LIBRARY}/30 Church History/Saints"
FOLDER_HISTORY = f"{FOLDER_LIBRARY}/30 Church History"
# "Findings" -- what the reading found. The old name, "Evidence", carried a
# verdict in the word (evidence is FOR or AGAINST something) and most of what
# lives here is illumination that makes no such claim. The constant keeps its
# name so nothing else has to change; the folder and its pages are Findings.
FOLDER_EVIDENCE = f"{FOLDER_LIBRARY}/40 Findings"
FOLDER_FINDINGS = FOLDER_EVIDENCE
FINDINGS_MOC = "Findings"
CORPUS_FINDINGS_MOC = {"Book of Mormon": "Book of Mormon Findings", "Bible": "Bible Findings",
                       "Restoration": "Restoration Findings"}
FOLDER_QUESTIONS = f"{FOLDER_LIBRARY}/50 Questions"
FOLDER_SCHOLARSHIP = f"{FOLDER_LIBRARY}/60 Scholarship"
FOLDER_AI_GUIDES = f"{FOLDER_LIBRARY}/70 AI Study Guides"
FOLDER_PERSONAL = "Library"
FOLDER_PERSONAL_SCRIPTURES = f"{FOLDER_PERSONAL}/Scriptures"
FOLDER_SOURCES = f"{FOLDER_LIBRARY}/90 Sources"
FOLDER_SYSTEM = f"{FOLDER_LIBRARY}/00 System"

EVIDENCE_SUBFOLDERS = [
    "Book of Mormon/Chiasmus", "Book of Mormon/Hebraisms", "Book of Mormon/Literary",
    "Book of Mormon/Names", "Book of Mormon/Geography", "Book of Mormon/Archaeology",
    "Book of Mormon/Ancient Culture", "Book of Mormon/Translation",
    "Bible/Manuscripts", "Bible/Textual Criticism", "Bible/Languages",
    "Bible/Archaeology", "Bible/Historical Context", "Bible/Literary",
    "Restoration",
]

# (marker-name, heading) — headings live OUTSIDE markers; content inside.
STUDY_SECTIONS: list[tuple[str, str]] = [
    ("overview", "Overview"),
    ("structure", "Structure & Setting"),
    ("people", "People"),
    ("places", "Places"),
    ("related-scriptures", "Related Scriptures"),
    ("topics", "Gospel Topics"),
    ("doctrines", "Doctrines & Principles"),
    ("conference", "General Conference"),
    ("history", "Church History"),
    ("language", "Language & Text"),
    ("literary", "Literary Features"),
    ("evidence", "Evidence & Easter Eggs"),
    ("questions", "Questions Worth Studying"),
    ("further-study", "Further Study"),
]


# --------------------------------------------------------------------- paths

def canonical_dir(book: Book) -> str:
    from scripturegraph.booksdata import book_dirname, volume_dirname
    return f"{FOLDER_CANONICAL}/{volume_dirname(book.volume)}/{book_dirname(book)}"


def guides_dir(book: Book) -> str:
    from scripturegraph.booksdata import book_dirname, volume_dirname
    return f"{FOLDER_GUIDES}/{volume_dirname(book.volume)}/{book_dirname(book)}"


def personal_dir(book: Book) -> str:
    from scripturegraph.booksdata import book_dirname, volume_dirname
    return (f"{FOLDER_PERSONAL_SCRIPTURES}/{volume_dirname(book.volume)}"
            f"/{book_dirname(book)}")


def scripture_relpath(book: Book, chapter: int) -> str:
    return f"{canonical_dir(book)}/{chapter_title(book, chapter)}.md"


def study_title(book: Book, chapter: int) -> str:
    return f"{chapter_title(book, chapter)} - Study Guide"


def study_relpath(book: Book, chapter: int) -> str:
    return f"{guides_dir(book)}/{study_title(book, chapter)}.md"


def personal_title(book: Book, chapter: int) -> str:
    return f"{chapter_title(book, chapter)} - My Notes"


def personal_relpath(book: Book, chapter: int) -> str:
    return f"{personal_dir(book)}/{personal_title(book, chapter)}.md"


def is_canonical_path(relpath: str) -> bool:
    return relpath.replace("\\", "/").startswith(FOLDER_CANONICAL + "/")


def is_personal_path(relpath: str) -> bool:
    return relpath.replace("\\", "/").startswith(FOLDER_PERSONAL + "/")


# ------------------------------------------------------------- file writing

def _set_readonly(path: Path, readonly: bool) -> None:
    try:
        mode = path.stat().st_mode
        if readonly:
            os.chmod(path, mode & ~(stat.S_IWRITE | stat.S_IWGRP | stat.S_IWOTH))
        else:
            os.chmod(path, mode | stat.S_IWRITE)
    except OSError:
        pass  # best-effort; hash validation is the real guard


def record_file(ctx: Ctx, relpath: str, kind: str, managed_by: str,
                node_id: str | None, content: str, readonly: bool = False) -> bool:
    """Write a vault file if changed; update file_registry. Returns True if written."""
    relpath = relpath.replace("\\", "/")
    h = sha256_text(content)
    db = ctx.db()
    row = db.execute("SELECT content_hash FROM file_registry WHERE path=?", (relpath,)).fetchone()
    abspath = ctx.vault / relpath
    if row and row["content_hash"] == h and abspath.exists():
        return False
    if abspath.exists():
        _set_readonly(abspath, False)
    atomic_write_text(abspath, content)
    if readonly:
        _set_readonly(abspath, True)
    db.execute(
        "INSERT INTO file_registry(path,kind,managed_by,node_id,content_hash,updated_at) "
        "VALUES(?,?,?,?,?,?) "
        "ON CONFLICT(path) DO UPDATE SET kind=excluded.kind, managed_by=excluded.managed_by, "
        "node_id=excluded.node_id, content_hash=excluded.content_hash, updated_at=excluded.updated_at",
        (relpath, kind, managed_by, node_id, h, now_iso()))
    return True


def write_once(ctx: Ctx, relpath: str, kind: str, managed_by: str, content: str,
               node_id: str | None = None) -> bool:
    """Create a file only if it never existed. If the registry remembers it
    (even deleted by the user), it is NOT recreated — deletions are respected."""
    relpath = relpath.replace("\\", "/")
    abspath = ctx.vault / relpath
    if abspath.exists():
        return False
    row = ctx.db().execute("SELECT 1 FROM file_registry WHERE path=?", (relpath,)).fetchone()
    if row is not None:
        return False
    return record_file(ctx, relpath, kind, managed_by, node_id, content)


def stamp_node_ids(ctx: Ctx) -> int:
    """Backfill `sg-id` frontmatter on librarian-owned entity pages (§39).

    Plugin annotations anchored to `node:<sg-id>` then survive renames. Never
    touches canonical scripture (readonly + hashed) or personal files.
    """
    db = ctx.db()
    rows = db.execute(
        "SELECT path, kind, managed_by, node_id FROM file_registry "
        "WHERE node_id IS NOT NULL AND node_id NOT LIKE 'chapter:%' "
        "AND kind IN ('topic','person','place','event','evidence','question',"
        "'practice','source')").fetchall()
    stamped = 0
    for r in rows:
        abspath = ctx.vault / r["path"]
        if not abspath.exists():
            continue
        text = read_text(abspath)
        fm, body = md.parse_note(text)
        if fm.get("sg-id") == r["node_id"]:
            continue
        fm["sg-id"] = r["node_id"]
        if record_file(ctx, r["path"], r["kind"], r["managed_by"], r["node_id"],
                       md.build_note(fm, body)):
            stamped += 1
    db.commit()
    return stamped


def refresh_registry_hash(ctx: Ctx, relpath: str) -> None:
    """Re-hash a file after a legitimate managed edit (librarian patches)."""
    relpath = relpath.replace("\\", "/")
    abspath = ctx.vault / relpath
    if abspath.exists():
        ctx.db().execute(
            "UPDATE file_registry SET content_hash=?, updated_at=? WHERE path=?",
            (sha256_text(read_text(abspath)), now_iso(), relpath))


# ------------------------------------------------------------- scripture note

def render_scripture_note(ctx: Ctx, book: Book, chapter: int,
                          verses: list[tuple[int, str, str]],
                          prev_title: str | None, next_title: str | None) -> str:
    title = chapter_title(book, chapter)
    fm = {
        "ownership": "canonical",
        "mutable": False,
        "content_type": "scripture",
        "volume": book.volume,
        "book": book.name,
        "chapter": chapter,
        "slug": f"{book.slug}-{chapter}",
        "verses": len(verses),
        "cssclasses": ["sg-scripture"],
    }
    if book.title_prefix != book.name:
        fm["aliases"] = [f"{book.name} {chapter}"]
    lines = [f"# {title}", ""]
    for vn, text, vslug in verses:
        lines.append(f"**{vn}** {text} ^{vslug}")
        lines.append("")
    lines.append("---")
    nav = [md.wikilink(f"{title} (Annotated)", "Annotated"),
           md.wikilink(study_title(book, chapter), "Study guide"),
           md.wikilink(personal_title(book, chapter), "My notes"),
           md.wikilink(book.name)]
    if prev_title:
        nav.insert(0, md.wikilink(prev_title, f"← {prev_title}"))
    if next_title:
        nav.append(md.wikilink(next_title, f"{next_title} →"))
    lines.append(" · ".join(nav))
    return md.build_note(fm, "\n".join(lines))


def render_study_stub(book: Book, chapter: int) -> str:
    title = chapter_title(book, chapter)
    fm = {
        "ownership": "system",
        "mutable": "ai",
        "content_type": "study-guide",
        "volume": book.volume,
        "book": book.name,
        "chapter": chapter,
        "slug": f"{book.slug}-{chapter}",
        "corpus_version_reviewed": 0,
        "cssclasses": ["sg-study"],
    }
    lines = [f"# {title} — Study Guide", "",
             f"Scripture: {md.wikilink(title)} · "
             f"My notes: {md.wikilink(personal_title(book, chapter))}", ""]
    for name, heading in STUDY_SECTIONS:
        lines.append(f"## {heading}")
        lines.append(md.marker_block(name))
        lines.append("")
    return md.build_note(fm, "\n".join(lines))


def render_personal_scaffold(book: Book, chapter: int) -> str:
    title = chapter_title(book, chapter)
    fm = {
        "ownership": "personal",
        "mutable": "user",
        "content_type": "personal-notes",
        "volume": book.volume,
        "book": book.name,
        "chapter": chapter,
        "slug": f"{book.slug}-{chapter}",
        "cssclasses": ["sg-personal"],
    }
    prev_nav = (f"[[{personal_title(book, chapter - 1)}|◀ {chapter_title(book, chapter - 1)}]]"
                if chapter > 1 else f"[[{book.name}|◀ {book.name}]]")
    next_nav = (f"[[{personal_title(book, chapter + 1)}|{chapter_title(book, chapter + 1)} ▶]]"
                if chapter < book.chapters else f"[[{book.name}|{book.name} ▶]]")
    # Reading-first: the page opens straight into scripture (the embed's own
    # title/H1 are hidden by the plugin CSS); navigation folds away in a
    # collapsed callout; My Notes stays LAST so the ✍️ dialog appends there.
    body = f"""# {title} — My Study

> [!tip]- Views & navigation
> [[{title}|📜 Scripture only]] · [[{title} (Annotated)|🔍 Annotated]] · \
[[{study_title(book, chapter)}|📖 Study guide]] · [[{book.name}|📚 {book.name}]] · \
[[Study Hub|🏠 Study Hub]]

![[{title}]]

{prev_nav} · {next_nav}

## 📖 Study Guide

![[{study_title(book, chapter)}]]

## ✍️ My Notes

"""
    return md.build_note(fm, body)


def upgrade_untouched_scaffolds(ctx: Ctx) -> dict:
    """Re-render personal My-Study scaffolds the user has NEVER edited
    (current file hash == the hash recorded at creation). Any file the user
    touched — even one keystroke — is left strictly alone."""
    from scripturegraph.booksdata import BY_SLUG
    db = ctx.db()
    stats = {"upgraded": 0, "user_edited_kept": 0, "missing": 0}
    for row in db.execute(
            "SELECT c.slug, c.book_slug, c.chapter FROM chapters c").fetchall():
        book = BY_SLUG[row["book_slug"]]
        rel = personal_relpath(book, row["chapter"])
        reg = db.execute("SELECT content_hash FROM file_registry WHERE path=?",
                         (rel,)).fetchone()
        p = ctx.vault / rel
        if not p.exists():
            stats["missing"] += 1
            continue
        if reg is None or sha256_text(read_text(p)) != reg["content_hash"]:
            stats["user_edited_kept"] += 1
            continue
        new = render_personal_scaffold(book, row["chapter"])
        if sha256_text(new) != reg["content_hash"]:
            record_file(ctx, rel, "personal", "human", f"chapter:{row['slug']}", new)
            stats["upgraded"] += 1
    db.commit()
    ctx.log.info("personal.scaffolds_upgraded", **stats)
    return stats


# ------------------------------------------------------------- index notes

def render_book_index(ctx: Ctx, book: Book, chapters: list[int]) -> str:
    fm = {"ownership": "system", "mutable": "ai", "content_type": "book-index",
          "volume": book.volume, "book": book.name}
    aliases = [a for a in book.aliases if a != book.name][:2]
    if aliases:
        fm["aliases"] = aliases
    lines = [f"# {book.name}", "",
             f"Volume: {md.wikilink(book.volume)}", "",
             f"| {book.unit.title()} | Study | Mine |", "| --- | --- | --- |"]
    for n in chapters:
        lines.append(f"| {md.wikilink(chapter_title(book, n))} "
                     f"| {md.wikilink(study_title(book, n), 'study')} "
                     f"| {md.wikilink(personal_title(book, n), 'notes')} |")
    return md.build_note(fm, "\n".join(lines))


def render_volume_moc(volume: str, books: list[Book]) -> str:
    fm = {"ownership": "system", "mutable": "ai", "content_type": "moc", "scope": "volume"}
    lines = [f"# {volume}", "", f"Part of {md.wikilink('Scriptures')}.", ""]
    for b in books:
        lines.append(f"- {md.wikilink(b.name)} — {b.chapters} {b.unit}s")
    return md.build_note(fm, "\n".join(lines))


def render_scriptures_moc() -> str:
    fm = {"ownership": "system", "mutable": "ai", "content_type": "moc", "scope": "scriptures"}
    lines = ["# Scriptures", ""]
    for v in VOLUMES:
        lines.append(f"- {md.wikilink(v)}")
    lines += ["", "Canonical text lives under `Canonical/` (immutable); study guides under",
              "`Study Guides/`; your own chapter notes under `80 Personal Notes/Scriptures/`.",
              "", f"Home: {md.wikilink('Scripture Graph Home')}"]
    return md.build_note(fm, "\n".join(lines))


def render_home() -> str:
    fm = {"ownership": "system", "mutable": "ai", "content_type": "moc",
          "scope": "home", "cssclasses": ["sg-home"]}
    body = f"""# Scripture Graph Home

A living, AI-maintained knowledge graph for serious scripture study.

## Study
- {md.wikilink('Scriptures')} — all five standard works, verse-linkable
- Your combined study view per chapter: scripture + study guide + your notes
  (e.g. {md.wikilink('Alma 36 - My Notes', 'Alma 36 — My Study')})
- {md.wikilink('Gospel Topics')}
- {md.wikilink('People')} · {md.wikilink('Places')} · {md.wikilink('Events')}
- {md.wikilink('Questions')} — serious questions, honestly handled

## Findings & scholarship
- {md.wikilink('Findings')} — what the reading found: literary, linguistic, historical, archaeological
- {md.wikilink('Book of Mormon Findings')} · {md.wikilink('Bible Findings')} · {md.wikilink('Restoration Findings')}
- {md.wikilink('Assessments')} — the contested issues, one stable assessment each
- {md.wikilink('Scholarship')}

## History
- {md.wikilink('General Conference')}
- {md.wikilink('Words of the Prophets')}
- {md.wikilink('Church History')}

## System
- {md.wikilink('STUDY-TOOLS', 'Study Tools')} — highlighting, verse notes, protection
- {md.wikilink('Status')} — corpus, coverage, and engine state
- {md.wikilink('Graph Health')}
- {md.wikilink('README')} · {md.wikilink('ARCHITECTURE')} · {md.wikilink('AI-CONSTITUTION')}

> [!info] Ownership rules
> **Canonical scripture is immutable. AI knowledge is autonomously maintained.
> Personal writing belongs only to you.** The engine's researchers propose, a
> critic attacks, a judge decides, and only the Librarian writes — never to
> canonical text, never to `80 Personal Notes`.
"""
    return md.build_note(fm, body)


def _simple_moc(title: str, body_lines: list[str], fm_extra: dict | None = None) -> str:
    fm = {"ownership": "system", "mutable": "ai", "content_type": "moc", **(fm_extra or {})}
    return md.build_note(fm, "\n".join([f"# {title}", ""] + body_lines))


# ------------------------------------------------------------- obsidian cfg

def write_obsidian_config(ctx: Ctx) -> None:
    import json
    obs = ctx.vault / ".obsidian"
    obs.mkdir(parents=True, exist_ok=True)
    app_json = obs / "app.json"
    if not app_json.exists():
        atomic_write_text(app_json, json.dumps({
            "readableLineLength": True,
            "alwaysUpdateLinks": True,
            "newFileLocation": "folder",
            "newFileFolderPath": "Library",
            "attachmentFolderPath": "Library/Attachments",
            "useMarkdownLinks": False,
            "showUnsupportedFiles": False,
            # study tool first: every note opens in reading view; editing is
            # an explicit choice (and the plugin force-reverts AI Library)
            "defaultViewMode": "preview",
            "livePreview": True,
        }, indent=2))
    appearance = obs / "appearance.json"
    if not appearance.exists():
        atomic_write_text(appearance, json.dumps(
            {"enabledCssSnippets": ["scripture-graph"]}, indent=2))
    snippets = obs / "snippets"
    snippets.mkdir(exist_ok=True)
    css = res.files("scripturegraph").joinpath("assets/obsidian/snippets/scripture-graph.css")
    atomic_write_text(snippets / "scripture-graph.css", css.read_text(encoding="utf-8"))
    # ecosystem plugin suite (supersedes the old scripture-graph-annotate):
    # install the built bundle when present; NEVER touch data.json (shared
    # settings) — the old plugin dir is left alone so migration can read it.
    eco = ctx.vault.parent / "ecosystem" / "plugins" / "scripture-graph"
    if (eco / "dist" / "main.js").exists():
        plug_dst = obs / "plugins" / "scripture-graph"
        plug_dst.mkdir(parents=True, exist_ok=True)
        for src, name in ((eco / "manifest.json", "manifest.json"),
                          (eco / "dist" / "main.js", "main.js"),
                          (eco / "styles.css", "styles.css")):
            atomic_write_text(plug_dst / name, src.read_text(encoding="utf-8"))
    cp = obs / "community-plugins.json"
    if not cp.exists():
        atomic_write_text(cp, json.dumps(["scripture-graph"], indent=2))


# ------------------------------------------------------------- generate all

def generate_scriptures(ctx: Ctx) -> dict:
    """Write canonical notes + study stubs + personal scaffolds + indexes."""
    db = ctx.db()
    stats = {"scripture_written": 0, "stubs_written": 0, "personal_written": 0,
             "indexes_written": 0}
    from scripturegraph.booksdata import BY_SLUG
    books_rows = db.execute("SELECT slug FROM books ORDER BY position").fetchall()
    vol_books: dict[str, list[Book]] = {v: [] for v in VOLUMES}
    for br in books_rows:
        book = BY_SLUG[br["slug"]]
        vol_books[book.volume].append(book)
        chapters = [r["chapter"] for r in db.execute(
            "SELECT chapter FROM chapters WHERE book_slug=? ORDER BY chapter", (book.slug,))]
        for i, n in enumerate(chapters):
            cslug = f"{book.slug}-{n}"
            verses = [(r["verse"], r["text"], r["slug"]) for r in db.execute(
                "SELECT slug, verse, text FROM verses WHERE chapter_slug=? ORDER BY verse",
                (cslug,))]
            prev_t = chapter_title(book, chapters[i - 1]) if i > 0 else None
            next_t = chapter_title(book, chapters[i + 1]) if i + 1 < len(chapters) else None
            note = render_scripture_note(ctx, book, n, verses, prev_t, next_t)
            spath = scripture_relpath(book, n)
            if record_file(ctx, spath, "scripture", "generator", f"chapter:{cslug}", note,
                           readonly=True):
                stats["scripture_written"] += 1
            db.execute("UPDATE chapters SET file_path=? WHERE slug=?", (spath, cslug))
            db.execute("UPDATE nodes SET vault_path=?, updated_at=? WHERE id=?",
                       (spath, now_iso(), f"chapter:{cslug}"))
            if write_once(ctx, study_relpath(book, n), "study-guide", "librarian",
                          render_study_stub(book, n), f"chapter:{cslug}"):
                stats["stubs_written"] += 1
            if write_once(ctx, personal_relpath(book, n), "personal", "human",
                          render_personal_scaffold(book, n), f"chapter:{cslug}"):
                stats["personal_written"] += 1
        if record_file(ctx, f"{guides_dir(book)}/{book.name}.md", "book-index", "generator",
                       f"book:{book.slug}", render_book_index(ctx, book, chapters)):
            stats["indexes_written"] += 1
        db.execute("UPDATE nodes SET vault_path=?, updated_at=? WHERE id=?",
                   (f"{guides_dir(book)}/{book.name}.md", now_iso(), f"book:{book.slug}"))
    from scripturegraph.booksdata import volume_dirname
    for volume, books in vol_books.items():
        if books and record_file(ctx, f"{FOLDER_GUIDES}/{volume_dirname(volume)}/{volume}.md",
                                 "moc", "generator", None, render_volume_moc(volume, books)):
            stats["indexes_written"] += 1
    record_file(ctx, f"{FOLDER_SCRIPTURES}/Scriptures.md", "moc", "generator", None,
                render_scriptures_moc())
    db.commit()
    ctx.log.info("vault.generate.scriptures", **stats)
    return stats


def generate_framework(ctx: Ctx) -> None:
    """Home note, folder MOCs, personal-notes README, findings tree, config."""
    record_file(ctx, "Scripture Graph Home.md", "moc", "generator", None, render_home())

    mocs = {
        f"{FOLDER_TOPICS}/Gospel Topics.md": _simple_moc(
            "Gospel Topics",
            ["Canonical gospel-topic dossiers. The Librarian keeps names canonical;",
             "aliases redirect variants (e.g. *Atonement* → *Atonement of Jesus Christ*).",
             "", "See also " + md.wikilink("Doctrines") + "."]),
        f"{FOLDER_PEOPLE}/People.md": _simple_moc(
            "People", ["People of scripture and Church history. Generated stubs grow into",
                       "dossiers as passes run. Browse via backlinks or search."]),
        f"{FOLDER_PLACES}/Places.md": _simple_moc(
            "Places", ["Geography of scripture and the Restoration."]),
        f"{FOLDER_EVENTS}/Events.md": _simple_moc(
            "Events", ["Major events across scripture and Church history."]),
        f"{FOLDER_DOCTRINES}/Doctrines.md": _simple_moc(
            "Doctrines", ["Doctrinal statements and principle notes distilled from",
                          f"{md.wikilink('Gospel Topics')} study."]),
        f"{FOLDER_CFM}/Come Follow Me.md": _simple_moc(
            "Come Follow Me",
            ["This year's *Come, Follow Me — For Home and Church* lessons, one page each, and the",
             "week index the home page reads (" + md.wikilink("Come Follow Me", "this week") + ")."]),
        f"{FOLDER_CONFERENCE}/General Conference.md": _simple_moc(
            "General Conference",
            ["Conference talks, organized by year/session once imported.",
             "", "> [!info] Corpus status", "> See " + md.wikilink("Status") +
             " — drop official EPUB/HTML conference files into `sources/drop/conference/` "
             "and run `scripturegraph ingest`."]),
        f"{FOLDER_PROPHETS}/Words of the Prophets.md": _simple_moc(
            "Words of the Prophets",
            ["What the prophets said and wrote, from every source this vault may keep:", "",
             "- **Teachings of Presidents of the Church** — the Church's own volumes, Joseph Smith",
             "  through Gordon B. Hinckley, chapter by chapter (`Teachings of Presidents/`).",
             "- **Journals and Writings** — public-domain books by the prophets and their",
             "  contemporaries: Discourses of Brigham Young, Gospel Doctrine, Mediation and",
             "  Atonement, Leaves from My Journal, Parley P. Pratt's autobiography, and more.",
             "- **Periodicals** — the Church's own papers, 1832–1929, under",
             "  " + md.wikilink("Church History") + " → Periodicals (Times and Seasons, Millennial Star,",
             "  Nauvoo Neighbor, The Seer, Evening and Morning Star …).",
             "- " + md.wikilink("Joseph Smith Papers") + " — reference records for the JSP series;",
             "  their edited transcripts stay on their site by its terms.",
             "- " + md.wikilink("Patriarchal Blessings (historical)") + " — blessing texts found inside the",
             "  public-domain sources above, and nowhere else.", "",
             "Anything you have the right to keep — a purchased volume, a family document —",
             "goes in `sources/drop/prophets/` and is imported nightly."],
            {"aliases": ["Modern Prophets"]}),
        f"{FOLDER_JSP}/Joseph Smith Papers.md": _simple_moc(
            "Joseph Smith Papers",
            ["Reference records for the Joseph Smith Papers series. Respecting the site's",
             "terms, its edited transcripts are not copied; place permitted local packages",
             "in `sources/drop/jsp/`. The public-domain sources on the",
             md.wikilink("Words of the Prophets") + " shelf carry most of the same words."]),
        f"{FOLDER_HISTORY}/Church History.md": _simple_moc(
            "Church History",
            ["- " + md.wikilink("Saints") + " — the Church's narrative history, four volumes",
             "- " + md.wikilink("Words of the Prophets") + " — Teachings of Presidents, journals and",
             "  writings, the Joseph Smith Papers records, historical blessings",
             "- Periodicals — Times and Seasons, Millennial Star, Nauvoo Neighbor, The Seer …",
             "- Revelations in Context — the story behind each section of the D&C"]),
        f"{FOLDER_SAINTS}/Saints.md": _simple_moc(
            "Saints", ["*Saints: The Story of the Church of Jesus Christ in the Latter Days* —",
                       "four volumes, chapter by chapter."]),
        # The old titles stay as aliases: a [[Evidence]] link in anyone's
        # personal notes still resolves, and the engine never rewrites those.
        f"{FOLDER_EVIDENCE}/Findings.md": _simple_moc(
            "Findings",
            [f"- {md.wikilink('Book of Mormon Findings')}",
             f"- {md.wikilink('Bible Findings')}",
             f"- {md.wikilink('Restoration Findings')}", "",
             "What the chapter-by-chapter reading found. Most findings are",
             "*illumination* — history, geography, language, culture and science that",
             "make a passage more intelligible — and carry no verdict. A minority bear",
             "on a genuinely contested question; those are *assessments*, weighed",
             "against a named proposition and recorded once, stably, in",
             md.wikilink("Assessments") + ". Each corpus also has a cumulative page",
             "(e.g. " + md.wikilink("Book of Mormon Assessment") + ") so that findings",
             "are read together, never dismissed one at a time. The standard is in",
             md.wikilink("AI-CONSTITUTION") + "."],
            {"aliases": ["Evidence"]}),
        f"{FOLDER_EVIDENCE}/Book of Mormon/Book of Mormon Findings.md": _simple_moc(
            "Book of Mormon Findings",
            ["Chiasmus · Hebraisms · Literary · Names · Geography · Archaeology ·",
             "Ancient Culture · Translation", "",
             "Cumulative view: " + md.wikilink("Book of Mormon Assessment")],
            {"aliases": ["Book of Mormon Evidence"]}),
        f"{FOLDER_EVIDENCE}/Bible/Bible Findings.md": _simple_moc(
            "Bible Findings",
            ["Manuscripts · Textual Criticism · Languages · Archaeology ·",
             "Historical Context · Literary", "",
             "Cumulative view: " + md.wikilink("Bible Assessment")],
            {"aliases": ["Bible Evidence"]}),
        f"{FOLDER_EVIDENCE}/Restoration/Restoration Findings.md": _simple_moc(
            "Restoration Findings",
            ["Witnesses, documents, and historical findings bearing on the Restoration.", "",
             "Cumulative view: " + md.wikilink("Restoration Assessment")],
            {"aliases": ["Restoration Evidence"]}),
        f"{FOLDER_QUESTIONS}/Questions.md": _simple_moc(
            "Questions",
            ["Serious questions deserve serious, sourced answers — strongest evidence",
             "*and* strongest objections, with an honest confidence assessment."]),
        f"{FOLDER_SCHOLARSHIP}/Scholarship.md": _simple_moc(
            "Scholarship", ["Academic sources and scholarly discussion notes."]),
        f"{FOLDER_AI_GUIDES}/AI Study Guides.md": _simple_moc(
            "AI Study Guides", ["Cross-cutting synthesized guides (reading plans, thematic",
                                "deep dives) produced by the engine."]),
        f"{FOLDER_SOURCES}/Sources.md": _simple_moc(
            "Sources", ["Source registry notes and manifests. The machine registry lives in",
                        "the engine database; human-readable manifests in `manifests/`."]),
    }
    for path, content in mocs.items():
        record_file(ctx, path, "moc", "generator", None, content)

    write_once(ctx, f"{FOLDER_PERSONAL}/Personal Notes.md", "personal", "human",
               md.build_note(
                   {"ownership": "personal", "mutable": "user", "content_type": "personal-index"},
                   "# Personal Notes\n\nYour space. The engine NEVER rewrites, summarizes, "
                   "merges, reorganizes, or deletes anything here — it only reads, indexes, "
                   "and links *toward* your writing.\n\n"
                   "- `Scriptures/` mirrors the standard works with one **My Study** note per "
                   "chapter: the scripture text and the AI study guide are embedded above a "
                   "free-writing area. Study and write from there.\n"
                   "- Anything else you create in this folder is yours alone and joins the "
                   "graph automatically.\n"))
    write_once(ctx, f"{FOLDER_PERSONAL}/Study Hub.md", "personal", "human",
               md.build_note(
                   {"ownership": "personal", "mutable": "user", "content_type": "personal-hub",
                    "cssclasses": ["sg-home"]},
                   f"""# Study Hub

Your doorway to everything — this page is yours to rearrange.

## Read & study
- {md.wikilink('Scriptures')} — all five standard works
  (plain · **(Annotated)** verse-link views · study guides per chapter)
- Your chapter pages live beside this note under `Scriptures/` —
  scripture + AI study guide embedded above your own writing

## The AI knowledge graph
- {md.wikilink('Gospel Topics')} — canonical dossiers
  (+ `Essays/`, `Reference/`, `True to the Faith/`, `Bible Dictionary/`, `Topical Guide/`)
- {md.wikilink('People')} · {md.wikilink('Places')} · {md.wikilink('Events')} · {md.wikilink('Doctrines')}
- {md.wikilink('Findings')} — what the reading found, honestly weighed where it is contested
- {md.wikilink('Questions')} — hard questions, both sides sourced

## Words of the prophets & history
- {md.wikilink('General Conference')} — full talks, 2015→today (backfilling to 1971 nightly)
- {md.wikilink('Church History')} — Revelations in Context · Saints · Journal of Discourses ·
  History of the Church · Conference Reports 1897-1930
- {md.wikilink('Words of the Prophets')} — teachings, journals, periodicals, the JSP

## System
- {md.wikilink('STUDY-TOOLS', 'Study Tools')} — how highlighting & verse notes work
- {md.wikilink('Status')} — what the engine did lately · {md.wikilink('Graph Health')}
"""))
    write_once(ctx, f"{FOLDER_PERSONAL}/_Template - Chapter Study.md", "personal", "human",
               md.build_note(
                   {"ownership": "personal", "mutable": "user", "content_type": "template"},
                   "# <Chapter> — My Study\n\n## Scripture\n\n![[<Chapter>]]\n\n"
                   "## Scripture Graph\n\n![[<Chapter> - Study Guide]]\n\n## My Notes\n\n"))
    for sub in EVIDENCE_SUBFOLDERS:
        (ctx.vault / FOLDER_EVIDENCE / sub).mkdir(parents=True, exist_ok=True)
    (ctx.vault / FOLDER_SOURCES / "manifests").mkdir(parents=True, exist_ok=True)
    (ctx.vault / FOLDER_SOURCES / "source-notes").mkdir(parents=True, exist_ok=True)
    write_obsidian_config(ctx)
    ctx.db().commit()


def write_system_docs(ctx: Ctx) -> int:
    """Copy the 00 System documentation set from package assets (write-once)."""
    n = 0
    sys_assets = res.files("scripturegraph").joinpath("assets/system")
    for entry in sorted(sys_assets.iterdir(), key=lambda e: e.name):
        if entry.name.endswith(".md"):
            if write_once(ctx, f"{FOLDER_SYSTEM}/{entry.name}", "system", "human",
                          entry.read_text(encoding="utf-8")):
                n += 1
    return n
