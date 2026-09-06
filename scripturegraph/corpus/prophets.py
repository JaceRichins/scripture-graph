"""Words of the Prophets — the shelf that holds what the prophets said and
wrote, from every source the vault may legitimately keep.

Three lanes, one shelf (`AI Library/20 Words of the Prophets`):

1. TEACHINGS OF PRESIDENTS OF THE CHURCH — the Church's own curated volumes,
   Joseph Smith through Gordon B. Hinckley, chapter by chapter through the
   Gospel Library API (glib.COLLECTIONS, `teachings-*`). Copyrighted Church
   text: it lives in the private index and this private study vault under
   the same posture as Saints and the Gospel Topics essays.
2. JOURNALS & WRITINGS — public-domain books by the prophets and their
   contemporaries, from archive.org (Project Gutenberg texts where they
   exist, OCR otherwise): Discourses of Brigham Young, Gospel Doctrine,
   Mediation and Atonement, Leaves from My Journal, Parley P. Pratt's
   autobiography, Life of Heber C. Kimball, Key to the Science of Theology,
   Jenson's Biographical Encyclopedia, Richards's Compendium.
3. PERIODICALS — the Church's own papers, public domain, from archive.org's
   "Utah and the Mormons" collection: the Millennial Star (to 1929), the
   Nauvoo Neighbor, The Seer, Zion's Watchman, the Elders' Journal, the
   Evening and Morning Star, the Southern Star, the Frontier Guardian, the
   Gospel Reflector. Budgeted per night; notes beside the ones the
   Times and Seasons / Messenger and Advocate importer writes.

Plus PATRIARCHAL BLESSINGS (HISTORICAL): a gathered page of blessing texts
that appear inside the public-domain sources above — people gone a century
and more, printed by their own families and presses. Nothing is fetched for
this from anywhere else, and the drop folder (`sources/drop/prophets/`) is
where anything the owner has the right to keep goes. The Joseph Smith
Papers stay reference records (jsp_refs.py): their site's terms forbid
copying the edited transcripts, and the public-domain sources here carry
most of the same words.
"""
from __future__ import annotations

import json
import re

from scripturegraph.context import Ctx
from scripturegraph.corpus.fetchers import _archive_search_ids, _download_cached
from scripturegraph.corpus.universal import store_document
from scripturegraph.util import now_iso, sanitize_filename, sha256_text, truncate
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import FOLDER_PROPHETS, record_file

SOURCE_BOOKS = "prophet-writings"
SOURCE_PERIODICALS = "lds-periodicals"
FOLDER_WRITINGS = f"{FOLDER_PROPHETS}/Journals and Writings"
FOLDER_PERIODICALS = "AI Library/30 Church History/Periodicals"
BLESSINGS_NOTE = f"{FOLDER_PROPHETS}/Patriarchal Blessings (historical).md"
MAX_NOTE_TEXT_BYTES = 120_000

# key, archive.org identifier, title, author, year. Gutenberg-derived
# identifiers (…gut) carry clean text; the rest are scans with OCR.
BOOKS: list[tuple[str, str, str, str, str]] = [
    ("discourses-of-brigham-young", "discoursesofbrig0000john_e1s5",
     "Discourses of Brigham Young", "Brigham Young (John A. Widtsoe, comp.)", "1925"),
    ("gospel-doctrine", "gospeldoctrinese47109gut",
     "Gospel Doctrine", "Joseph F. Smith", "1919"),
    ("mediation-and-atonement", "anexaminationint36327gut",
     "The Mediation and Atonement of Our Lord and Savior Jesus Christ", "John Taylor", "1882"),
    ("leaves-from-my-journal", "leavesfrommyjour1882wood",
     "Leaves from My Journal", "Wilford Woodruff", "1882"),
    ("autobiography-of-parley-p-pratt", "theautobiography44896gut",
     "Autobiography of Parley P. Pratt", "Parley P. Pratt", "1874"),
    ("life-of-heber-c-kimball", "lifeheberckimba00whitgoog",
     "Life of Heber C. Kimball", "Orson F. Whitney", "1888"),
    ("key-to-the-science-of-theology", "keytothescienceo35470gut",
     "Key to the Science of Theology", "Parley P. Pratt", "1855"),
    ("lds-biographical-encyclopedia-v1", "latterdaysaint01jensuoft",
     "Latter-day Saint Biographical Encyclopedia, Volume 1", "Andrew Jenson", "1901"),
    ("compendium-of-the-doctrines", "compendiumofdoct01rich",
     "A Compendium of the Doctrines of the Gospel", "Franklin D. Richards and James A. Little", "1884"),
]

# archive.org identifier prefix (after per_utah-and-the-mormons_), display
# title, last public-domain year. Times and Seasons and the Messenger and
# Advocate are the other importer's; they are not listed here on purpose.
PERIODICALS: list[tuple[str, str, int]] = [
    ("the-latter-day-saints-millennial-star", "The Latter-day Saints' Millennial Star", 1929),
    ("nauvoo-neighbor", "Nauvoo Neighbor", 1846),
    ("evening-and-morning-star", "The Evening and the Morning Star", 1834),
    ("the-seer", "The Seer", 1854),
    ("the-zions-watchman-", "Zion's Watchman", 1930),
    ("latter-day-saints-southern-star", "Latter-day Saints' Southern Star", 1900),
    ("the-frontier-guardian_orson-hyde", "The Frontier Guardian", 1852),
    ("the-gospel-reflector-_b-winchester-", "The Gospel Reflector", 1841),
]
_ISSUE_RE = re.compile(r"^per_utah-and-the-mormons_(?P<paper>.+?)_(?P<date>\d{4}(?:-\d{2}(?:-\d{2})?)?)(?:_(?P<vol>\d+))?(?:_(?P<no>\d+))?$")


# ------------------------------------------------------------------ books

def fetch_books(ctx: Ctx, limit: int | None = None) -> dict:
    """Public-domain books by the prophets: download once, index, note."""
    stats = {"fetched": 0, "skipped": 0, "missing": 0, "chunks": 0}
    db = ctx.db()
    for key, ident, title, author, year in BOOKS:
        doc_id = f"book:{key}"
        if db.execute("SELECT 1 FROM documents WHERE doc_id=?", (doc_id,)).fetchone():
            stats["skipped"] += 1
            continue
        if limit is not None and stats["fetched"] >= limit:
            break
        path = _download_cached(ctx, ident, "prophet-writings")
        if path is None:
            stats["missing"] += 1
            continue
        text = _clean_gutenberg(path.read_text(encoding="utf-8"))
        n = store_document(ctx, doc_id, SOURCE_BOOKS, "history", title, text,
                           author=author, date=year, url=f"https://archive.org/details/{ident}",
                           local_path=str(path), content_hash=sha256_text(str(path)),
                           meta={"archive_identifier": ident, "licence": "public-domain"})
        stats["fetched"] += 1
        stats["chunks"] += n
        _write_book_note(ctx, doc_id, title, author, year, ident, text)
    if stats["fetched"]:
        db.execute("UPDATE sources SET status='imported', last_imported=? WHERE source_id=?",
                   (now_iso(), SOURCE_BOOKS))
        db.commit()
    ctx.log.info("prophets.books", **stats)
    return stats


def _clean_gutenberg(text: str) -> str:
    """Trim the Project Gutenberg header/footer when the text carries one."""
    m = re.search(r"\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n", text)
    if m:
        text = text[m.end():]
    m = re.search(r"\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK", text)
    if m:
        text = text[:m.start()]
    return text.strip()


def _write_book_note(ctx: Ctx, doc_id: str, title: str, author: str, year: str,
                     ident: str, text: str) -> None:
    from scripturegraph.graphops import chapter_display
    db = ctx.db()
    node_id = f"doc:{doc_id}"
    full = len(text.encode()) <= MAX_NOTE_TEXT_BYTES
    cites = db.execute("SELECT dst, weight FROM edges WHERE src=? AND rel='cites' "
                       "ORDER BY weight DESC LIMIT 40", (node_id,)).fetchall()
    lines = [f"# {title}", "",
             f"**{author}** · {year} · public domain · "
             f"[scan and text](https://archive.org/details/{ident})", ""]
    if full:
        lines += [text]
    else:
        lines += ["> " + truncate(text.replace("\n", " "), 600), "",
                  "> [!info] Full text in the local index",
                  "> This book is too large for one note; search reaches all of it "
                  "(`scripturegraph ask …`), and the link above has the scan."]
    if cites:
        lines += ["", "## Scripture citations in this book", ""]
        for c in cites:
            try:
                lines.append(f"- {mdkit.wikilink(chapter_display(c['dst'].split(':', 1)[1]))} "
                             f"({int(c['weight'] or 0)}×)")
            except KeyError:
                continue
    fm = {"ownership": "system", "mutable": "ai", "content_type": "source-text",
          "source_id": SOURCE_BOOKS, "author": author, "year": year, "licence": "public-domain",
          "archive_identifier": ident, "doc_id": doc_id, "full_text": full}
    relpath = f"{FOLDER_WRITINGS}/{sanitize_filename(title)}.md"
    record_file(ctx, relpath, "source-note", "generator", node_id, mdkit.build_note(fm, "\n".join(lines)))
    db.execute("UPDATE nodes SET vault_path=? WHERE id=?", (relpath, node_id))
    db.commit()


# ------------------------------------------------------------ periodicals

def periodical_issues(ctx: Ctx, paper: str, last_year: int, rows: int = 4000) -> list[str]:
    """archive.org identifiers for one paper, oldest first, public-domain years only."""
    ids = _archive_search_ids(ctx, f"identifier:per_utah-and-the-mormons_{paper}*", rows=rows)
    keep = []
    for i in ids:
        m = _ISSUE_RE.match(i)
        if not m or m.group("paper") != paper:
            continue
        year = int(m.group("date")[:4])
        if year <= last_year:
            keep.append((m.group("date"), i))
    keep.sort()
    return [i for _d, i in keep]


def fetch_periodicals(ctx: Ctx, budget: int) -> dict:
    """Up to `budget` issues across the papers, oldest first per paper,
    round-robin so one long run (the Millennial Star) does not starve the
    short ones. Skips issues any importer already holds."""
    stats = {"fetched": 0, "skipped": 0, "missing": 0, "papers": {}}
    db = ctx.db()
    have = {r["archive"] for r in db.execute(
        "SELECT json_extract(meta_json, '$.archive_identifier') AS archive FROM documents "
        "WHERE json_extract(meta_json, '$.archive_identifier') IS NOT NULL")}
    have |= {r["u"].rsplit("/", 1)[-1] for r in db.execute(
        "SELECT url AS u FROM documents WHERE url LIKE 'https://archive.org/details/per_utah%'")}
    queues: list[tuple[str, str, list[str]]] = []
    for paper, title, last_year in PERIODICALS:
        if ctx.meta_get(f"periodical_complete:{paper}"):
            continue
        issues = [i for i in periodical_issues(ctx, paper, last_year) if i not in have]
        if not issues:
            ctx.meta_set(f"periodical_complete:{paper}", now_iso())
            continue
        queues.append((paper, title, issues))
    while queues and stats["fetched"] < budget:
        for entry in list(queues):
            if stats["fetched"] >= budget:
                break
            paper, title, issues = entry
            if not issues:
                queues.remove(entry)
                continue
            ident = issues.pop(0)
            r = _import_issue(ctx, paper, title, ident)
            stats[r] += 1
            stats["papers"][paper] = stats["papers"].get(paper, 0) + (1 if r == "fetched" else 0)
    if stats["fetched"]:
        db.execute("UPDATE sources SET status='imported', last_imported=? WHERE source_id=?",
                   (now_iso(), SOURCE_PERIODICALS))
        db.commit()
    ctx.log.info("prophets.periodicals", **{k: v for k, v in stats.items() if k != "papers"})
    return stats


def _issue_label(title: str, ident: str) -> tuple[str, str]:
    m = _ISSUE_RE.match(ident)
    date = m.group("date") if m else ""
    vol, no = (m.group("vol"), m.group("no")) if m else (None, None)
    tag = f" (Vol. {vol} No. {no})" if vol and no else ""
    return f"{title} {date}{tag}".strip(), date


def _import_issue(ctx: Ctx, paper: str, title: str, ident: str) -> str:
    db = ctx.db()
    doc_id = f"per:{ident}"
    if db.execute("SELECT 1 FROM documents WHERE doc_id=?", (doc_id,)).fetchone():
        return "skipped"
    path = _download_cached(ctx, ident, f"periodicals/{paper}")
    if path is None:
        return "missing"
    text = path.read_text(encoding="utf-8")
    label, date = _issue_label(title, ident)
    n = store_document(ctx, doc_id, SOURCE_PERIODICALS, "history", label, text,
                       author=title, date=date, url=f"https://archive.org/details/{ident}",
                       local_path=str(path), content_hash=sha256_text(str(path)),
                       meta={"archive_identifier": ident, "paper": paper, "licence": "public-domain"})
    node_id = f"doc:{doc_id}"
    fm = {"ownership": "system", "mutable": "ai", "content_type": "source-text",
          "source_id": SOURCE_PERIODICALS, "archive_identifier": ident,
          "url": f"https://archive.org/details/{ident}", "published": date,
          "authority_category": 4, "licence": "public-domain",
          "text_provenance": "archive.org OCR", "indexed_chunks": n, "doc_id": doc_id}
    lines = [f"# {label}", "",
             "> [!quote] Public-domain primary source",
             f"> Contemporary printed text, ingested into the study index as {n} searchable passages.", "",
             f"**Source:** {title}  ", f"**Published:** {date}  ",
             f"**Scan + OCR:** [archive.org/{ident}](https://archive.org/details/{ident})  ",
             "**Authority category:** 4 — primary historical source", "",
             "## Opening", "", "> " + truncate(text.replace("\n", " ").strip(), 700), "",
             "> [!info] Full text in the local index",
             "> Search reaches every passage of this issue (`scripturegraph ask …`)."]
    relpath = f"{FOLDER_PERIODICALS}/{sanitize_filename(label)}.md"
    record_file(ctx, relpath, "source-note", "generator", node_id, mdkit.build_note(fm, "\n".join(lines)))
    db.execute("UPDATE nodes SET vault_path=? WHERE id=?", (relpath, node_id))
    db.commit()
    return "fetched"


# ------------------------------------------------ patriarchal blessings

_BLESSING_RE = re.compile(r"patriarchal blessing", re.I)


def write_blessings_note(ctx: Ctx) -> int:
    """Blessing texts and accounts that appear inside the public-domain
    sources — nothing else, ever. Treated with care: only sources whose
    people have been gone a century and more, printed by their own presses."""
    db = ctx.db()
    rows = db.execute(
        "SELECT c.owner_id, c.seq, c.text, d.title, d.source_id FROM chunks c "
        "JOIN documents d ON d.doc_id = c.owner_id "
        "WHERE c.owner_type='document' AND d.source_id IN (?, ?, 'history-of-the-church', "
        "'journal-of-discourses', 'church-history', 'times-and-seasons', 'messenger-and-advocate') "
        "AND c.text LIKE '%atriarchal blessing%' ORDER BY d.date, c.seq",
        (SOURCE_BOOKS, SOURCE_PERIODICALS)).fetchall()
    lines = ["# Patriarchal Blessings (historical)", "",
             "Passages in the vault's **public-domain** sources that record or discuss a "
             "patriarchal blessing — the early patriarchs' words to people long gone, printed "
             "by their own families and presses. This page gathers only what those sources "
             "already say; nothing is fetched for it from anywhere else, and no living "
             "person's blessing belongs here. Treat what you read as what it is: sacred to "
             "the families it was given to.", ""]
    n = 0
    seen: set[str] = set()
    cur = None
    for r in rows:
        key = f"{r['owner_id']}#{r['seq']}"
        if key in seen:
            continue
        seen.add(key)
        if r["title"] != cur:
            cur = r["title"]
            node = db.execute("SELECT vault_path FROM nodes WHERE id=?",
                              (f"doc:{r['owner_id']}" if not r["owner_id"].startswith(("doc:", "talk:")) else r["owner_id"],)).fetchone()
            link = mdkit.wikilink(node["vault_path"].rsplit("/", 1)[-1][:-3]) if node and node["vault_path"] else cur
            lines += ["", f"## {link}", ""]
        lines.append("> " + truncate(r["text"].replace("\n", " "), 900))
        lines.append("")
        n += 1
        if n >= 400:
            break
    if n == 0:
        lines += ["_Nothing gathered yet — the sources that carry these are still being imported._"]
    record_file(ctx, BLESSINGS_NOTE, "moc", "generator", None,
                mdkit.build_note({"ownership": "system", "mutable": "ai", "content_type": "moc",
                                  "passages": n, "updated_at": now_iso()}, "\n".join(lines)))
    db.commit()
    return n


# ---------------------------------------------------------------- nightly

def nightly(ctx: Ctx, page_budget: int) -> dict:
    """Books first (nine, once), then a night's worth of periodical issues,
    then the blessings page. The Teachings of Presidents ride glib's own
    nightly crawl (COLLECTIONS)."""
    out: dict = {}
    out["books"] = fetch_books(ctx)
    per = int(ctx.c("acquisition.periodicals_per_night", 40))
    out["periodicals"] = fetch_periodicals(ctx, min(per, page_budget) if page_budget else per)
    out["blessings_passages"] = write_blessings_note(ctx)
    if out["books"]["fetched"] or out["periodicals"]["fetched"]:
        ctx.bump_corpus_version("words of the prophets")
        from scripturegraph.corpus.registry import _enqueue_affected
        _enqueue_affected(ctx, {"history"})
    return out
