"""Public-domain Bible translations, fetched once and kept in the vault.

Modern translations (NIV, ESV, ...) are copyrighted and can never be
redistributed through a synced vault. These three are lawful to carry:

  WEB — World English Bible        (public domain, modern English)
  ASV — American Standard Version  (1901, public domain)
  YLT — Young's Literal Translation (public domain, hyper-literal)

Source: getbible.net v2 static API (ebible.org texts; the translations.json
manifest labels each distribution license — we only fetch Public Domain).
Raw downloads are cached in the engine cache (gitignored); the vault gets
one Markdown file per book per translation with plain "**ch:v** text" lines
the reading plugin parses on demand. No block anchors and no wiki-links, so
these pages never pollute the graph or the ⇄ connection chips.
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

from .booksdata import BOOKS, NT, OT
from .util import atomic_write_text, read_text

OUTPUT_SUB = Path("AI Library") / "01 Scriptures" / "Translations"

TRANSLATIONS: list[tuple[str, str, str]] = [
    ("web", "WEB", "World English Bible"),
    ("asv", "ASV", "American Standard Version"),
    ("ylt", "YLT", "Young's Literal Translation"),
]

_WS = re.compile(r"\s+")


def _bible_books():
    """Our 66 biblical books, canonical order — aligns 1:1 with getbible nr."""
    return [b for b in BOOKS if b.volume in (OT, NT)]


def _fetch_raw(ctx, trans_id: str, refresh: bool) -> dict:
    cache = ctx.cache_dir / "translations" / f"{trans_id}.json"
    if cache.exists() and not refresh:
        return json.loads(read_text(cache))
    url = f"https://api.getbible.net/v2/{trans_id}.json"
    req = urllib.request.Request(url, headers={"User-Agent": "ScriptureGraph/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = r.read().decode("utf-8")
    cache.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(cache, data)
    return json.loads(data)


def _clean(text: str) -> str:
    return _WS.sub(" ", text.replace(" ", " ")).strip()


def build_translations(ctx, refresh: bool = False) -> dict:
    books = _bible_books()
    out_root = ctx.vault / OUTPUT_SUB
    stats: dict = {"translations": {}, "files": 0}
    for trans_id, abbr, full in TRANSLATIONS:
        raw = _fetch_raw(ctx, trans_id, refresh)
        license_label = str(raw.get("distribution_license", "")).strip() or "Public Domain"
        if "public domain" not in license_label.lower():
            # the manifest is the authority — refuse anything not clearly PD
            stats["translations"][abbr] = {"skipped": f"license: {license_label}"}
            continue
        raw_books = {int(b["nr"]): b for b in raw.get("books", [])}
        verses_written = 0
        files = 0
        for i, book in enumerate(books, start=1):
            rb = raw_books.get(i)
            if not rb:
                continue
            lines = [
                "---",
                "ownership: ai",
                "mutable: engine",
                "content_type: translation",
                f"translation: {abbr}",
                f"translation_name: {full}",
                f"license: {license_label}",
                f"book: {book.name}",
                f"slug: {book.slug}",
                "cssclasses:",
                "- sg-ai",
                "---",
                "",
                f"# {book.name} — {full}",
                "",
                f"_{license_label}. Text via getbible.net (ebible.org)._",
                "",
            ]
            for ch in rb.get("chapters", []):
                for v in ch.get("verses", []):
                    text = _clean(str(v.get("text", "")))
                    if not text:
                        continue
                    lines.append(f"**{ch['chapter']}:{v['verse']}** {text}")
                    verses_written += 1
            lines.append("")
            atomic_write_text(out_root / abbr / f"{book.name} ({abbr}).md",
                              "\n".join(lines))
            files += 1
        stats["translations"][abbr] = {"files": files, "verses": verses_written}
        stats["files"] += files
    return stats
