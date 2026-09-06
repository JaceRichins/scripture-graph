"""Footnote notes — the official study apparatus, one page per chapter, so
the phone can show it on the verse.

`chapter_apparatus` holds the Church's footnotes for every chapter (fetched
through the Gospel Library API, corpus/glib.py): per verse, the markers and
the scripture references each one points to. The engine's database is not
reachable from a phone; a note per chapter is. Each note carries a compact
JSON block the plugin reads (verse → [{marker, refs}]) and a readable list
beneath it for anyone opening the page by hand. Regenerable; the apparatus
fetch and the weekly run both refresh them.
"""
from __future__ import annotations

import json

from scripturegraph.booksdata import BY_SLUG
from scripturegraph.context import Ctx
from scripturegraph.graphops import chapter_display
from scripturegraph.util import now_iso
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import FOLDER_CANONICAL, FOLDER_SCRIPTURES, canonical_dir, record_file

FOLDER_FOOTNOTES = f"{FOLDER_SCRIPTURES}/Footnotes"


def footnote_path(cslug: str) -> str | None:
    book_slug = cslug.rsplit("-", 1)[0]
    book = BY_SLUG.get(book_slug)
    if not book:
        return None
    rel = canonical_dir(book)[len(FOLDER_CANONICAL) + 1:]
    return f"{FOLDER_FOOTNOTES}/{rel}/{chapter_display(cslug)} - Footnotes.md"


def _compact(footnotes: dict) -> dict:
    """{verse: [{m, refs: [{c, t, v: [..], l}]}]} — chapter slug, chapter title,
    verses, the printed label. Small enough that 1,584 of them are a few MB."""
    out: dict[str, list] = {}
    for verse, notes in footnotes.items():
        items = []
        for n in notes or []:
            refs = []
            for r in n.get("refs") or []:
                c = r.get("chapter")
                try:
                    t = chapter_display(c) if c else None
                except KeyError:
                    t = None
                refs.append({"c": c, "t": t, "v": r.get("verses") or [], "l": r.get("label") or ""})
            if refs or n.get("text"):
                items.append({"m": n.get("marker") or "", "refs": refs,
                              **({"x": n["text"]} if n.get("text") else {})})
        if items:
            out[str(verse)] = items
    return out


def write_footnote_notes(ctx: Ctx, only: list[str] | None = None) -> int:
    """One note per chapter that has apparatus. Returns notes written (changed)."""
    db = ctx.db()
    q = "SELECT chapter_slug, heading, footnotes_json FROM chapter_apparatus"
    rows = db.execute(q).fetchall()
    n = 0
    for r in rows:
        cslug = r["chapter_slug"]
        if only and cslug not in only:
            continue
        rel = footnote_path(cslug)
        if not rel:
            continue
        try:
            fn = json.loads(r["footnotes_json"] or "{}")
        except json.JSONDecodeError:
            continue
        compact = _compact(fn)
        title = chapter_display(cslug)
        lines = [f"# {title} — Footnotes", "",
                 "The official study footnotes for this chapter, verse by verse. The reader shows "
                 "them on the verse; this page is the same data, readable.", ""]
        if r["heading"]:
            lines += [f"> {r['heading'].strip()}", ""]
        lines += ["```json", json.dumps(compact, ensure_ascii=False, separators=(",", ":")), "```", ""]
        for verse in sorted(compact, key=lambda v: int(v) if v.isdigit() else 0):
            parts = []
            for it in compact[verse]:
                refs = " · ".join(
                    (mdkit.wikilink(rf["t"], rf["l"], f"#^{rf['c']}-{rf['v'][0]}") if rf.get("t") and rf.get("v")
                     else rf["l"]) for rf in it["refs"])
                text = f"{it['m']} {refs}".strip()
                if it.get("x"):
                    text += f" — {it['x']}"
                parts.append(text)
            lines.append(f"- **{verse}** " + "; ".join(parts))
        fm = {"ownership": "ai", "mutable": "engine", "content_type": "footnotes", "slug": cslug,
              "verses": len(compact), "updated_at": now_iso(), "cssclasses": ["sg-ai"]}
        if record_file(ctx, rel, "footnotes", "generator", None, mdkit.build_note(fm, "\n".join(lines))):
            n += 1
    db.commit()
    if n:
        ctx.log.info("footnotes.written", notes=n)
    return n
