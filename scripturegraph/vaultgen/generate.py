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

FOLDER_SCRIPTURES = "01 Scriptures"
FOLDER_CANONICAL = f"{FOLDER_SCRIPTURES}/Canonical"
FOLDER_GUIDES = f"{FOLDER_SCRIPTURES}/Study Guides"
FOLDER_TOPICS = "02 Gospel Topics"
FOLDER_PEOPLE = "03 People"
FOLDER_PLACES = "04 Places"
FOLDER_EVENTS = "05 Events"
FOLDER_DOCTRINES = "06 Doctrines"
FOLDER_CONFERENCE = "10 General Conference"
FOLDER_JSP = "20 Joseph Smith Papers"
FOLDER_HISTORY = "30 Church History"
FOLDER_EVIDENCE = "40 Evidence"
FOLDER_QUESTIONS = "50 Questions"
FOLDER_SCHOLARSHIP = "60 Scholarship"
FOLDER_AI_GUIDES = "70 AI Study Guides"
FOLDER_PERSONAL = "80 Personal Notes"
FOLDER_PERSONAL_SCRIPTURES = f"{FOLDER_PERSONAL}/Scriptures"
FOLDER_SOURCES = "90 Sources"
FOLDER_SYSTEM = "00 System"

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
    return f"{FOLDER_CANONICAL}/{book.volume}/{book.name}"


def guides_dir(book: Book) -> str:
    return f"{FOLDER_GUIDES}/{book.volume}/{book.name}"


def personal_dir(book: Book) -> str:
    return f"{FOLDER_PERSONAL_SCRIPTURES}/{book.volume}/{book.name}"


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
    body = f"""# {title} — My Study

## Scripture

![[{title}]]

## Scripture Graph

![[{study_title(book, chapter)}]]

## My Notes

"""
    return md.build_note(fm, body)


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

## Evidence & scholarship
- {md.wikilink('Evidence')} — literary, linguistic, historical, archaeological
- {md.wikilink('Book of Mormon Evidence')} · {md.wikilink('Bible Evidence')} · {md.wikilink('Restoration Evidence')}
- {md.wikilink('Scholarship')}

## History
- {md.wikilink('General Conference')}
- {md.wikilink('Joseph Smith Papers')}
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
            "newFileFolderPath": "80 Personal Notes",
            "attachmentFolderPath": "80 Personal Notes/Attachments",
            "useMarkdownLinks": False,
            "showUnsupportedFiles": False,
        }, indent=2))
    appearance = obs / "appearance.json"
    if not appearance.exists():
        atomic_write_text(appearance, json.dumps(
            {"enabledCssSnippets": ["scripture-graph"]}, indent=2))
    snippets = obs / "snippets"
    snippets.mkdir(exist_ok=True)
    css = res.files("scripturegraph").joinpath("assets/obsidian/snippets/scripture-graph.css")
    atomic_write_text(snippets / "scripture-graph.css", css.read_text(encoding="utf-8"))
    # bundled plugin: highlight/notes overlay (data.json = user data, preserved)
    plug_src = res.files("scripturegraph").joinpath(
        "assets/obsidian/plugins/scripture-graph-annotate")
    plug_dst = obs / "plugins" / "scripture-graph-annotate"
    plug_dst.mkdir(parents=True, exist_ok=True)
    for entry in plug_src.iterdir():
        if entry.name != "data.json":
            atomic_write_text(plug_dst / entry.name, entry.read_text(encoding="utf-8"))
    cp = obs / "community-plugins.json"
    if not cp.exists():
        atomic_write_text(cp, json.dumps(["scripture-graph-annotate"], indent=2))


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
    for volume, books in vol_books.items():
        if books and record_file(ctx, f"{FOLDER_GUIDES}/{volume}/{volume}.md", "moc",
                                 "generator", None, render_volume_moc(volume, books)):
            stats["indexes_written"] += 1
    record_file(ctx, f"{FOLDER_SCRIPTURES}/Scriptures.md", "moc", "generator", None,
                render_scriptures_moc())
    db.commit()
    ctx.log.info("vault.generate.scriptures", **stats)
    return stats


def generate_framework(ctx: Ctx) -> None:
    """Home note, folder MOCs, personal-notes README, evidence tree, config."""
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
        f"{FOLDER_CONFERENCE}/General Conference.md": _simple_moc(
            "General Conference",
            ["Conference talks, organized by year/session once imported.",
             "", "> [!info] Corpus status", "> See " + md.wikilink("Status") +
             " — drop official EPUB/HTML conference files into `sources/drop/conference/` "
             "and run `scripturegraph ingest`."]),
        f"{FOLDER_JSP}/Joseph Smith Papers.md": _simple_moc(
            "Joseph Smith Papers",
            ["Reference records and (where legitimately available) documents related to",
             "the Joseph Smith Papers. Respecting site terms, bulk scraping is not used;",
             "place permitted local packages in `sources/drop/jsp/`."]),
        f"{FOLDER_HISTORY}/Church History.md": _simple_moc(
            "Church History", ["Church history narratives, documents, and context notes."]),
        f"{FOLDER_EVIDENCE}/Evidence.md": _simple_moc(
            "Evidence",
            [f"- {md.wikilink('Book of Mormon Evidence')}",
             f"- {md.wikilink('Bible Evidence')}",
             f"- {md.wikilink('Restoration Evidence')}", "",
             "Every evidence note carries explicit scores: claim confidence, evidence",
             "strength, study relevance, source quality, and consensus status — see",
             md.wikilink("AI-CONSTITUTION") + "."]),
        f"{FOLDER_EVIDENCE}/Book of Mormon/Book of Mormon Evidence.md": _simple_moc(
            "Book of Mormon Evidence",
            ["Chiasmus · Hebraisms · Literary · Names · Geography · Archaeology ·",
             "Ancient Culture · Translation"]),
        f"{FOLDER_EVIDENCE}/Bible/Bible Evidence.md": _simple_moc(
            "Bible Evidence",
            ["Manuscripts · Textual Criticism · Languages · Archaeology ·",
             "Historical Context · Literary"]),
        f"{FOLDER_EVIDENCE}/Restoration/Restoration Evidence.md": _simple_moc(
            "Restoration Evidence",
            ["Witnesses, documents, and historical evidence bearing on the Restoration."]),
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
