"""Scheduled run entry points: frequent / nightly / weekly.

Windows Task Scheduler (outer clock) → thin PowerShell scripts → these
functions. All AI spending is gated by config (automation.ai_enabled, mode
budgets, daily USD cap) and everything is resumable/idempotent.
"""
from __future__ import annotations

import json

from scripturegraph import gitops, queue
from scripturegraph.context import Ctx
from scripturegraph.util import now_iso


def _run_record(ctx: Ctx, kind: str):
    cur = ctx.db().execute(
        "INSERT INTO runs(kind,started_at,status) VALUES(?,?,'running')",
        (kind, now_iso()))
    ctx.db().commit()
    return cur.lastrowid


def _finish_run(ctx: Ctx, run_id: int, status: str, stats: dict):
    ctx.db().execute(
        "UPDATE runs SET finished_at=?, status=?, stats_json=?, git_rev=? WHERE id=?",
        (now_iso(), status, json.dumps(stats, default=str),
         gitops.current_rev(ctx), run_id))
    ctx.db().commit()


def _guard(ctx: Ctx, kind: str) -> bool:
    if not ctx.c("automation.enabled", True):
        ctx.log.info("run.skipped", kind=kind, reason="automation.enabled=false")
        return False
    from scripturegraph.bootstrap import get_state
    if get_state(ctx) == "NOT_INITIALIZED":
        ctx.log.warn("run.skipped", kind=kind, reason="not bootstrapped")
        return False
    return True


def _locked(fn):
    """Every runner is single-instance: overlapping scheduled/manual runs skip."""
    from functools import wraps

    @wraps(fn)
    def wrapper(ctx: Ctx) -> dict:
        from scripturegraph.lockfile import EngineBusy, engine_lock
        try:
            with engine_lock(ctx):
                return fn(ctx)
        except EngineBusy:
            ctx.log.info("run.skipped", kind=fn.__name__, reason="engine lock held")
            return {"skipped": "another engine run active"}
    return wrapper


def _ai_budget(ctx: Ctx, key: str) -> int:
    """Job-count budget for this run, respecting the daily USD cap."""
    if not ctx.c("automation.ai_enabled", True):
        return 0
    from scripturegraph.agents.providers import any_provider_available
    if not any_provider_available(ctx):
        return 0
    from scripturegraph.statuscmd import _spend_today
    cap = float(ctx.budget("daily_usd_cap") or 0)
    if cap and _spend_today(ctx) >= cap:
        ctx.log.warn("run.ai_capped", reason=f"daily USD cap {cap} reached")
        return 0
    return int(ctx.budget(key) or 0)


@_locked
def run_frequent(ctx: Ctx) -> dict:
    """Light: detect/import new sources, refresh indexes, work the queue
    (deterministic only), validate what changed."""
    if not _guard(ctx, "frequent"):
        return {"skipped": True}
    run_id = _run_record(ctx, "frequent")
    stats: dict = {}
    try:
        from scripturegraph.corpus.registry import scan_drop
        from scripturegraph.personal import index_personal_notes
        stats["drop"] = scan_drop(ctx)
        stats["personal"] = index_personal_notes(ctx)
        stats["queue"] = _process(ctx, include_ai=False, max_items=800)
        gitops.commit_all(ctx, "frequent: source scan + deterministic queue work")
        _finish_run(ctx, run_id, "ok", stats)
    except Exception as e:  # noqa: BLE001
        ctx.log.error("run.failed", kind="frequent", error=str(e))
        _finish_run(ctx, run_id, "failed", {**stats, "error": str(e)})
        raise
    return stats


@_locked
def run_nightly(ctx: Ctx) -> dict:
    """Research/refinement: everything frequent does + budgeted AI research on
    the highest-priority (weakest/stalest) chapters + coverage + status."""
    if not _guard(ctx, "nightly"):
        return {"skipped": True}
    run_id = _run_record(ctx, "nightly")
    stats: dict = {}
    try:
        from scripturegraph.corpus.registry import scan_drop
        from scripturegraph.coverage import update_all_coverage
        from scripturegraph.personal import index_personal_notes
        from scripturegraph.statuscmd import write_status_note
        from scripturegraph.waves import enqueue_wave
        stats["drop"] = scan_drop(ctx)
        stats["personal"] = index_personal_notes(ctx)
        # refresh every stale deterministic pass (no-ops when current):
        # corpus growth re-opens them via corpus versioning, nightly closes them
        for det in ("parallels", "embed", "semantic", "entities", "citations",
                    "topics", "conference", "history", "synthesis", "topic-synthesis"):
            enqueue_wave(ctx, det)
        budget = _ai_budget(ctx, "nightly_ai_jobs")
        stats["ai_budget"] = budget
        if budget:
            update_all_coverage(ctx)
            enqueue_wave(ctx, "research", limit=budget * 3, by_priority=True)
        stats["queue"] = _process(ctx, include_ai=budget > 0, ai_budget=budget,
                                  max_items=2000)
        update_all_coverage(ctx)
        write_status_note(ctx)
        gitops.commit_all(ctx, "nightly: refinement run")
        _finish_run(ctx, run_id, "ok", stats)
    except Exception as e:  # noqa: BLE001
        ctx.log.error("run.failed", kind="nightly", error=str(e))
        _finish_run(ctx, run_id, "failed", {**stats, "error": str(e)})
        raise
    return stats


@_locked
def run_weekly(ctx: Ctx) -> dict:
    """Deep maintenance: gardener, full validation (with canonical repair),
    coverage equalization queueing, health + status reports."""
    if not _guard(ctx, "weekly"):
        return {"skipped": True}
    run_id = _run_record(ctx, "weekly")
    stats: dict = {}
    try:
        from scripturegraph.coverage import update_all_coverage, weakest_chapters
        from scripturegraph.gardener import run_gardener
        from scripturegraph.statuscmd import write_status_note
        stats["gardener"] = {k: v for k, v in run_gardener(ctx, repair=True).items()
                             if isinstance(v, (int, str))}
        update_all_coverage(ctx)
        batch = int(ctx.c("coverage.equalize_batch", 40))
        for w in weakest_chapters(ctx, batch):
            queue.enqueue(ctx, "job", w["node_id"].split(":", 1)[1],
                          pass_name="research", priority=w["priority"] or 0)
        ctx.db().commit()
        budget = _ai_budget(ctx, "weekly_ai_jobs")
        stats["ai_budget"] = budget
        if budget:
            stats["queue"] = _process(ctx, include_ai=True, ai_budget=budget,
                                      max_items=2000)
        write_status_note(ctx)
        gitops.commit_all(ctx, "weekly: gardener + equalization")
        _finish_run(ctx, run_id, "ok", stats)
    except Exception as e:  # noqa: BLE001
        ctx.log.error("run.failed", kind="weekly", error=str(e))
        _finish_run(ctx, run_id, "failed", {**stats, "error": str(e)})
        raise
    return stats


def _process(ctx: Ctx, include_ai: bool, max_items: int, ai_budget: int | None = None):
    from scripturegraph.waves import process_queue
    return process_queue(ctx, max_items=max_items, include_ai=include_ai,
                         ai_budget=ai_budget)
