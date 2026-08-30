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


def test_provider_unavailable_preserves_work(imported_ctx, monkeypatch):
    """A rate-limited provider must NOT consume the job's retry budget.

    Before this, a rate-limit window burned every attempt of every queued
    chapter within seconds and buried real research in 'dead'."""
    ctx = imported_ctx
    from scripturegraph.agents.pipeline import ProviderUnavailable

    calls = []

    def unavailable(c, target):
        calls.append(target)
        raise ProviderUnavailable("rate limited")

    monkeypatch.setitem(waves.PASS_DEFS["entities"], "fn", unavailable)
    waves.enqueue_wave(ctx, "entities")
    before = q.counts(ctx)["pending"]
    stats = waves.process_queue(ctx)

    # stops on the first unavailable item instead of grinding the whole queue
    assert stats.get("provider_unavailable") == 1
    assert len(calls) == 1
    # nothing failed, nothing died, and the attempt was handed back
    assert stats["failed"] == 0
    assert q.counts(ctx) == {"pending": before}
    row = ctx.db().execute(
        "SELECT attempts FROM work_queue WHERE target=?", (calls[0],)).fetchone()
    assert row["attempts"] == 0


def test_transport_failure_retries_with_backoff(mini_ctx, monkeypatch):
    """Transport errors get backoff retries; schema errors do not wait."""
    from scripturegraph.agents import pipeline

    sleeps: list[float] = []
    monkeypatch.setattr(pipeline.time, "sleep", lambda s: sleeps.append(s))

    class FlakyProvider:
        name = "flaky"

        def __init__(self):
            self.calls = 0

        def run(self, prompt, role, timeout, workspace, context=None):
            from scripturegraph.agents.providers import ProviderResult
            self.calls += 1
            if self.calls < 3:           # two transport failures, then success
                return ProviderResult(ok=False, error="429 rate limited")
            return ProviderResult(ok=True, text='{"claims": [], "candidate_links": [],'
                                                ' "study_sections": {}}')

    prov = FlakyProvider()
    obj, stats = pipeline._call_validated(
        mini_ctx, prov, "researcher", "prompt", "proposal", 60,
        mini_ctx.jobs_dir, None)

    assert obj is not None                 # the work survived the rate limit
    assert prov.calls == 3
    assert sleeps == [6.0, 12.0]           # growing backoff between attempts
    assert not stats.get("transport_failed")


def test_transport_failure_gives_up_and_flags(mini_ctx, monkeypatch):
    from scripturegraph.agents import pipeline

    monkeypatch.setattr(pipeline.time, "sleep", lambda s: None)

    class DeadProvider:
        name = "dead"

        def run(self, prompt, role, timeout, workspace, context=None):
            from scripturegraph.agents.providers import ProviderResult
            return ProviderResult(ok=False, error="429 rate limited")

    obj, stats = pipeline._call_validated(
        mini_ctx, DeadProvider(), "researcher", "p", "proposal", 60,
        mini_ctx.jobs_dir, None)
    assert obj is None
    # flagged as transport so the caller requeues instead of quarantining
    assert stats["transport_failed"] is True
    assert stats["calls"] == 4


def test_corpus_version_reopens_passes(imported_ctx):
    ctx = imported_ctx
    waves.run_wave(ctx, "entities")
    assert waves.pending_targets(ctx, "entities") == []
    ctx.bump_corpus_version("new corpus arrived")
    pending = waves.pending_targets(ctx, "entities")
    assert len(pending) == 4  # EVERY chapter re-opens — no permanent 'done'
