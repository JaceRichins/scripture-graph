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
    db.execute("UPDATE work_queue SET status=?, error=?, updated_at=? WHERE id=?",
               (status, error[:2000], now_iso(), item_id))
    db.commit()


def requeue_stale(ctx: Ctx) -> int:
    """Reset items left 'running' by a crashed process back to 'pending'."""
    db = ctx.db()
    cur = db.execute("UPDATE work_queue SET status='pending', updated_at=? WHERE status='running'",
                     (now_iso(),))
    db.commit()
    return cur.rowcount


def revive_dead(ctx: Ctx, only_provider_errors: bool = True) -> int:
    """Return 'dead' items to the queue with a fresh attempt budget.

    Items die after MAX_ATTEMPTS failures, which is right for genuinely bad
    work — but a provider outage or rate-limit window can kill a whole run's
    worth of perfectly good chapters in seconds. By default only those are
    revived; pass only_provider_errors=False to revive everything."""
    db = ctx.db()
    if only_provider_errors:
        cur = db.execute(
            "UPDATE work_queue SET status='pending', attempts=0, error=NULL, "
            "updated_at=? WHERE status='dead' AND ("
            "  error LIKE '%ProviderUnavailable%'"
            "  OR error LIKE '%no valid researcher output%'"
            "  OR error LIKE '%JobQuarantined%'"
            "  OR error LIKE '%timeout%'"
            "  OR error LIKE '%rate%')", (now_iso(),))
    else:
        cur = db.execute(
            "UPDATE work_queue SET status='pending', attempts=0, error=NULL, "
            "updated_at=? WHERE status='dead'", (now_iso(),))
    db.commit()
    return cur.rowcount


def counts(ctx: Ctx) -> dict:
    rows = ctx.db().execute(
        "SELECT status, COUNT(*) AS n FROM work_queue GROUP BY status").fetchall()
    return {r["status"]: r["n"] for r in rows}
