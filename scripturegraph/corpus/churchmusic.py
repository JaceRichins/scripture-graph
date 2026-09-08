"""The Church's Music Library (churchofjesuschrist.org/media/music), indexed.

Every song there with a recording: title, who performs it, which book or
conference it came from, and the Church-hosted MP3s. The prize is The
Tabernacle Choir at Temple Square — hundreds of General Conference
performances — which the playlists prefer over the plain hymn recording.
Streamed straight from the Church's servers, nothing stored but titles
and links.

Written to `00 System/Church Music.md` as a JSON block:
  [{t, slug, book, artists, audio: {vocal, accompaniment, instrumental}}]
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request

from scripturegraph.context import Ctx
from scripturegraph.vaultgen.generate import FOLDER_SYSTEM

NOTE = f"{FOLDER_SYSTEM}/Church Music.md"
API = "https://www.churchofjesuschrist.org/media/music/api"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"}
CHOIR_RE = re.compile(r"tabernacle choir", re.I)
_JSON = re.compile(r"```json\s*([\s\S]*?)```")


def _page(offset: int, limit: int = 500) -> dict:
    ident = urllib.parse.quote(json.dumps({"lang": "eng", "limit": limit, "offset": offset, "orderByKey": ["songTitleSortKey"]}))
    url = f"{API}?type=songsFilteredList&lang=eng&identifier={ident}&batchSize={limit}"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:  # noqa: BLE001
            time.sleep(4 * (attempt + 1))
    return {}


def _when(book_slug: str) -> str:
    """'music-from-april-1998-general-conference' → 'April 1998 General Conference'"""
    m = re.match(r"music-from-(\w+)-(\d{4})-general-conference", book_slug or "")
    if m:
        return f"{m.group(1).title()} {m.group(2)} General Conference"
    return (book_slug or "").replace("-", " ").title()


def fetch(ctx: Ctx) -> dict:
    """the whole catalog, sixteen pages; keeps every song with a recording"""
    out: list[dict] = []
    offset = 0
    total = None
    while True:
        d = _page(offset)
        data = d.get("data") or []
        total = d.get("total") or total
        for s in data:
            audio: dict[str, str] = {}
            for a in s.get("assets") or []:
                url = a.get("distributionUrl")
                kind = a.get("assetType") or ""
                if not url or not kind.startswith("AUDIO"):
                    continue
                if kind in ("AUDIO_VOCAL", "AUDIO_VOCAL_CONGREGATION"):
                    audio.setdefault("vocal", url)
                elif kind == "AUDIO_ACCOMPANIMENT":
                    audio.setdefault("accompaniment", url)
                elif kind == "AUDIO_INSTRUMENTAL":
                    audio.setdefault("instrumental", url)
            if not audio:
                continue
            out.append({"t": s.get("title") or "", "slug": s.get("slug") or "", "book": s.get("bookSlug") or "",
                        "when": _when(s.get("bookSlug") or ""),
                        "artists": [a.get("personName", "").strip() for a in s.get("artists") or []],
                        "audio": audio})
        offset += 500
        if not data or (total and offset >= total):
            break
        time.sleep(1)
    choir = sum(1 for s in out if any(CHOIR_RE.search(a) for a in s["artists"]))
    body = ["---", "ownership: system", "mutable: ai", "content_type: reference", "---", "",
            "# Church Music Library", "",
            f"Every song in the Church's Music Library that has a recording: {len(out):,} entries, "
            f"{choir} of them performed by The Tabernacle Choir at Temple Square. Streamed from the Church's servers; "
            "the playlists prefer the Choir's performance of a hymn over the plain hymnbook recording. "
            "Titles and links only. Refreshed weekly by the engine.", "",
            "```json", json.dumps(out, ensure_ascii=False), "```", ""]
    p = ctx.vault / NOTE
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join(body), encoding="utf-8")
    stats = {"songs": len(out), "choir": choir, "total": total}
    ctx.log.info("churchmusic.index", **stats)
    return stats


def index(ctx: Ctx) -> list[dict]:
    p = ctx.vault / NOTE
    if not p.exists():
        return []
    m = _JSON.search(p.read_text(encoding="utf-8"))
    try:
        return json.loads(m.group(1)) if m else []
    except json.JSONDecodeError:
        return []


def norm(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", t.lower().replace("’", "'")).strip()


def choir_performance(entries: list[dict], title: str) -> dict | None:
    """the Choir's newest performance of a title (exact, then with a
    parenthetical dropped)"""
    key = norm(re.sub(r"\s*\(.*?\)\s*$", "", title))
    best = None
    for e in entries:
        if not any(CHOIR_RE.search(a) for a in e["artists"]) or "vocal" not in e["audio"]:
            continue
        ek = norm(re.sub(r"\s*\(.*?\)\s*$", "", e["t"]))
        if ek != key:
            continue
        year = re.search(r"(\d{4})", e["book"] or "")
        rank = int(year.group(1)) if year else 0
        if best is None or rank > best[0]:
            best = (rank, e)
    return best[1] if best else None
