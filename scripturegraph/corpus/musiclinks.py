"""Where each playlist track can be heard, resolved once and kept in Music.md.

Three kinds of link, in the order the player prefers them:

* `url`  — a free recording streamed in the app: the Church's own for hymns
           and Primary songs (from the hymn index), or a public-domain /
           Creative Commons performance from Wikimedia Commons for the
           classical pieces. Ad-free, no account.
* `yt`   — a YouTube video id, played in the app's embedded YouTube player
           (YouTube's own player, visible, as its terms require). Hymns and
           classics look for The Tabernacle Choir at Temple Square's own
           upload first; in playlists that beats the plain Church recording.
           Found with the YouTube Data API (key: YOUTUBE_API_KEY in
           .scripture-engine/config/.env, or music.youtube_api_key), or,
           without a key, from YouTube's own results page, one throttled
           request per track.
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

CHOIR = "The Tabernacle Choir at Temple Square"
_choir_channel: str | None = None


def choir_channel(api_key: str) -> str | None:
    """the Choir's channel id, looked up once per run"""
    global _choir_channel
    if _choir_channel:
        return _choir_channel
    q = urllib.parse.urlencode({"part": "snippet", "type": "channel", "maxResults": 3, "q": CHOIR, "key": api_key})
    d = _get_json(f"https://www.googleapis.com/youtube/v3/search?{q}")
    for it in (d or {}).get("items") or []:
        title = ((it.get("snippet") or {}).get("channelTitle") or "").lower()
        if "tabernacle choir" in title:
            _choir_channel = (it.get("id") or {}).get("channelId")
            break
    return _choir_channel


def youtube_id(api_key: str, title: str, artist: str, prefer_choir: bool = False) -> str | None:
    """the best video for the track — the Choir's own upload when it has one
    (one search on their channel), else the open search (one more)."""
    def search(q: str, channel: str | None) -> str | None:
        params = {"part": "snippet", "type": "video", "videoCategoryId": "10", "maxResults": 3, "q": q,
                  "key": api_key, "safeSearch": "strict", "videoEmbeddable": "true"}
        if channel:
            params["channelId"] = channel
        d = _get_json(f"https://www.googleapis.com/youtube/v3/search?{urllib.parse.urlencode(params)}")
        for it in (d or {}).get("items") or []:
            vid = (it.get("id") or {}).get("videoId")
            if vid:
                return vid
        return None
    if prefer_choir:
        ch = choir_channel(api_key)
        if ch:
            vid = search(title, ch)
            if vid:
                return vid
        return search(f"{title} {CHOIR}", None)
    return search(f"{title} {artist}", None)


_BROWSER_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
               "Accept-Language": "en-US,en;q=0.9", "Cookie": "CONSENT=YES+1; SOCS=CAI"}
_VID_RE = re.compile(r'"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"(.{0,4000}?)"ownerText":\{"runs":\[\{"text":"([^"]+)"', re.S)


def youtube_id_page(title: str, artist: str, prefer_choir: bool = False) -> str | None:
    """No API key: read YouTube's results page for the query, the way a
    browser would, and take the first video — the Choir's own upload when
    one is on the page. One request, three seconds apart."""
    q = f"{title} {CHOIR}" if prefer_choir else f"{title} {artist}"
    url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": q, "sp": "EgIQAQ%3D%3D"})
    req = urllib.request.Request(url, headers=_BROWSER_UA)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            html = r.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    finally:
        time.sleep(3)
    hits = _VID_RE.findall(html)
    if not hits:
        return None
    if prefer_choir:
        for vid, _, owner in hits[:8]:
            if "tabernacle choir" in owner.lower():
                return vid
    return hits[0][0]


_STOP = {"the", "a", "an", "of", "and", "in", "on", "to", "my", "o", "oh", "is", "for", "with", "thee", "thou", "thy", "no",
         "you", "were", "there", "did", "that", "this", "what", "when", "all", "our", "your", "his", "are", "was",
         "will", "shall", "how", "who", "out", "not", "let", "come", "ye"}


def _words(t: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", t.lower()) if len(w) > 2 and w not in _STOP}


def title_matches(track_title: str, file_title: str) -> bool:
    """most of the track's real words appear in the file's name"""
    want = _words(re.sub(r"\(.*?\)", "", track_title))
    if not want:
        return False
    have = _words(file_title)
    return len(want & have) >= max(1, round(len(want) * 0.6))


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
        if not title_matches(title, t):
            continue                                  # a different piece that shares a word
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
            mp3 = next((dv["src"] for dv in vi.get("derivatives") or []
                        if "mpeg" in dv.get("type", "") or dv.get("src", "").endswith(".mp3")), None)
            src = mp3 or (vi.get("url") if t.lower().endswith(".mp3") else None)
            if not src:
                continue                              # phones play mp3; Ogg/FLAC stay on the shelf
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
    from scripturegraph.corpus.churchmusic import choir_performance, church_performance, index as church_index
    library = church_index(ctx)
    stats["choir"] = 0
    for pl in data.get("playlists") or []:
        for tr in pl.get("tracks") or []:
            title, artist = tr.get("t", ""), tr.get("a", "")
            in_book = tr.get("a") in ("Hymn", "Primary")   # the plain Church recording is the fallback
            # the Choir's own performance, from the Church's library, wins outright
            perf = choir_performance(library, title) if library else None
            if perf and tr.get("choir") != perf["audio"]["vocal"]:
                tr["choir"] = perf["audio"]["vocal"]
                tr["choir_when"] = perf.get("when", "")
                stats["choir"] += 1
                changed = True
            if not perf and not in_book and library:
                other = church_performance(library, title)
                if other and tr.get("church") != other["audio"]["vocal"]:
                    tr["church"] = other["audio"]["vocal"]
                    tr["church_when"] = other.get("when", "")
                    tr["church_by"] = ", ".join(a for a in other.get("artists", []) if a) or "Church recording"
                    stats["church"] = stats.get("church", 0) + 1
                    changed = True
            if not ctx.c("music.youtube_lookups", True):
                continue                                   # headless: video ids are not collected
            if "url" not in tr and not in_book and _CLASSICAL.search(artist):
                hit = commons_audio(title, artist)
                tr["url"] = hit["url"] if hit else ""    # "" = looked, nothing free
                if hit:
                    tr["credit"] = hit["credit"]
                    stats["commons"] += 1
                changed = True
            if "yt" not in tr:
                if yt_used >= budget:
                    stats["pending"] += 1
                    continue
                choir = in_book or bool(_CLASSICAL.search(artist))
                if key:
                    vid = youtube_id(key, title, artist, prefer_choir=choir)
                    yt_used += 2 if choir else 1
                else:
                    vid = youtube_id_page(title, artist, prefer_choir=choir)   # keyless, throttled
                    yt_used += 1
                    stats["page_lookups"] = stats.get("page_lookups", 0) + 1
                tr["yt"] = vid or ""
                if vid:
                    stats["youtube"] += 1
                changed = True
    if changed:
        save(ctx, raw, data)
    ctx.log.info("music.links", **stats)
    return stats
