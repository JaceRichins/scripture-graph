"""Legitimate corpus acquisition.

GENERAL CONFERENCE (churchofjesuschrist.org):
  robots.txt permits /study/general-conference; the Church's terms allow
  personal, noncommercial use. We use the site's own structured content API,
  a self-identifying User-Agent, and a hard rate limit (default 1.5s between
  requests). Full text goes into the PRIVATE local index for personal study;
  vault notes carry metadata + citations + a brief excerpt only. Backfill is
  resumable and can run a few sessions per night, oldest-missing-first.

PUBLIC DOMAIN (archive.org):
  Journal of Discourses (1854-1886), Conference Reports through 1930, the
  History of the Church volumes, and Lucy Mack Smith's 1853 history are
  public domain; OCR text is downloaded once and imported as documents.

Nothing here touches josephsmithpapers.org content (their terms restrict
copying); JSP is represented by reference-record notes + the drop folder.
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

from scripturegraph.context import Ctx
from scripturegraph.corpus.universal import html_to_text, store_document
from scripturegraph.util import json_read, json_write, now_iso, sha256_text

USER_AGENT = "ScriptureGraph-personal-study/0.1 (personal noncommercial study tool)"
API = ("https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content"
       "?lang=eng&uri={uri}")

_last_request = [0.0]


def _rate_limit(ctx: Ctx) -> None:
    gap = float(ctx.c("acquisition.request_gap_sec", 1.5))
    wait = _last_request[0] + gap - time.time()
    if wait > 0:
        time.sleep(wait)
    _last_request[0] = time.time()


def _get(ctx: Ctx, url: str, retries: int = 3) -> bytes | None:
    for attempt in range(retries):
        _rate_limit(ctx)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            ctx.log.warn("fetch.http_error", url=url[:120], code=e.code, attempt=attempt)
            time.sleep(4 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            ctx.log.warn("fetch.net_error", url=url[:120], error=str(e)[:120],
                         attempt=attempt)
            time.sleep(4 * (attempt + 1))
    return None


# ------------------------------------------------------------- conference

def _clean(s: str) -> str:
    s = re.sub(r"[  -​  　]", " ", s)
    return re.sub(r"\s+", " ", s).strip()



def parse_toc_talk_uris(toc_body: str, year: int, month: int) -> list[str]:
    pat = re.compile(
        rf'href="(/study)?(/general-conference/{year}/{month:02d}/[a-z0-9][a-z0-9-]*)\?lang=eng"')
    out: list[str] = []
    for m in pat.finditer(toc_body):
        uri = m.group(2)
        if uri.endswith("-session"):
            continue
        if uri not in out:
            out.append(uri)
    return out


def parse_talk_json(data: dict, year: int, month_name: str, uri: str) -> dict | None:
    meta = data.get("meta") or {}
    content = data.get("content") or {}
    body_html = content.get("body") or ""
    title = _clean(meta.get("title") or "")
    if not title or len(body_html) < 600:
        return None
    m = re.search(r"author-name[^>]*>([^<]+)", body_html)
    speaker = _clean(re.sub(r"^By\s+", "", m.group(1))) if m else ""
    text, _ = html_to_text(body_html)
    foot = content.get("footnotes") or ""
    if not isinstance(foot, str):
        foot = json.dumps(foot, ensure_ascii=False)
    foot_text, _ = html_to_text(foot)
    body = text + ("\n\nNotes\n" + foot_text if foot_text.strip() else "")
    return {"title": title, "speaker": speaker, "year": str(year), "month": month_name,
            "url": f"https://www.churchofjesuschrist.org{uri}?lang=eng",
            "body": body.strip()}


def fetch_conference_session(ctx: Ctx, year: int, month: int) -> dict:
    """Download one session's talks into sources/downloads/conference/ as the
    JSON format the conference importer already understands. Resumable."""
    month_name = "April" if month == 4 else "October"
    dest = ctx.downloads_dir / "conference" / f"{year}-{month:02d}"
    stats = {"session": f"{year}-{month:02d}", "talks": 0, "skipped": 0, "failed": 0,
             "missing": False}
    toc_raw = _get(ctx, API.format(uri=f"/general-conference/{year}/{month:02d}"))
    if toc_raw is None:
        stats["missing"] = True
        return stats
    try:
        toc = json.loads(toc_raw)
    except json.JSONDecodeError:
        stats["missing"] = True
        return stats
    uris = parse_toc_talk_uris((toc.get("content") or {}).get("body") or "", year, month)
    dest.mkdir(parents=True, exist_ok=True)
    for uri in uris:
        slug = uri.rsplit("/", 1)[-1]
        out = dest / f"{slug}.json"
        if out.exists():
            stats["skipped"] += 1
            continue
        raw = _get(ctx, API.format(uri=uri))
        if raw is None:
            stats["failed"] += 1
            continue
        try:
            talk = parse_talk_json(json.loads(raw), year, month_name, uri)
        except json.JSONDecodeError:
            talk = None
        if talk is None:
            stats["failed"] += 1
            continue
        json_write(out, talk)
        stats["talks"] += 1
    ctx.log.info("fetch.conference_session", **stats)
    return stats


def import_downloaded_conference(ctx: Ctx) -> dict:
    """Import every downloaded talk JSON not yet in the index."""
    from scripturegraph.corpus.conference import import_conference_file
    from scripturegraph.util import sha256_file
    base = ctx.downloads_dir / "conference"
    stats = {"imported": 0, "skipped": 0}
    if not base.exists():
        return stats
    db = ctx.db()
    for path in sorted(base.rglob("*.json")):
        h = sha256_file(path)
        doc_key = f"conf-dl:{path.parent.name}/{path.name}"
        row = db.execute("SELECT content_hash FROM documents WHERE doc_id=?",
                         (doc_key,)).fetchone()
        if row and row["content_hash"] == h:
            stats["skipped"] += 1
            continue
        n = import_conference_file(ctx, path, "general-conference", doc_key, h)
        if n:
            db.execute(
                "INSERT INTO documents(doc_id,source_id,doc_type,title,local_path,"
                "content_hash) VALUES(?,?,?,?,?,?) "
                "ON CONFLICT(doc_id) DO UPDATE SET content_hash=excluded.content_hash",
                (doc_key, "general-conference", "package-file", path.name, str(path), h))
            db.commit()
            stats["imported"] += n
    if stats["imported"]:
        db.execute("UPDATE sources SET status='imported', last_imported=?, "
                   "acquisition_method='api-fetch' WHERE source_id='general-conference'",
                   (now_iso(),))
        db.commit()
    ctx.log.info("conference.import_downloaded", **stats)
    return stats


def fetch_conference_range(ctx: Ctx, start_year: int, end_year: int) -> dict:
    total = {"sessions": 0, "talks": 0}
    for year in range(end_year, start_year - 1, -1):  # newest first
        for month in (10, 4):
            s = fetch_conference_session(ctx, year, month)
            if not s.get("missing"):
                total["sessions"] += 1
                total["talks"] += s["talks"]
    imp = import_downloaded_conference(ctx)
    if imp["imported"]:
        ctx.bump_corpus_version(f"conference fetch {start_year}-{end_year}")
        from scripturegraph.corpus.registry import _enqueue_affected, write_manifest
        _enqueue_affected(ctx, {"conference"})
        write_manifest(ctx)
    return {**total, **imp}


def freshen_conference(ctx: Ctx) -> dict:
    """Keep the newest sessions COMPLETE, not just present.

    `backfill_conference` skips any session directory that already has talks,
    so late-published talks (or earlier per-talk failures) in the most recent
    conferences would never be retried. Re-running the fetch on the latest two
    expected sessions is nearly free (existing files are skipped) and closes
    that gap. A new session (e.g. the October conference the weekend it airs)
    is picked up here the same night it appears."""
    import datetime
    now = datetime.date.today()
    sessions: list[tuple[int, int]] = []
    if now.month >= 10:
        sessions = [(now.year, 10), (now.year, 4)]
    elif now.month >= 4:
        sessions = [(now.year, 4), (now.year - 1, 10)]
    else:
        sessions = [(now.year - 1, 10), (now.year - 1, 4)]
    stats = {"sessions": [], "new_talks": 0}
    for y, m in sessions:
        s = fetch_conference_session(ctx, y, m)
        if not s.get("missing") and s.get("talks"):
            stats["sessions"].append(f"{y}-{m:02d}")
            stats["new_talks"] += s["talks"]
    if stats["new_talks"]:
        imp = import_downloaded_conference(ctx)
        stats.update(imp)
        if imp.get("imported"):
            ctx.bump_corpus_version(f"conference freshen {stats['sessions']}")
            from scripturegraph.corpus.registry import _enqueue_affected
            _enqueue_affected(ctx, {"conference"})
    return stats


def backfill_conference(ctx: Ctx, max_sessions: int) -> dict:
    """Fetch the next N oldest-missing sessions (newest-first coverage grows
    backward toward acquisition.conference_from_year). Used by nightly runs."""
    from_year = int(ctx.c("acquisition.conference_from_year", 1971))
    import datetime
    now = datetime.date.today()
    done = 0
    stats = {"sessions": [], "talks": 0}
    year = now.year
    months = [10, 4] if now.month >= 10 else ([4] if now.month >= 4 else [])
    sessions: list[tuple[int, int]] = [(year, m) for m in months]
    for y in range(year - 1, from_year - 1, -1):
        sessions += [(y, 10), (y, 4)]
    for y, m in sessions:
        if done >= max_sessions:
            break
        dest = ctx.downloads_dir / "conference" / f"{y}-{m:02d}"
        if dest.exists() and any(dest.glob("*.json")):
            continue
        s = fetch_conference_session(ctx, y, m)
        if not s.get("missing"):
            done += 1
            stats["sessions"].append(f"{y}-{m:02d}")
            stats["talks"] += s["talks"]
    if done:
        imp = import_downloaded_conference(ctx)
        stats.update(imp)
        if imp.get("imported"):
            ctx.bump_corpus_version(f"conference backfill {stats['sessions']}")
            from scripturegraph.corpus.registry import _enqueue_affected
            _enqueue_affected(ctx, {"conference"})
    return stats


# ------------------------------------------------------------- archive.org

def _archive_text(ctx: Ctx, identifier: str) -> str | None:
    """Download the best plain-text file for an archive.org item."""
    meta_raw = _get(ctx, f"https://archive.org/metadata/{identifier}")
    if meta_raw is None:
        return None
    try:
        meta = json.loads(meta_raw)
    except json.JSONDecodeError:
        return None
    files = meta.get("files") or []
    candidates = [f["name"] for f in files if str(f.get("name", "")).endswith("_djvu.txt")]
    if not candidates:
        candidates = [f["name"] for f in files
                      if str(f.get("name", "")).endswith(".txt")
                      and "meta" not in str(f.get("name"))]
    if not candidates:
        return None
    raw = _get(ctx, f"https://archive.org/download/{identifier}/"
                    f"{urllib.request.quote(candidates[0])}")
    if raw is None:
        return None
    return raw.decode("utf-8", errors="replace")


def _archive_search_ids(ctx: Ctx, query: str, rows: int = 200) -> list[str]:
    url = ("https://archive.org/advancedsearch.php?q=" + urllib.request.quote(query)
           + f"&fl%5B%5D=identifier&rows={rows}&output=json")
    raw = _get(ctx, url)
    if raw is None:
        return []
    try:
        docs = json.loads(raw)["response"]["docs"]
    except (json.JSONDecodeError, KeyError):
        return []
    return [d["identifier"] for d in docs]


def _download_cached(ctx: Ctx, identifier: str, subdir: str) -> Path | None:
    dest = ctx.downloads_dir / "archive-org" / subdir / f"{identifier}.txt"
    if dest.exists() and dest.stat().st_size > 10000:
        return dest
    text = _archive_text(ctx, identifier)
    if text is None or len(text) < 10000:
        ctx.log.warn("fetch.archive_item_empty", identifier=identifier)
        return None
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")
    ctx.log.info("fetch.archive_item", identifier=identifier, kb=len(text) // 1024)
    return dest


def fetch_public_domain_history(ctx: Ctx, include_conference_reports: bool = True) -> dict:
    """Journal of Discourses + History of the Church + Lucy Mack Smith
    (+ Conference Reports through 1930). Download once, import as documents."""
    stats = {"jod": 0, "hoc": 0, "other": 0, "conference_reports": 0, "chunks": 0}
    # Journal of Discourses volumes (identifiers JoDV01..JoDV26)
    for vol in range(1, 27):
        ident = f"JoDV{vol:02d}"
        path = _download_cached(ctx, ident, "journal-of-discourses")
        if path is None:
            continue
        n = store_document(
            ctx, f"jod:v{vol}", "journal-of-discourses", "history",
            f"Journal of Discourses, Volume {vol}", path.read_text(encoding="utf-8"),
            author="various (reported sermons)", date=f"~{1853 + vol}",
            url=f"https://archive.org/details/{ident}", local_path=str(path),
            content_hash=sha256_text(str(path)))
        stats["jod"] += 1
        stats["chunks"] += n
    # History of the Church (B. H. Roberts ed., public domain)
    hoc_ids = _archive_search_ids(
        ctx, "identifier:historyofchurchof* AND mediatype:texts", rows=30)
    if not any(re.search(r"historyofchurchof\d{2}", i) for i in hoc_ids):
        hoc_ids = _archive_search_ids(
            ctx, 'title:("history of the church of jesus christ of latter-day saints") '
                 "AND mediatype:texts", rows=60)
        hoc_ids = [i for i in hoc_ids if re.search(r"historyofchurchof\d{2}", i)]
    seen_vols: set[str] = set()
    for ident in sorted(hoc_ids):
        m = re.search(r"historyofchurchof(\d{2})", ident)
        if not m or m.group(1) in seen_vols:
            continue
        path = _download_cached(ctx, ident, "history-of-the-church")
        if path is None:
            continue
        vol = int(m.group(1))
        store_document(
            ctx, f"hoc:v{vol}", "history-of-the-church", "history",
            f"History of the Church, Volume {vol}", path.read_text(encoding="utf-8"),
            author="Joseph Smith et al. (B. H. Roberts, ed.)", date="1902-1912",
            url=f"https://archive.org/details/{ident}", local_path=str(path),
            content_hash=sha256_text(str(path)))
        seen_vols.add(m.group(1))
        stats["hoc"] += 1
    # Lucy Mack Smith, Biographical Sketches (1853)
    lucy_ids = _archive_search_ids(
        ctx, 'title:("biographical sketches of joseph smith") AND mediatype:texts', rows=5)
    for ident in lucy_ids[:1]:
        path = _download_cached(ctx, ident, "lucy-mack-smith")
        if path:
            store_document(
                ctx, "lucy-mack-smith:1853", "church-history", "history",
                "Biographical Sketches of Joseph Smith (Lucy Mack Smith, 1853)",
                path.read_text(encoding="utf-8"), author="Lucy Mack Smith", date="1853",
                url=f"https://archive.org/details/{ident}", local_path=str(path),
                content_hash=sha256_text(str(path)))
            stats["other"] += 1
    # Conference Reports through 1930 (public domain)
    if include_conference_reports:
        stats["conference_reports"] = _fetch_pd_conference_reports(ctx)
    for sid in ("journal-of-discourses", "history-of-the-church", "church-history"):
        ctx.db().execute("UPDATE sources SET status='imported', last_imported=? "
                         "WHERE source_id=?", (now_iso(), sid))
    ctx.db().commit()
    ctx.log.info("fetch.pd_history", **stats)
    return stats


def _fetch_pd_conference_reports(ctx: Ctx) -> int:
    from scripturegraph.corpus.conference import import_conference_file
    # source row must exist BEFORE its documents (FK constraint)
    ctx.db().execute(
        "INSERT INTO sources(source_id,name,type,authority_category,acquisition_method,"
        "status,source_url,license_notes) VALUES(?,?,?,?,?,?,?,?) "
        "ON CONFLICT(source_id) DO NOTHING",
        ("conference-reports-pd", "Conference Reports 1897-1930 (public domain)",
         "conference", 3, "download", "available",
         "https://archive.org/search?query=identifier%3Aconferencereport*",
         "Public domain (pre-1931). OCR text; whole-report granularity."))
    ctx.db().commit()
    ids = _archive_search_ids(ctx, "identifier:conferencereport* AND mediatype:texts",
                              rows=800)
    n_done = 0
    for ident in sorted(ids):
        m = re.fullmatch(r"conferencereport(\d{4})(a|sa)", ident)
        if not m or int(m.group(1)) > 1930:
            continue
        year, half = int(m.group(1)), m.group(2)
        month_name = "April" if half == "a" else "October"
        path = _download_cached(ctx, ident, "conference-reports")
        if path is None:
            continue
        talk = {"title": f"Conference Report, {month_name} {year}",
                "speaker": "General Conference (full report)",
                "year": str(year), "month": month_name,
                "url": f"https://archive.org/details/{ident}",
                "body": path.read_text(encoding="utf-8")}
        jpath = path.with_suffix(".import.json")
        json_write(jpath, talk)
        from scripturegraph.util import sha256_file
        import_conference_file(ctx, jpath, "conference-reports-pd",
                               f"confreport:{ident}", sha256_file(jpath))
        n_done += 1
    if n_done:
        ctx.db().execute(
            "UPDATE sources SET status='imported', last_imported=? "
            "WHERE source_id='conference-reports-pd'", (now_iso(),))
        ctx.db().commit()
    return n_done


def register_acquisition_sources(ctx: Ctx) -> None:
    db = ctx.db()
    rows = [
        ("journal-of-discourses", "Journal of Discourses (1854-1886)", "history", 4,
         "download", "available", "https://archive.org/details/JoDV01",
         "Public domain. 26 volumes of reported sermons; reporter accuracy varies — "
         "treat as contemporaneous reports, not verbatim transcripts."),
        ("history-of-the-church", "History of the Church (B. H. Roberts ed.)", "history", 4,
         "download", "available", "https://archive.org/search?query=historyofchurchof",
         "Public domain (1902-1912). Compiled/edited narrative; use with documentary care."),
    ]
    for sid, name, typ, auth, acq, status, url, notes in rows:
        db.execute(
            "INSERT INTO sources(source_id,name,type,authority_category,acquisition_method,"
            "status,source_url,notes) VALUES(?,?,?,?,?,?,?,?) "
            "ON CONFLICT(source_id) DO UPDATE SET notes=excluded.notes",
            (sid, name, typ, auth, acq, status, url, notes))
    db.commit()
