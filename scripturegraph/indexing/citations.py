"""Deterministic scripture-citation parser.

Finds explicit references like "1 Nephi 3:7", "Alma 36:22–24", "D&C 76:22-24",
"Hel. 5:12", "Matt. 5:3, 5, 7", "Joseph Smith—History 1:15-20", including
same-book continuations ("Alma 5:14; 7:11-13") and chapter-only references
("Alma 36"). Pure software — used both to index documents and to verify
AI-proposed citations mechanically.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

from scripturegraph.booksdata import BY_SLUG, citation_alias_map


@dataclass
class Citation:
    book_slug: str
    chapter: int
    verse_ranges: list[tuple[int, int]] = field(default_factory=list)  # empty = whole chapter
    text: str = ""
    start: int = 0
    end: int = 0
    valid: bool = True  # chapter within known bounds

    @property
    def chapter_slug(self) -> str:
        return f"{self.book_slug}-{self.chapter}"

    def verses(self) -> list[int]:
        out: list[int] = []
        for a, b in self.verse_ranges:
            out.extend(range(a, min(b, a + 200) + 1))
        return out

    def display(self) -> str:
        book = BY_SLUG[self.book_slug]
        base = f"{book.title_prefix} {self.chapter}"
        if not self.verse_ranges:
            return base
        parts = [f"{a}" if a == b else f"{a}-{b}" for a, b in self.verse_ranges]
        return f"{base}:{','.join(parts)}"


_VERSES_PART = r"\s*:\s*\d{1,3}(?:\s*-\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*-\s*\d{1,3})?)*"
# used with .match(text, pos) so it is implicitly anchored at pos
_CONT_RE = re.compile(r"\s*;\s*(?P<chap>\d{1,3})(?P<verses>" + _VERSES_PART + r")")


@lru_cache(maxsize=1)
def _pattern() -> tuple[re.Pattern, dict]:
    amap = citation_alias_map()
    alts = sorted(amap.keys(), key=len, reverse=True)
    alt_re = "|".join(re.escape(a) for a in alts)
    pat = re.compile(
        r"(?<![A-Za-z])(?P<book>" + alt_re + r")[  ]+"
        r"(?P<chap>\d{1,3})(?!\d)"
        r"(?P<verses>" + _VERSES_PART + r")?")
    return pat, amap


def _parse_verses(vtext: str | None) -> list[tuple[int, int]]:
    if not vtext:
        return []
    vtext = vtext.split(":", 1)[1]
    ranges = []
    for part in vtext.split(","):
        part = part.strip().replace(" ", "")
        if not part:
            continue
        if "-" in part:
            a, _, b = part.partition("-")
            if a.isdigit() and b.isdigit() and int(a) <= int(b):
                ranges.append((int(a), int(b)))
        elif part.isdigit():
            ranges.append((int(part), int(part)))
    return ranges


def find_citations(text: str) -> list[Citation]:
    # normalize dash variants without shifting offsets (1-char replacements)
    norm = (text.replace("–", "-").replace("—", "-")
                .replace("‑", "-").replace(" ", " "))
    pat, amap = _pattern()
    out: list[Citation] = []
    pos = 0
    while True:
        m = pat.search(norm, pos)
        if m is None:
            break
        book = amap[m.group("book")]
        chap = int(m.group("chap"))
        # guard: "Book of Mormon 9" is the volume, not the book "Mormon"
        if book.slug == "morm" and norm[max(0, m.start() - 8):m.start()].lower() == "book of ":
            pos = m.end()
            continue
        cit = Citation(
            book_slug=book.slug, chapter=chap,
            verse_ranges=_parse_verses(m.group("verses")),
            text=text[m.start():m.end()], start=m.start(), end=m.end(),
            valid=1 <= chap <= book.chapters)
        out.append(cit)
        pos = m.end()
        # same-book continuations: "; 7:11-13"
        while True:
            cm = _CONT_RE.match(norm, pos)
            if cm is None:
                break
            cchap = int(cm.group("chap"))
            out.append(Citation(
                book_slug=book.slug, chapter=cchap,
                verse_ranges=_parse_verses(cm.group("verses")),
                text=text[cm.start():cm.end()].strip("; "), start=cm.start(), end=cm.end(),
                valid=1 <= cchap <= book.chapters))
            pos = cm.end()
    return out


def resolve_reference(ref: str) -> Citation | None:
    """Parse a single reference string like 'Alma 36:22-24'. None if unparseable."""
    found = find_citations(ref.strip())
    if len(found) >= 1 and found[0].valid:
        return found[0]
    return None


def scan_chapter_citations(ctx, chapter_slug: str) -> dict:
    """Explicit scripture references inside a chapter's own text (rare but real,
    e.g. narrative references). Produces accepted 'cites' edges."""
    import json as _json

    from scripturegraph.util import now_iso
    db = ctx.db()
    rows = db.execute("SELECT slug, text FROM verses WHERE chapter_slug=? ORDER BY verse",
                      (chapter_slug,)).fetchall()
    src = f"chapter:{chapter_slug}"
    found: dict[str, list[str]] = {}
    for r in rows:
        for cit in find_citations(r["text"]):
            if not cit.valid or cit.chapter_slug == chapter_slug:
                continue
            exists = db.execute("SELECT 1 FROM chapters WHERE slug=?",
                                (cit.chapter_slug,)).fetchone()
            if not exists:
                continue
            found.setdefault(cit.chapter_slug, []).append(r["slug"])
    db.execute("DELETE FROM edges WHERE src=? AND rel='cites' AND provenance='pass:citations'",
               (src,))
    for target, verse_slugs in found.items():
        db.execute(
            "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
            "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(src,dst,rel) DO UPDATE SET weight=excluded.weight, "
            "meta_json=excluded.meta_json, updated_at=excluded.updated_at",
            (src, f"chapter:{target}", "cites", "accepted", 0.99, float(len(verse_slugs)),
             _json.dumps({"verses": verse_slugs[:20]}), "pass:citations",
             now_iso(), now_iso()))
    db.commit()
    return {"cites": len(found)}
