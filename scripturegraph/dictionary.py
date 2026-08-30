"""Bible Dictionary — Easton's (1897) + Smith's (1863), both public domain.

The LDS Bible Dictionary is copyrighted and can never be redistributed
through a synced vault; these are the classic public-domain references the
LDS BD itself drew on. Source dataset: neuu-org/bible-dictionary-dataset
(dictionary texts public domain; dataset compilation CC BY 4.0 — credited
in every generated page).

Output: one Markdown page per letter under AI Library/80 Bible Dictionary/
("A.md" … "Z.md") with an ## heading per entry and labeled definitions.
Plain text only — no wiki-links, so the dictionary never pollutes the graph
or the ⇄ connection chips. Raw downloads cache in the engine cache.
"""
from __future__ import annotations

import json
import string
import urllib.error
import urllib.request
from pathlib import Path

from .util import atomic_write_text, read_text

OUTPUT_SUB = Path("AI Library") / "80 Bible Dictionary"
RAW_BASE = ("https://raw.githubusercontent.com/neuu-org/"
            "bible-dictionary-dataset/main/data/01_parsed")

SOURCE_NAMES = {
    "EAS": "Easton (1897)",
    "SMI": "Smith (1863)",
}


def _fetch_letter(ctx, letter: str, refresh: bool) -> dict | None:
    cache = ctx.cache_dir / "dictionary" / f"{letter}.json"
    if cache.exists() and not refresh:
        return json.loads(read_text(cache))
    url = f"{RAW_BASE}/{letter}.json"
    req = urllib.request.Request(url, headers={"User-Agent": "ScriptureGraph/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:  # a couple of letters may not exist
        if e.code == 404:
            return None
        raise
    cache.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(cache, data)
    return json.loads(data)


def build_dictionary(ctx, refresh: bool = False) -> dict:
    out_root = ctx.vault / OUTPUT_SUB
    letters_written = 0
    entries_written = 0
    for letter in string.ascii_lowercase:
        raw = _fetch_letter(ctx, letter, refresh)
        if not raw:
            continue
        lines = [
            "---",
            "ownership: ai",
            "mutable: engine",
            "content_type: bible-dictionary",
            f"letter: {letter.upper()}",
            "license: public domain (texts); dataset CC BY 4.0",
            "cssclasses:",
            "- sg-ai",
            "---",
            "",
            f"# Bible Dictionary — {letter.upper()}",
            "",
            "_Easton's Bible Dictionary (1897) and Smith's Bible Dictionary"
            " (1863), public domain. Compiled dataset: neuu-org"
            " bible-dictionary-dataset (CC BY 4.0)._",
            "",
        ]
        for key in sorted(raw.keys()):
            entry = raw[key]
            name = str(entry.get("name") or key.title()).strip()
            defs = entry.get("definitions") or []
            if not name or not defs:
                continue
            lines.append(f"## {name}")
            for d in defs:
                src = SOURCE_NAMES.get(str(d.get("source", "")).strip(),
                                       str(d.get("source", "")).strip() or "—")
                text = " ".join(str(d.get("text", "")).split())
                if not text:
                    continue
                lines.append(f"**{src}:** {text}")
                lines.append("")
            entries_written += 1
        lines.append("")
        atomic_write_text(out_root / f"{letter.upper()}.md", "\n".join(lines))
        letters_written += 1
    return {"letters": letters_written, "entries": entries_written}
