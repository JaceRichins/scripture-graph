"""Deterministic study-guide synthesis.

Fills the mechanical sections of a chapter's study guide (people, places,
related scriptures, topics) purely from verified index data — links that
software can defend. Interpretive sections (overview, doctrines, language,
evidence…) are left for AI passes; nothing is ever fabricated here.

All writes go through the Librarian patch layer, same as AI output.
"""
from __future__ import annotations

import json
from pathlib import Path

from scripturegraph.booksdata import split_chapter_slug
from scripturegraph.context import Ctx
from scripturegraph.graphops import chapter_display, verse_display
from scripturegraph.util import now_iso
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import study_relpath
from scripturegraph.vaultgen.patch import apply_ops
from scripturegraph.util import read_text
from scripturegraph.vaultgen.md import section_is_empty as mdkit_section_is_empty


def _current_section(ctx: Ctx, relpath: str, name: str) -> str:
    p = ctx.vault / relpath
    if not p.exists():
        return ""
    _, body = md.parse_note(read_text(p))
    return md.get_section(body, name) or ""


def _entity_lines(ctx: Ctx, cslug: str, node_type: str, cap: int) -> list[str]:
    rows = ctx.db().execute(
        "SELECT e.dst, e.status, e.weight, e.meta_json, n.title FROM edges e "
        "JOIN nodes n ON n.id = e.dst "
        "WHERE e.src=? AND e.rel='mentions' AND n.node_type=? "
        "AND e.status IN ('accepted','tentative') "
        "ORDER BY CASE e.status WHEN 'accepted' THEN 0 ELSE 1 END, e.weight DESC LIMIT ?",
        (f"chapter:{cslug}", node_type, cap)).fetchall()
    lines = []
    for r in rows:
        w = int(r["weight"] or 0)
        if r["status"] == "accepted":
            lines.append(f"- {md.wikilink(r['title'])} — {w} mention{'s' if w != 1 else ''}")
        else:
            lines.append(f"- {md.wikilink(r['title'])} *(ambiguous name match)*")
    return lines


def _related_lines(ctx: Ctx, cslug: str, cap: int) -> list[str]:
    """Chapters related to this one, for the Related Chapters section.

    Every query here is filtered to chapter endpoints. `cites`, `parallel_to`
    and `semantically_related` are NOT chapter-only relations — topics, events
    and personal notes ride them too — and a topic slug handed to
    `chapter_display` raises KeyError, which inside a research job's write
    phase rolls the whole chapter back. `build_context` already guards its own
    copy of these queries; this is the render side of the same relation, and it
    was the last unguarded reader (live: ps-69 died on KeyError
    'crucifixion-of-jesus', an event node on the far end of a parallel_to edge,
    and dc-132 and josh-4 were carrying the same landmine).
    """
    me = f"chapter:{cslug}"
    db = ctx.db()
    lines: list[str] = []
    # explicit citations first
    for r in db.execute(
            "SELECT dst FROM edges WHERE src=? AND rel='cites' AND status='accepted' "
            "AND dst LIKE 'chapter:%' ORDER BY weight DESC LIMIT 6", (me,)):
        other = r["dst"].split(":", 1)[1]
        lines.append(f"- {md.wikilink(chapter_display(other))} — cited in the text")
    # official footnote cross-references (canonical study apparatus)
    for r in db.execute(
            "SELECT dst, weight, meta_json FROM edges WHERE src=? AND rel='footnote_xref' "
            "AND dst LIKE 'chapter:%' ORDER BY weight DESC LIMIT ?", (me, max(6, cap // 2))):
        other = r["dst"].split(":", 1)[1]
        meta = json.loads(r["meta_json"] or "{}")
        pairs = meta.get("pairs") or []
        n = int(r["weight"] or 0)
        detail = f"{n} footnote cross-reference{'s' if n != 1 else ''}"
        if pairs:
            src_v = pairs[0][0]
            src_slug = f"{cslug}-{src_v}"
            detail += (" (from "
                       f"{md.verse_link(chapter_display(cslug), src_slug, verse_display(src_slug))})")
        lines.append(f"- {md.wikilink(chapter_display(other))} — {detail}")
    rows = db.execute(
        "SELECT src, dst, weight, meta_json FROM edges "
        "WHERE (src=? OR dst=?) AND rel='parallel_to' AND status='accepted' "
        "AND src LIKE 'chapter:%' AND dst LIKE 'chapter:%' "
        "ORDER BY weight DESC LIMIT ?", (me, me, cap)).fetchall()
    for r in rows:
        other = (r["dst"] if r["src"] == me else r["src"]).split(":", 1)[1]
        meta = json.loads(r["meta_json"] or "{}")
        pairs = meta.get("verse_pairs") or []
        n = meta.get("n_verse_pairs", len(pairs))
        detail = f"{n} parallel verse{'s' if n != 1 else ''}"
        if pairs:
            va, vb, _score = pairs[0]
            mine, theirs = (va, vb) if va.startswith(cslug + "-") else (vb, va)
            detail += (f", e.g. {md.verse_link(chapter_display(cslug), mine, verse_display(mine))}"
                       f" ↔ {md.verse_link(chapter_display(other), theirs, verse_display(theirs))}")
        lines.append(f"- {md.wikilink(chapter_display(other))} — {detail}")
    return lines


def _topic_lines(ctx: Ctx, cslug: str, cap: int) -> list[str]:
    rows = ctx.db().execute(
        "SELECT e.status, e.meta_json, n.title FROM edges e JOIN nodes n ON n.id=e.dst "
        "WHERE e.src=? AND e.rel='discusses' AND e.status IN ('accepted','tentative') "
        "ORDER BY CASE e.status WHEN 'accepted' THEN 0 ELSE 1 END, e.weight DESC LIMIT ?",
        (f"chapter:{cslug}", cap)).fetchall()
    lines = []
    for r in rows:
        if r["status"] == "accepted":
            lines.append(f"- {md.wikilink(r['title'])}")
        else:
            lines.append(f"- {md.wikilink(r['title'])} *(keyword match — unconfirmed)*")
    return lines


def _evidence_lines(ctx: Ctx, cslug: str, cap: int = 6) -> list[str]:
    """Render judged evidence claims as callouts (ACCEPT first, then TENTATIVE)."""
    rows = ctx.db().execute(
        "SELECT id, text, tier, scores_json, consensus, provenance_json FROM claims "
        "WHERE node_id=? AND claim_type='evidence' AND tier IN ('ACCEPT','TENTATIVE') "
        "ORDER BY CASE tier WHEN 'ACCEPT' THEN 0 ELSE 1 END, id LIMIT ?",
        (f"chapter:{cslug}", cap)).fetchall()
    blocks = []
    for r in rows:
        scores = json.loads(r["scores_json"] or "{}")
        prov = json.loads(r["provenance_json"] or "{}")
        cls = (scores.get("class") or "Evidence").title()
        tag = " *(tentative)*" if r["tier"] == "TENTATIVE" else ""
        lines = [f"> [!evidence] {cls}{tag}"]
        for text_line in r["text"].strip().splitlines():
            lines.append(f"> {text_line}")
        meter = []
        for key, label in (("evidence_strength", "strength"),
                           ("claim_confidence", "confidence")):
            v = scores.get(key)
            if v is None:
                continue
            # these scores come from model output: a stringified number ("0.8")
            # or a word must not cost the chapter its whole research run at
            # render time — coerce, and failing that show what was actually said
            try:
                meter.append(f"{label} {float(v):.1f}")
            except (TypeError, ValueError):
                meter.append(f"{label} {str(v).strip()}")
        if r["consensus"]:
            meter.append(r["consensus"])
        note = prov.get("evidence_note")
        if note:
            meter.append(md.wikilink(note, "full dossier"))
        if meter:
            lines.append("> — " + " · ".join(meter))
        blocks.append("\n".join(lines))
    return blocks


def synthesize_chapter(ctx: Ctx, cslug: str) -> dict:
    book, n = split_chapter_slug(cslug)
    relpath = study_relpath(book, n)
    cap_people = int(ctx.c("links.max_people_per_chapter", 15))
    cap_places = int(ctx.c("links.max_places_per_chapter", 12))
    cap_rel = int(ctx.c("links.max_related_chapters", 12))
    cap_topics = int(ctx.c("links.max_topics_per_chapter", 8))

    sections = {
        "people": "\n".join(_entity_lines(ctx, cslug, "person", cap_people)),
        "places": "\n".join(_entity_lines(ctx, cslug, "place", cap_places)),
        "related-scriptures": "\n".join(_related_lines(ctx, cslug, cap_rel)),
        "topics": "\n".join(_topic_lines(ctx, cslug, cap_topics)),
        "evidence": "\n\n".join(_evidence_lines(ctx, cslug)),
    }
    # official chapter heading seeds the overview while no AI prose exists
    app = ctx.db().execute(
        "SELECT heading FROM chapter_apparatus WHERE chapter_slug=?", (cslug,)).fetchone()
    if app and app["heading"]:
        current = _current_section(ctx, relpath, "overview")
        if mdkit_section_is_empty(current) or current.startswith("> [!info] Chapter heading"):
            sections["overview"] = ("> [!info] Chapter heading (official)\n"
                                    f"> {app['heading']}")
    ops = [{"op": "set_section", "path": relpath, "section": name, "content": content}
           for name, content in sections.items() if content]
    ops.append({"op": "set_fm_field", "path": relpath,
                "field": "corpus_version_reviewed", "value": ctx.corpus_version()})
    result = apply_ops(ctx, ops, actor="engine:synthesis")
    from scripturegraph.coverage import update_chapter_coverage
    update_chapter_coverage(ctx, cslug)
    return {"sections_filled": sum(1 for c in sections.values() if c),
            "changed": len(result.changed_paths)}


def synthesize_topic(ctx: Ctx, node_id: str) -> dict:
    """Deterministic dossier scaffolding for one Gospel Topic or Event:
    scripture anchors + strongest linked chapters; related entities."""
    db = ctx.db()
    node = db.execute("SELECT * FROM nodes WHERE id=?", (node_id,)).fetchone()
    if node is None or not node["vault_path"]:
        return {"skipped": True}
    scripture_section = ("scriptural-accounts" if node["node_type"] == "event"
                         else "scriptural-foundation")
    meta = json.loads(node["meta_json"] or "{}")
    lines = []
    from scripturegraph.indexing.citations import resolve_reference
    for ref in meta.get("anchors", [])[:12]:
        cit = resolve_reference(ref)
        if cit is None:
            continue
        vs = cit.verses()
        anchor = f"#^{cit.chapter_slug}-{vs[0]}" if vs else ""
        lines.append(f"- [[{chapter_display(cit.chapter_slug)}{anchor}|{cit.display()}]]"
                     f" — key passage")
    # 'discusses' is not chapters-only: secondary-source episodes point at
    # topics with the same relation, and rendering one as a chapter reference
    # crashes the whole dossier. Ask for chapters explicitly.
    chapters = db.execute(
        "SELECT e.src, e.status, e.weight FROM edges e WHERE e.dst=? AND e.rel='discusses' "
        "AND e.src LIKE 'chapter:%' "
        "AND e.status IN ('accepted','tentative') ORDER BY e.weight DESC LIMIT 15",
        (node_id,)).fetchall()
    for r in chapters:
        cslug = r["src"].split(":", 1)[1]
        tag = "" if r["status"] == "accepted" else " *(keyword match)*"
        line = f"- {md.wikilink(chapter_display(cslug))}{tag}"
        if line not in lines:
            lines.append(line)
    talks = db.execute(
        "SELECT n.title, n.vault_path FROM edges e JOIN nodes n ON n.id=e.src "
        "WHERE e.dst=? AND e.rel='discusses' AND e.src LIKE 'talk:%' LIMIT 8",
        (node_id,)).fetchall()
    ops = []
    if lines:
        ops.append({"op": "set_section", "path": node["vault_path"],
                    "section": scripture_section, "content": "\n".join(lines)})
    if talks:
        tl = [f"- {md.wikilink(Path(t['vault_path']).stem if t['vault_path'] else t['title'], t['title'])}"
              for t in talks]
        ops.append({"op": "set_section", "path": node["vault_path"],
                    "section": "conference", "content": "\n".join(tl)})
    if ops:
        apply_ops(ctx, ops, actor="engine:topic-synthesis")
    return {"anchors": len(lines)}


def render_history_section(ctx: Ctx, cslug: str) -> dict:
    """Deterministic history section: imported historical / JSP / reference
    documents whose text explicitly cites this chapter."""
    rows = ctx.db().execute(
        "SELECT e.src, e.weight, n.title, n.vault_path, n.meta_json FROM edges e "
        "JOIN nodes n ON n.id=e.src "
        "WHERE e.dst=? AND e.rel='cites' AND e.src LIKE 'doc:%' "
        "ORDER BY e.weight DESC LIMIT 10", (f"chapter:{cslug}",)).fetchall()
    lines = []
    for r in rows:
        meta = json.loads(r["meta_json"] or "{}")
        kind = meta.get("doc_type", "document")
        when = meta.get("date") or ""
        lines.append(f"- **{r['title']}** ({kind}{', ' + when if when else ''}) "
                     f"*(explicit citation)*")
    if not lines:
        return {"docs": 0}
    book, n = split_chapter_slug(cslug)
    apply_ops(ctx, [{"op": "set_section", "path": study_relpath(book, n),
                     "section": "history", "content": "\n".join(lines)}],
              actor="engine:history")
    return {"docs": len(lines)}
