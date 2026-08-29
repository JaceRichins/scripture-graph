"""Deterministic verse-parallel cross-references (no AI involved).

The canon quotes itself constantly — Genesis 1 ↔ Moses 2 ↔ Abraham 4,
Isaiah ↔ 2 Nephi, Matthew 5–7 ↔ 3 Nephi 12–14, Psalms in the Gospels.
This module finds those textual parallels by shared word-shingle rarity
(pure text math: reproducible, honest, no model in the loop) and writes one
"<Chapter> - Cross References" page per chapter, each line citing BOTH verse
block anchors — which makes the reading plugin's ⇄ connection chips light up
on both sides of every parallel.

Method: 4-word shingles per verse; a shingle's weight is 1/df (document
frequency across all verses), so rare shared wording counts and formulaic
phrases ("and it came to pass that") count for almost nothing. Shingles with
df > DF_CAP never generate candidates at all. A pair is accepted when it
shares enough weighted rarity; each verse keeps its top partners.

Every run regenerates the whole folder from scratch (and prunes pages whose
chapter no longer has parallels), so corpus changes self-heal.
"""
from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

from .booksdata import BY_SLUG
from .util import atomic_write_text, read_text

CANONICAL_SUB = Path("AI Library") / "01 Scriptures" / "Canonical"
OUTPUT_SUB = Path("AI Library") / "01 Scriptures" / "Cross References"

VERSE_RE = re.compile(r"^\*\*(\d+)\*\*\s+(.*?)\s*\^([a-z0-9]+(?:-\d+)+)\s*$")
WORD_RE = re.compile(r"[a-z']+")

SHINGLE_N = 4
DF_CAP = 40          # shingles more common than this never generate candidates
MIN_SHARED = 3       # shared shingles required on the normal path
MIN_SCORE = 0.16     # summed 1/df over shared shingles (normal path)
RARE_SCORE = 0.5     # 2 shared shingles suffice when they are this rare
PER_VERSE_CAP = 6    # best partners kept per verse


def _shingles(text: str) -> set[str]:
    words = WORD_RE.findall(text.lower())
    if len(words) < SHINGLE_N:
        return {" ".join(words)} if words else set()
    return {" ".join(words[i:i + SHINGLE_N]) for i in range(len(words) - SHINGLE_N + 1)}


def _chapter_of(anchor: str) -> str:
    return anchor.rsplit("-", 1)[0]


def _book_slug(chapter_slug: str) -> str:
    return chapter_slug.rsplit("-", 1)[0]


def _chapter_order(chapter_slug: str) -> tuple[int, int]:
    book = BY_SLUG.get(_book_slug(chapter_slug))
    ch = int(chapter_slug.rsplit("-", 1)[1])
    return (book.order if book else 999, ch)


def _chapter_title(chapter_slug: str) -> str | None:
    book = BY_SLUG.get(_book_slug(chapter_slug))
    if not book:
        return None
    return f"{book.title_prefix} {chapter_slug.rsplit('-', 1)[1]}"


def _verse_ref(anchor: str) -> str | None:
    chapter = _chapter_of(anchor)
    title = _chapter_title(chapter)
    if not title:
        return None
    return f"{title}:{anchor.rsplit('-', 1)[1]}"


def scan_verses(ctx) -> tuple[dict[str, str], dict[str, Path]]:
    """anchor → verse text, plus chapter slug → canonical file path."""
    verses: dict[str, str] = {}
    chapter_files: dict[str, Path] = {}
    root = ctx.vault / CANONICAL_SUB
    for p in sorted(root.rglob("*.md")):
        for line in read_text(p).splitlines():
            m = VERSE_RE.match(line)
            if not m:
                continue
            anchor = m.group(3)
            verses[anchor] = m.group(2)
            chapter_files.setdefault(_chapter_of(anchor), p)
    return verses, chapter_files


def find_parallels(verses: dict[str, str]) -> dict[str, list[tuple[str, float]]]:
    """anchor → [(partner anchor, score)] using weighted shingle overlap."""
    sh_of: dict[str, set[str]] = {a: _shingles(t) for a, t in verses.items()}
    df: dict[str, int] = defaultdict(int)
    for shs in sh_of.values():
        for sh in shs:
            df[sh] += 1
    postings: dict[str, list[str]] = defaultdict(list)
    for a, shs in sh_of.items():
        for sh in shs:
            if 2 <= df[sh] <= DF_CAP:
                postings[sh].append(a)
    shared: dict[tuple[str, str], list[str]] = defaultdict(list)
    for sh, anchors in postings.items():
        for i in range(len(anchors)):
            for j in range(i + 1, len(anchors)):
                a, b = anchors[i], anchors[j]
                if _chapter_of(a) == _chapter_of(b):
                    continue
                shared[(a, b) if a < b else (b, a)].append(sh)
    best: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for (a, b), shs in shared.items():
        score = sum(1.0 / df[sh] for sh in shs)
        n = len(shs)
        if not ((n >= MIN_SHARED and score >= MIN_SCORE)
                or (n >= 2 and score >= RARE_SCORE)):
            continue
        best[a].append((b, score))
        best[b].append((a, score))
    for a in best:
        best[a].sort(key=lambda x: -x[1])
        best[a] = best[a][:PER_VERSE_CAP]
    return best


def build_crossrefs(ctx) -> dict:
    verses, chapter_files = scan_verses(ctx)
    best = find_parallels(verses)

    # a pair is written ONCE, on the canon-earlier chapter's page — one line
    # cites both anchors, so the ⇄ chips light on both sides with no dupes
    pages: dict[str, list[tuple[int, str, str, float]]] = defaultdict(list)
    written_pairs: set[tuple[str, str]] = set()
    for a, partners in best.items():
        for b, score in partners:
            key = (a, b) if a < b else (b, a)
            if key in written_pairs:
                continue
            written_pairs.add(key)
            ca, cb = _chapter_of(a), _chapter_of(b)
            owner_first = _chapter_order(ca) <= _chapter_order(cb)
            own, other = (a, b) if owner_first else (b, a)
            chapter = _chapter_of(own)
            pages[chapter].append((int(own.rsplit("-", 1)[1]), own, other, score))

    out_root = ctx.vault / OUTPUT_SUB
    wanted: set[Path] = set()
    chapters_written = 0
    for chapter, rows in sorted(pages.items()):
        title = _chapter_title(chapter)
        src = chapter_files.get(chapter)
        if not title or not src:
            continue
        rel = src.relative_to(ctx.vault / CANONICAL_SUB).parent
        out = out_root / rel / f"{title} - Cross References.md"
        lines = [
            "---",
            "ownership: ai",
            "mutable: engine",
            "content_type: cross-references",
            f"slug: {chapter}",
            "cssclasses:",
            "- sg-ai",
            "---",
            "",
            f"# {title} — Cross References",
            "",
            "_Textual parallels found deterministically by shared wording;"
            " regenerated by the engine as the corpus grows._",
            "",
        ]
        cur_verse = None
        for n, own, other, score in sorted(rows, key=lambda r: (r[0], -r[3])):
            own_ref, other_ref = _verse_ref(own), _verse_ref(other)
            other_title = _chapter_title(_chapter_of(other))
            if not own_ref or not other_ref or not other_title:
                continue
            if cur_verse != n:
                cur_verse = n
                lines.append(f"## Verse {n}")
            pct = min(99, round(score * 100))
            lines.append(
                f"- [[{title}#^{own}|{own_ref}]] ⇄ [[{other_title}#^{other}|{other_ref}]]"
                f" — shared wording, weight {pct}")
        lines.append("")
        atomic_write_text(out, "\n".join(lines))
        wanted.add(out)
        chapters_written += 1

    pruned = 0
    if out_root.exists():
        for p in out_root.rglob("*.md"):
            if p not in wanted:
                p.unlink()
                pruned += 1

    return {
        "verses_scanned": len(verses),
        "pairs": len(written_pairs),
        "verses_with_parallels": len(best),
        "chapters_written": chapters_written,
        "pruned": pruned,
    }
