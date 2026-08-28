"""Gospel Library content layer (churchofjesuschrist.org study API).

Same legitimacy posture as the conference fetcher (robots-permitted paths,
personal noncommercial use, self-identified UA, hard rate limit). Adds:

1. OFFICIAL DECLARATIONS 1-2 — canonized scripture missing from the
   scriptures-json corpus; imported as the 88th book (slug 'od').
2. CHAPTER APPARATUS — the official chapter/section headings and the full
   FOOTNOTE CROSS-REFERENCE web for every chapter, stored in
   chapter_apparatus and materialized as verse-accurate 'footnote_xref'
   edges (the canonical study-scriptures link system).
3. COLLECTIONS — a generic TOC-driven crawler for study collections
   (Gospel Topics + Essays, Revelations in Context, True to the Faith,
   Bible Dictionary, Topical Guide, JST appendix, Saints…), imported as
   indexed documents with automatic scripture-citation edges. Nightly runs
   work through these on a page budget, highest priority first.
"""
from __future__ import annotations

import html as html_mod
import json
import re

from scripturegraph.booksdata import BOOKS, BY_LDS_SLUG, BY_SLUG, chapter_title
from scripturegraph.context import Ctx
from scripturegraph.corpus.fetchers import API, _clean, _get
from scripturegraph.corpus.universal import html_to_text, store_document
from scripturegraph.util import now_iso, sha256_text

_VOLUME_SEG = {"Old Testament": "ot", "New Testament": "nt", "Book of Mormon": "bofm",
               "Doctrine and Covenants": "dc-testament", "Pearl of Great Price": "pgp"}

_HREF_RE = re.compile(
    r"/scriptures/(?:ot|nt|bofm|dc-testament|pgp)/([a-z0-9-]+)/(\d+)")
_ID_RANGE_RE = re.compile(r"[?&]id=p(\d+)(?:-p?(\d+))?")
_FRAG_RE = re.compile(r"#p(\d+)")


def chapter_uri(cslug: str) -> str:
    book_part, ch = cslug.rsplit("-", 1)
    book = BY_SLUG[book_part]
    return f"/scriptures/{_VOLUME_SEG[book.volume]}/{book.lds_slug}/{ch}"


def parse_scripture_href(href: str) -> tuple[str, list[int]] | None:
    """'/study/scriptures/bofm/hel/5?lang=eng&id=p1-p13#p13' -> ('hel-5', [1..13])."""
    href = html_mod.unescape(href)
    m = _HREF_RE.search(href)
    if not m:
        return None
    book = BY_LDS_SLUG.get(m.group(1))
    if book is None:
        return None
    cslug = f"{book.slug}-{int(m.group(2))}"
    verses: list[int] = []
    rng = _ID_RANGE_RE.search(href)
    if rng:
        a = int(rng.group(1))
        b = int(rng.group(2)) if rng.group(2) else a
        if b >= a:
            verses = list(range(a, min(b, a + 200) + 1))
    else:
        frag = _FRAG_RE.search(href)
        if frag:
            verses = [int(frag.group(1))]
    return cslug, verses


def _strip_tags(fragment: str) -> str:
    text = re.sub(r"<sup[^>]*>.*?</sup>", "", fragment, flags=re.DOTALL)
    text = re.sub(r"<span class=\"verse-number\"[^>]*>.*?</span>", "", text,
                  flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    return _clean(html_mod.unescape(text))


def _heading_of(body: str) -> str:
    """Official heading: chapter pages use study-summary; Official
    Declarations use a study-intro paragraph."""
    for cls in ("study-summary", "study-intro"):
        m = re.search(rf'class="{cls}"[^>]*>(.*?)</p>', body, re.DOTALL)
        if m:
            return _strip_tags(m.group(1))
    return ""


# ---------------------------------------------------- official declarations

def fetch_official_declarations(ctx: Ctx) -> dict:
    from scripturegraph.util import normalize_ws
    db = ctx.db()
    book = BY_SLUG["od"]
    stats = {"declarations": 0, "verses": 0}
    db.execute(
        "INSERT INTO books(slug,lds_slug,volume,name,position,num_chapters) "
        "VALUES(?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING",
        (book.slug, book.lds_slug, book.volume, book.name, book.order, book.chapters))
    db.execute(
        "INSERT INTO nodes(id,node_type,title,created_at,updated_at) VALUES(?,?,?,?,?) "
        "ON CONFLICT(id) DO NOTHING",
        ("book:od", "book", book.name, now_iso(), now_iso()))
    for n in (1, 2):
        raw = _get(ctx, API.format(uri=f"/scriptures/dc-testament/od/{n}"))
        if raw is None:
            continue
        try:
            body = json.loads(raw)["content"]["body"]
        except (json.JSONDecodeError, KeyError):
            continue
        paras = []
        for m in re.finditer(r'<p[^>]*\bid="p(\d+)"[^>]*>(.*?)</p>', body, re.DOTALL):
            text = _strip_tags(m.group(2))
            if len(text) >= 20:
                paras.append(text)
        if not paras:
            continue
        cslug = f"od-{n}"
        title = chapter_title(book, n)
        from scripturegraph.corpus.scriptures import _chapter_content_hash
        verses = list(enumerate(paras, start=1))
        db.execute(
            "INSERT INTO chapters(slug,book_slug,chapter,title,num_verses,text_hash) "
            "VALUES(?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET "
            "num_verses=excluded.num_verses, text_hash=excluded.text_hash",
            (cslug, "od", n, title, len(verses), _chapter_content_hash(verses)))
        db.execute(
            "INSERT INTO nodes(id,node_type,title,created_at,updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(id) DO NOTHING",
            (f"chapter:{cslug}", "chapter", title, now_iso(), now_iso()))
        for vn, text in verses:
            text = normalize_ws(text)
            db.execute(
                "INSERT INTO verses(slug,chapter_slug,verse,text) VALUES(?,?,?,?) "
                "ON CONFLICT(slug) DO UPDATE SET text=excluded.text",
                (f"od-{n}-{vn}", cslug, vn, text))
            db.execute(
                "INSERT INTO chunks(owner_type,owner_id,seq,text,text_hash) "
                "VALUES('verse',?,0,?,?) ON CONFLICT(owner_type,owner_id,seq) "
                "DO UPDATE SET text=excluded.text, text_hash=excluded.text_hash",
                (f"od-{n}-{vn}", text, sha256_text(text)))
        heading = _heading_of(body)
        if heading:
            db.execute(
                "INSERT INTO chapter_apparatus(chapter_slug,heading,fetched_at) "
                "VALUES(?,?,?) ON CONFLICT(chapter_slug) DO UPDATE SET "
                "heading=excluded.heading, fetched_at=excluded.fetched_at",
                (cslug, heading, now_iso()))
        stats["declarations"] += 1
        stats["verses"] += len(verses)
    db.commit()
    if stats["declarations"]:
        from scripturegraph.vaultgen.generate import generate_scriptures
        generate_scriptures(ctx)
    ctx.log.info("glib.official_declarations", **stats)
    return stats


# ------------------------------------------------------- chapter apparatus

def fetch_chapter_apparatus(ctx: Ctx, cslug: str) -> dict:
    """Official heading + footnote cross-references for one chapter."""
    db = ctx.db()
    raw = _get(ctx, API.format(uri=chapter_uri(cslug)))
    if raw is None:
        return {"missing": True}
    try:
        content = json.loads(raw)["content"]
    except (json.JSONDecodeError, KeyError):
        return {"missing": True}
    heading = _heading_of(content.get("body") or "")
    footnotes = content.get("footnotes") or {}
    per_verse: dict[int, list[dict]] = {}
    xref_targets: dict[str, list[tuple[int, str]]] = {}
    if isinstance(footnotes, dict):
        for key, note in footnotes.items():
            m = re.match(r"note(\d+)_", str(key))
            if not m or not isinstance(note, dict):
                continue
            verse = int(m.group(1))
            refs = []
            for ru in note.get("referenceUris") or []:
                if ru.get("type") != "scripture-ref":
                    continue
                parsed = parse_scripture_href(str(ru.get("href", "")))
                if parsed is None:
                    continue
                tslug, tverses = parsed
                if tslug == cslug:
                    continue
                refs.append({"chapter": tslug, "verses": tverses[:6],
                             "label": _clean(str(ru.get("text", "")))})
                first = f"{tslug}-{tverses[0]}" if tverses else tslug
                xref_targets.setdefault(tslug, []).append((verse, first))
            entry = {"marker": note.get("marker", ""), "refs": refs}
            if refs or note.get("text"):
                per_verse.setdefault(verse, []).append(entry)
    db.execute(
        "INSERT INTO chapter_apparatus(chapter_slug,heading,footnotes_json,fetched_at) "
        "VALUES(?,?,?,?) ON CONFLICT(chapter_slug) DO UPDATE SET heading=excluded.heading, "
        "footnotes_json=excluded.footnotes_json, fetched_at=excluded.fetched_at",
        (cslug, heading, json.dumps(per_verse, ensure_ascii=False), now_iso()))
    # verse-accurate canonical cross-reference edges
    db.execute("DELETE FROM edges WHERE src=? AND rel='footnote_xref'",
               (f"chapter:{cslug}",))
    for tslug, pairs in xref_targets.items():
        if not db.execute("SELECT 1 FROM chapters WHERE slug=?", (tslug,)).fetchone():
            continue
        db.execute(
            "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
            "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(src,dst,rel) DO UPDATE SET weight=excluded.weight, "
            "meta_json=excluded.meta_json, updated_at=excluded.updated_at",
            (f"chapter:{cslug}", f"chapter:{tslug}", "footnote_xref", "accepted", 0.99,
             float(len(pairs)), json.dumps({"pairs": pairs[:40]}), "pass:apparatus",
             now_iso(), now_iso()))
    db.commit()
    return {"heading": bool(heading), "verses_with_notes": len(per_verse),
            "xref_chapters": len(xref_targets)}


def fetch_all_apparatus(ctx: Ctx, limit: int | None = None) -> dict:
    db = ctx.db()
    rows = db.execute(
        "SELECT c.slug FROM chapters c LEFT JOIN chapter_apparatus a "
        "ON a.chapter_slug = c.slug JOIN books b ON b.slug=c.book_slug "
        "WHERE a.chapter_slug IS NULL ORDER BY b.position, c.chapter").fetchall()
    targets = [r["slug"] for r in rows]
    if limit:
        targets = targets[:limit]
    stats = {"fetched": 0, "missing": 0, "xref_edges": 0}
    for i, cslug in enumerate(targets):
        r = fetch_chapter_apparatus(ctx, cslug)
        if r.get("missing"):
            stats["missing"] += 1
        else:
            stats["fetched"] += 1
            stats["xref_edges"] += r.get("xref_chapters", 0)
        if (i + 1) % 50 == 0:
            ctx.log.info("glib.apparatus_progress", done=i + 1, total=len(targets))
    remaining = len(rows) - len(targets)
    ctx.log.info("glib.apparatus", remaining=remaining, **stats)
    return {**stats, "remaining": remaining}


# ------------------------------------------------------------- collections

COLLECTIONS: dict[str, dict] = {
    "gospel-topics-essays": {"uri": "/manual/gospel-topics-essays",
                             "source": "gospel-topics", "doc_type": "reference-entry",
                             "max_pages": 40, "priority": 1},
    "revelations-in-context": {"uri": "/manual/revelations-in-context",
                               "source": "church-history", "doc_type": "history",
                               "max_pages": 90, "priority": 1},
    "gospel-topics": {"uri": "/manual/gospel-topics", "source": "gospel-topics",
                      "doc_type": "reference-entry", "max_pages": 500, "priority": 2},
    "true-to-the-faith": {"uri": "/manual/true-to-the-faith", "source": "gospel-topics",
                          "doc_type": "reference-entry", "max_pages": 250, "priority": 2},
    "jst-appendix": {"uri": "/scriptures/jst", "source": "bible-dictionary",
                     "doc_type": "reference-entry", "max_pages": 60, "priority": 2},
    "saints-v1": {"uri": "/history/saints-v1", "source": "church-history",
                  "doc_type": "history", "max_pages": 60, "priority": 3},
    "saints-v2": {"uri": "/history/saints-v2", "source": "church-history",
                  "doc_type": "history", "max_pages": 60, "priority": 3},
    "saints-v3": {"uri": "/history/saints-v3", "source": "church-history",
                  "doc_type": "history", "max_pages": 60, "priority": 3},
    "saints-v4": {"uri": "/history/saints-v4", "source": "church-history",
                  "doc_type": "history", "max_pages": 60, "priority": 3},
    "bible-dictionary": {"uri": "/scriptures/bd", "source": "bible-dictionary",
                         "doc_type": "reference-entry", "max_pages": 1400, "priority": 4},
    "topical-guide": {"uri": "/scriptures/tg", "source": "bible-dictionary",
                      "doc_type": "reference-entry", "max_pages": 3600, "priority": 5},
}


def _toc_child_uris(body: str, base_uri: str) -> list[str]:
    out: list[str] = []
    pat = re.compile(r'href="(?:/study)?(' + re.escape(base_uri) + r'/[a-z0-9][a-z0-9-]*)'
                     r'(?:\?lang=eng)?"')
    for m in pat.finditer(body):
        uri = m.group(1)
        if uri not in out:
            out.append(uri)
    return out


def crawl_collection(ctx: Ctx, name: str, page_budget: int) -> dict:
    spec = COLLECTIONS[name]
    db = ctx.db()
    stats = {"collection": name, "fetched": 0, "skipped": 0, "missing_toc": False,
             "budget_exhausted": False}
    toc_raw = _get(ctx, API.format(uri=spec["uri"]))
    if toc_raw is None:
        stats["missing_toc"] = True
        ctx.meta_set(f"glib_missing:{name}", now_iso())
        return stats
    try:
        toc_body = json.loads(toc_raw)["content"]["body"]
    except (json.JSONDecodeError, KeyError):
        stats["missing_toc"] = True
        return stats
    queue = _toc_child_uris(toc_body, spec["uri"])
    seen: set[str] = set(queue)
    fetched_docs = 0
    while queue:
        uri = queue.pop(0)
        doc_id = f"glib:{uri}"
        if db.execute("SELECT 1 FROM documents WHERE doc_id=?", (doc_id,)).fetchone():
            stats["skipped"] += 1
            continue
        if fetched_docs >= page_budget or stats["fetched"] + stats["skipped"] > spec["max_pages"]:
            stats["budget_exhausted"] = True
            break
        raw = _get(ctx, API.format(uri=uri))
        fetched_docs += 1
        if raw is None:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        body = (data.get("content") or {}).get("body") or ""
        title = _clean((data.get("meta") or {}).get("title") or uri.rsplit("/", 1)[-1])
        text, _ = html_to_text(body)
        children = _toc_child_uris(body, uri)
        if len(text) < 400 and children:
            for c in children:  # sub-TOC page → descend
                if c not in seen:
                    seen.add(c)
                    queue.append(c)
            continue
        if len(text) < 300:
            continue
        foot = (data.get("content") or {}).get("footnotes") or ""
        if not isinstance(foot, str):
            foot = json.dumps(foot, ensure_ascii=False)
        foot_text, _ = html_to_text(foot)
        if foot_text.strip():
            text += "\n\nNotes\n" + foot_text
        store_document(ctx, doc_id, spec["source"], spec["doc_type"], title, text,
                       url=f"https://www.churchofjesuschrist.org/study{uri}?lang=eng",
                       meta={"collection": name})
        stats["fetched"] += 1
    if not queue and not stats["budget_exhausted"]:
        ctx.meta_set(f"glib_complete:{name}", str(ctx.corpus_version()))
    ctx.log.info("glib.collection", **stats)
    return stats


def collections_status(ctx: Ctx) -> dict:
    out = {}
    for name in COLLECTIONS:
        n = ctx.db().execute(
            "SELECT COUNT(*) AS n FROM documents WHERE doc_id LIKE ?",
            (f"glib:{COLLECTIONS[name]['uri']}%",)).fetchone()["n"]
        out[name] = {"docs": n,
                     "complete": ctx.meta_get(f"glib_complete:{name}") is not None,
                     "missing": ctx.meta_get(f"glib_missing:{name}") is not None}
    return out


def nightly_acquisition(ctx: Ctx, page_budget: int) -> dict:
    """Nightly budgeted work: chapter apparatus first, then collections by
    priority. Returns whatever it accomplished."""
    stats: dict = {}
    spent = 0
    app = fetch_all_apparatus(ctx, limit=page_budget)
    spent += app["fetched"] + app["missing"]
    stats["apparatus"] = app
    for name, spec in sorted(COLLECTIONS.items(), key=lambda kv: kv[1]["priority"]):
        if spent >= page_budget:
            break
        if ctx.meta_get(f"glib_complete:{name}") or ctx.meta_get(f"glib_missing:{name}"):
            continue
        r = crawl_collection(ctx, name, page_budget - spent)
        spent += r["fetched"]
        stats[name] = r
    if spent:
        ctx.bump_corpus_version(f"gospel-library acquisition ({spent} pages)")
        from scripturegraph.corpus.registry import _enqueue_affected
        _enqueue_affected(ctx, {"reference", "history"})
    stats["pages_spent"] = spent
    return stats
