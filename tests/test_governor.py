"""The AI budget governor: pace spend against the plan's rolling window.

The failure this prevents is not overspending — it is the engine hitting a hard
throttle mid-week and producing NOTHING until the window resets. Every test
here is a case where the governor must either brake or, just as importantly,
must NOT brake.
"""
import time

from scripturegraph import usage


def _now_iso(offset_h=0.0):
    import datetime
    return (datetime.datetime.now(datetime.timezone.utc)
            + datetime.timedelta(hours=offset_h)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _limit(ctx, used_pct, window_minutes=10080, resets_in_h=100.0,
           reached=None, source="codex", limit_id=None, observed_h_ago=0.0,
           clear=True):
    if clear:
        ctx.db().execute("DELETE FROM usage_limits")
    ctx.db().execute(
        "INSERT INTO usage_limits(source,limit_id,window_minutes,used_percent,resets_at,"
        "plan_type,reached_type,observed_at) VALUES(?,?,?,?,?,?,?,?)",
        (source, limit_id or source, window_minutes, used_pct,
         int(time.time() + resets_in_h * 3600), "prolite", reached,
         _now_iso(-observed_h_ago)))
    ctx.db().commit()


def test_no_reading_means_full_budget(mini_ctx):
    """A telemetry gap must never be able to silently halt research."""
    assert usage.governor(mini_ctx)["scale"] == 1.0
    budget, g = usage.apply_governor(mini_ctx, 30)
    assert budget == 30
    assert g["used_pct"] is None


def test_an_expired_window_is_ignored(mini_ctx):
    """A percentage from a window that already reset says nothing about now."""
    _limit(mini_ctx, 99.0, resets_in_h=-5)
    g = usage.governor(mini_ctx)
    assert g["scale"] == 1.0
    assert "no reading" in g["reason"]


def test_on_pace_runs_at_full_budget(mini_ctx):
    """Half the window elapsed, half the quota used: exactly on track."""
    _limit(mini_ctx, 50.0, resets_in_h=84.0)   # 7d window, half remaining
    g = usage.governor(mini_ctx)
    assert g["pace_pct"] == 50.0
    assert g["scale"] == 1.0
    assert "on track" in g["reason"]


def test_early_burst_is_allowed(mini_ctx):
    """The window starts empty; being modestly ahead early is normal and must
    not be throttled, or the engine never uses the quota it pays for."""
    _limit(mini_ctx, 8.0, resets_in_h=168.0)   # window just opened, 8% spent
    assert usage.governor(mini_ctx)["scale"] == 1.0


def test_running_far_ahead_of_pace_tapers(mini_ctx):
    """30% used with only 10% of the week elapsed is a 4-day burn rate."""
    _limit(mini_ctx, 30.0, resets_in_h=151.2)  # 10% elapsed -> 20pp ahead
    g = usage.governor(mini_ctx)
    assert 0.0 < g["scale"] < 1.0
    assert "throttling" in g["reason"]
    budget, _ = usage.apply_governor(mini_ctx, 30)
    assert 0 < budget < 30


def test_ceiling_stops_new_ai_work(mini_ctx):
    _limit(mini_ctx, 95.0, resets_in_h=20.0)
    g = usage.governor(mini_ctx)
    assert g["scale"] == 0.0
    assert usage.apply_governor(mini_ctx, 30)[0] == 0


def test_provider_reporting_limit_reached_stops_immediately(mini_ctx):
    """Whatever the arithmetic says, the provider's own word wins."""
    _limit(mini_ctx, 12.0, resets_in_h=160.0, reached="weekly")
    g = usage.governor(mini_ctx)
    assert g["scale"] == 0.0
    assert "limit reached" in g["reason"]


def test_a_throttled_budget_still_keeps_one_job(mini_ctx):
    """Rounding to zero would stall the queue AND stop producing the telemetry
    the governor reads. While any headroom remains, a trickle continues."""
    _limit(mini_ctx, 30.0, resets_in_h=151.2)
    budget, g = usage.apply_governor(mini_ctx, 2)
    assert budget >= 1
    assert g["scale"] > 0


def test_a_superseded_plans_leftover_row_cannot_grant_full_budget(mini_ctx):
    """Caught live: after a plan change the old limit_id's row lingered with a
    window that had not technically expired. Selecting by window size let that
    stale 0% reading outrank the live 30% one and hand back FULL budget — the
    governor failing open in exactly the direction that does damage."""
    _limit(mini_ctx, 0.0, resets_in_h=158.0, limit_id="old-plan", observed_h_ago=58)
    _limit(mini_ctx, 30.0, resets_in_h=151.2, limit_id="codex", clear=False)

    g = usage.governor(mini_ctx)
    assert g["used_pct"] == 30.0, "the live reading must win, not the stale one"
    assert g["scale"] < 1.0


def test_the_most_constraining_live_window_wins(mini_ctx):
    """Plans can report several windows at once; a comfortable weekly number
    must not mask a nearly-spent short one."""
    _limit(mini_ctx, 20.0, window_minutes=10080, resets_in_h=151.2, limit_id="weekly")
    _limit(mini_ctx, 95.0, window_minutes=300, resets_in_h=1.0, limit_id="hourly",
           clear=False)
    assert usage.governor(mini_ctx)["scale"] == 0.0


def test_governor_can_be_switched_off(mini_ctx):
    _limit(mini_ctx, 99.0, resets_in_h=20.0)
    mini_ctx.cfg["governor"]["enabled"] = False
    assert usage.governor(mini_ctx)["scale"] == 1.0
