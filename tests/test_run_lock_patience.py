"""The nightly and weekly runs are patient, and study ticks yield to them.

Four nights in a row the nightly fired at 02:30 into a running 30-minute
study tick, waited its 90 seconds, and skipped — no podcast ingestion, no
conference freshen, no wave refresh. Now a patient run waits longer than any
tick, and while it waits it raises a flag that makes the next study tick step
aside instead of taking the lock again.
"""
from __future__ import annotations

import threading
import time

from scripturegraph.lockfile import engine_lock
from scripturegraph.runners import YIELD_FLAG, _locked


def _hold(ctx, seconds: float) -> threading.Thread:
    started = threading.Event()

    def run():
        with engine_lock(ctx):
            started.set()
            time.sleep(seconds)

    t = threading.Thread(target=run, daemon=True)
    t.start()
    started.wait(timeout=5)
    return t


def test_nightly_outwaits_a_holder_the_study_tick_would_skip(mini_ctx):
    mini_ctx.cfg["automation"]["lock_wait_sec"] = 1
    mini_ctx.cfg["automation"]["long_lock_wait_sec"] = 15
    ran = []

    @_locked
    def run_nightly(ctx):
        ran.append("nightly")
        return {"ok": True}

    @_locked
    def run_study(ctx):
        ran.append("study")
        return {"ok": True}

    holder = _hold(mini_ctx, 4.0)
    assert run_study(mini_ctx) == {"skipped": "another engine run active"}, \
        "a study tick is still impatient"
    out = run_nightly(mini_ctx)
    holder.join(timeout=10)
    assert out == {"ok": True} and ran == ["nightly"], "the nightly waited the holder out"
    assert not (mini_ctx.state_dir / YIELD_FLAG).exists(), "the flag is cleared on entry"


def test_a_study_tick_yields_while_a_patient_run_waits(mini_ctx):
    mini_ctx.cfg["automation"]["lock_wait_sec"] = 1
    mini_ctx.cfg["automation"]["long_lock_wait_sec"] = 15
    ran = []

    @_locked
    def run_nightly(ctx):
        ran.append("nightly")
        return {"ok": True}

    @_locked
    def run_study(ctx):
        ran.append("study")
        return {"ok": True}

    holder = _hold(mini_ctx, 5.0)
    nightly_out = {}
    t = threading.Thread(target=lambda: nightly_out.update(run_nightly(mini_ctx)), daemon=True)
    t.start()
    time.sleep(1.0)   # the nightly is now waiting and has raised its flag
    assert (mini_ctx.state_dir / YIELD_FLAG).exists()
    out = run_study(mini_ctx)
    assert out["skipped"].startswith("yielding to run_nightly"), out
    holder.join(timeout=10)
    t.join(timeout=20)
    assert nightly_out == {"ok": True} and ran == ["nightly"]
    assert not (mini_ctx.state_dir / YIELD_FLAG).exists()
    # with the flag gone, the next tick runs normally
    assert run_study(mini_ctx) == {"ok": True}


def test_a_stale_flag_does_not_block_study_forever(mini_ctx):
    import os
    flag = mini_ctx.state_dir / YIELD_FLAG
    flag.parent.mkdir(parents=True, exist_ok=True)
    flag.write_text("run_nightly", encoding="utf-8")
    old = time.time() - 2 * 3600
    os.utime(flag, (old, old))

    @_locked
    def run_study(ctx):
        return {"ok": True}

    assert run_study(mini_ctx) == {"ok": True}
    assert not flag.exists()


def test_patient_run_that_gives_up_clears_its_flag(mini_ctx):
    mini_ctx.cfg["automation"]["long_lock_wait_sec"] = 1

    @_locked
    def run_weekly(ctx):
        return {"ok": True}

    holder = _hold(mini_ctx, 4.0)
    out = run_weekly(mini_ctx)
    holder.join(timeout=10)
    assert out == {"skipped": "another engine run active"}
    assert not (mini_ctx.state_dir / YIELD_FLAG).exists()
