"""General Conference importer + the chapter-level conference pass.

Accepts drop files (JSON / HTML / EPUB / MD). JSON is preferred:

    {"title": "...", "speaker": "...", "year": 2025, "month": "April",
     "url": "...", "body": "full text"}          (or "paragraphs": [...])

The importer distinguishes EXPLICIT citations (parsed from the talk text,
deterministic) from semantic connections (later AI/embedding passes); the
distinction stays visible in rendered sections. Vault talk notes carry
metadata + citations + a brief excerpt; full text lives only in the index.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from scripturegraph.context import Ctx
from scripturegraph.corpus.universal import extract_texts, store_document
from scripturegraph.graphops import chapter_display
from scripturegraph.util import read_text, sanitize_filename, slugify, truncate
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_CONFERENCE, record_file
from scripturegraph.vaultgen.patch import apply_ops

_MONTHS = {"april": "April", "apr": "April", "04": "April", "4": "April",
           "october": "October", "oct": "October", "10": "October"}


def _parse_meta_from_name(path: Path) -> dict:
    """Best-effort year/month from filename like '2024-04-nelson-title.html'."""
    m = re.search(r"(19|20)\d{2}", path.name)
    year = m.group(0) if m else ""
    month = ""
    for token, canon in _MONTHS.items():
        if re.search(rf"(?<![a-z0-9]){token}(?![a-z0-9])", path.name.lower()):
            month = canon
            break
    return {"year": year, "month": month}


def import_conference_file(ctx: Ctx, path: Path, source_id: str, doc_key: str,
                           content_hash: str) -> int:
    talks: list[dict] = []
    if path.suffix.lower() == ".json":
        data = json.loads(read_text(path))
        items = data if isinstance(data, list) else [data]
        for it in items:
            body = it.get("body") or "\n\n".join(it.get("paragraphs") or [])
            if not body:
                continue
            talks.append({"title": it.get("title") or path.stem,
                          "speaker": it.get("speaker", ""),
                          "year": str(it.get("year", "")),
                          "month": _MONTHS.get(str(it.get("month", "")).lower(),
                                               str(it.get("month", ""))),
                          "url": it.get("url", ""), "body": body})
    else:
        meta = _parse_meta_from_name(path)
        for title, text in extract_texts(path):
            if len(text.strip()) < 400:
                continue
            talks.append({"title": title or path.stem, "speaker": "",
                          "year": meta["year"], "month": meta["month"],
                          "url": "", "body": text})
    n = 0
    for t in talks:
        year = t["year"] or "Unknown Year"
        month = t["month"] or ""
        tslug = slugify(f"{year}-{month}-{t['title']}")[:80]
        doc_id = f"talk:{tslug}"
        date = f"{year}-{month}" if month else year
        store_document(ctx, doc_id, source_id, "talk", t["title"], t["body"],
                       author=t["speaker"], date=date, url=t["url"],
                       local_path=str(path), content_hash=content_hash,
                       meta={"year": year, "month": month})
        _write_talk_note(ctx, doc_id, t, year, month)
        n += 1
    ctx.log.info("import.conference", file=path.name, talks=n)
    return n


def _write_talk_note(ctx: Ctx, doc_id: str, t: dict, year: str, month: str) -> None:
    db = ctx.db()
    title = sanitize_filename(f"{t['title']} ({t['speaker'] or 'Conference'}, "
                              f"{month or ''} {year})".replace("  ", " "))
    folder = f"{FOLDER_CONFERENCE}/{year}" + (f"/{month}" if month else "")
    relpath = f"{folder}/{title}.md"
    cites = db.execute(
        "SELECT dst, weight FROM edges WHERE src=? AND rel='cites' ORDER BY weight DESC",
        (doc_id,)).fetchall()
    lines = [f"# {t['title']}", "",
             f"**Speaker:** {t['speaker'] or 'Unknown'} · **Conference:** "
             f"{month + ' ' if month else ''}{year}"]
    if t.get("url"):
        lines.append(f"**Source:** {t['url']}")
    lines += ["", "> " + truncate(t["body"].strip().replace("\n", " "), 400),
              "", "## Explicit scripture citations", ""]
    if cites:
        for c in cites:
            cslug = c["dst"].split(":", 1)[1]
            lines.append(f"- {md.wikilink(chapter_display(cslug))} "
                         f"({int(c['weight'] or 0)}×)")
    else:
        lines.append("*None detected.*")
    fm = {"ownership": "system", "mutable": "ai", "content_type": "talk",
          "speaker": t["speaker"], "year": year, "month": month, "url": t.get("url", ""),
          "doc_id": doc_id}
    record_file(ctx, relpath, "talk", "librarian", doc_id, md.build_note(fm, "\n".join(lines)))
    db.execute("UPDATE nodes SET vault_path=? WHERE id=?", (relpath, doc_id))
    db.commit()


# ------------------------------------------------------- chapter conference pass

def render_conference_section(ctx: Ctx, cslug: str) -> dict:
    """Deterministic conference section for one chapter: explicit citations
    only, clearly labeled (semantic connections come from later AI passes)."""
    from scripturegraph.booksdata import split_chapter_slug
    from scripturegraph.vaultgen.generate import study_relpath
    db = ctx.db()
    rows = db.execute(
        "SELECT e.src, e.weight, n.title, n.vault_path, n.meta_json FROM edges e "
        "JOIN nodes n ON n.id=e.src "
        "WHERE e.dst=? AND e.rel='cites' AND e.src LIKE 'talk:%' "
        "ORDER BY e.weight DESC LIMIT 10", (f"chapter:{cslug}",)).fetchall()
    lines = []
    for r in rows:
        meta = json.loads(r["meta_json"] or "{}")
        label = f"{meta.get('author') or 'Conference talk'}"
        when = meta.get("date") or ""
        note_title = Path(r["vault_path"]).stem if r["vault_path"] else r["title"]
        lines.append(f"- {md.wikilink(note_title, r['title'])} — {label}"
                     f"{', ' + when if when else ''} *(explicit citation)*")
    if not lines:
        return {"talks": 0}
    book, n = split_chapter_slug(cslug)
    apply_ops(ctx, [{"op": "set_section", "path": study_relpath(book, n),
                     "section": "conference", "content": "\n".join(lines)}],
              actor="engine:conference")
    return {"talks": len(lines)}
