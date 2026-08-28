"""Annotated chapter view: verse-by-verse links WITH the scripture text.

Canonical files stay pure (immutability rule), so the annotated companion
transcludes each verse from the canonical note (`![[Alma 36#^alma-36-18]]`)
and renders that verse's connections immediately beneath it:

- official footnote cross-references (chapter_apparatus, once fetched)
- verified text parallels (per-verse pairs from the parallel detector)

The page regenerates on every corpus bump (deterministic 'annotate' wave),
so it enriches automatically as the apparatus and corpora arrive. The CSS
snippet renders the embeds seamlessly, so it reads like a normal chapter
with study links under each verse.
"""
from __future__ import annotations

import json
from collections import defaultdict

from scripturegraph.booksdata import Book, chapter_title, split_chapter_slug
from scripturegraph.context import Ctx
from scripturegraph.graphops import chapter_display, verse_display
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import (FOLDER_SCRIPTURES, personal_title,
                                              record_file, study_title)

FOLDER_ANNOTATED = f"{FOLDER_SCRIPTURES}/Annotated"


def annotated_title(book: Book, chapter: int) -> str:
    return f"{chapter_title(book, chapter)} (Annotated)"


def annotated_relpath(book: Book, chapter: int) -> str:
    from scripturegraph.booksdata import book_dirname, volume_dirname
    return (f"{FOLDER_ANNOTATED}/{volume_dirname(book.volume)}/{book_dirname(book)}"
            f"/{annotated_title(book, chapter)}.md")


def _footnote_links_by_verse(ctx: Ctx, cslug: str) -> dict[int, list[str]]:
    row = ctx.db().execute(
        "SELECT footnotes_json FROM chapter_apparatus WHERE chapter_slug=?",
        (cslug,)).fetchone()
    out: dict[int, list[str]] = defaultdict(list)
    if not row or not row["footnotes_json"]:
        return out
    try:
        per_verse = json.loads(row["footnotes_json"])
    except json.JSONDecodeError:
        return out
    for verse_str, notes in per_verse.items():
        try:
            v = int(verse_str)
        except ValueError:
            continue
        for note in notes:
            for ref in note.get("refs") or []:
                tchap = ref.get("chapter")
                if not tchap or not ctx.db().execute(
                        "SELECT 1 FROM chapters WHERE slug=?", (tchap,)).fetchone():
                    continue
                verses = ref.get("verses") or []
                label = ref.get("label") or (
                    verse_display(f"{tchap}-{verses[0]}") if verses
                    else chapter_display(tchap))
                if verses:
                    link = md.verse_link(chapter_display(tchap),
                                         f"{tchap}-{verses[0]}", label)
                else:
                    link = md.wikilink(chapter_display(tchap), label)
                if link not in out[v]:
                    out[v].append(link)
    return out


def _parallel_links_by_verse(ctx: Ctx, cslug: str) -> dict[int, list[str]]:
    me = f"chapter:{cslug}"
    out: dict[int, list[str]] = defaultdict(list)
    rows = ctx.db().execute(
        "SELECT src, dst, meta_json FROM edges WHERE (src=? OR dst=?) "
        "AND rel='parallel_to' AND status='accepted'", (me, me)).fetchall()
    for r in rows:
        meta = json.loads(r["meta_json"] or "{}")
        for pair in meta.get("verse_pairs") or []:
            va, vb = pair[0], pair[1]
            mine, theirs = (va, vb) if va.startswith(cslug + "-") else (vb, va)
            if not mine.startswith(cslug + "-"):
                continue
            try:
                v = int(mine.rsplit("-", 1)[1])
            except ValueError:
                continue
            tchap = theirs.rsplit("-", 1)[0]
            link = md.verse_link(chapter_display(tchap), theirs,
                                 f"≈ {verse_display(theirs)}")
            if link not in out[v] and len(out[v]) < 6:
                out[v].append(link)
    return out


def render_annotated_chapter(ctx: Ctx, cslug: str) -> dict:
    book, n = split_chapter_slug(cslug)
    title = chapter_title(book, n)
    verses = [r["slug"] for r in ctx.db().execute(
        "SELECT slug FROM verses WHERE chapter_slug=? ORDER BY verse", (cslug,))]
    if not verses:
        return {"skipped": True}
    foot = _footnote_links_by_verse(ctx, cslug)
    para = _parallel_links_by_verse(ctx, cslug)
    heading_row = ctx.db().execute(
        "SELECT heading FROM chapter_apparatus WHERE chapter_slug=?", (cslug,)).fetchone()

    fm = {"ownership": "system", "mutable": "ai", "content_type": "annotated",
          "book": book.name, "chapter": n, "slug": cslug,
          "cssclasses": ["sg-annotated"]}
    lines = [f"# {title} — Annotated", "",
             f"{md.wikilink(title, 'Plain text')} · "
             f"{md.wikilink(study_title(book, n), 'Study guide')} · "
             f"{md.wikilink(personal_title(book, n), 'My notes')}", ""]
    if heading_row and heading_row["heading"]:
        lines += [f"> [!info] Chapter heading (official)\n> {heading_row['heading']}", ""]
    n_linked = 0
    for vslug in verses:
        v = int(vslug.rsplit("-", 1)[1])
        lines.append(f"![[{title}#^{vslug}]]")
        links = (foot.get(v) or []) + (para.get(v) or [])
        if links:
            lines.append("> " + " · ".join(links[:10]))
            n_linked += 1
        lines.append("")
    record_file(ctx, annotated_relpath(book, n), "annotated", "generator",
                f"chapter:{cslug}", md.build_note(fm, "\n".join(lines)))
    return {"verses": len(verses), "verses_with_links": n_linked}
