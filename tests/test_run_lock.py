"""A short-lived lock holder must not cost a scheduled run its whole slot.

The frequent run fires on the same minute as a study tick every two hours and
holds the engine lock for well under a second. The study tick lost that race
and forfeited its entire 30-minute window — 12 of 48 daily ticks, and with
parallel workers each forfeit costs N chapters instead of one.
"""
from __future__ import annotations

import threading
import time

from scripturegraph.lockfile import engine_lock
from scripturegraph.runners import _locked


def _hold(ctx, seconds: float, started: threading.Event) -> threading.Thread:
    """Hold the engine lock for `seconds` in another thread."""
    def run():
        with engine_lock(ctx):
            started.set()
            time.sleep(seconds)

    t = threading.Thread(target=run, daemon=True)
    t.start()
    started.wait(timeout=5)
    return t


def test_a_brief_holder_does_not_cost_the_next_run_its_slot(mini_ctx):
    mini_ctx.cfg["automation"]["lock_wait_sec"] = 10
    ran = []

    @_locked
    def study(ctx):
        ran.append("study")
        return {"ok": True}

    holder = _hold(mini_ctx, 1.0, threading.Event())
    t0 = time.time()
    out = study(mini_ctx)
    holder.join(timeout=10)

    assert ran == ["study"], f"the run skipped instead of waiting: {out}"
    assert out == {"ok": True}
    assert 0.5 < time.time() - t0 < 9, "it should wait for the holder, not spin or hang"


def test_a_long_holder_still_makes_the_run_skip(mini_ctx):
    """A study run overrunning its window, or the nightly run, must still cause
    a skip — the lock is unchanged, only the patience is new."""
    mini_ctx.cfg["automation"]["lock_wait_sec"] = 1
    ran = []

    @_locked
    def study(ctx):
        ran.append("study")
        return {"ok": True}

    holder = _hold(mini_ctx, 4.0, threading.Event())
    t0 = time.time()
    out = study(mini_ctx)
    elapsed = time.time() - t0

    assert ran == [], "the run must not start while another holds the lock"
    assert out == {"skipped": "another engine run active"}
    assert elapsed < 3.5, "it must give up at the deadline, not wait out the holder"
    holder.join(timeout=10)


def test_zero_wait_is_the_old_instant_skip(mini_ctx):
    mini_ctx.cfg["automation"]["lock_wait_sec"] = 0
    ran = []

    @_locked
    def study(ctx):
        ran.append("study")
        return {"ok": True}

    holder = _hold(mini_ctx, 2.0, threading.Event())
    t0 = time.time()
    out = study(mini_ctx)

    assert ran == []
    assert out == {"skipped": "another engine run active"}
    assert time.time() - t0 < 1.0, "zero wait must skip immediately"
    holder.join(timeout=10)


def test_an_uncontended_run_does_not_wait_at_all(mini_ctx):
    ran = []

    @_locked
    def study(ctx):
        ran.append("study")
        return {"ok": True}

    t0 = time.time()
    assert study(mini_ctx) == {"ok": True}
    assert ran == ["study"]
    assert time.time() - t0 < 1.0, "the common path must not pay for the retry loop"


def test_the_runners_own_exception_is_not_swallowed_by_the_retry(mini_ctx):
    """An EngineBusy raised INSIDE the wrapped function must propagate, not
    send the wrapper round the loop again."""
    from scripturegraph.lockfile import EngineBusy
    calls = []

    @_locked
    def study(ctx):
        calls.append(1)
        raise EngineBusy("raised from inside the run")

    try:
        study(mini_ctx)
    except EngineBusy:
        pass
    else:
        raise AssertionError("EngineBusy from inside the run must propagate")
    assert calls == [1], "the run must not be retried"
