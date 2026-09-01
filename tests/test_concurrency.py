"""Phase 2 gate: the queue, the database and the git transaction under N workers.

Every test here fails on the pre-parallel engine. They are deliberately about
the three ways concurrency can lose work: two workers taking the same item,
two connections interleaving one transaction, and two workers landing in git
at once (where a rollback reverts the whole vault subtree, peer work included).
"""
from __future__ import annotations

import subprocess
import threading
import time

from scripturegraph import gitops
from scripturegraph import queue as q
from scripturegraph import waves
from scripturegraph.agents.pipeline import LANDING, ProviderUnavailable


def _enqueue(ctx, n, task_type="pass", pass_name="entities"):
    for i in range(n):
        q.enqueue(ctx, task_type, f"t-{i:03d}", pass_name=pass_name)
    ctx.db().commit()


# ------------------------------------------------------------- atomic claim

def test_concurrent_claims_never_hand_the_same_item_to_two_workers(mini_ctx):
    _enqueue(mini_ctx, 60)
    claimed: list[dict] = []
    guard = threading.Lock()
    barrier = threading.Barrier(8)

    def grab():
        barrier.wait()  # maximise the overlap on the read-then-mark window
        while True:
            item = q.claim_one(mini_ctx, task_types=("pass",))
            if item is None:
                return
            with guard:
                claimed.append(item)

    threads = [threading.Thread(target=grab) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    ids = [c["id"] for c in claimed]
    assert len(ids) == 60, "every item must be claimed exactly once"
    assert len(set(ids)) == 60, f"double-claimed ids: {len(ids) - len(set(ids))}"
    assert {c["target"] for c in claimed} == {f"t-{i:03d}" for i in range(60)}
    assert all(r["attempts"] == 1 for r in
               mini_ctx.db().execute("SELECT attempts FROM work_queue")), \
        "an atomic claim burns exactly one attempt"


def test_release_returns_the_item_without_charging_an_attempt(mini_ctx):
    _enqueue(mini_ctx, 1)
    item = q.claim_one(mini_ctx, task_types=("pass",))
    assert item["attempts"] == 1
    q.release(mini_ctx, item["id"])
    row = mini_ctx.db().execute(
        "SELECT status, attempts FROM work_queue WHERE id=?", (item["id"],)).fetchone()
    assert row["status"] == "pending"
    assert row["attempts"] == 0, "work that was never tried must not be charged"
    again = q.claim_one(mini_ctx, task_types=("pass",))
    assert again["id"] == item["id"], "a released item is claimable again"


def test_release_never_drives_attempts_negative(mini_ctx):
    _enqueue(mini_ctx, 1)
    item = q.claim_one(mini_ctx, task_types=("pass",))
    q.release(mini_ctx, item["id"])
    q.release(mini_ctx, item["id"])  # double release (crash-resume overlap)
    row = mini_ctx.db().execute(
        "SELECT attempts FROM work_queue WHERE id=?", (item["id"],)).fetchone()
    assert row["attempts"] == 0


def test_pending_rows_over_the_attempt_ceiling_are_normalised(mini_ctx):
    """A pending row at or above MAX_ATTEMPTS dies on its first failure with no
    retries at all — the state the 'f'-format victims were left in."""
    _enqueue(mini_ctx, 3)
    mini_ctx.db().execute("UPDATE work_queue SET attempts=12")
    mini_ctx.db().commit()
    assert q.reset_burned_attempts(mini_ctx) == 3
    assert [r["attempts"] for r in
            mini_ctx.db().execute("SELECT attempts FROM work_queue")] == [0, 0, 0]
    # a healthy row is left alone
    mini_ctx.db().execute("UPDATE work_queue SET attempts=1")
    mini_ctx.db().commit()
    assert q.reset_burned_attempts(mini_ctx) == 0


# --------------------------------------------------- concurrent SQLite write

def test_worker_threads_get_their_own_connection(mini_ctx):
    main = mini_ctx.db()
    seen: dict[str, object] = {}

    def grab():
        seen["worker"] = mini_ctx.db()

    t = threading.Thread(target=grab)
    t.start()
    t.join()
    assert seen["worker"] is not main, \
        "a shared connection means a peer's commit() lands this thread's work"


def test_concurrent_writers_do_not_lose_rows_or_corrupt_the_database(mini_ctx):
    barrier = threading.Barrier(6)
    errors: list[Exception] = []

    def write(worker: int):
        try:
            barrier.wait()
            db = mini_ctx.db()
            for i in range(40):
                db.execute(
                    "INSERT INTO work_queue(task_type,pass_name,target,priority,status,"
                    "created_at,updated_at) VALUES('pass','entities',?,0,'pending',?,?)",
                    (f"w{worker}-{i:03d}", "now", "now"))
                db.commit()
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    threads = [threading.Thread(target=write, args=(w,)) for w in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"concurrent writers raised: {errors!r}"
    n = mini_ctx.db().execute("SELECT COUNT(*) c FROM work_queue").fetchone()["c"]
    assert n == 6 * 40, "every committed row survived"
    assert mini_ctx.db().execute("PRAGMA integrity_check").fetchone()[0] == "ok"


# ------------------------------------------------------------- landing lock

def test_the_git_landing_section_admits_one_worker_at_a_time():
    inside = {"now": 0, "max": 0}
    guard = threading.Lock()

    def land():
        with LANDING:
            with guard:
                inside["now"] += 1
                inside["max"] = max(inside["max"], inside["now"])
            time.sleep(0.01)
            with guard:
                inside["now"] -= 1

    threads = [threading.Thread(target=land) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert inside["max"] == 1, \
        "two workers in the write phase means one rolls back the other's chapter"


# ----------------------------------------------------- process_queue workers

def _install_pass(monkeypatch, name, fn, mode="ai"):
    monkeypatch.setitem(waves.PASS_DEFS, name,
                        {"scope": "chapter", "mode": mode, "fn": fn})


def test_parallel_workers_run_every_item_exactly_once(mini_ctx, monkeypatch):
    seen: list[str] = []
    guard = threading.Lock()
    overlap = {"now": 0, "max": 0}

    def handler(ctx, target):
        with guard:
            overlap["now"] += 1
            overlap["max"] = max(overlap["max"], overlap["now"])
        time.sleep(0.02)
        with guard:
            overlap["now"] -= 1
            seen.append(target)
        return {}

    _install_pass(monkeypatch, "research", handler)
    _enqueue(mini_ctx, 24, task_type="job", pass_name="research")

    stats = waves.process_queue(mini_ctx, include_ai=True, workers=4)

    assert stats["done"] == 24 and stats["failed"] == 0
    assert sorted(seen) == sorted(f"t-{i:03d}" for i in range(24))
    assert len(seen) == len(set(seen)), "an item ran twice"
    assert overlap["max"] > 1, "workers must actually overlap"
    assert q.counts(mini_ctx) == {}, "the queue is drained"


def test_the_ai_budget_holds_across_workers(mini_ctx, monkeypatch):
    ran: list[str] = []
    guard = threading.Lock()

    def handler(ctx, target):
        time.sleep(0.02)  # keep peers in flight while the budget is checked
        with guard:
            ran.append(target)
        return {}

    _install_pass(monkeypatch, "research", handler)
    _enqueue(mini_ctx, 30, task_type="job", pass_name="research")

    stats = waves.process_queue(mini_ctx, include_ai=True, ai_budget=6, workers=5)

    assert len(ran) == 6, f"budget of 6 produced {len(ran)} jobs"
    assert stats["ai_done"] == 6
    left = mini_ctx.db().execute(
        "SELECT COUNT(*) c FROM work_queue WHERE status='pending'").fetchone()["c"]
    assert left == 24, "unspent work stays pending, not running"
    assert mini_ctx.db().execute(
        "SELECT COUNT(*) c FROM work_queue WHERE status='running'").fetchone()["c"] == 0


def test_a_throttled_provider_stops_every_worker_and_gives_the_work_back(
        mini_ctx, monkeypatch):
    attempted: list[str] = []
    guard = threading.Lock()

    def handler(ctx, target):
        with guard:
            attempted.append(target)
        raise ProviderUnavailable("rate limited")

    _install_pass(monkeypatch, "research", handler)
    _enqueue(mini_ctx, 20, task_type="job", pass_name="research")

    stats = waves.process_queue(mini_ctx, include_ai=True, workers=4)

    assert stats["done"] == 0 and stats["failed"] == 0
    assert stats["provider_unavailable"] >= 1
    assert len(attempted) <= 4, \
        "the queue must not be ground against a limited provider"
    rows = mini_ctx.db().execute("SELECT status, attempts FROM work_queue").fetchall()
    assert len(rows) == 20, "no item was consumed"
    assert all(r["status"] == "pending" for r in rows), "everything was handed back"
    assert all(r["attempts"] == 0 for r in rows), "a throttle is not the item's fault"


def test_repeated_failures_open_the_circuit_instead_of_burning_the_queue(
        mini_ctx, monkeypatch):
    def handler(ctx, target):
        raise RuntimeError("boom")

    _install_pass(monkeypatch, "research", handler)
    _enqueue(mini_ctx, 40, task_type="job", pass_name="research")

    started = time.time()
    stats = waves.process_queue(mini_ctx, include_ai=True, workers=2)
    assert stats.get("failure_circuit_open"), "a run failing every item must give up"
    assert stats["failed"] < 40, "the circuit opened before the queue was consumed"
    assert time.time() - started < 60


def test_the_deadline_stops_new_claims_and_leaves_nothing_running(
        mini_ctx, monkeypatch):
    def handler(ctx, target):
        time.sleep(0.05)
        return {}

    _install_pass(monkeypatch, "research", handler)
    _enqueue(mini_ctx, 40, task_type="job", pass_name="research")

    stats = waves.process_queue(mini_ctx, include_ai=True, workers=3,
                                deadline_ts=time.time() + 0.25)
    assert stats.get("deadline_hit")
    assert 0 < stats["done"] < 40
    assert mini_ctx.db().execute(
        "SELECT COUNT(*) c FROM work_queue WHERE status='running'").fetchone()["c"] == 0, \
        "a claimed-but-unworked item left 'running' is invisible until the next sweep"


def test_a_single_worker_is_the_original_serial_engine(mini_ctx, monkeypatch):
    overlap = {"now": 0, "max": 0}
    guard = threading.Lock()

    def handler(ctx, target):
        with guard:
            overlap["now"] += 1
            overlap["max"] = max(overlap["max"], overlap["now"])
        time.sleep(0.005)
        with guard:
            overlap["now"] -= 1
        return {}

    _install_pass(monkeypatch, "research", handler)
    _enqueue(mini_ctx, 10, task_type="job", pass_name="research")
    stats = waves.process_queue(mini_ctx, include_ai=True, workers=1)
    assert stats["done"] == 10
    assert overlap["max"] == 1
    assert "workers" not in stats


# ------------------------------------------- the real pipeline, N workers

def test_a_rollback_in_one_worker_does_not_eat_a_peers_chapter(
        imported_ctx, monkeypatch):
    """`gitops.hard_restore` reverts the WHOLE vault subtree to HEAD.

    Serialised, that is exactly right: the only uncommitted work is the failing
    job's own. Run two landings at once and it becomes a weapon — the loser's
    rollback discards whatever the winner had written but not yet committed.

    This runs the real research pipeline (stub providers, real git) with one
    chapter rigged to fail its write phase, and the interleaving forced: a peer
    signals the moment its vault files are on disk but not yet committed, and
    the doomed chapter waits for that signal before blowing up. Without the
    landing lock the peer's chapter is erased from under it; with the lock the
    peer is simply not in the section yet, and the signal times out harmlessly.
    """
    from scripturegraph import synthesis, waves as w
    from scripturegraph.indexing.parallels import run_global_parallels

    ctx = imported_ctx
    run_global_parallels(ctx)
    slugs = [r["slug"] for r in ctx.db().execute("SELECT slug FROM chapters ORDER BY slug")]
    assert len(slugs) >= 3, "need peers for a rollback to threaten"
    doomed = slugs[0]
    survivors = slugs[1:]

    real_synth = synthesis.synthesize_chapter
    peer_wrote = threading.Event()

    def synth(c, slug, *a, **kw):
        if slug == doomed:
            # blow up exactly while a peer's files are written but uncommitted
            peer_wrote.wait(timeout=2.0)
            raise RuntimeError("rigged write-phase failure")
        out = real_synth(c, slug, *a, **kw)
        peer_wrote.set()
        time.sleep(0.4)  # linger, still uncommitted
        return out

    monkeypatch.setattr(synthesis, "synthesize_chapter", synth)

    from scripturegraph.booksdata import split_chapter_slug
    from scripturegraph.vaultgen.generate import study_relpath
    guides = {s_: ctx.vault / study_relpath(*split_chapter_slug(s_)) for s_ in slugs}
    before = {s_: g.read_text(encoding="utf-8") for s_, g in guides.items()}

    for s_ in slugs:
        q.enqueue(ctx, "job", s_, pass_name="research")
    ctx.db().commit()

    stats = w.process_queue(ctx, include_ai=True, workers=len(slugs))

    # the rigged chapter fails, is retried, and finally dies — but only it
    assert stats["done"] == len(survivors), f"a peer was lost: {stats}"
    assert stats["failed"] >= 1
    failed_targets = {r["target"] for r in ctx.db().execute(
        "SELECT target FROM jobs WHERE status='failed'")}
    assert failed_targets == {doomed}, f"only the rigged chapter fails: {failed_targets}"

    landed = {r["target"] for r in ctx.db().execute(
        "SELECT target FROM jobs WHERE status='applied'")}
    assert landed == set(survivors),         f"a peer's chapter was rolled back by the failing worker: {set(survivors) - landed}"
    for s_ in survivors:
        rows = ctx.db().execute(
            "SELECT COUNT(*) c FROM claims WHERE node_id=?", (f"chapter:{s_}",)
        ).fetchone()["c"]
        assert rows, f"{s_} lost its claims to a peer's rollback"
    # ...and on DISK, not just in the database: a rollback that erased a peer's
    # files while its row still said 'applied' would be the worst outcome of all
    for s_ in survivors:
        guide = guides[s_]
        assert guide.exists(), f"{s_}: study guide erased by a peer's rollback"
        assert guide.read_text(encoding="utf-8") != before[s_],             f"{s_}: study guide reverted to its pre-research state"
    log = subprocess.run(["git", "log", "--format=%s"], cwd=str(ctx.root),
                         capture_output=True, text=True).stdout.splitlines()
    assert len([m for m in log if m.startswith("research(")]) == len(survivors),         "a peer's research never reached a commit"
    assert not gitops.is_dirty(ctx), "the vault is clean after a mid-flight rollback"
