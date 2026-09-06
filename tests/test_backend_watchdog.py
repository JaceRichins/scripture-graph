"""The family server dies silently; the ticks now notice and restart it."""
from scripturegraph.runners import backend_watchdog


def test_healthy_server_is_left_alone(mini_ctx):
    calls = []
    out = backend_watchdog(mini_ctx, probe=lambda: True, start=lambda: calls.append(1) or True)
    assert out == {"ok": True} and calls == []


def test_dead_server_is_restarted(mini_ctx):
    calls = []
    out = backend_watchdog(mini_ctx, probe=lambda: False, start=lambda: calls.append(1) or True)
    assert out == {"ok": False, "restarted": True} and calls == [1]


def test_watchdog_can_be_disabled(mini_ctx):
    mini_ctx.cfg["backend"] = {"watchdog": False}
    assert backend_watchdog(mini_ctx, probe=lambda: False, start=lambda: True) == {"skipped": "disabled"}
