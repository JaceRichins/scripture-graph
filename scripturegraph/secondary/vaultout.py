"""Vault notes for the secondary-source layer.

`AI Library/65 Secondary Sources/` holds the MOC, one profile note per
source, one note per ingested episode, and the discovery report. Episode
notes carry metadata/summaries/timestamps/attribution — never transcripts
(§10/§20). Entity + study-guide pages get a maintained `secondary-sources`
marker section so curated media appears exactly where you study (§31).
"""
from __future__ import annotations

import json
import re

from scripturegraph.context import Ctx
from scripturegraph.secondary import rubric
from scripturegraph.util import read_text
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_LIBRARY, record_file

FOLDER_SECONDARY = f"{FOLDER_LIBRARY}/65 Secondary Sources"

_SAFE = re.compile(r'[<>:"/\\|?*#^\[\]]')


def _safe_name(s: str, limit: int = 90) -> str:
    out = _SAFE.sub("", s).strip().rstrip(".")
    out = re.sub(r"\s+", " ", out)
    return out[:limit].strip()


def source_note_path(source: dict) -> str:
    return f"{FOLDER_SECONDARY}/Sources/{_safe_name(source['name'])}.md"


def item_note_path(source: dict, item: dict) -> str:
    date = (item.get("published_at") or "undated")[:10]
    return (f"{FOLDER_SECONDARY}/{_safe_name(source['name'], 60)}/"
            f"{date} {_safe_name(item['title'], 70)}.md")


def _ts_link(item: dict, seconds: int | None) -> str:
    label = rubric.fmt_ts(seconds)
    jump = rubric.jump_url(item.get("url"), seconds)
    return f"[{label}]({jump})" if jump else label


# ------------------------------------------------------------ source notes

def write_source_note(ctx: Ctx, source: dict) -> str:
    hosts = json.loads(source.get("hosts_json") or "[]")
    domains = json.loads(source.get("expertise_domains_json") or "[]")
    strengths = json.loads(source.get("strengths_json") or "[]")
    limits = json.loads(source.get("limitations_json") or "[]")
    scores = json.loads(source.get("scores_json") or "{}")
    fm = {"ownership": "system", "mutable": "ai", "content_type": "sec-source",
          "sg-id": f"secsource:{source['source_id']}",
          "source-tier": source.get("quality_tier"),
          "approval": source.get("approval_status")}
    lines = [f"# {source['name']}", ""]
    tier = source.get("quality_tier") or "unscored"
    lines.append(f"**{source.get('source_type', 'source')}** · Quality tier **{tier}**"
                 + (f" ({source['overall_score']:.0f}/100)" if source.get("overall_score") else "")
                 + f" · Status **{source.get('approval_status')}**")
    if hosts:
        lines.append(f"Hosts/creators: {', '.join(hosts)}")
    if source.get("institution"):
        lines.append(f"Institution: {source['institution']}")
    if source.get("homepage"):
        lines.append(f"Homepage: {source['homepage']}")
    if source.get("faith_orientation"):
        lines.append(f"Perspective label: `{source['faith_orientation']}` "
                     "(tracked separately from quality — §8)")
    if source.get("perspective"):
        lines += ["", f"> {source['perspective']}"]
    if domains:
        lines += ["", "## Expertise domains", ""]
        lines += [f"- {d}" for d in domains]
    if scores:
        lines += ["", "## Quality profile", "",
                  "| Dimension | Score |", "|---|---|"]
        for d in rubric.DIMENSIONS:
            if d in scores:
                lines.append(f"| {d.replace('_', ' ')} | {rubric.clamp(scores[d]):.0f} |")
        if rubric.PENALTY in scores:
            lines.append(f"| sensationalism penalty | −{rubric.clamp(scores[rubric.PENALTY]):.0f} |")
    if strengths:
        lines += ["", "## Known strengths", ""] + [f"- {s}" for s in strengths]
    if limits:
        lines += ["", "## Known limitations", ""] + [f"- {s}" for s in limits]
    if source.get("last_reviewed"):
        lines += ["", f"_Last reviewed: {source['last_reviewed'][:10]}_"]
    # recent ingested episodes
    rows = ctx.db().execute(
        "SELECT * FROM sec_items WHERE source_id=? AND status='ingested' "
        "ORDER BY published_at DESC LIMIT 25", (source["source_id"],)).fetchall()
    if rows:
        lines += ["", "## Ingested episodes", ""]
        for r in rows:
            title = _safe_name(dict(r)["title"], 70)
            date = (r["published_at"] or "")[:10]
            note = item_note_path(source, dict(r)).rsplit("/", 1)[-1][:-3]
            lines.append(f"- {date} {md.wikilink(note, title)} "
                         f"(quality {r['episode_quality']:.0f})")
    path = source_note_path(source)
    record_file(ctx, path, "sec-source", "generator",
                f"secsource:{source['source_id']}", md.build_note(fm, "\n".join(lines)))
    return path


# -------------------------------------------------------------- item notes

def write_item_note(ctx: Ctx, source: dict, item: dict) -> str:
    db = ctx.db()
    segs = [dict(r) for r in db.execute(
        "SELECT * FROM sec_segments WHERE item_id=? ORDER BY COALESCE(t_start_s, 0)",
        (item["item_id"],)).fetchall()]
    mentions = [dict(r) for r in db.execute(
        "SELECT * FROM sec_mentions WHERE item_id=? ORDER BY id", (item["item_id"],)).fetchall()]
    claims = [dict(r) for r in db.execute(
        "SELECT * FROM claims WHERE provenance_json LIKE ? ORDER BY id",
        (f'%"item_id": "{item["item_id"]}"%',)).fetchall()]
    guests = json.loads(item.get("guests_json") or "[]")
    fm = {"ownership": "system", "mutable": "ai", "content_type": "sec-item",
          "sg-id": f"secitem:{item['item_id']}",
          "show": source["name"], "published": item.get("published_at"),
          "episode-quality": item.get("episode_quality"),
          "novelty": item.get("novelty")}
    title = item["title"]
    lines = [f"# {title}", "",
             f"{md.wikilink(_safe_name(source['name']))} · "
             f"{(item.get('published_at') or 'undated')[:10]}"
             + (f" · {item['duration_s'] // 60} min" if item.get("duration_s") else "")
             + f" · source tier **{source.get('quality_tier') or '?'}**"
             + (f" · episode quality **{item['episode_quality']:.0f}**"
                if item.get("episode_quality") is not None else "")]
    if item.get("url"):
        lines.append(f"[Listen / watch]({item['url']})")
    if guests:
        gl = ", ".join(f"{g.get('name')}"
                       + (f" ({', '.join(g.get('expertise') or [])})" if g.get("expertise") else "")
                       for g in guests)
        lines.append(f"Guests: {gl}")
    if item.get("analysis_depth") == "notes-only":
        lines.append("_Analyzed from show notes only — no transcript was available._")
    if item.get("summary"):
        lines += ["", f"> {item['summary']}"]

    if segs:
        lines += ["", "## Timestamped outline", ""]
        for s in segs:
            ts = _ts_link(item, s.get("t_start_s"))
            links = [db.execute("SELECT title FROM nodes WHERE id=?", (nid,)).fetchone()
                     for nid in json.loads(s.get("nodes_json") or "[]")]
            linktxt = " · ".join(md.wikilink(r["title"]) for r in links if r)
            lines.append(f"- **{ts}** — {s['label']}: {s['summary']}"
                         + (f" ({linktxt})" if linktxt else ""))

    if claims:
        lines += ["", "## Claims extracted (TENTATIVE — awaiting corroboration)", "",
                  "_Secondary commentary is not primary evidence (§13). These entered "
                  "the evidence pipeline as tentative claims._", ""]
        for c in claims:
            prov = json.loads(c.get("provenance_json") or "{}")
            speaker = prov.get("speaker") or "speaker"
            ts = _ts_link(item, prov.get("t_s"))
            line = f"- **{speaker}** ({ts}): {c['text']}"
            if prov.get("primary_source_named"):
                line += f"\n  - Named primary source: _{prov['primary_source_named']}_"
            lines.append(line)

    if mentions:
        lines += ["", "## Works & sources mentioned", ""]
        for m in mentions:
            entry = f"- {m['kind']}: **{m['title']}**"
            if m.get("author"):
                entry += f" — {m['author']}"
            if m.get("detail"):
                entry += f" ({m['detail']})"
            if m.get("t_s") is not None:
                entry += f" · at {_ts_link(item, m['t_s'])}"
            lines.append(entry)

    lines += ["", "---", "_Attribution preserved by design; interpretations belong to "
              "the named speakers, not to Scripture Graph (§20)._"]
    path = item_note_path(source, item)
    record_file(ctx, path, "sec-item", "generator", f"secitem:{item['item_id']}",
                md.build_note(fm, "\n".join(lines)))
    db.execute("UPDATE sec_items SET vault_path=? WHERE item_id=?",
               (path, item["item_id"]))
    db.execute("UPDATE nodes SET vault_path=? WHERE id=?",
               (path, f"secitem:{item['item_id']}"))
    db.commit()
    return path


# --------------------------------------------------------------------- MOC

def write_moc(ctx: Ctx) -> str:
    db = ctx.db()
    sources = [dict(r) for r in db.execute(
        "SELECT * FROM sec_sources ORDER BY "
        "CASE approval_status WHEN 'APPROVED' THEN 0 WHEN 'CONDITIONAL' THEN 1 "
        "WHEN 'WATCHLIST' THEN 2 ELSE 3 END, overall_score DESC, name").fetchall()]
    fm = {"ownership": "system", "mutable": "ai", "content_type": "moc",
          "cssclasses": ["wide"]}
    lines = ["# Secondary Sources", "",
             "A **curated** library of secondary voices — podcasts, channels, "
             "lectures — admitted through a quality rubric, never collected "
             "wholesale. If it's listed here, there's probably something "
             "genuinely worth hearing (§32).", "",
             "Perspective is labeled, not scored: faithful ≠ accurate and "
             "critical ≠ accurate (§7).", ""]
    by_status: dict[str, list[dict]] = {}
    for s in sources:
        by_status.setdefault(s["approval_status"], []).append(s)
    labels = [("APPROVED", "Approved"), ("CONDITIONAL", "Conditional — use selectively"),
              ("WATCHLIST", "Watchlist — under evaluation"),
              ("REJECTED", "Rejected"), ("BLOCKED", "Blocked"), ("DEPRECATED", "Deprecated")]
    for key, label in labels:
        rows = by_status.get(key) or []
        if not rows:
            continue
        lines += [f"## {label}", ""]
        for s in rows:
            entry = f"- {md.wikilink(_safe_name(s['name']))}"
            if s.get("quality_tier"):
                entry += f" — tier **{s['quality_tier']}**"
            if s.get("overall_score"):
                entry += f" ({s['overall_score']:.0f})"
            hosts = json.loads(s.get("hosts_json") or "[]")
            if hosts:
                entry += f" · {', '.join(hosts[:3])}"
            if s.get("faith_orientation"):
                entry += f" · `{s['faith_orientation']}`"
            lines.append(entry)
        lines.append("")
    n_items = db.execute("SELECT COUNT(*) n FROM sec_items WHERE status='ingested'").fetchone()["n"]
    lines += ["## Recently ingested", ""]
    for r in db.execute(
            "SELECT i.*, s.name AS show FROM sec_items i "
            "JOIN sec_sources s ON s.source_id=i.source_id "
            "WHERE i.status='ingested' ORDER BY i.published_at DESC LIMIT 20").fetchall():
        note = (r["vault_path"] or "").rsplit("/", 1)[-1][:-3] if r["vault_path"] else None
        if note:
            lines.append(f"- {(r['published_at'] or '')[:10]} — "
                         f"{md.wikilink(note, r['title'][:80])} ({r['show']})")
    lines += ["", f"_{n_items} episodes ingested · "
              f"{len(by_status.get('APPROVED') or [])} approved sources · "
              "see [[Secondary Source Discoveries|Discovery Report]]_"]
    path = f"{FOLDER_SECONDARY}/Secondary Sources.md"
    record_file(ctx, path, "moc", "generator", None, md.build_note(fm, "\n".join(lines)))
    return path


def write_all_notes(ctx: Ctx) -> dict:
    stats = {"sources": 0, "items": 0}
    for s in ctx.db().execute("SELECT * FROM sec_sources").fetchall():
        write_source_note(ctx, dict(s))
        stats["sources"] += 1
    rows = [dict(r) for r in ctx.db().execute(
        "SELECT * FROM sec_items WHERE status='ingested'").fetchall()]
    for item in rows:
        source = ctx.db().execute("SELECT * FROM sec_sources WHERE source_id=?",
                                  (item["source_id"],)).fetchone()
        if source:
            write_item_note(ctx, dict(source), item)
            stats["items"] += 1
    write_moc(ctx)
    return stats


# ----------------------------------------------- per-node section (§31)

_SECTION = "secondary-sources"


def _section_lines(ctx: Ctx, node_id: str) -> list[str]:
    db = ctx.db()
    rows = db.execute(
        """SELECT e.meta_json, i.*, s.name AS show, s.quality_tier AS tier
           FROM edges e
           JOIN sec_items i ON ('secitem:' || i.item_id) = e.src
           JOIN sec_sources s ON s.source_id = i.source_id
           WHERE e.dst=? AND e.rel='discusses' AND i.status='ingested'
           ORDER BY CASE COALESCE(s.quality_tier,'D') WHEN 'A' THEN 0 WHEN 'B' THEN 1
                    WHEN 'C' THEN 2 ELSE 3 END, i.published_at DESC
           LIMIT 12""", (node_id,)).fetchall()
    lines: list[str] = []
    seen: set[str] = set()
    for r in rows:
        if r["item_id"] in seen:
            continue
        seen.add(r["item_id"])
        meta = json.loads(r["meta_json"] or "{}")
        note = (r["vault_path"] or "").rsplit("/", 1)[-1]
        if not note.endswith(".md"):
            continue
        entry = (f"- {md.wikilink(note[:-3], r['title'][:80])} — {r['show']} · "
                 f"tier {r['tier'] or '?'}")
        t0 = meta.get("t_start")
        if t0 is not None:
            item = dict(r)
            entry += f" · from {_ts_link(item, t0)}"
            if meta.get("label"):
                entry += f" ({meta['label'][:80]})"
        lines.append(entry)
    return lines


def update_secondary_sections(ctx: Ctx) -> dict:
    """Maintain the `secondary-sources` marker section on every study guide /
    entity page that ingested episodes discuss. Deterministic; canonical and
    personal files are never candidates (registry kinds gate the write)."""
    db = ctx.db()
    stats = {"updated": 0, "nodes": 0}
    node_ids = [r["dst"] for r in db.execute(
        "SELECT DISTINCT e.dst FROM edges e JOIN sec_items i "
        "ON ('secitem:' || i.item_id) = e.src "
        "WHERE e.rel='discusses' AND i.status='ingested'").fetchall()]
    for nid in node_ids:
        stats["nodes"] += 1
        # chapters land on the study guide; entities on their own page
        reg = db.execute(
            "SELECT path, kind, managed_by FROM file_registry WHERE node_id=? AND kind IN "
            "('study-guide','topic','person','place','event','evidence','question')",
            (nid,)).fetchone()
        if not reg:
            continue
        abspath = ctx.vault / reg["path"]
        if not abspath.exists():
            continue
        content = read_text(abspath)
        fm, body = md.parse_note(content)
        new_inner = "\n".join(_section_lines(ctx, nid)) or md.PLACEHOLDER
        if md.get_section(body, _SECTION) is not None:
            if (md.get_section(body, _SECTION) or "").strip() == new_inner.strip():
                continue
            body = md.set_section(body, _SECTION, new_inner)
        else:
            if new_inner == md.PLACEHOLDER:
                continue  # never add an empty section
            body = (body.rstrip() + "\n\n## Secondary Sources\n"
                    + md.marker_block(_SECTION, new_inner) + "\n")
        record_file(ctx, reg["path"], reg["kind"], reg["managed_by"], nid,
                    md.build_note(fm, body))
        stats["updated"] += 1
    return stats
