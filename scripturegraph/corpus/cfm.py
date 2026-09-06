"""Come, Follow Me — this year's lessons, and the index the home page's
"This week" card reads.

The manual is crawled like any other Gospel Library collection (glib
COLLECTIONS, `cfm-<year>`): one page per lesson under
`AI Library/07 Come Follow Me/<year>/`. This module reads the manual's table
of contents and writes `00 System/Come Follow Me.md`: a JSON list of weeks
— the date range, the scripture block, the chapters it covers as vault
titles, and the lesson page — so the phone can pick the current week
without any parsing of its own. Same posture as Saints: Church text, private
index, private vault.
"""
from __future__ import annotations

import datetime as dt
import json
import re

from scripturegraph.booksdata import chapter_slug, find_chapter_by_title
from scripturegraph.graphops import chapter_display
from scripturegraph.context import Ctx
from scripturegraph.corpus.fetchers import API, _clean, _get
from scripturegraph.util import now_iso
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import FOLDER_LIBRARY, FOLDER_SYSTEM, record_file

FOLDER_CFM = f"{FOLDER_LIBRARY}/07 Come Follow Me"
INDEX_NOTE = f"{FOLDER_SYSTEM}/Come Follow Me.md"
MANUALS = {
    2024: "/manual/come-follow-me-for-home-and-church-book-of-mormon-2024",
    2025: "/manual/come-follow-me-for-home-and-church-doctrine-and-covenants-2025",
    2026: "/manual/come-follow-me-for-home-and-church-old-testament-2026",
}
_MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August", "September",
     "October", "November", "December"], 1)}
_ENTRY = re.compile(r'href="(?:/study)?(?P<uri>%s/(?P<key>[a-z0-9][a-z0-9-]*))(?:\?lang=eng)?"[^>]*>(?P<label>.*?)</a>', re.S)
_DATES = re.compile(r"^(?P<m1>[A-Z][a-z]+) (?P<d1>\d{1,2})\s*[–-]\s*(?:(?P<m2>[A-Z][a-z]+) )?(?P<d2>\d{1,2})\s+(?P<rest>.+)$")
_RANGE = re.compile(r"([1-4]?\s?[A-Z][A-Za-z&. ]+?)\s+(\d+)(?:\s*[–-]\s*(\d+))?")


def parse_weeks(year: int, body: str, uri: str) -> list[dict]:
    """The manual's TOC → the weeks: dates, block, chapters, page key."""
    weeks: list[dict] = []
    seen: set[str] = set()
    for m in _ENTRY.finditer(body.replace("\n", " ")):
        if m.group("uri") in seen or "/" + uri.strip("/") + "/" not in m.group("uri") + "/":
            continue
        seen.add(m.group("uri"))
        key = m.group("key")
        if not re.fullmatch(r"\d{2}", key):
            continue
        label = _clean(re.sub(r"<[^>]+>", " ", m.group("label")))
        d = _DATES.match(label)
        if not d:
            continue
        m1, d1 = _MONTHS.get(d.group("m1")), int(d.group("d1"))
        m2, d2 = _MONTHS.get(d.group("m2") or d.group("m1")), int(d.group("d2"))
        if not m1 or not m2:
            continue
        y1 = year - 1 if (key == "01" and m1 == 12) else year
        y2 = year + 1 if (m2 == 1 and m1 == 12 and key != "01") else year
        start = dt.date(y1, m1, d1)
        end = dt.date(y2, m2, d2)
        block = d.group("rest").strip()
        weeks.append({"week": key, "start": start.isoformat(), "end": end.isoformat(),
                      "dates": f"{d.group('m1')} {d1}–{(d.group('m2') + ' ') if d.group('m2') else ''}{d2}",
                      "block": block, "chapters": chapters_of(block), "uri": m.group("uri")})
    return weeks


def chapters_of(block: str) -> list[str]:
    """'Genesis 1–2; Moses 2–3; Abraham 4–5' → the vault's chapter titles."""
    out: list[str] = []
    for part in re.split(r"[;,]", block):
        part = part.strip()
        mm = _RANGE.search(part)
        if not mm:
            continue
        book = re.sub(r"\s+", " ", mm.group(1)).strip()
        a, b = int(mm.group(2)), int(mm.group(3) or mm.group(2))
        for n in range(a, min(b, a + 40) + 1):
            found = find_chapter_by_title(f"{book} {n}")
            if not found:
                continue
            try:
                out.append(chapter_display(chapter_slug(found[0], n)))
            except KeyError:
                continue
    return out


def write_index(ctx: Ctx, year: int | None = None) -> dict:
    year = year or dt.date.today().year
    uri = MANUALS.get(year)
    if not uri:
        return {"year": year, "weeks": 0, "skipped": "no manual known for this year"}
    raw = _get(ctx, API.format(uri=uri))
    if raw is None:
        return {"year": year, "weeks": 0, "skipped": "manual unreachable"}
    try:
        data = json.loads(raw)
        body = data["content"]["body"]
        title = _clean(data.get("meta", {}).get("title") or f"Come, Follow Me {year}")
    except (json.JSONDecodeError, KeyError):
        return {"year": year, "weeks": 0, "skipped": "manual unreadable"}
    weeks = parse_weeks(year, body, uri)
    db = ctx.db()
    for w in weeks:
        # the lesson page, once the collection crawl has written it
        row = db.execute("SELECT vault_path FROM nodes WHERE id=?", (f"doc:glib:{w['uri']}",)).fetchone()
        w["page"] = row["vault_path"].rsplit("/", 1)[-1][:-3] if row and row["vault_path"] else None
    lines = [f"# Come, Follow Me — {year}", "",
             f"*{title}*. The weeks of this year's study, with the chapters each covers. The home "
             "page's **This week** card reads this list; the lessons themselves are under "
             f"`{FOLDER_CFM}/{year}` once the nightly crawl has fetched them.", "",
             "```json", json.dumps({"year": year, "title": title, "weeks": weeks}, ensure_ascii=False,
                                   separators=(",", ":")), "```", ""]
    for w in weeks:
        chaps = " · ".join(mdkit.wikilink(c) for c in w["chapters"][:8])
        page = mdkit.wikilink(w["page"]) if w.get("page") else ""
        lines.append(f"- **{w['dates']}** — {w['block']}" + (f" — {chaps}" if chaps else "")
                     + (f" — {page}" if page else ""))
    record_file(ctx, INDEX_NOTE, "moc", "generator", None,
                mdkit.build_note({"ownership": "system", "mutable": "ai", "content_type": "come-follow-me",
                                  "year": year, "weeks": len(weeks), "updated_at": now_iso()},
                                 "\n".join(lines)))
    db.commit()
    ctx.log.info("cfm.index", year=year, weeks=len(weeks))
    return {"year": year, "weeks": len(weeks)}
