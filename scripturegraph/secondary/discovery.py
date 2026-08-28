"""Candidate discovery (§21/§28): find → verify feed → evaluate → decide.

Discovery ≠ admission. Candidates come from a curated, extensible search-term
pool spanning distinct expertise areas (§29); each is resolved to a real feed
via the public iTunes Search API, registered as WATCHLIST, and then put
through the same profile rubric as everything else. A few per week, never a
flood.
"""
from __future__ import annotations

import json

from scripturegraph.context import Ctx
from scripturegraph.secondary import feeds, registry
from scripturegraph.secondary.vaultout import FOLDER_SECONDARY, _safe_name
from scripturegraph.util import now_iso, slugify
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import record_file

# Search terms, NOT approvals — every hit still passes the rubric. Spread
# across §29's expertise areas on purpose. Extend via config
# secondary.candidate_terms without code changes.
CANDIDATE_TERMS: list[dict] = [
    {"term": "Maxwell Institute Podcast", "domain": "LDS scholarship interviews"},
    {"term": "Y Religion BYU", "domain": "BYU Religious Education research"},
    {"term": "Scripture Central podcast", "domain": "Book of Mormon scholarship"},
    {"term": "LDS Perspectives Podcast", "domain": "Church history interviews"},
    {"term": "The Interpreter Foundation podcast", "domain": "LDS apologetic scholarship"},
    {"term": "Standard of Truth podcast", "domain": "Church history"},
    {"term": "Saints podcast Church history", "domain": "official Church history narrative"},
    {"term": "OnScript podcast", "domain": "academic biblical studies interviews"},
    {"term": "Naked Bible Podcast", "domain": "Hebrew Bible / ancient Near East"},
    {"term": "The Biblical World podcast", "domain": "biblical archaeology"},
    {"term": "Data Over Dogma", "domain": "critical biblical scholarship"},
    {"term": "BibleProject podcast", "domain": "biblical literary design"},
    {"term": "New Testament Review podcast", "domain": "New Testament scholarship"},
    {"term": "Church History Matters", "domain": "seed (already registered)"},
]


def candidate_pool(ctx: Ctx) -> list[dict]:
    extra = ctx.c("secondary.candidate_terms", []) or []
    pool = CANDIDATE_TERMS + [
        ({"term": t, "domain": "user-added"} if isinstance(t, str) else t)
        for t in extra]
    return pool


def run_discovery(ctx: Ctx, provider) -> dict:
    """Evaluate up to `discovery_per_week` new candidates end-to-end."""
    from scripturegraph.secondary.evaluate import profile_source
    from scripturegraph.secondary.ingest import build_source_evidence
    budget = int(ctx.c("secondary.discovery_per_week", 3))
    stats = {"considered": 0, "registered": 0, "evaluated": 0, "decisions": []}
    db = ctx.db()
    for cand in candidate_pool(ctx):
        if stats["evaluated"] >= budget:
            break
        term = cand["term"]
        stats["considered"] += 1
        feed_url = feeds.lookup_feed_url(ctx, term)
        if not feed_url:
            continue
        # already registered (by feed or by similar name)?
        row = db.execute("SELECT source_id FROM sec_sources WHERE feed_url=?",
                         (feed_url,)).fetchone()
        if row:
            continue
        sid = slugify(term)[:60]
        if registry.get_source(ctx, sid):
            continue
        registry.upsert_source(ctx, {
            "source_id": sid, "name": term, "source_type": "podcast",
            "feed_url": feed_url, "approval_status": "WATCHLIST",
            "notes": f"Discovered via search term '{term}' ({cand.get('domain')}); "
                     "awaiting rubric evaluation.",
        })
        stats["registered"] += 1
        source = registry.get_source(ctx, sid)
        try:
            feeds.refresh_source_items(ctx, source)  # metadata = evidence
            source = registry.get_source(ctx, sid)
            # feed title is more canonical than the search term
            profile, _ = profile_source(ctx, provider, sid,
                                        build_source_evidence(ctx, source))
            if profile:
                if profile.get("name"):
                    registry.upsert_source(ctx, {"source_id": sid,
                                                 "name": profile["name"][:200]})
                decision = registry.apply_evaluation(ctx, sid, profile)
                stats["evaluated"] += 1
                stats["decisions"].append(
                    {"source": profile.get("name") or term, **decision})
        except Exception as e:  # noqa: BLE001 — one bad candidate must not stop the batch
            ctx.log.warn("sec.candidate_failed", term=term, error=str(e)[:200])
    write_discovery_report(ctx)
    return stats


def write_discovery_report(ctx: Ctx) -> str:
    """Human-readable log of admission decisions (§28's report)."""
    db = ctx.db()
    fm = {"ownership": "system", "mutable": "ai", "content_type": "report"}
    lines = ["# Secondary Source Discoveries", "",
             "Every candidate the system considered, and what the rubric decided. "
             "Discovery is not admission (§21): WATCHLIST/REJECTED sources are "
             "never ingested.", ""]
    rows = db.execute("""
        SELECT r.*, s.name FROM sec_reviews r
        JOIN sec_sources s ON s.source_id = r.source_id
        ORDER BY r.at DESC LIMIT 60""").fetchall()
    if rows:
        lines += ["| Date | Source | Overall | Tier | Status |", "|---|---|---|---|---|"]
        for r in rows:
            lines.append(f"| {r['at'][:10]} | {md.wikilink(_safe_name(r['name']))} | "
                         f"{r['overall']:.0f} | {r['tier']} | {r['status']} |")
    watch = db.execute(
        "SELECT name, notes FROM sec_sources WHERE approval_status='WATCHLIST' "
        "ORDER BY name").fetchall()
    if watch:
        lines += ["", "## Watchlist (registered, not yet evaluated)", ""]
        for w in watch:
            lines.append(f"- **{w['name']}** — {w['notes'] or ''}")
    lines += ["", f"_Updated {now_iso()[:10]}. Candidate pool spans distinct "
              "expertise areas (§29); quality threshold is identical for all "
              "perspectives (§7)._"]
    path = f"{FOLDER_SECONDARY}/Secondary Source Discoveries.md"
    record_file(ctx, path, "report", "generator", None,
                md.build_note(fm, "\n".join(lines)))
    return path
