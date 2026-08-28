"""Gardener: periodic graph maintenance + the Graph Health report.

Deterministic detection of: orphans, broken links, duplicate/conflicting
aliases, overbroad hubs, stale notes, dead queue items, unsupported AI edges.
Safe fixes are applied automatically; judgment calls are written to the
Graph Health note (and can be routed to an AI pass later) — never destructive
on its own.
"""
from __future__ import annotations

import json
from collections import defaultdict

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso
from scripturegraph.validation import validate_all
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_SYSTEM, record_file

HUB_DEGREE = 200


def run_gardener(ctx: Ctx, repair: bool = True) -> dict:
    from scripturegraph.personal import index_personal_notes
    db = ctx.db()
    stats: dict = {"started": now_iso()}

    stats["personal"] = index_personal_notes(ctx)

    report = validate_all(ctx, repair=repair)
    stats["validation"] = report.summary()
    broken_links = [i for i in report.issues if i.check in ("link", "block-link")][:60]

    # unsupported AI edges: provenance job missing or failed → downgrade
    bad_edges = db.execute(
        "SELECT e.id FROM edges e LEFT JOIN jobs j "
        "ON j.job_id = substr(e.provenance, 5) "
        "WHERE e.provenance LIKE 'job:%' AND (j.job_id IS NULL OR "
        "j.status IN ('failed','quarantined'))").fetchall()
    if bad_edges and repair:
        db.execute(
            f"UPDATE edges SET status='rejected', updated_at=? WHERE id IN "
            f"({','.join(str(r['id']) for r in bad_edges)})", (now_iso(),))
    stats["unsupported_ai_edges"] = len(bad_edges)

    # alias conflicts within a node type (same alias → multiple same-kind nodes)
    conflicts = db.execute(
        "SELECT a.alias, COUNT(DISTINCT n.id) AS n, GROUP_CONCAT(n.id) AS ids "
        "FROM aliases a JOIN nodes n ON n.id=a.node_id "
        "GROUP BY a.alias, n.node_type HAVING n > 1").fetchall()
    stats["alias_conflicts"] = len(conflicts)

    # orphans: entity/evidence/question notes with zero graph edges
    orphans = db.execute(
        "SELECT n.id, n.title FROM nodes n "
        "WHERE n.node_type IN ('topic','person','place','event','evidence','question') "
        "AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.src=n.id OR e.dst=n.id) "
        "ORDER BY n.title LIMIT 100").fetchall()
    stats["orphans"] = len(orphans)

    hubs = db.execute(
        "SELECT n.id, n.title, COUNT(*) AS deg FROM edges e "
        "JOIN nodes n ON n.id IN (e.src, e.dst) "
        "WHERE e.status IN ('accepted','tentative') "
        "GROUP BY n.id HAVING deg > ? ORDER BY deg DESC LIMIT 20",
        (HUB_DEGREE,)).fetchall()
    stats["hubs"] = len(hubs)

    dead = db.execute("SELECT COUNT(*) AS n FROM work_queue WHERE status='dead'").fetchone()["n"]
    stats["dead_queue_items"] = dead

    stale = db.execute(
        "SELECT node_id, completeness FROM coverage WHERE node_id LIKE 'chapter:%' "
        "ORDER BY corpus_version_at_review ASC, completeness ASC LIMIT 15").fetchall()

    db.commit()
    _write_health_note(ctx, stats, broken_links, conflicts, orphans, hubs, stale)
    ctx.log.info("gardener.done", **{k: v for k, v in stats.items()
                                     if isinstance(v, (int, str))})
    return stats


def _write_health_note(ctx: Ctx, stats, broken_links, conflicts, orphans, hubs, stale):
    from scripturegraph.coverage import stats as cov_stats
    cov = cov_stats(ctx)
    lines = ["# Graph Health", "", f"*Generated {now_iso()} by the Gardener.*", ""]
    v = stats.get("validation", {})
    lines += ["## Validation",
              f"- fatal: {v.get('fatal', 0)} · errors: {v.get('error', 0)} · "
              f"warnings: {v.get('warn', 0)} (files checked: {v.get('files_checked', 0)})",
              f"- canonical files checked: {v.get('canonical_checked', 0)}"
              + (f" · **restored: {v['canonical_restored']}**" if v.get("canonical_restored") else ""),
              ""]
    if cov.get("overall"):
        o = cov["overall"]
        lines += ["## Coverage",
                  f"- overall mean {o['mean']} · stddev {o['stddev']} · min {o['min']} "
                  f"(n={o['n']})"]
        for vol, s in cov.get("volumes", {}).items():
            lines.append(f"- {vol}: mean {s['mean']}, min {s['min']}, p10 {s['p10']}")
        lines.append("")
    lines += ["## Issues",
              f"- unsupported AI edges downgraded: {stats.get('unsupported_ai_edges', 0)}",
              f"- alias conflicts: {stats.get('alias_conflicts', 0)}",
              f"- orphan notes: {stats.get('orphans', 0)}",
              f"- oversized hubs (> {HUB_DEGREE} links): {stats.get('hubs', 0)}",
              f"- dead queue items: {stats.get('dead_queue_items', 0)}", ""]
    if broken_links:
        lines += ["### Broken / unresolved links (sample)"] + \
                 [f"- `{i.path}` → {i.detail}" for i in broken_links[:25]] + [""]
    if conflicts:
        lines += ["### Alias conflicts"] + \
                 [f"- `{c['alias']}` → {c['ids']}" for c in conflicts[:20]] + [""]
    if hubs:
        lines += ["### Hub notes to consider splitting"] + \
                 [f"- {md.wikilink(h['title'])} — {h['deg']} links" for h in hubs] + [""]
    if stale:
        lines += ["### Most stale / weakest chapters (next in queue)"] + \
                 [f"- `{s['node_id']}` — completeness {s['completeness']}" for s in stale] + [""]
    record_file(ctx, f"{FOLDER_SYSTEM}/Graph Health.md", "system", "generator", None,
                md.build_note({"ownership": "system", "mutable": "ai",
                               "content_type": "report"}, "\n".join(lines)))
    ctx.db().commit()
