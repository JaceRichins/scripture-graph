"""Feed + transcript acquisition for registered secondary sources.

- Podcast RSS / Atom / YouTube channel feeds parsed with stdlib ElementTree.
- Podcasting-2.0 `<podcast:transcript>` URLs are first-choice transcripts
  (they exist precisely to be machine-read).
- Otherwise the episode page (robots-gated) is checked for a creator-provided
  transcript region.
- iTunes Search API (public, keyless) resolves show name → feed URL so the
  registry never hardcodes fragile feed addresses.
"""
from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from urllib.parse import quote

from scripturegraph.context import Ctx
from scripturegraph.corpus.universal import html_to_text
from scripturegraph.secondary import net
from scripturegraph.util import now_iso

ITUNES_SEARCH = "https://itunes.apple.com/search?media=podcast&limit=5&term={term}"

_PODCAST_NS = "https://podcastindex.org/namespace/1.0"
_PODCAST_NS_ALT = "https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md"


def item_id_for(source_id: str, guid: str) -> str:
    return hashlib.sha1(f"{source_id}|{guid}".encode()).hexdigest()[:12]


def lookup_feed_url(ctx: Ctx, term: str, want_name: str | None = None) -> str | None:
    """Resolve a show name to its RSS feed via the iTunes Search API."""
    raw = net.fetch_feed(ctx, ITUNES_SEARCH.format(term=quote(term)))
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    results = data.get("results") or []
    want = (want_name or term).lower()
    best = None
    for r in results:
        name = str(r.get("collectionName") or "").lower()
        feed = r.get("feedUrl")
        if not feed:
            continue
        if name == want:
            return str(feed)
        if best is None and want.split()[0] in name:
            best = str(feed)
    return best


def _iso_date(text: str | None) -> str:
    if not text:
        return ""
    try:
        return parsedate_to_datetime(text).date().isoformat()
    except (TypeError, ValueError):
        pass
    m = re.match(r"(\d{4}-\d{2}-\d{2})", text.strip())
    return m.group(1) if m else ""


def _duration_s(text: str | None) -> int | None:
    if not text:
        return None
    t = text.strip()
    if t.isdigit():
        return int(t)
    parts = t.split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    s = 0
    for n in nums:
        s = s * 60 + n
    return s if 0 < len(nums) <= 3 else None


def _strip_ns(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_feed(xml_bytes: bytes) -> list[dict]:
    """RSS 2.0 / Atom / YouTube feed → newest-first entry dicts:
    {guid, title, url, audio_url, published, duration_s, description,
     transcript_url}"""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []
    entries: list[dict] = []
    items = [el for el in root.iter() if _strip_ns(el.tag) in ("item", "entry")]
    for it in items:
        e = {"guid": "", "title": "", "url": "", "audio_url": "", "published": "",
             "duration_s": None, "description": "", "transcript_url": ""}
        for child in it:
            tag = _strip_ns(child.tag)
            text = (child.text or "").strip()
            if tag == "title":
                e["title"] = text
            elif tag == "guid" or tag == "id":
                e["guid"] = text
            elif tag == "link":
                href = child.get("href")
                if href:  # Atom
                    if child.get("rel") in (None, "alternate"):
                        e["url"] = href
                elif text:
                    e["url"] = text
            elif tag == "pubdate" or tag == "published" or tag == "updated":
                e["published"] = e["published"] or _iso_date(text)
            elif tag == "enclosure":
                e["audio_url"] = child.get("url") or ""
            elif tag == "duration":
                e["duration_s"] = _duration_s(text)
            elif tag == "transcript":
                # podcasting 2.0 — prefer text-ish types
                url = child.get("url") or ""
                mime = (child.get("type") or "").lower()
                if url and (not e["transcript_url"]
                            or any(k in mime for k in ("text", "srt", "vtt", "json"))):
                    e["transcript_url"] = url
            elif tag in ("description", "summary", "encoded"):
                if len(text) > len(e["description"]):
                    e["description"] = text
        if not e["guid"]:
            e["guid"] = e["url"] or e["title"]
        if e["title"] and e["guid"]:
            entries.append(e)
    return entries


def refresh_source_items(ctx: Ctx, source: dict) -> dict:
    """Pull the source's feed and register any new items (metadata only)."""
    stats = {"source": source["source_id"], "new": 0, "seen": 0, "no_feed": False}
    feed_url = source.get("feed_url")
    if not feed_url:
        term = source.get("name") or source["source_id"]
        hosts = json.loads(source.get("hosts_json") or "[]")
        feed_url = lookup_feed_url(ctx, f"{term} {hosts[0]}" if hosts else term,
                                   want_name=source.get("name"))
        if feed_url:
            from scripturegraph.secondary.registry import upsert_source
            upsert_source(ctx, {"source_id": source["source_id"], "feed_url": feed_url})
            ctx.log.info("sec.feed_resolved", source=source["source_id"], feed=feed_url[:120])
        else:
            stats["no_feed"] = True
            return stats
    raw = net.fetch_feed(ctx, feed_url)
    if not raw:
        stats["no_feed"] = True
        return stats
    entries = parse_feed(raw)[: int(ctx.c("secondary.max_items_per_refresh", 40))]
    db = ctx.db()
    for e in entries:
        iid = item_id_for(source["source_id"], e["guid"])
        row = db.execute("SELECT 1 FROM sec_items WHERE item_id=?", (iid,)).fetchone()
        if row:
            stats["seen"] += 1
            continue
        desc_text, _ = html_to_text(e["description"] or "")
        db.execute(
            "INSERT INTO sec_items(item_id,source_id,guid,title,url,audio_url,"
            "published_at,duration_s,description,transcript_url,transcript_status,"
            "status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'discovered',?,?)",
            (iid, source["source_id"], e["guid"], e["title"][:300], e["url"],
             e["audio_url"], e["published"], e["duration_s"], desc_text[:8000],
             e["transcript_url"] or None,
             "feed" if e["transcript_url"] else "none", now_iso(), now_iso()))
        stats["new"] += 1
    db.commit()
    return stats


# ------------------------------------------------------------- transcripts

_TS_LINE = re.compile(r"^\s*(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?)\s", re.MULTILINE)


def _vtt_or_srt_to_text(raw: str) -> str:
    """Collapse SRT/VTT captions to '[h:mm:ss] text' lines (keeps timestamps)."""
    out: list[str] = []
    last_ts = ""
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.isdigit() or line.upper().startswith("WEBVTT"):
            continue
        m = re.match(r"(\d{1,2}:\d{2}(?::\d{2})?)[.,]\d+\s+--?>\s", line)
        if m:
            last_ts = m.group(1)
            continue
        if "-->" in line:
            continue
        line = re.sub(r"<[^>]+>", "", line)
        if last_ts:
            out.append(f"[{last_ts}] {line}")
            last_ts = ""
        else:
            out.append(line)
    return "\n".join(out)


def acquire_transcript(ctx: Ctx, item: dict) -> tuple[str | None, str]:
    """Best lawful transcript for an item. Returns (text|None, status).

    Order: podcast-namespace transcript URL → episode page transcript region.
    A transcript is never stored in the vault; callers cache it under the
    engine cache dir.
    """
    # 1. feed-declared transcript (machine endpoint)
    if item.get("transcript_url"):
        raw = net.fetch_feed(ctx, item["transcript_url"])
        if raw:
            text = raw.decode("utf-8", errors="replace")
            if item["transcript_url"].lower().endswith((".srt", ".vtt")) or "-->" in text[:2000]:
                text = _vtt_or_srt_to_text(text)
            elif text.lstrip().startswith("{"):
                try:  # podcasting 2.0 JSON transcript
                    seg = json.loads(text).get("segments") or []
                    text = "\n".join(
                        f"[{int(s.get('startTime', 0)) // 60}:{int(s.get('startTime', 0)) % 60:02d}] "
                        f"{s.get('body', '')}" for s in seg)
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass
            elif "<" in text[:200]:
                text, _ = html_to_text(text)
            if len(text) > 2000:
                return text, "feed"
    # 2. episode page (robots-gated)
    page = net.fetch_page(ctx, item.get("url") or "")
    if page:
        text, _ = html_to_text(page)
        # creator-provided transcript pages are long; show-notes pages are short
        if len(text) > 12_000 or _TS_LINE.search(text):
            return text, "page"
    return None, "unavailable"
