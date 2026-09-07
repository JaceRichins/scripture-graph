"""Hymns — the index the phone's Hymns shelf plays from.

The Gospel Library API lists the 341 hymns of the current hymnbook
(`/manual/hymns`) and, per hymn, the Church's own recordings on its public
assets host (an accompaniment and a vocal track). This writes ONE note,
`00 System/Hymns.md`, with a JSON block of titles, numbers, page links and
those audio URLs — no lyrics, no sheet music; the words stay on the
Church's page, which the shelf links to. The recordings are streamed from
the Church, never copied. A few hymns a night keeps the API polite; the
whole book is indexed in a week.
"""
from __future__ import annotations

import json
import re

from scripturegraph.context import Ctx
from scripturegraph.corpus.fetchers import API, _clean, _get
from scripturegraph.util import now_iso
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import FOLDER_SYSTEM, record_file

HYMNS_NOTE = f"{FOLDER_SYSTEM}/Hymns.md"
TOC_URI = "/manual/hymns"
# the 1985 hymnal and the new "Hymns—For Home and Church" (released in batches)
TOC_URIS = ["/manual/hymns", "/music/hymns-for-home-and-church", "/manual/childrens-songbook"]
BOOKS = {"/manual/hymns/": "Hymns", "/music/hymns-for-home-and-church/": "Hymns—For Home and Church",
         "/manual/childrens-songbook/": "Children's Songbook"}
_CHILD = re.compile(r'href="(?:/study)?(/(?:manual/hymns|music/hymns-for-home-and-church|manual/childrens-songbook)/[a-z0-9][a-z0-9-]*)(?:\?lang=eng)?"[^>]*>(?:\s*<[^>]+>)*\s*([^<]{2,90})<')
_NUMBER = re.compile(r"^\s*(\d{1,4})\b")


def _index(ctx: Ctx) -> list[dict]:
    """what is known so far, from the note's own JSON block"""
    p = ctx.vault / HYMNS_NOTE
    if not p.exists():
        return []
    m = re.search(r"```json\s*([\s\S]*?)```", p.read_text(encoding="utf-8"))
    try:
        return json.loads(m.group(1)) if m else []
    except json.JSONDecodeError:
        return []


def fetch_hymns(ctx: Ctx, budget: int = 40) -> dict:
    """Extend the index by up to `budget` hymns (TOC once, then one call per
    hymn for its recordings). Idempotent; finished when every hymn has audio."""
    stats = {"toc": 0, "fetched": 0, "done": False}
    known = {h["uri"]: h for h in _index(ctx)}
    body = ""
    for toc in TOC_URIS:
        raw = _get(ctx, API.format(uri=toc))
        if raw is None:
            continue
        try:
            body += json.loads(raw)["content"]["body"]
        except (json.JSONDecodeError, KeyError):
            continue
    if not body:
        return stats
    order: list[dict] = []
    seen = set()
    for uri, label in _CHILD.findall(body):
        if uri in seen:
            continue
        seen.add(uri)
        label = _clean(label)
        n = _NUMBER.match(label)
        title = re.sub(r"^\s*\d{1,4}\s*[.:\-–]?\s*", "", label).strip() or uri.rsplit("/", 1)[-1]
        h = known.get(uri) or {"uri": uri, "title": title, "n": int(n.group(1)) if n else None,
                               "url": f"https://www.churchofjesuschrist.org/study{uri}?lang=eng"}
        if not h.get("n") and n:
            h["n"] = int(n.group(1))
        for pre, book in BOOKS.items():
            if uri.startswith(pre):
                h["book"] = book
        order.append(h)
    stats["toc"] = len(order)
    for h in order:
        if h.get("audio"):
            continue
        if stats["fetched"] >= budget:
            break
        raw = _get(ctx, API.format(uri=h["uri"]))
        stats["fetched"] += 1
        if raw is None:
            h["audio"] = {}
            continue
        try:
            meta = json.loads(raw).get("meta") or {}
        except json.JSONDecodeError:
            h["audio"] = {}
            continue
        if meta.get("title"):
            h["title"] = _clean(meta["title"])
        audio = {}
        for a in meta.get("audio") or []:
            v = str(a.get("variant") or "").upper()
            url = a.get("mediaUrl")
            if not url:
                continue
            if "VOCAL" in v:
                audio["vocal"] = url
            elif "ACCOMPANIMENT" in v or "INSTRUMENTAL" in v:
                audio["accompaniment"] = url
            else:
                audio.setdefault("other", url)
        h["audio"] = audio
    stats["done"] = all(h.get("audio") is not None for h in order)
    _write(ctx, order)
    ctx.log.info("hymns.index", **stats)
    return stats


def _write(ctx: Ctx, hymns: list[dict]) -> None:
    hymns = sorted(hymns, key=lambda h: (h.get("n") or 999, h["title"]))
    with_audio = sum(1 for h in hymns if h.get("audio"))
    lines = ["# Hymns", "",
             f"The hymnbook as an index — {len(hymns)} hymns, {with_audio} with the Church's own "
             "recordings linked. No words or music are stored here: each entry links to the "
             "hymn's page on churchofjesuschrist.org, and the recordings stream from the Church's "
             "servers. The Library's **Hymns** shelf plays from this list.", "",
             "```json", json.dumps(hymns, ensure_ascii=False, separators=(",", ":")), "```", ""]
    for h in hymns:
        num = f"{h['n']}. " if h.get("n") else ""
        lines.append(f"- {num}[{h['title']}]({h['url']})")
    fm = {"ownership": "system", "mutable": "ai", "content_type": "hymns", "hymns": len(hymns),
          "with_audio": with_audio, "updated_at": now_iso()}
    record_file(ctx, HYMNS_NOTE, "moc", "generator", None, mdkit.build_note(fm, "\n".join(lines)))
    ctx.db().commit()
