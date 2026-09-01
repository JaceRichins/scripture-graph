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


def claim_one(ctx: Ctx, task_types: tuple[str, ...] | None = None) -> dict | None:
    """Atomically take the single highest-priority pending item, or None.

    SELECT-then-UPDATE is a race the moment more than one worker runs: two
    workers read the same row as 'pending' and both go do it. BEGIN IMMEDIATE
    takes SQLite's write lock for the whole read-and-mark, so exactly one
    worker can ever see a given row as claimable. With `busy_timeout` set, a
    contending worker waits for the lock instead of raising SQLITE_BUSY.

    Claiming ONE item — rather than a batch — is also what keeps the attempt
    counter honest. A batch claim increments `attempts` on every row it takes,
    including the ones the run never reaches; when the process is later killed
    mid-run those rows are requeued with the attempt already burned, so work
    that was never tried marches toward `MAX_ATTEMPTS` and dies on its first
    real hiccup.
    """
    db = ctx.db()
    if db.in_transaction:
        db.commit()
    db.execute("BEGIN IMMEDIATE")
    try:
        q = "SELECT * FROM work_queue WHERE status='pending'"
        params: list = []
        if task_types:
            q += f" AND task_type IN ({','.join('?' * len(task_types))})"
            params.extend(task_types)
        q += " ORDER BY priority DESC, id ASC LIMIT 1"
        row = db.execute(q, params).fetchone()
        if row is None:
            db.commit()
            return None
        item = dict(row)
        _clear_status_slot(db, item["id"], "running")
        db.execute(
            "UPDATE work_queue SET status='running', attempts=attempts+1, updated_at=? "
            "WHERE id=?", (now_iso(), item["id"]))
        db.commit()
    except BaseException:
        db.rollback()
        raise
    item["status"] = "running"
    item["attempts"] = (item["attempts"] or 0) + 1
    return item


def claim_batch(ctx: Ctx, n: int, task_types: tuple[str, ...] | None = None) -> list[dict]:
    """n atomic single claims. Kept for callers that want a whole slice."""
    out: list[dict] = []
    for _ in range(n):
        item = claim_one(ctx, task_types=task_types)
        if item is None:
            break
        out.append(item)
    return out


def release(ctx: Ctx, item_id: int) -> None:
    """Hand a claimed item back untouched — no attempt burned.

    Used whenever a worker stops for a reason that is not the item's fault
    (deadline, spent budget, provider throttle): the work was never actually
    attempted, so it must not be charged for one."""
    db = ctx.db()
    _clear_status_slot(db, item_id, "pending")
    db.execute("UPDATE work_queue SET status='pending', "
               "attempts=MAX(0, attempts-1), updated_at=? WHERE id=?",
               (now_iso(), item_id))
    db.commit()


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


def reset_burned_attempts(ctx: Ctx) -> int:
    """Give a fresh attempt budget to pending rows that already exceed it.

    A row sitting in 'pending' with attempts >= MAX_ATTEMPTS is a landmine: it
    is queued, so it looks alive, but `fail` will kill it on its very first
    failure with no retries at all. Rows reach that state without ever being
    tried — a batch claim charges an attempt to every row it takes, and a run
    killed before it reaches them requeues them with the charge already made.
    Normalising them is the counterpart to claiming one item at a time."""
    db = ctx.db()
    cur = db.execute(
        "UPDATE work_queue SET attempts=0, updated_at=? "
        "WHERE status='pending' AND attempts >= ?", (now_iso(), MAX_ATTEMPTS))
    db.commit()
    return cur.rowcount


def counts(ctx: Ctx) -> dict:
    rows = ctx.db().execute(
        "SELECT status, COUNT(*) AS n FROM work_queue GROUP BY status").fetchall()
    return {r["status"]: r["n"] for r in rows}
