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
    """Every runner is single-instance: overlapping scheduled/manual runs skip.

    But skipping INSTANTLY threw away a quarter of the engine's day. The
    frequent run fires on the same minute as a study tick every two hours and
    holds the lock for well under a second — and the study tick, losing that
    race, forfeited its entire 30-minute slot: 12 of 48 daily ticks. With
    parallel workers each forfeited tick costs N times as much.

    So a runner now waits briefly for a SHORT holder before giving up. A long
    one — a study run overrunning its window, the nightly run — still causes a
    skip, exactly as before, just decided a minute later. The lock itself is
    unchanged; only the patience is new."""
    from functools import wraps

    @wraps(fn)
    def wrapper(ctx: Ctx) -> dict:
        import time as _time
        from scripturegraph.lockfile import EngineBusy, engine_lock
        deadline = _time.time() + float(ctx.c("automation.lock_wait_sec", 90) or 0)
        waited = False
        while True:
            entered = False
            try:
                with engine_lock(ctx):
                    entered = True
                    if waited:
                        ctx.log.info("run.lock_waited", kind=fn.__name__)
                    return fn(ctx)
            except EngineBusy:
                if entered:
                    raise
                if _time.time() >= deadline:
                    ctx.log.info("run.skipped", kind=fn.__name__,
                                 reason="engine lock held")
                    return {"skipped": "another engine run active"}
                waited = True
                _time.sleep(min(3.0, max(0.1, deadline - _time.time())))
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
        # curated pages shipped with the package (hard questions, exemplar
        # evidence) — write-once, so this is free when nothing is new
        from scripturegraph.bootstrap import install_seed_notes
        stats["seed_notes"] = install_seed_notes(ctx)
        if ctx.c("timeline.enabled", True):
            from scripturegraph.timeline import maybe_build_timeline
            try:
                # hash-guarded no-op unless the chronology changed — puts a
                # fresh dataset on devices within 2h instead of overnight
                stats["timeline"] = maybe_build_timeline(ctx)
            except Exception as e:  # noqa: BLE001
                ctx.log.warn("frequent.timeline_failed", error=str(e)[:200])
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
        if ctx.c("acquisition.conference_backfill", True):
            from scripturegraph.corpus.fetchers import backfill_conference, freshen_conference
            try:
                # newest sessions stay complete (late-published talks, new conference)
                stats["conference_freshen"] = freshen_conference(ctx)
                stats["conference_backfill"] = backfill_conference(
                    ctx, int(ctx.c("acquisition.conference_sessions_per_night", 4)))
            except Exception as e:  # noqa: BLE001 — network trouble must not sink the run
                ctx.log.warn("nightly.backfill_failed", error=str(e)[:200])
        if ctx.c("timeline.enabled", True):
            from scripturegraph.timeline import maybe_build_timeline
            try:
                # only writes when the chronology actually changed
                stats["timeline"] = maybe_build_timeline(ctx)
            except Exception as e:  # noqa: BLE001
                ctx.log.warn("nightly.timeline_failed", error=str(e)[:200])
        if ctx.c("secondary.enabled", True):
            from scripturegraph.secondary.ingest import secondary_nightly
            try:
                stats["secondary"] = secondary_nightly(ctx)
            except Exception as e:  # noqa: BLE001
                ctx.log.warn("nightly.secondary_failed", error=str(e)[:200])
        if ctx.c("acquisition.gospel_library_backfill", True):
            from scripturegraph.corpus.glib import nightly_acquisition
            try:
                stats["gospel_library"] = nightly_acquisition(
                    ctx, int(ctx.c("acquisition.pages_per_night", 350)))
            except Exception as e:  # noqa: BLE001
                ctx.log.warn("nightly.glib_failed", error=str(e)[:200])
        # refresh every stale deterministic pass (no-ops when current):
        # corpus growth re-opens them via corpus versioning, nightly closes them
        for det in ("parallels", "embed", "semantic", "entities", "citations",
                    "topics", "conference", "history", "synthesis", "annotate",
                    "topic-synthesis"):
            enqueue_wave(ctx, det)
        budget = _ai_budget(ctx, "nightly_ai_jobs")
        budget, stats["governor"] = _governed(ctx, budget)
        stats["ai_budget"] = budget
        if budget:
            update_all_coverage(ctx)
            enqueue_wave(ctx, "research", limit=budget * 3, by_priority=True)
            # nothing until the canon is read; then the budget research no
            # longer needs flows into subject dossiers
            enqueue_wave(ctx, "dossier", limit=budget)
        stats["queue"] = _process(ctx, include_ai=budget > 0, ai_budget=budget,
                                  max_items=20000)
        update_all_coverage(ctx)
        write_status_note(ctx)
        gitops.commit_all(ctx, "nightly: refinement run")
        _finish_run(ctx, run_id, "ok", stats)
    except Exception as e:  # noqa: BLE001
        ctx.log.error("run.failed", kind="nightly", error=str(e))
        _finish_run(ctx, run_id, "failed", {**stats, "error": str(e)})
        raise
    return stats


def _daily_jobs_used(ctx: Ctx) -> int:
    from scripturegraph.util import today_utc
    return ctx.db().execute(
        "SELECT COUNT(*) AS n FROM jobs WHERE created_at LIKE ? "
        "AND status != 'quarantined'", (today_utc() + "%",)).fetchone()["n"]


@_locked
def run_study(ctx: Ctx) -> dict:
    """The all-day study tick (default: every 30 minutes).

    Time-boxed slice of the big build-out: drain quick deterministic work,
    then run AI research jobs on the highest-priority chapters until the soft
    deadline. Overruns are harmless — the engine lock makes the next tick
    skip — and the durable queue carries everything across ticks."""
    if not _guard(ctx, "study"):
        return {"skipped": True}
    from scripturegraph.agents.providers import any_provider_available
    import time as _time
    run_id = _run_record(ctx, "study")
    stats: dict = {}
    start = _time.time()
    window = int(ctx.c("study.window_minutes", 30)) * 60
    est = int(ctx.c("study.job_estimate_sec", 540))
    safety = 120
    try:
        # 0. canonical self-heal: any user edit/deletion of scripture files is
        # detected and restored EVERY tick (≤30-minute damage window)
        from scripturegraph.validation import Report, check_canonical
        report = Report()
        check_canonical(ctx, report, repair=True)
        if report.stats.get("canonical_restored"):
            stats["canonical_restored"] = report.stats["canonical_restored"]
        # 1. quick deterministic drain (renders, re-opened passes, …)
        stats["det"] = _process(ctx, include_ai=False, max_items=600,
                                deadline_ts=start + min(300, window // 4))
        # 1b. timeline freshness rides THIS tick because it reliably owns the
        # lock — a hot queue can starve the 2h frequent run for days, and the
        # hash guard makes this free whenever nothing changed
        if ctx.c("timeline.enabled", True):
            from scripturegraph.timeline import maybe_build_timeline
            try:
                tl = maybe_build_timeline(ctx)
                if tl.get("rebuilt") or tl.get("sections", {}).get("updated"):
                    stats["timeline"] = tl
            except Exception as e:  # noqa: BLE001
                ctx.log.warn("study.timeline_failed", error=str(e)[:200])
        # 2. AI research until the window closes
        cap = int(ctx.budget("daily_ai_jobs_cap") or 0)
        used = _daily_jobs_used(ctx)
        remaining = max(0, cap - used) if cap else 0
        stats["daily_cap"] = cap
        stats["daily_used"] = used
        # pace the plan's rolling window: refresh the reading, then let the
        # governor scale this tick's budget (fails open if it has no reading)
        remaining, stats["governor"] = _governed(ctx, remaining)
        if remaining and any_provider_available(ctx) and ctx.c("automation.ai_enabled", True):
            from scripturegraph.waves import enqueue_wave
            pending_jobs = ctx.db().execute(
                "SELECT COUNT(*) AS n FROM work_queue WHERE task_type='job' "
                "AND status='pending'").fetchone()["n"]
            if pending_jobs < 5:
                from scripturegraph.coverage import update_all_coverage
                update_all_coverage(ctx)
                enqueue_wave(ctx, "research", limit=25, by_priority=True)
                enqueue_wave(ctx, "dossier", limit=25)   # gated: empty until read
            stats["ai"] = _process(
                ctx, include_ai=True, max_items=None, ai_budget=remaining,
                deadline_ts=start + window - safety - est)
        else:
            stats["ai"] = {"skipped": "cap reached" if not remaining else "no provider"}
        # visible momentum: the Status note moves every tick, not just nightly
        from scripturegraph.statuscmd import write_status_note
        write_status_note(ctx)
        gitops.commit_all(ctx, "study: tick")
        _finish_run(ctx, run_id, "ok", stats)
    except Exception as e:  # noqa: BLE001
        ctx.log.error("run.failed", kind="study", error=str(e))
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
        if ctx.c("secondary.enabled", True):
            from scripturegraph.secondary.ingest import secondary_weekly
            try:
                stats["secondary"] = secondary_weekly(ctx)
            except Exception as e:  # noqa: BLE001
                ctx.log.warn("weekly.secondary_failed", error=str(e)[:200])
        if ctx.c("crossrefs.enabled", True):
            from scripturegraph.crossrefs import build_crossrefs
            try:
                stats["crossrefs"] = build_crossrefs(ctx)
            except Exception as e:  # noqa: BLE001
                ctx.log.warn("weekly.crossrefs_failed", error=str(e)[:200])
        if ctx.c("timeline.enabled", True):
            from scripturegraph.timeline import maybe_build_timeline
            try:
                stats["timeline"] = maybe_build_timeline(ctx)
            except Exception as e:  # noqa: BLE001
                ctx.log.warn("weekly.timeline_failed", error=str(e)[:200])
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


def _governed(ctx: Ctx, ai_budget: int) -> tuple[int, dict]:
    """Refresh subscription telemetry, then pace this run's AI budget by it.

    Wrapped whole: neither the log scan nor the governor is worth failing a run
    over, and a telemetry problem must not be able to stop research."""
    if not ai_budget:
        return ai_budget, {"skipped": "no budget"}
    try:
        from scripturegraph import usage
        usage.scan(ctx, days=7)
        budget, g = usage.apply_governor(ctx, ai_budget)
        if budget != ai_budget:
            ctx.log.info("governor.throttled", **{
                k: v for k, v in g.items() if k in
                ("used_pct", "pace_pct", "scale", "reason", "budget_before", "budget_after")})
        return budget, g
    except Exception as e:  # noqa: BLE001 — telemetry never sinks a run
        ctx.log.warn("governor.failed", error=str(e)[:200])
        return ai_budget, {"error": str(e)[:200]}


def _process(ctx: Ctx, include_ai: bool, max_items: int | None,
             ai_budget: int | None = None, deadline_ts: float | None = None):
    from scripturegraph.waves import process_queue
    return process_queue(ctx, max_items=max_items, include_ai=include_ai,
                         ai_budget=ai_budget, deadline_ts=deadline_ts,
                         workers=_workers(ctx) if include_ai else 1)


def _workers(ctx: Ctx) -> int:
    """Parallel research workers, never more than the AI budget can feed."""
    return max(1, int(ctx.c("automation.workers", 1) or 1))
