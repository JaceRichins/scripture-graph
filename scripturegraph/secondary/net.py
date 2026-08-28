"""Polite, lawful fetching for the secondary-source layer.

Policy (documented in docs/SECONDARY-SOURCES.md):
- RSS/Atom feeds and podcast-namespace transcript URLs are machine-consumption
  endpoints (podcast apps poll them); fetched with a self-identifying UA and a
  hard rate limit.
- HTML pages (episode pages, about pages) are additionally gated by the host's
  robots.txt. Disallowed → we simply don't fetch (transcript_status becomes
  'unavailable'); we never work around robots.
- No YouTube page/caption scraping at all — channel RSS metadata only.
- Fetched bodies are cached in the engine cache dir (gitignored, outside the
  synced vault).
"""
from __future__ import annotations

import time
import urllib.error
import urllib.robotparser
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from scripturegraph.context import Ctx
from scripturegraph.util import sha256_text

USER_AGENT = "ScriptureGraph-personal-study/0.1 (personal noncommercial study tool)"

_last_by_host: dict[str, float] = {}
_robots_cache: dict[str, urllib.robotparser.RobotFileParser | None] = {}

_BLOCKED_HOSTS = ("youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com",
                  "josephsmithpapers.org", "www.josephsmithpapers.org")


def _rate_limit(ctx: Ctx, host: str) -> None:
    gap = float(ctx.c("acquisition.request_gap_sec", 1.5))
    wait = _last_by_host.get(host, 0.0) + gap - time.time()
    if wait > 0:
        time.sleep(wait)
    _last_by_host[host] = time.time()


def _robots(ctx: Ctx, url: str) -> urllib.robotparser.RobotFileParser | None:
    host = urlparse(url).netloc.lower()
    if host in _robots_cache:
        return _robots_cache[host]
    rp = urllib.robotparser.RobotFileParser()
    robots_url = f"{urlparse(url).scheme}://{host}/robots.txt"
    try:
        _rate_limit(ctx, host)
        req = urllib.request.Request(robots_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as r:
            rp.parse(r.read().decode("utf-8", errors="replace").splitlines())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            rp = None  # host forbids even robots.txt → treat as disallow-all
        else:
            rp.parse([])  # 404 etc → allow-all per convention
    except (urllib.error.URLError, TimeoutError, OSError):
        rp = None  # unreachable → be conservative
    _robots_cache[host] = rp
    return rp


def page_allowed(ctx: Ctx, url: str) -> bool:
    host = urlparse(url).netloc.lower()
    if any(host == b or host.endswith("." + b) for b in _BLOCKED_HOSTS):
        return False
    rp = _robots(ctx, url)
    if rp is None:
        return False
    try:
        return rp.can_fetch(USER_AGENT, url)
    except Exception:  # noqa: BLE001 — malformed robots entries
        return False


def _fetch(ctx: Ctx, url: str, retries: int = 2) -> bytes | None:
    host = urlparse(url).netloc.lower()
    for attempt in range(retries + 1):
        _rate_limit(ctx, host)
        req = urllib.request.Request(url, headers={
            "User-Agent": USER_AGENT, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404, 410):
                return None
            ctx.log.warn("sec.fetch_http", url=url[:120], code=e.code, attempt=attempt)
            time.sleep(3 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            ctx.log.warn("sec.fetch_net", url=url[:120], error=str(e)[:100], attempt=attempt)
            time.sleep(3 * (attempt + 1))
    return None


def _cache_dir(ctx: Ctx) -> Path:
    d = ctx.cache_dir / "secondary"
    d.mkdir(parents=True, exist_ok=True)
    return d


def fetch_feed(ctx: Ctx, url: str) -> bytes | None:
    """Machine endpoint: RSS/Atom/JSON feed, or a podcast-namespace transcript."""
    return _fetch(ctx, url)


def fetch_page(ctx: Ctx, url: str, cache: bool = True) -> str | None:
    """HTML page, robots-gated, cached by URL hash."""
    if not url or not url.startswith(("http://", "https://")):
        return None
    key = sha256_text(url)[:24]
    cached = _cache_dir(ctx) / f"page-{key}.html"
    if cache and cached.exists():
        return cached.read_text(encoding="utf-8", errors="replace")
    if not page_allowed(ctx, url):
        ctx.log.info("sec.page_disallowed", url=url[:140])
        return None
    raw = _fetch(ctx, url)
    if raw is None:
        return None
    text = raw.decode("utf-8", errors="replace")
    if cache:
        cached.write_text(text, encoding="utf-8", errors="replace")
    return text
