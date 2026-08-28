"""Coverage scoring + the self-balancing priority engine.

Principles (spec §4, §49):
- Completeness measures whether each APPLICABLE pass/dimension has been done
  against the CURRENT corpus — never whether a chapter hit content quotas.
  A chapter with no places is complete on 'places' once the scan ran.
- Dimensions become applicable only when their corpus exists (conference dims
  activate when conference talks are imported) or when AI providers exist.
- A pass completed at an older corpus version earns only partial credit, so
  corpus growth automatically re-opens every chapter — early books can never
  be permanently disadvantaged by processing order.
"""
from __future__ import annotations

import json
import math

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso, read_text
from scripturegraph.vaultgen import md as mdkit

STALE_CREDIT = 0.5   # pass done, but corpus has since grown
AI_SECTIONS = ["overview", "structure", "doctrines", "language", "literary",
               "evidence", "questions"]
DET_PASSES = ["entities", "citations", "topics", "synthesis"]
GLOBAL_PASSES = ["parallels", "semantic"]


def _ai_available(ctx: Ctx) -> bool:
    try:
        from scripturegraph.agents.providers import any_provider_available
        return any_provider_available(ctx)
    except Exception:  # noqa: BLE001
        return False


def _corpus_present(ctx: Ctx, source_type: str) -> bool:
    row = ctx.db().execute(
        "SELECT 1 FROM sources WHERE type=? AND status='imported' LIMIT 1",
        (source_type,)).fetchone()
    return row is not None


def _pass_credit(ctx: Ctx, name: str, target: str, current_cv: int) -> float:
    row = ctx.db().execute(
        "SELECT corpus_version FROM passes WHERE name=? AND target=?",
        (name, target)).fetchone()
    if row is None:
        return 0.0
    return 1.0 if row["corpus_version"] >= current_cv else STALE_CREDIT


def _latest_pass_cv(ctx: Ctx, target: str) -> int:
    row = ctx.db().execute(
        "SELECT MAX(corpus_version) AS cv FROM passes WHERE target=?", (target,)).fetchone()
    return int(row["cv"] or 0)


def chapter_dims(ctx: Ctx, cslug: str) -> dict[str, tuple[float, float]]:
    """{dim: (value 0..1, weight)} — only APPLICABLE dims are present."""
    cv = ctx.corpus_version()
    dims: dict[str, tuple[float, float]] = {"structure": (1.0, 0.5)}
    for p in DET_PASSES:
        dims[p] = (_pass_credit(ctx, p, cslug, cv), 1.0 if p != "citations" else 0.5)
    for p in GLOBAL_PASSES:
        dims[p] = (_pass_credit(ctx, p, "__global__", cv), 0.8)
    deg = ctx.db().execute(
        "SELECT COUNT(*) AS n FROM edges WHERE (src=? OR dst=?) "
        "AND status IN ('accepted','tentative')",
        (f"chapter:{cslug}", f"chapter:{cslug}")).fetchone()["n"]
    dims["connections"] = (min(1.0, math.log1p(deg) / math.log1p(12)), 0.6)
    if _ai_available(ctx):
        dims["research"] = (_pass_credit(ctx, "research", cslug, cv), 2.0)
        dims["ai_sections"] = (_ai_section_fill(ctx, cslug), 1.2)
    if _corpus_present(ctx, "conference"):
        dims["conference"] = (_pass_credit(ctx, "conference", cslug, cv), 1.0)
    if _corpus_present(ctx, "jsp") or _corpus_present(ctx, "history"):
        dims["history"] = (_pass_credit(ctx, "history", cslug, cv), 0.8)
    return dims


def _ai_section_fill(ctx: Ctx, cslug: str) -> float:
    row = ctx.db().execute(
        "SELECT path FROM file_registry WHERE node_id=? AND kind='study-guide'",
        (f"chapter:{cslug}",)).fetchone()
    if row is None:
        return 0.0
    p = ctx.vault / row["path"]
    if not p.exists():
        return 0.0
    _, body = mdkit.parse_note(read_text(p))
    sections = mdkit.list_sections(body)
    filled = sum(1 for s in AI_SECTIONS if not mdkit.section_is_empty(sections.get(s)))
    return filled / len(AI_SECTIONS)


def _citation_health(ctx: Ctx, node_id: str) -> float:
    rows = ctx.db().execute(
        "SELECT provenance_json FROM claims WHERE node_id=? AND tier != 'REJECT'",
        (node_id,)).fetchall()
    if not rows:
        return 1.0
    ok = total = 0
    for r in rows:
        prov = json.loads(r["provenance_json"] or "{}")
        v = prov.get("citations_verified")
        if v is not None:
            total += 1
            ok += 1 if v else 0
    return ok / total if total else 1.0


def update_chapter_coverage(ctx: Ctx, cslug: str) -> dict:
    node_id = f"chapter:{cslug}"
    cv = ctx.corpus_version()
    dims = chapter_dims(ctx, cslug)
    wsum = sum(w for _, w in dims.values())
    completeness = 100.0 * sum(v * w for v, w in dims.values()) / wsum if wsum else 0.0
    from scripturegraph.graphops import degree
    deg = degree(ctx, node_id)
    connectivity = min(1.0, math.log1p(deg) / math.log1p(50))
    citation_health = _citation_health(ctx, node_id)
    reviewed_cv = _latest_pass_cv(ctx, cslug)
    staleness = max(0, cv - reviewed_cv) if reviewed_cv else 5
    priority = (2.0 * (1.0 - completeness / 100.0)
                + 0.6 * min(staleness, 5) / 5.0
                + 0.4 * connectivity
                + 0.3 * (1.0 - citation_health))
    passes_n = ctx.db().execute(
        "SELECT COUNT(*) AS n FROM passes WHERE target=?", (cslug,)).fetchone()["n"]
    ctx.db().execute(
        "INSERT INTO coverage(node_id,completeness,confidence,citation_health,connectivity,"
        "dims_json,passes_completed,last_reviewed_at,corpus_version_at_review,priority) "
        "VALUES(?,?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(node_id) DO UPDATE SET completeness=excluded.completeness, "
        "citation_health=excluded.citation_health, connectivity=excluded.connectivity, "
        "dims_json=excluded.dims_json, passes_completed=excluded.passes_completed, "
        "last_reviewed_at=excluded.last_reviewed_at, "
        "corpus_version_at_review=excluded.corpus_version_at_review, priority=excluded.priority",
        (node_id, round(completeness, 2), None, round(citation_health, 3),
         round(connectivity, 3), json.dumps({k: [round(v, 3), w] for k, (v, w) in dims.items()}),
         passes_n, now_iso(), reviewed_cv, round(priority, 4)))
    ctx.db().commit()
    return {"completeness": completeness, "priority": priority}


def update_all_coverage(ctx: Ctx) -> dict:
    n = 0
    for r in ctx.db().execute("SELECT slug FROM chapters ORDER BY slug"):
        update_chapter_coverage(ctx, r["slug"])
        n += 1
    ctx.log.info("coverage.updated", chapters=n)
    return {"updated": n}


def stats(ctx: Ctx) -> dict:
    db = ctx.db()
    out: dict = {"volumes": {}}
    rows = db.execute(
        "SELECT b.volume AS volume, c2.completeness AS comp FROM coverage c2 "
        "JOIN chapters ch ON ('chapter:' || ch.slug) = c2.node_id "
        "JOIN books b ON b.slug = ch.book_slug").fetchall()
    by_vol: dict[str, list[float]] = {}
    allc: list[float] = []
    for r in rows:
        by_vol.setdefault(r["volume"], []).append(r["comp"])
        allc.append(r["comp"])
    for vol, vals in by_vol.items():
        vals.sort()
        out["volumes"][vol] = {
            "n": len(vals),
            "mean": round(sum(vals) / len(vals), 1),
            "min": round(vals[0], 1),
            "p10": round(vals[max(0, len(vals) // 10 - 1)], 1),
        }
    if allc:
        mean = sum(allc) / len(allc)
        var = sum((x - mean) ** 2 for x in allc) / len(allc)
        out["overall"] = {"n": len(allc), "mean": round(mean, 1),
                          "stddev": round(math.sqrt(var), 2), "min": round(min(allc), 1)}
    return out


def weakest_chapters(ctx: Ctx, n: int = 25) -> list[dict]:
    rows = ctx.db().execute(
        "SELECT node_id, completeness, priority FROM coverage "
        "WHERE node_id LIKE 'chapter:%' ORDER BY priority DESC, completeness ASC LIMIT ?",
        (n,)).fetchall()
    return [dict(r) for r in rows]
