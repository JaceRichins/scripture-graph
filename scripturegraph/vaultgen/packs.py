"""Packs — the per-chapter apparatus, one note per BOOK, for phones.

The vault carries ~1,600 footnote pages, ~1,550 cross-reference pages and a
library of pages that cite verses. Every one of those is a file a phone has
to sync and Obsidian has to index, and the file count — not the bytes — is
what makes the phone app heavy. A phone only ever reads them through the
plugin, never by hand. So the same data goes out again packed by book:

    AI Library/01 Scriptures/Packs/<Book> — Footnotes Pack.md
        {"<chapter slug>": {"<verse>": [{m, refs, w, o}]}}     (footnotes.py's shape)
    AI Library/01 Scriptures/Packs/<Book> — Cross References Pack.md
        {"<chapter slug>": {"<verse>": [{"id": verse slug, "l": label, "w": weight}]}}
        (both directions: a pair written once on the earlier chapter's page
         appears under BOTH chapters here)
    AI Library/01 Scriptures/Packs/<Book> — Citations Pack.md
        {"<chapter slug>": {"verses": {"<verse slug>": [{"p": path, "n": name}]},
                            "chapter": [{"p": path, "n": name}]}}
        (every library page that links a verse anchor or the chapter itself,
         the same set the reader's ⇄ chips show — minus the mirrors and the
         system folder, which are never destinations)

Built from the vault's own pages, so it needs no database and runs after
the writers that produce them. Regenerable. About 270 files replace ~5,000
on a phone; the per-chapter pages stay in the vault for the desktop and the
graph.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

from scripturegraph.booksdata import BOOKS, BY_SLUG, find_chapter_by_title
from scripturegraph.context import Ctx
from scripturegraph.util import now_iso
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import FOLDER_SCRIPTURES, record_file

FOLDER_PACKS = f"{FOLDER_SCRIPTURES}/Packs"
FOLDER_FOOTNOTES = f"{FOLDER_SCRIPTURES}/Footnotes"
FOLDER_XREFS = f"{FOLDER_SCRIPTURES}/Cross References"

# pages that are never a destination for a citation (mirrors, data, system)
CITE_EXCLUDED = (
    "AI Library/00 System/",
    "AI Library/01 Scriptures/Annotated/",
    "AI Library/01 Scriptures/Canonical/",
    "AI Library/01 Scriptures/Translations/",
    "AI Library/01 Scriptures/Footnotes/",
    "AI Library/01 Scriptures/Cross References/",
    "AI Library/01 Scriptures/Packs/",
)

JSON_BLOCK = re.compile(r"```json\s*([\s\S]*?)```")
XREF_LINE = re.compile(r"^- \[\[([^\]|#]+)#\^([a-z0-9]+(?:-\d+)+)\|([^\]]+)\]\] ⇄ \[\[([^\]|#]+)#\^([a-z0-9]+(?:-\d+)+)\|([^\]]+)\]\](?: — [^,]*, weight (\d+))?")
WIKILINK = re.compile(r"(?<!!)\[\[([^\[\]|#]+)(#\^([a-z0-9]+(?:-\d+)+))?(?:#[^\[\]|]*)?(?:\|[^\[\]]*)?\]\]")
FM_SLUG = re.compile(r"^slug:\s*(\S+)\s*$", re.M)


def _book_of(chapter_slug: str):
    return BY_SLUG.get(chapter_slug.rsplit("-", 1)[0])


def _read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def _footnotes(ctx: Ctx) -> dict[str, dict]:
    """chapter slug → the compact footnotes JSON the per-chapter page carries"""
    out: dict[str, dict] = {}
    root = ctx.vault / FOLDER_FOOTNOTES
    if not root.exists():
        return out
    for p in root.rglob("* - Footnotes.md"):
        text = _read(p)
        m = FM_SLUG.search(text)
        j = JSON_BLOCK.search(text)
        if not m or not j:
            continue
        try:
            out[m.group(1)] = json.loads(j.group(1))
        except json.JSONDecodeError:
            continue
    return out


def _crossrefs(ctx: Ctx) -> dict[str, dict[str, list[dict]]]:
    """chapter slug → verse → [{id, l, w}], both directions of every pair"""
    out: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    root = ctx.vault / FOLDER_XREFS
    if not root.exists():
        return out
    seen: set[tuple[str, str]] = set()
    for p in root.rglob("* - Cross References.md"):
        for line in _read(p).splitlines():
            m = XREF_LINE.match(line)
            if not m:
                continue
            a, la, b, lb = m.group(2), m.group(3), m.group(5), m.group(6)
            w = int(m.group(7)) if m.group(7) else 0
            for own, other, label in ((a, b, lb), (b, a, la)):
                if (own, other) in seen:
                    continue
                seen.add((own, other))
                chapter, verse = own.rsplit("-", 1)
                out[chapter][verse].append({"id": other, "l": label, "w": w})
    for chapter in out.values():
        for lst in chapter.values():
            lst.sort(key=lambda r: -r["w"])
    return out


def _citations(ctx: Ctx) -> dict[str, dict]:
    """chapter slug → {"verses": {verse slug: [{p, n}]}, "chapter": [{p, n}]}"""
    verses: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    chapters: dict[str, list[dict]] = defaultdict(list)
    lib = ctx.vault / "AI Library"
    if not lib.exists():
        return {}
    for p in lib.rglob("*.md"):
        rel = p.relative_to(ctx.vault).as_posix()
        if rel.startswith(CITE_EXCLUDED):
            continue
        text = _read(p)
        if "[[" not in text:
            continue
        name = p.stem
        seen_v: set[str] = set()
        seen_c: set[str] = set()
        for m in WIKILINK.finditer(text):
            target, anchor = m.group(1).strip(), m.group(3)
            if anchor:
                chapter = anchor.rsplit("-", 1)[0]
                if not _book_of(chapter) or anchor in seen_v:
                    continue
                seen_v.add(anchor)
                verses[chapter][anchor].append({"p": rel, "n": name})
            else:
                hit = find_chapter_by_title(target)
                if not hit:
                    continue
                book, ch = hit
                chapter = f"{book.slug}-{ch}"
                if chapter in seen_c:
                    continue
                seen_c.add(chapter)
                chapters[chapter].append({"p": rel, "n": name})
    out: dict[str, dict] = {}
    for chapter in set(verses) | set(chapters):
        out[chapter] = {"verses": {k: sorted(v, key=lambda r: r["n"]) for k, v in verses.get(chapter, {}).items()},
                        "chapter": sorted(chapters.get(chapter, []), key=lambda r: r["n"])}
    return out


def _by_book(data: dict[str, object]) -> dict[str, dict[str, object]]:
    out: dict[str, dict[str, object]] = defaultdict(dict)
    for chapter, v in data.items():
        book = _book_of(chapter)
        if book:
            out[book.slug][chapter] = v
    return out


def _write(ctx: Ctx, book, kind: str, label: str, blurb: str, payload: dict) -> bool:
    rel = f"{FOLDER_PACKS}/{book.name} — {label} Pack.md"
    body = "\n".join([
        f"# {book.name} — {label} Pack", "",
        blurb, "",
        "```json", json.dumps(payload, ensure_ascii=False, separators=(",", ":")), "```", "",
    ])
    fm = {"ownership": "ai", "mutable": "engine", "content_type": f"pack-{kind}", "book": book.name,
          "book_slug": book.slug, "chapters": len(payload), "updated_at": now_iso(), "cssclasses": ["sg-ai"]}
    return record_file(ctx, rel, "packs", "generator", None, mdkit.build_note(fm, body))


def write_packs(ctx: Ctx) -> dict[str, int]:
    """Every book's three packs. Returns how many notes changed, per kind."""
    stats = {"footnotes": 0, "crossrefs": 0, "citations": 0}
    fn = _by_book(_footnotes(ctx))
    xr = _by_book(_crossrefs(ctx))
    ci = _by_book(_citations(ctx))
    for book in BOOKS:
        if book.slug in fn and _write(ctx, book, "footnotes", "Footnotes",
                                       "The official footnotes for every chapter of this book, verse by verse, "
                                       "packed for the reader. The per-chapter pages carry the same data.",
                                       fn[book.slug]):
            stats["footnotes"] += 1
        if book.slug in xr and _write(ctx, book, "crossrefs", "Cross References",
                                       "Textual parallels for every verse of this book, both directions, "
                                       "packed for the reader's ⇄ chips.",
                                       xr[book.slug]):
            stats["crossrefs"] += 1
        if book.slug in ci and _write(ctx, book, "citations", "Citations",
                                       "Every library page that cites a verse or a chapter of this book, "
                                       "packed for the reader's ⇄ chips.",
                                       ci[book.slug]):
            stats["citations"] += 1
    try:
        ctx.db().commit()
    except Exception:  # noqa: BLE001
        pass
    if any(stats.values()):
        ctx.log.info("packs.written", **stats)
    return stats
