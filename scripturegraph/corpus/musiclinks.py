"""Where each playlist track can be heard, resolved once and kept in Music.md.

Three kinds of link, in the order the player prefers them:

* `url`  — a free recording streamed in the app: the Church's own for hymns
           and Primary songs (from the hymn index), or a public-domain /
           Creative Commons performance from Wikimedia Commons for the
           classical pieces. Ad-free, no account.
* `yt`   — a YouTube video id, played in the app's embedded YouTube player
           (YouTube's own player, visible, as its terms require).
           Found with the YouTube Data API (key: YOUTUBE_API_KEY in
           .scripture-engine/config/.env, or music.youtube_api_key).
* nothing — the player searches the listener's own music app.

Spotify is resolved on the device at play time (it needs the listener's
login), so it is not stored here.

Titles and artists only. No words, no audio, ever, in the vault.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from scripturegraph.context import Ctx
from scripturegraph.vaultgen.generate import FOLDER_SYSTEM

MUSIC_NOTE = f"{FOLDER_SYSTEM}/Music.md"
UA = {"User-Agent": "ScriptureGraph/0.72 (family study vault; music links)"}
_JSON = re.compile(r"```json\s*([\s\S]*?)```")

# works old enough that a good free recording is likely on Commons
_CLASSICAL = re.compile(r"bach|mozart|handel|allegri|tallis|bruckner|fauré|faure|schubert|franck|palestrina|"
                        r"vivaldi|purcell|brahms|beethoven|grieg|chopin|debussy|satie|dvořák|dvorak|"
                        r"humperdinck|mascagni|gounod|parry|byrd|spiritual|folk|plainsong|lullaby|"
                        r"wesley|heber|crosby|scriven|lowry|elliott|bridges|clairvaux|adams|yon|holst|"
                        r"leontovych|davis|malotte|stravinsky|duruflé|durufle|brahe|bernard", re.I)


def _get_json(url: str, timeout: int = 30) -> dict | None:
    req = urllib.request.Request(url, headers=UA)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (403, 400, 404):
                return None
            time.sleep(3 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(3 * (attempt + 1))
    return None


# ------------------------------------------------------------- the note

def load(ctx: Ctx) -> tuple[str, dict] | None:
    p = ctx.vault / MUSIC_NOTE
    if not p.exists():
        return None
    raw = p.read_text(encoding="utf-8")
    m = _JSON.search(raw)
    if not m:
        return None
    try:
        return raw, json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def save(ctx: Ctx, raw: str, data: dict) -> None:
    body = json.dumps(data, ensure_ascii=False, indent=2)
    new = _JSON.sub(lambda _m: "```json\n" + body + "\n```", raw, count=1)
    (ctx.vault / MUSIC_NOTE).write_text(new, encoding="utf-8")


# ------------------------------------------------------------ resolvers

def youtube_id(api_key: str, title: str, artist: str) -> str | None:
    """the best music video for 'title artist' — one Data API search (100 units)"""
    q = urllib.parse.urlencode({"part": "snippet", "type": "video", "videoCategoryId": "10",
                                "maxResults": 3, "q": f"{title} {artist}", "key": api_key,
                                "safeSearch": "strict", "videoEmbeddable": "true"})
    d = _get_json(f"https://www.googleapis.com/youtube/v3/search?{q}")
    if not d:
        return None
    for it in d.get("items") or []:
        vid = (it.get("id") or {}).get("videoId")
        if vid:
            return vid
    return None


def commons_audio(title: str, artist: str) -> dict | None:
    """a public-domain / CC recording on Wikimedia Commons, as an mp3 url"""
    api = "https://commons.wikimedia.org/w/api.php"
    q = urllib.parse.urlencode({"action": "query", "list": "search", "srnamespace": 6, "srlimit": 8,
                                "srsearch": f"{title} {artist.split('&')[0].strip()} filetype:audio", "format": "json"})
    d = _get_json(f"{api}?{q}")
    time.sleep(1.5)
    if not d:
        return None
    for hit in (d.get("query") or {}).get("search") or []:
        t = hit["title"]
        if not t.lower().endswith((".ogg", ".oga", ".mp3", ".flac", ".wav", ".opus")):
            continue
        q2 = urllib.parse.urlencode({"action": "query", "titles": t, "prop": "videoinfo|imageinfo",
                                     "viprop": "derivatives|url", "iiprop": "extmetadata",
                                     "iiextmetadatafilter": "LicenseShortName|Artist", "format": "json"})
        info = _get_json(f"{api}?{q2}")
        time.sleep(1.5)
        if not info:
            continue
        for page in (info.get("query") or {}).get("pages", {}).values():
            ii = (page.get("imageinfo") or [{}])[0]
            lic = ((ii.get("extmetadata") or {}).get("LicenseShortName") or {}).get("value", "").lower()
            if not ("public domain" in lic or lic.startswith("pd") or lic.startswith("cc")):
                continue
            if "nc" in lic or "nd" in lic:          # keep it to licences that allow plain playback anywhere
                pass
            vi = (page.get("videoinfo") or [{}])[0]
            mp3 = next((dv["src"] for dv in vi.get("derivatives") or [] if dv.get("type", "").startswith("audio/mpeg")), None)
            src = mp3 or vi.get("url")
            if not src:
                continue
            return {"url": src, "credit": f"{t[5:]} ({lic})", "page": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(t)}"}
    return None


# ------------------------------------------------------------- the run

def resolve(ctx: Ctx, budget: int = 90) -> dict:
    """Fill in `yt` and `url` for tracks that lack them. `budget` caps
    YouTube searches per run (100 units each against a 10,000/day quota)."""
    loaded = load(ctx)
    stats = {"youtube": 0, "commons": 0, "skipped_no_key": 0, "pending": 0}
    if not loaded:
        return stats
    raw, data = loaded
    key = os.environ.get("YOUTUBE_API_KEY") or ctx.c("music.youtube_api_key") or ""
    yt_used = 0
    changed = False
    for pl in data.get("playlists") or []:
        for tr in pl.get("tracks") or []:
            if tr.get("a") in ("Hymn", "Primary"):
                continue                                   # the Church's recording, from the hymn index
            title, artist = tr.get("t", ""), tr.get("a", "")
            if "url" not in tr and _CLASSICAL.search(artist):
                hit = commons_audio(title, artist)
                tr["url"] = hit["url"] if hit else ""    # "" = looked, nothing free
                if hit:
                    tr["credit"] = hit["credit"]
                    stats["commons"] += 1
                changed = True
            if "yt" not in tr:
                if not key:
                    stats["skipped_no_key"] += 1
                    continue
                if yt_used >= budget:
                    stats["pending"] += 1
                    continue
                vid = youtube_id(key, title, artist)
                yt_used += 1
                tr["yt"] = vid or ""
                if vid:
                    stats["youtube"] += 1
                changed = True
    if changed:
        save(ctx, raw, data)
    ctx.log.info("music.links", **stats)
    return stats
