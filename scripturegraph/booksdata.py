"""Canonical registry of the standard works: volumes, books, slugs, aliases.

The compact ``slug`` (lds_slug with dashes removed) is the basis of every
stable chapter/verse identifier in the system:

    chapter slug   ->  "1ne-3"          (node id "chapter:1ne-3")
    verse block id ->  "1ne-3-7"        (Obsidian block ref  ^1ne-3-7)

Slugs never contain internal dashes, so ids always split as
``book, chapter[, verse]`` on "-". These identifiers are permanent.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Book:
    order: int
    volume: str
    name: str            # display / folder name, e.g. "1 Nephi"
    lds_slug: str        # official churchofjesuschrist.org slug, e.g. "1-ne"
    chapters: int        # expected chapter (or section) count
    unit: str = "chapter"          # "chapter" | "section"
    prefix: str = ""               # chapter-note title prefix; default = name
    aliases: tuple[str, ...] = ()  # citation-parsing aliases (besides name)

    @property
    def slug(self) -> str:
        return self.lds_slug.replace("-", "")

    @property
    def title_prefix(self) -> str:
        return self.prefix or self.name


OT = "Old Testament"
NT = "New Testament"
BM = "Book of Mormon"
DC = "Doctrine and Covenants"
PGP = "Pearl of Great Price"

VOLUMES = [OT, NT, BM, DC, PGP]

_raw: list[tuple] = [
    # volume, name, lds_slug, chapters, aliases..., optional dict of extras
    (OT, "Genesis", "gen", 50, ("Gen.",)),
    (OT, "Exodus", "ex", 40, ("Ex.", "Exod.")),
    (OT, "Leviticus", "lev", 27, ("Lev.",)),
    (OT, "Numbers", "num", 36, ("Num.",)),
    (OT, "Deuteronomy", "deut", 34, ("Deut.",)),
    (OT, "Joshua", "josh", 24, ("Josh.",)),
    (OT, "Judges", "judg", 21, ("Judg.",)),
    (OT, "Ruth", "ruth", 4, ()),
    (OT, "1 Samuel", "1-sam", 31, ("1 Sam.",)),
    (OT, "2 Samuel", "2-sam", 24, ("2 Sam.",)),
    (OT, "1 Kings", "1-kgs", 22, ("1 Kgs.",)),
    (OT, "2 Kings", "2-kgs", 25, ("2 Kgs.",)),
    (OT, "1 Chronicles", "1-chr", 29, ("1 Chr.", "1 Chron.")),
    (OT, "2 Chronicles", "2-chr", 36, ("2 Chr.", "2 Chron.")),
    (OT, "Ezra", "ezra", 10, ()),
    (OT, "Nehemiah", "neh", 13, ("Neh.",)),
    (OT, "Esther", "esth", 10, ("Esth.",)),
    (OT, "Job", "job", 42, ()),
    (OT, "Psalms", "ps", 150, ("Psalm", "Ps.", "Pss."), {"prefix": "Psalm"}),
    (OT, "Proverbs", "prov", 31, ("Prov.",)),
    (OT, "Ecclesiastes", "eccl", 12, ("Eccl.",)),
    (OT, "Song of Solomon", "song", 8, ("Song of Sol.",)),
    (OT, "Isaiah", "isa", 66, ("Isa.",)),
    (OT, "Jeremiah", "jer", 52, ("Jer.",)),
    (OT, "Lamentations", "lam", 5, ("Lam.",)),
    (OT, "Ezekiel", "ezek", 48, ("Ezek.",)),
    (OT, "Daniel", "dan", 12, ("Dan.",)),
    (OT, "Hosea", "hosea", 14, ("Hos.",)),
    (OT, "Joel", "joel", 3, ()),
    (OT, "Amos", "amos", 9, ()),
    (OT, "Obadiah", "obad", 1, ("Obad.",)),
    (OT, "Jonah", "jonah", 4, ()),
    (OT, "Micah", "micah", 7, ()),
    (OT, "Nahum", "nahum", 3, ()),
    (OT, "Habakkuk", "hab", 3, ("Hab.",)),
    (OT, "Zephaniah", "zeph", 3, ("Zeph.",)),
    (OT, "Haggai", "hag", 2, ("Hag.",)),
    (OT, "Zechariah", "zech", 14, ("Zech.",)),
    (OT, "Malachi", "mal", 4, ("Mal.",)),
    (NT, "Matthew", "matt", 28, ("Matt.",)),
    (NT, "Mark", "mark", 16, ()),
    (NT, "Luke", "luke", 24, ()),
    (NT, "John", "john", 21, ("Jn.",)),
    (NT, "Acts", "acts", 28, ()),
    (NT, "Romans", "rom", 16, ("Rom.",)),
    (NT, "1 Corinthians", "1-cor", 16, ("1 Cor.",)),
    (NT, "2 Corinthians", "2-cor", 13, ("2 Cor.",)),
    (NT, "Galatians", "gal", 6, ("Gal.",)),
    (NT, "Ephesians", "eph", 6, ("Eph.",)),
    (NT, "Philippians", "philip", 4, ("Philip.", "Phil.")),
    (NT, "Colossians", "col", 4, ("Col.",)),
    (NT, "1 Thessalonians", "1-thes", 5, ("1 Thes.", "1 Thess.")),
    (NT, "2 Thessalonians", "2-thes", 3, ("2 Thes.", "2 Thess.")),
    (NT, "1 Timothy", "1-tim", 6, ("1 Tim.",)),
    (NT, "2 Timothy", "2-tim", 4, ("2 Tim.",)),
    (NT, "Titus", "titus", 3, ()),
    (NT, "Philemon", "philem", 1, ("Philem.",)),
    (NT, "Hebrews", "heb", 13, ("Heb.",)),
    (NT, "James", "james", 5, ()),
    (NT, "1 Peter", "1-pet", 5, ("1 Pet.",)),
    (NT, "2 Peter", "2-pet", 3, ("2 Pet.",)),
    (NT, "1 John", "1-jn", 5, ("1 Jn.",)),
    (NT, "2 John", "2-jn", 1, ("2 Jn.",)),
    (NT, "3 John", "3-jn", 1, ("3 Jn.",)),
    (NT, "Jude", "jude", 1, ()),
    (NT, "Revelation", "rev", 22, ("Rev.", "Revelations")),
    (BM, "1 Nephi", "1-ne", 22, ("1 Ne.",)),
    (BM, "2 Nephi", "2-ne", 33, ("2 Ne.",)),
    (BM, "Jacob", "jacob", 7, ()),
    (BM, "Enos", "enos", 1, ()),
    (BM, "Jarom", "jarom", 1, ()),
    (BM, "Omni", "omni", 1, ()),
    (BM, "Words of Mormon", "w-of-m", 1, ("W of M", "WofM")),
    (BM, "Mosiah", "mosiah", 29, ()),
    (BM, "Alma", "alma", 63, ()),
    (BM, "Helaman", "hel", 16, ("Hel.",)),
    (BM, "3 Nephi", "3-ne", 30, ("3 Ne.",)),
    (BM, "4 Nephi", "4-ne", 1, ("4 Ne.",)),
    (BM, "Mormon", "morm", 9, ("Morm.",)),
    (BM, "Ether", "ether", 15, ()),
    (BM, "Moroni", "moro", 10, ("Moro.",)),
    (DC, "Doctrine and Covenants", "dc", 138,
     ("D&C", "D & C", "Doctrine & Covenants"), {"unit": "section", "prefix": "D&C"}),
    (PGP, "Moses", "moses", 8, ()),
    (PGP, "Abraham", "abr", 5, ("Abr.",)),
    (PGP, "Joseph Smith—Matthew", "js-m", 1,
     ("Joseph Smith-Matthew", "JS-Matthew", "JS-M")),
    (PGP, "Joseph Smith—History", "js-h", 1,
     ("Joseph Smith-History", "JS-History", "JS-H")),
    (PGP, "Articles of Faith", "a-of-f", 1, ("A of F", "AofF")),
]

BOOKS: list[Book] = []
for i, row in enumerate(_raw, start=1):
    volume, name, lds_slug, chapters, aliases = row[0], row[1], row[2], row[3], row[4]
    extras = row[5] if len(row) > 5 else {}
    BOOKS.append(Book(order=i, volume=volume, name=name, lds_slug=lds_slug,
                      chapters=chapters, aliases=tuple(aliases), **extras))

BY_SLUG: dict[str, Book] = {b.slug: b for b in BOOKS}
BY_LDS_SLUG: dict[str, Book] = {b.lds_slug: b for b in BOOKS}
BY_NAME: dict[str, Book] = {b.name: b for b in BOOKS}

EXPECTED_VOLUME_CHAPTERS = {OT: 929, NT: 260, BM: 239, DC: 138, PGP: 16}
EXPECTED_TOTAL_CHAPTERS = sum(EXPECTED_VOLUME_CHAPTERS.values())  # 1582

assert len(BOOKS) == 87, f"registry has {len(BOOKS)} books, expected 87"
for _vol, _n in EXPECTED_VOLUME_CHAPTERS.items():
    _got = sum(b.chapters for b in BOOKS if b.volume == _vol)
    assert _got == _n, f"{_vol}: registry chapters {_got} != expected {_n}"


# ---------------------------------------------------------------- identifiers

def chapter_slug(book: Book, chapter: int) -> str:
    return f"{book.slug}-{chapter}"


def verse_slug(book: Book, chapter: int, verse: int) -> str:
    return f"{book.slug}-{chapter}-{verse}"


def chapter_title(book: Book, chapter: int) -> str:
    return f"{book.title_prefix} {chapter}"


def split_chapter_slug(slug: str) -> tuple[Book, int]:
    book_part, ch = slug.rsplit("-", 1)
    return BY_SLUG[book_part], int(ch)


def split_verse_slug(slug: str) -> tuple[Book, int, int]:
    book_part, ch, v = slug.rsplit("-", 2)
    return BY_SLUG[book_part], int(ch), int(v)


def find_chapter_by_title(title: str) -> tuple[Book, int] | None:
    """Resolve a display title like 'Alma 36', 'D&C 76', 'Psalm 23'."""
    title = title.strip()
    parts = title.rsplit(" ", 1)
    if len(parts) != 2 or not parts[1].isdigit():
        return None
    prefix, num = parts[0], int(parts[1])
    for b in BOOKS:
        if prefix in (b.name, b.title_prefix) or prefix in b.aliases:
            return b, num
    # allow alias forms without periods ("1 Ne 3")
    for b in BOOKS:
        for a in (b.name, b.title_prefix, *b.aliases):
            if prefix == a.rstrip("."):
                return b, num
    return None


# -------------------------------------------------- citation alias expansion

def citation_alias_map() -> dict[str, Book]:
    """All surface forms usable in a citation, mapped to their book.

    Includes book names and aliases, each also without trailing periods and
    with unicode dashes normalized to '-'. Keys are case-sensitive.
    """
    out: dict[str, Book] = {}
    for b in BOOKS:
        forms = {b.name, b.title_prefix, *b.aliases}
        expanded = set()
        for f in forms:
            f = f.replace("—", "-").replace("–", "-")
            expanded.add(f)
            if f.endswith("."):
                expanded.add(f[:-1])
            if "." in f[:-1]:
                expanded.add(f.replace(".", ""))
        for f in expanded:
            out.setdefault(f, b)
    return out
