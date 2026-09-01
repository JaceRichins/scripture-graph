"""Usage telemetry: attribution, dedup, and the freshness of limit readings.

These tests guard the numbers a parallel ramp gets sized against. Every one of
them corresponds to a way the dashboard could confidently report a wrong figure.
"""
import json

from scripturegraph import usage


def _write(path, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r) + "\n")


def _claude_record(rid, ts, out_tokens, cwd, block="text", model="claude-opus-5"):
    return {"type": "assistant", "requestId": rid, "timestamp": ts, "cwd": cwd,
            "uuid": f"{rid}-{block}",
            "message": {"id": f"msg-{rid}", "model": model,
                        "content": [{"type": block}],
                        "usage": {"input_tokens": 10, "output_tokens": out_tokens,
                                  "cache_read_input_tokens": 100,
                                  "cache_creation_input_tokens": 5}}}


def _point_logs(monkeypatch, tmp_path, claude_glob=None, codex_glob=None):
    monkeypatch.setattr(usage, "CLAUDE_LOGS", claude_glob or str(tmp_path / "none-c/*.jsonl"))
    monkeypatch.setattr(usage, "CODEX_LOGS", codex_glob or str(tmp_path / "none-x/*.jsonl"))


def test_consumer_attribution_separates_the_loops():
    eng = usage.consumer_for(
        r"C:\Users\jacer\repos\SCRIPTURE GRAPH\Scripture Graph\.scripture-engine\jobs\job-x")
    assert eng == "scripture-engine"
    assert usage.consumer_for(r"C:\ScriptureGraphAudio\jobs\podcast\alma-5") == "audio"
    assert usage.consumer_for(r"C:\Users\jacer\repos\construction") == "construction"
    assert usage.consumer_for(r"C:\Users\jacer\repos\investing") == "investing"
    # the engine repo itself, but NOT an engine job -> interactive, not engine
    assert usage.consumer_for(r"C:\Users\jacer\repos\SCRIPTURE GRAPH") \
        == "scripture-graph-interactive"
    assert usage.consumer_for(None) == "unknown"


def test_claude_requests_are_deduped_across_content_blocks(mini_ctx, tmp_path, monkeypatch):
    """Claude Code writes one record per content block, each repeating the SAME
    message usage. Counting records instead of requests overstated tokens by
    ~85% in the real logs — enough to mis-size a ramp badly."""
    cwd = r"C:\Users\jacer\repos\SCRIPTURE GRAPH\Scripture Graph\.scripture-engine\jobs\j"
    logs = tmp_path / "claude"
    _write(logs / "session.jsonl", [
        _claude_record("req-1", "2026-09-01T10:00:00Z", 500, cwd, "thinking"),
        _claude_record("req-1", "2026-09-01T10:00:01Z", 500, cwd, "text"),
        _claude_record("req-1", "2026-09-01T10:00:02Z", 500, cwd, "tool_use"),
        _claude_record("req-2", "2026-09-01T10:05:00Z", 300, cwd, "text"),
    ])
    _point_logs(monkeypatch, tmp_path, claude_glob=str(logs / "*.jsonl"))

    stats = usage.scan(mini_ctx, days=3650)
    assert stats["claude_requests"] == 2, "3 blocks of req-1 must count once"
    row = mini_ctx.db().execute(
        "SELECT SUM(calls) c, SUM(output_tokens) o FROM usage_samples "
        "WHERE source='claude'").fetchone()
    assert row["c"] == 2
    assert row["o"] == 800  # 500 + 300, not 500*3 + 300


def test_rescanning_does_not_double_count(mini_ctx, tmp_path, monkeypatch):
    """The scan is incremental; running it twice must not inflate totals, and
    appending must pick up only the new records."""
    cwd = r"C:\ScriptureGraphAudio\jobs\podcast\x"
    log = tmp_path / "claude" / "s.jsonl"
    _write(log, [_claude_record("r1", "2026-09-01T10:00:00Z", 100, cwd)])
    _point_logs(monkeypatch, tmp_path, claude_glob=str(tmp_path / "claude" / "*.jsonl"))

    usage.scan(mini_ctx, days=3650)
    usage.scan(mini_ctx, days=3650)  # nothing changed
    total = lambda: mini_ctx.db().execute(  # noqa: E731
        "SELECT COALESCE(SUM(output_tokens),0) o FROM usage_samples").fetchone()["o"]
    assert total() == 100

    with open(log, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(_claude_record("r2", "2026-09-01T11:00:00Z", 250, cwd)) + "\n")
    usage.scan(mini_ctx, days=3650)
    assert total() == 350


def test_codex_counts_per_turn_deltas_not_cumulative_totals(mini_ctx, tmp_path, monkeypatch):
    """token_count carries a cumulative total AND a per-turn delta. Summing the
    cumulative field counts every earlier turn again on each new turn."""
    def tc(ts, total_out, last_out):
        return {"timestamp": ts, "type": "event_msg", "payload": {
            "type": "token_count",
            "info": {"total_token_usage": {"input_tokens": 999, "output_tokens": total_out},
                     "last_token_usage": {"input_tokens": 10, "output_tokens": last_out}},
            "rate_limits": {}}}

    log = tmp_path / "codex" / "r.jsonl"
    _write(log, [
        {"timestamp": "2026-09-01T10:00:00Z", "type": "session_meta",
         "payload": {"cwd": r"C:\Users\jacer\repos\SCRIPTURE GRAPH\Scripture Graph"
                            r"\.scripture-engine\jobs\j"}},
        tc("2026-09-01T10:00:10Z", 100, 100),
        tc("2026-09-01T10:01:00Z", 250, 150),
        tc("2026-09-01T10:02:00Z", 400, 150),
    ])
    _point_logs(monkeypatch, tmp_path, codex_glob=str(tmp_path / "codex" / "*.jsonl"))

    usage.scan(mini_ctx, days=3650)
    row = mini_ctx.db().execute(
        "SELECT consumer, SUM(output_tokens) o FROM usage_samples WHERE source='codex' "
        "GROUP BY consumer").fetchone()
    assert row["consumer"] == "scripture-engine"   # taken from session_meta cwd
    assert row["o"] == 400                          # 100+150+150, not 100+250+400


def test_a_stale_limit_reading_never_overwrites_a_newer_one(mini_ctx, tmp_path, monkeypatch):
    """Logs are scanned in glob order, not time order. A two-day-old session
    read after a fresh one must not resurrect its percentage."""
    def rl(ts, pct):
        return {"timestamp": ts, "type": "event_msg", "payload": {
            "type": "token_count", "info": {"last_token_usage": {}},
            "rate_limits": {"limit_id": "codex", "plan_type": "prolite",
                            "primary": {"used_percent": pct, "window_minutes": 10080,
                                        "resets_at": 1788748153}}}}

    d = tmp_path / "codex"
    _write(d / "b-new.jsonl", [rl("2026-09-01T17:00:00Z", 30.0)])
    _write(d / "a-old.jsonl", [rl("2026-08-30T13:00:00Z", 98.0)])
    _point_logs(monkeypatch, tmp_path, codex_glob=str(d / "*.jsonl"))

    usage.scan(mini_ctx, days=3650)
    row = mini_ctx.db().execute("SELECT used_percent, observed_at FROM usage_limits").fetchone()
    assert row["used_percent"] == 30.0
    assert row["observed_at"].startswith("2026-09-01")


def test_report_flags_a_window_that_has_already_reset(mini_ctx, tmp_path, monkeypatch):
    """A percentage from a window that already rolled over is not headroom
    information; the report must say so rather than present it as current."""
    _point_logs(monkeypatch, tmp_path)
    mini_ctx.db().execute(
        "INSERT INTO usage_limits(source,limit_id,window_minutes,used_percent,resets_at,"
        "plan_type,reached_type,observed_at) VALUES('codex','codex',300,98.0,1000000000,"
        "'plus',NULL,'2026-08-30T13:19:00Z')")
    mini_ctx.db().commit()

    rep = usage.report(mini_ctx, days=7)
    assert rep["limits"][0]["expired"] is True
    assert "ALREADY RESET" in usage.render(rep)


def test_render_is_ascii_safe_for_a_windows_console(mini_ctx, tmp_path, monkeypatch):
    """The engine prints this on a cp1252 console; a stray block character
    crashes the command with UnicodeEncodeError instead of reporting."""
    _point_logs(monkeypatch, tmp_path)
    text = usage.render(usage.report(mini_ctx, days=7))
    text.encode("cp1252")  # raises if any non-cp1252 glyph slipped in
