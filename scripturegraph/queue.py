"""Durable work queue with crash resume.

Rows are ephemeral work items; history lives in `passes`, `jobs`, and `runs`.
Completing an item deletes its row. A crash leaves rows in 'running'; the next
run calls `requeue_stale` and picks them back up — no lost or duplicated work
(handlers are idempotent).
"""
from __future__ import annotations

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso

MAX_ATTEMPTS = 3


def enqueue(ctx: Ctx, task_type: str, target: str, pass_name: str = "",
            priority: float = 0.0, payload: str | None = None) -> None:
    db = ctx.db()
    existing = db.execute(
        "SELECT id FROM work_queue WHERE task_type=? AND pass_name=? AND target=? "
        "AND status IN ('pending','running')",
        (task_type, pass_name, target)).fetchone()
    if existing:
        db.execute("UPDATE work_queue SET priority=MAX(priority, ?) WHERE id=?",
                   (priority, existing["id"]))
        return
    db.execute(
        "INSERT INTO work_queue(task_type,pass_name,target,priority,status,created_at,updated_at,"
        "payload_json) VALUES(?,?,?,?, 'pending', ?, ?, ?)",
        (task_type, pass_name, target, priority, now_iso(), now_iso(), payload))


def _clear_status_slot(db, item_id: int, status: str) -> int:
    """Drop any other row already sitting in this row's destination slot.

    work_queue declares UNIQUE(task_type, pass_name, target, status)
    ON CONFLICT IGNORE. That dedupes enqueues — but it also turns every status
    transition into a SILENT no-op whenever a twin row already occupies the
    destination slot: the UPDATE is skipped, nothing raises, nothing is logged,
    and rowcount reports 0. A row stranded that way in 'running' is never
    claimed again (claim_batch takes only 'pending'), never dies, and never
    reappears — it wedges forever, invisibly. Twin rows are the same work by
    definition (enqueue treats task_type+pass_name+target as the identity), so
    the duplicate is dropped and the transition is allowed to land.

    The `=` comparisons mirror SQLite's UNIQUE semantics exactly: a NULL in any
    key column can never conflict there, and never matches here either.
    """
    row = db.execute(
        "SELECT task_type, pass_name, target FROM work_queue WHERE id=?",
        (item_id,)).fetchone()
    if row is None:
        return 0
    return db.execute(
        "DELETE FROM work_queue WHERE id<>? AND status=? "
        "AND task_type=? AND pass_name=? AND target=?",
        (item_id, status, row["task_type"], row["pass_name"], row["target"])).rowcount


def claim_batch(ctx: Ctx, n: int, task_types: tuple[str, ...] | None = None) -> list[dict]:
    db = ctx.db()
    q = "SELECT * FROM work_queue WHERE status='pending'"
    params: list = []
    if task_types:
        q += f" AND task_type IN ({','.join('?' * len(task_types))})"
        params.extend(task_types)
    q += " ORDER BY priority DESC, id ASC LIMIT ?"
    params.append(n)
    rows = [dict(r) for r in db.execute(q, params).fetchall()]
    for r in rows:
        _clear_status_slot(db, r["id"], "running")
        db.execute(
            "UPDATE work_queue SET status='running', attempts=attempts+1, updated_at=? WHERE id=?",
            (now_iso(), r["id"]))
    db.commit()
    return rows


def complete(ctx: Ctx, item_id: int) -> None:
    ctx.db().execute("DELETE FROM work_queue WHERE id=?", (item_id,))
    ctx.db().commit()


def fail(ctx: Ctx, item_id: int, error: str) -> None:
    db = ctx.db()
    row = db.execute("SELECT attempts FROM work_queue WHERE id=?", (item_id,)).fetchone()
    if row is None:
        return
    status = "dead" if row["attempts"] >= MAX_ATTEMPTS else "pending"
    _clear_status_slot(db, item_id, status)
    db.execute("UPDATE work_queue SET status=?, error=?, updated_at=? WHERE id=?",
               (status, error[:2000], now_iso(), item_id))
    db.commit()


def requeue_stale(ctx: Ctx) -> int:
    """Reset items left 'running' by a crashed process back to 'pending'."""
    db = ctx.db()
    # bulk form of _clear_status_slot: a stale 'running' row whose identity
    # already has a 'pending' twin is duplicate work, and leaving it in place
    # would make the UPDATE below silently skip it — stranding it in 'running'
    # where nothing can ever claim, retry, or kill it again.
    dropped = db.execute(
        "DELETE FROM work_queue WHERE status='running' AND EXISTS ("
        "  SELECT 1 FROM work_queue o WHERE o.id <> work_queue.id AND o.status='pending'"
        "  AND o.task_type = work_queue.task_type AND o.pass_name = work_queue.pass_name"
        "  AND o.target = work_queue.target)").rowcount
    cur = db.execute("UPDATE work_queue SET status='pending', updated_at=? WHERE status='running'",
                     (now_iso(),))
    db.commit()
    return cur.rowcount + dropped


def revive_dead(ctx: Ctx, only_provider_errors: bool = True) -> int:
    """Return 'dead' items to the queue with a fresh attempt budget.

    Items die after MAX_ATTEMPTS failures, which is right for genuinely bad
    work — but a provider outage or rate-limit window can kill a whole run's
    worth of perfectly good chapters in seconds. By default only those are
    revived; pass only_provider_errors=False to revive everything."""
    db = ctx.db()
    where = "status='dead'"
    if only_provider_errors:
        where += (" AND ("
                  "  error LIKE '%ProviderUnavailable%'"
                  "  OR error LIKE '%no valid researcher output%'"
                  "  OR error LIKE '%JobQuarantined%'"
                  "  OR error LIKE '%timeout%'"
                  "  OR error LIKE '%rate%')")
    # a revivable row whose identity is already queued as 'pending' is work the
    # queue is about to do anyway; drop it rather than let the UPDATE be
    # silently ignored and leave it 'dead' forever (see _clear_status_slot)
    dropped = db.execute(
        f"DELETE FROM work_queue WHERE {where} AND EXISTS ("
        "  SELECT 1 FROM work_queue o WHERE o.id <> work_queue.id AND o.status='pending'"
        "  AND o.task_type = work_queue.task_type AND o.pass_name = work_queue.pass_name"
        "  AND o.target = work_queue.target)").rowcount
    cur = db.execute(
        f"UPDATE work_queue SET status='pending', attempts=0, error=NULL, "
        f"updated_at=? WHERE {where}", (now_iso(),))
    db.commit()
    return cur.rowcount + dropped


def counts(ctx: Ctx) -> dict:
    rows = ctx.db().execute(
        "SELECT status, COUNT(*) AS n FROM work_queue GROUP BY status").fetchall()
    return {r["status"]: r["n"] for r in rows}
