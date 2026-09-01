"""Global wave processing — the anti-conveyor-belt.

The corpus is improved in corpus-wide passes (all chapters → entities; all
chapters → topics; global parallels; …), never "finish chapter 1, then
chapter 2". Pass completion is recorded per (pass, target) WITH the corpus
version, so any corpus growth re-opens every affected target.

Waves are executed through the durable work queue, so a crash mid-wave
resumes exactly where it stopped.
"""
from __future__ import annotations

from scripturegraph import queue as q
from scripturegraph.agents.pipeline import ProviderUnavailable
from scripturegraph.context import Ctx
from scripturegraph.util import now_iso

GLOBAL_TARGET = "__global__"


def _dispatch_entities(ctx: Ctx, target: str) -> dict:
    from scripturegraph.indexing.entities import scan_chapter_mentions
    return scan_chapter_mentions(ctx, target)


def _dispatch_citations(ctx: Ctx, target: str) -> dict:
    from scripturegraph.indexing.citations import scan_chapter_citations
    return scan_chapter_citations(ctx, target)


def _dispatch_topics(ctx: Ctx, target: str) -> dict:
    from scripturegraph.indexing.entities import scan_chapter_topics
    return scan_chapter_topics(ctx, target)


def _dispatch_synthesis(ctx: Ctx, target: str) -> dict:
    from scripturegraph.synthesis import synthesize_chapter
    return synthesize_chapter(ctx, target)


def _dispatch_parallels(ctx: Ctx, target: str) -> dict:
    from scripturegraph.indexing.parallels import run_global_parallels
    return run_global_parallels(ctx)


def _dispatch_embed(ctx: Ctx, target: str) -> dict:
    from scripturegraph.indexing.embeddings import embed_missing
    return embed_missing(ctx)


def _dispatch_semantic(ctx: Ctx, target: str) -> dict:
    from scripturegraph.indexing.semantic import run_semantic_candidates
    return run_semantic_candidates(ctx)


def _dispatch_research(ctx: Ctx, target: str) -> dict:
    from scripturegraph.agents.pipeline import run_chapter_job
    return run_chapter_job(ctx, target)


def _dispatch_conference(ctx: Ctx, target: str) -> dict:
    from scripturegraph.corpus.conference import render_conference_section
    return render_conference_section(ctx, target)


def _dispatch_history(ctx: Ctx, target: str) -> dict:
    from scripturegraph.synthesis import render_history_section
    return render_history_section(ctx, target)


def _dispatch_topic_synthesis(ctx: Ctx, target: str) -> dict:
    from scripturegraph.synthesis import synthesize_topic
    return synthesize_topic(ctx, target)


def _dispatch_annotate(ctx: Ctx, target: str) -> dict:
    from scripturegraph.vaultgen.annotated import render_annotated_chapter
    return render_annotated_chapter(ctx, target)


PASS_DEFS: dict[str, dict] = {
    "entities":   {"scope": "chapter", "mode": "deterministic", "fn": _dispatch_entities},
    "citations":  {"scope": "chapter", "mode": "deterministic", "fn": _dispatch_citations},
    "topics":     {"scope": "chapter", "mode": "deterministic", "fn": _dispatch_topics},
    "synthesis":  {"scope": "chapter", "mode": "deterministic", "fn": _dispatch_synthesis},
    "annotate":   {"scope": "chapter", "mode": "deterministic", "fn": _dispatch_annotate},
    "conference": {"scope": "chapter", "mode": "deterministic", "fn": _dispatch_conference},
    "history":    {"scope": "chapter", "mode": "deterministic", "fn": _dispatch_history},
    "topic-synthesis": {"scope": "topic", "mode": "deterministic",
                        "fn": _dispatch_topic_synthesis},
    "parallels":  {"scope": "global", "mode": "deterministic", "fn": _dispatch_parallels},
    "embed":      {"scope": "global", "mode": "deterministic", "fn": _dispatch_embed},
    "semantic":   {"scope": "global", "mode": "deterministic", "fn": _dispatch_semantic},
    "research":   {"scope": "chapter", "mode": "ai", "fn": _dispatch_research},
}


def mark_pass(ctx: Ctx, name: str, target: str, mode: str) -> None:
    ctx.db().execute(
        "INSERT INTO passes(name,target,corpus_version,mode,completed_at) VALUES(?,?,?,?,?) "
        "ON CONFLICT(name,target) DO UPDATE SET corpus_version=excluded.corpus_version, "
        "mode=excluded.mode, completed_at=excluded.completed_at",
        (name, target, ctx.corpus_version(), mode, now_iso()))
    ctx.db().commit()


def pending_targets(ctx: Ctx, name: str, by_priority: bool = False) -> list[str]:
    """Targets whose pass is missing or older than the current corpus version."""
    spec = PASS_DEFS[name]
    cv = ctx.corpus_version()
    db = ctx.db()
    if spec["scope"] == "global":
        row = db.execute("SELECT corpus_version FROM passes WHERE name=? AND target=?",
                         (name, GLOBAL_TARGET)).fetchone()
        return [] if (row and row["corpus_version"] >= cv) else [GLOBAL_TARGET]
    if spec["scope"] == "topic":
        rows = db.execute(
            "SELECT n.id FROM nodes n LEFT JOIN passes p ON p.name=? AND p.target=n.id "
            "WHERE n.node_type IN ('topic','event') "
            "AND (p.target IS NULL OR p.corpus_version < ?) "
            "ORDER BY n.title", (name, cv)).fetchall()
        return [r["id"] for r in rows]
    if by_priority:
        join = "LEFT JOIN coverage cov ON cov.node_id = ('chapter:' || c.slug) "
        order = "ORDER BY cov.priority DESC, c.slug"
    else:
        join = "JOIN books b ON b.slug = c.book_slug "
        order = "ORDER BY b.position, c.chapter"
    rows = db.execute(
        "SELECT c.slug FROM chapters c " + join +
        "LEFT JOIN passes p ON p.name=? AND p.target=c.slug "
        "WHERE p.target IS NULL OR p.corpus_version < ? " + order, (name, cv)).fetchall()
    return [r["slug"] for r in rows]


def enqueue_wave(ctx: Ctx, name: str, limit: int | None = None,
                 by_priority: bool = False) -> int:
    spec = PASS_DEFS[name]
    targets = pending_targets(ctx, name, by_priority=by_priority)
    if limit:
        targets = targets[:limit]
    task_type = "job" if spec["mode"] == "ai" else "pass"
    for t in targets:
        q.enqueue(ctx, task_type, t, pass_name=name)
    ctx.db().commit()
    if targets:
        ctx.log.info("wave.enqueued", pass_name=name, count=len(targets))
    return len(targets)


def process_queue(ctx: Ctx, max_items: int | None = None, include_ai: bool = True,
                  ai_budget: int | None = None,
                  deadline_ts: float | None = None,
                  workers: int | None = None) -> dict:
    """Work the queue until empty (or caps/deadline hit). Crash-safe: claimed
    items left 'running' by a dead process are requeued on the next call.
    `deadline_ts` (epoch seconds) is a soft stop: no NEW item is claimed after
    it passes — in-flight work finishes normally.

    `workers` runs that loop in N threads. A research job is ~9 minutes of
    waiting on a provider subprocess and ~7 seconds of writing, so the win is
    almost linear — but only the waiting part may overlap. Everything that
    touches the vault or git runs under a single landing lock (see
    `agents.pipeline`), because a rollback there restores the WHOLE vault
    subtree and would eat a peer's half-written chapter.

    Deterministic passes stay single-threaded: they are seconds long, they
    write shared rendered files, and there is nothing to overlap."""
    import threading
    import time as _time
    q.requeue_stale(ctx)
    if workers is None:
        workers = int(ctx.c("automation.workers", 1) or 1)
    if not include_ai:
        workers = 1  # deterministic passes are cheap and share output files
    workers = max(1, min(int(workers), 16))

    stats = {"done": 0, "failed": 0, "ai_done": 0, "skipped_ai": 0}
    task_types = ("pass", "job", "maintenance") if include_ai else ("pass", "maintenance")
    lock = threading.Lock()
    state = {"stop": False, "ai_inflight": 0, "consec_failures": 0}
    if workers > 1:
        stats["workers"] = workers

    def _stop_now(reason: str | None = None) -> None:
        state["stop"] = True
        if reason:
            stats[reason] = stats.get(reason, 0) + 1

    def _next_types() -> tuple[str, ...] | None:
        """What this worker may claim right now, or None to stop.

        Called under `lock`. Returning a narrowed tuple is how the AI budget is
        enforced across workers: once the spent-plus-in-flight count reaches the
        governor's budget, nobody may claim another 'job' — but deterministic
        work in the same queue still drains."""
        if state["stop"]:
            return None
        if max_items is not None and stats["done"] + stats["failed"] >= max_items:
            state["stop"] = True
            return None
        if deadline_ts is not None and _time.time() >= deadline_ts:
            stats["deadline_hit"] = True
            state["stop"] = True
            return None
        if include_ai and ai_budget is not None                 and stats["ai_done"] + state["ai_inflight"] >= ai_budget:
            narrowed = tuple(t for t in task_types if t != "job")
            if not narrowed:
                return None
            return narrowed
        return task_types

    def worker() -> None:
        backoff = 0.0
        while True:
            if backoff:
                _time.sleep(backoff)
            with lock:
                types = _next_types()
                budget_capped = types is not None and types != task_types
            if types is None:
                return
            item = q.claim_one(ctx, task_types=types)
            if item is None:
                if budget_capped:
                    with lock:
                        stats["skipped_ai"] += 1
                return  # queue drained for the work this worker may take
            name = item["pass_name"]
            spec = PASS_DEFS.get(name)
            if spec is None:
                q.fail(ctx, item["id"], f"unknown pass {name!r}")
                with lock:
                    stats["failed"] += 1
                continue
            is_ai = spec["mode"] == "ai"
            with lock:
                # a second look, now that the claim is real: the deadline or the
                # budget may have closed while this worker was waiting on the
                # write lock. Hand it straight back rather than start work.
                giving_back = state["stop"] or (
                    deadline_ts is not None and _time.time() >= deadline_ts) or (
                    is_ai and ai_budget is not None
                    and stats["ai_done"] + state["ai_inflight"] >= ai_budget)
                if not giving_back and is_ai:
                    state["ai_inflight"] += 1
            if giving_back:
                q.release(ctx, item["id"])
                return
            try:
                spec["fn"](ctx, item["target"])
                mark_pass(ctx, name, item["target"], spec["mode"])
                q.complete(ctx, item["id"])
                with lock:
                    stats["done"] += 1
                    state["consec_failures"] = 0
                    if is_ai:
                        stats["ai_done"] += 1
                backoff = 0.0
            except ProviderUnavailable as e:
                # the provider is down or rate-limited: give the item back
                # untouched and STOP EVERY worker. Grinding the queue against a
                # limited provider only converts pending work into dead work.
                q.release(ctx, item["id"])
                ctx.log.warn("queue.provider_unavailable", pass_name=name,
                             target=item["target"], error=str(e)[:200])
                with lock:
                    _stop_now("provider_unavailable")
                return
            except Exception as e:  # noqa: BLE001 — one bad item must not kill the run
                ctx.log.error("queue.item_failed", pass_name=name, target=item["target"],
                              error=f"{type(e).__name__}: {e}")
                q.fail(ctx, item["id"], f"{type(e).__name__}: {e}")
                with lock:
                    stats["failed"] += 1
                    state["consec_failures"] += 1
                    consec = state["consec_failures"]
                    # a run failing over and over is failing for a reason the
                    # next item will hit too — back off, then give up
                    if consec >= 3 * workers:
                        _stop_now("failure_circuit_open")
                        ctx.log.warn("queue.failure_circuit_open", consecutive=consec)
                        return
                backoff = min(30.0, 2.0 * consec)
            finally:
                if is_ai:
                    with lock:
                        state["ai_inflight"] -= 1

    if workers == 1:
        worker()  # in-thread: identical to the single-worker engine
    else:
        threads = [threading.Thread(target=worker, name=f"sg-worker-{i}", daemon=True)
                   for i in range(workers)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
    return stats


def run_wave(ctx: Ctx, name: str, limit: int | None = None,
             by_priority: bool = False) -> dict:
    enqueue_wave(ctx, name, limit=limit, by_priority=by_priority)
    include_ai = PASS_DEFS[name]["mode"] == "ai"
    return process_queue(ctx, include_ai=include_ai)


def waves_status(ctx: Ctx) -> dict:
    cv = ctx.corpus_version()
    out = {}
    total = ctx.db().execute("SELECT COUNT(*) AS n FROM chapters").fetchone()["n"]
    for name, spec in PASS_DEFS.items():
        if spec["scope"] == "global":
            row = ctx.db().execute(
                "SELECT corpus_version FROM passes WHERE name=? AND target=?",
                (name, GLOBAL_TARGET)).fetchone()
            out[name] = {"scope": "global",
                         "current": bool(row and row["corpus_version"] >= cv),
                         "done_cv": row["corpus_version"] if row else None}
        else:
            done = ctx.db().execute(
                "SELECT COUNT(*) AS n FROM passes WHERE name=? AND corpus_version>=?",
                (name, cv)).fetchone()["n"]
            ever = ctx.db().execute(
                "SELECT COUNT(*) AS n FROM passes WHERE name=?", (name,)).fetchone()["n"]
            out[name] = {"scope": "chapter", "current": done, "ever": ever, "total": total}
    return out
