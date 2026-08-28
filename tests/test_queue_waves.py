import pytest

from scripturegraph import queue as q
from scripturegraph import waves


def test_enqueue_dedupe_and_lifecycle(mini_ctx):
    q.enqueue(mini_ctx, "pass", "1ne-1", pass_name="entities", priority=1.0)
    q.enqueue(mini_ctx, "pass", "1ne-1", pass_name="entities", priority=2.0)  # dedupe
    mini_ctx.db().commit()
    assert q.counts(mini_ctx) == {"pending": 1}
    batch = q.claim_batch(mini_ctx, 10)
    assert len(batch) == 1 and batch[0]["priority"] == 2.0
    q.complete(mini_ctx, batch[0]["id"])
    assert q.counts(mini_ctx) == {}


def test_crash_resume_requeues_running(mini_ctx):
    q.enqueue(mini_ctx, "pass", "t1", pass_name="entities")
    mini_ctx.db().commit()
    q.claim_batch(mini_ctx, 5)  # claimed, then "crash"
    assert q.counts(mini_ctx) == {"running": 1}
    assert q.requeue_stale(mini_ctx) == 1
    assert q.counts(mini_ctx) == {"pending": 1}


def test_retry_until_dead(mini_ctx):
    q.enqueue(mini_ctx, "pass", "t1", pass_name="entities")
    mini_ctx.db().commit()
    for _ in range(q.MAX_ATTEMPTS):
        item = q.claim_batch(mini_ctx, 1)[0]
        q.fail(mini_ctx, item["id"], "boom")
    assert q.counts(mini_ctx) == {"dead": 1}


def test_wave_processing_and_mid_crash_resume(imported_ctx, monkeypatch):
    ctx = imported_ctx
    calls = []
    real_fn = waves.PASS_DEFS["entities"]["fn"]

    def flaky(c, target):
        calls.append(target)
        if target == "1ne-3" and len([t for t in calls if t == "1ne-3"]) == 1:
            raise RuntimeError("simulated crash")
        return real_fn(c, target)

    monkeypatch.setitem(waves.PASS_DEFS["entities"], "fn", flaky)
    waves.enqueue_wave(ctx, "entities")
    stats = waves.process_queue(ctx)
    # the transient failure is retried within the run and self-heals
    assert stats["failed"] == 1 and stats["done"] == 4
    assert waves.pending_targets(ctx, "entities") == []
    assert calls.count("1ne-3") == 2  # failed once, succeeded on retry


def test_corpus_version_reopens_passes(imported_ctx):
    ctx = imported_ctx
    waves.run_wave(ctx, "entities")
    assert waves.pending_targets(ctx, "entities") == []
    ctx.bump_corpus_version("new corpus arrived")
    pending = waves.pending_targets(ctx, "entities")
    assert len(pending) == 4  # EVERY chapter re-opens — no permanent 'done'
