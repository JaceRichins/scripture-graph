"""Subscription usage telemetry: what the Claude and Codex plans are actually spending.

Two sources, deliberately:

1. `provider_calls` — this engine's own record of every AI invocation, written
   at the call site. Authoritative for the engine, useless for anything else.
2. The CLIs' own machine-wide logs (`~/.claude/projects/*/*.jsonl`,
   `~/.codex/sessions/**/*.jsonl`). Every process that spends the subscription
   writes there — the scripture engine, the audio loop, investing, construction
   — so this is the only view that can size a ramp honestly. Sessions are
   attributed to a consumer by working directory.

Scanning is incremental (byte offsets per file in `usage_cursor`) because the
logs are ~1.5 GB/week; a steady-state scan reads only what was appended.

Two traps this module exists to avoid:

- Claude Code writes ONE TRANSCRIPT RECORD PER CONTENT BLOCK (text, thinking,
  each tool_use), and every one repeats the same message-level usage. Summing
  records overstates tokens by ~85%. Requests are deduped by `requestId`.
- Codex `token_count` events carry both a cumulative `total_token_usage` and a
  per-turn `last_token_usage`. Only the latter is additive.
"""
from __future__ import annotations

import datetime
import glob
import io
import json
import os
import time
from pathlib import Path

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso

CLAUDE_LOGS = "~/.claude/projects/*/*.jsonl"
CODEX_LOGS = "~/.codex/sessions/**/*.jsonl"

# cwd fragment (lowercased) -> consumer name. First match wins, so the more
# specific engine-jobs path must precede the bare repo path.
CONSUMER_RULES: list[tuple[str, str]] = [
    (r"scripture graph\.scripture-engine", "scripture-engine"),
    (r"scripture graph\jobs", "scripture-engine"),
    (".scripture-engine", "scripture-engine"),
    ("scripturegraphaudio", "audio"),
    ("scripture-graph-audio", "audio"),
    ("scripture-graph-tier0", "tier0"),
    ("repos\\investing", "investing"),
    ("repos\\construction", "construction"),
    ("goals-obsidian-vault", "goals"),
    ("repos\\scripture graph", "scripture-graph-interactive"),
]


def consumer_for(cwd: str | None) -> str:
    """Attribute a CLI session to whichever loop spent the subscription."""
    if not cwd:
        return "unknown"
    low = cwd.lower().replace("/", "\\")
    for frag, name in CONSUMER_RULES:
        if frag.lower().replace("/", "\\") in low:
            return name
    parts = [p for p in low.split("\\") if p and ":" not in p]
    for skip in ("users", "jacer", "repos", "appdata", "local", "temp"):
        while parts and parts[0] == skip:
            parts.pop(0)
    return f"other:{parts[0]}" if parts else "unknown"


def _hour(ts: str) -> str:
    """'2026-09-01T17:15:03.123Z' -> '2026-09-01T17' (UTC hour bucket)."""
    return (ts or "")[:13]


# ------------------------------------------------------------------ ingest

class _Roll:
    """Accumulates hour/source/consumer/model buckets for one scan."""

    def __init__(self) -> None:
        self.buckets: dict[tuple, list] = {}

    def add(self, hour, source, consumer, model, *, calls=0, throttled=0,
            inp=0, out=0, cread=0, cwrite=0, cost=0.0) -> None:
        if not hour:
            return
        k = (hour, source, consumer, model or "unknown")
        b = self.buckets.setdefault(k, [0, 0, 0, 0, 0, 0, 0.0])
        for i, v in enumerate((calls, throttled, inp, out, cread, cwrite)):
            b[i] += v
        b[6] += cost

    def flush(self, db) -> int:
        for (hour, source, consumer, model), b in self.buckets.items():
            db.execute(
                "INSERT INTO usage_samples(hour,source,consumer,model,calls,throttled,"
                "input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,cost_usd) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(hour,source,consumer,model) DO UPDATE SET "
                "calls=calls+excluded.calls, throttled=throttled+excluded.throttled, "
                "input_tokens=input_tokens+excluded.input_tokens, "
                "output_tokens=output_tokens+excluded.output_tokens, "
                "cache_read_tokens=cache_read_tokens+excluded.cache_read_tokens, "
                "cache_write_tokens=cache_write_tokens+excluded.cache_write_tokens, "
                "cost_usd=cost_usd+excluded.cost_usd",
                (hour, source, consumer, model, *b))
        return len(self.buckets)


def _new_lines(db, path: str, st: os.stat_result):
    """Yield (line, ...) appended since the last scan, and advance the cursor.

    Only whole lines are consumed: a file being written right now usually ends
    mid-record, and the remainder is picked up next scan.
    """
    row = db.execute("SELECT mtime,size,byte_offset,consumer FROM usage_cursor WHERE path=?",
                     (path,)).fetchone()
    start = 0
    consumer = None
    if row:
        if row["mtime"] == st.st_mtime and row["size"] == st.st_size:
            return None, None  # untouched since last scan
        # a shrunk file was rotated or rewritten; re-read it whole
        start = row["byte_offset"] if st.st_size >= row["byte_offset"] else 0
        consumer = row["consumer"]
    with io.open(path, "rb") as fh:
        fh.seek(start)
        blob = fh.read()
    cut = blob.rfind(b"\n")
    if cut < 0:
        return [], (start, consumer)
    text = blob[:cut + 1].decode("utf-8", errors="replace")
    return text.splitlines(), (start + cut + 1, consumer)


def _save_cursor(db, path, st, offset, consumer) -> None:
    db.execute(
        "INSERT INTO usage_cursor(path,mtime,size,byte_offset,consumer,scanned_at) "
        "VALUES(?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET mtime=excluded.mtime, "
        "size=excluded.size, byte_offset=excluded.byte_offset, "
        "consumer=COALESCE(excluded.consumer, usage_cursor.consumer), "
        "scanned_at=excluded.scanned_at",
        (path, st.st_mtime, st.st_size, offset, consumer, now_iso()))


_THROTTLE_HINTS = ("usage limit", "rate limit", "rate_limit", "429", "overloaded",
                   "too many requests", "quota")


def _looks_throttled(text: str) -> bool:
    low = (text or "").lower()
    return any(h in low for h in _THROTTLE_HINTS)


def _scan_claude(ctx: Ctx, roll: _Roll, since_ts: float, stats: dict) -> None:
    db = ctx.db()
    for path in glob.glob(os.path.expanduser(CLAUDE_LOGS)):
        try:
            st = os.stat(path)
        except OSError:
            continue
        if st.st_mtime < since_ts:
            continue
        lines, cur = _new_lines(db, path, st)
        if lines is None:
            continue
        stats["claude_files"] += 1
        offset, consumer = cur
        for line in lines:
            if '"assistant"' not in line:
                continue
            try:
                d = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue
            if d.get("type") != "assistant":
                continue
            msg = d.get("message") or {}
            u = msg.get("usage") or {}
            if not u:
                continue
            rid = d.get("requestId") or msg.get("id") or d.get("uuid")
            # one record per content block, all repeating the same usage
            if rid and db.execute("SELECT 1 FROM usage_seen WHERE request_id=?",
                                  (rid,)).fetchone():
                continue
            if rid:
                db.execute("INSERT OR IGNORE INTO usage_seen(request_id,ts) VALUES(?,?)",
                           (rid, d.get("timestamp") or now_iso()))
            who = consumer_for(d.get("cwd"))
            consumer = consumer or who
            roll.add(_hour(d.get("timestamp")), "claude", who, msg.get("model"),
                     calls=1,
                     throttled=1 if d.get("isApiErrorMessage") else 0,
                     inp=u.get("input_tokens") or 0,
                     out=u.get("output_tokens") or 0,
                     cread=u.get("cache_read_input_tokens") or 0,
                     cwrite=u.get("cache_creation_input_tokens") or 0)
            stats["claude_requests"] += 1
        _save_cursor(db, path, st, offset, consumer)


def _scan_codex(ctx: Ctx, roll: _Roll, since_ts: float, stats: dict) -> None:
    db = ctx.db()
    for path in glob.glob(os.path.expanduser(CODEX_LOGS), recursive=True):
        try:
            st = os.stat(path)
        except OSError:
            continue
        if st.st_mtime < since_ts:
            continue
        lines, cur = _new_lines(db, path, st)
        if lines is None:
            continue
        stats["codex_files"] += 1
        offset, consumer = cur
        for line in lines:
            try:
                d = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue
            payload = d.get("payload") or {}
            kind = d.get("type")
            if kind == "session_meta":
                consumer = consumer_for(payload.get("cwd"))
                continue
            if kind == "turn_context" and not consumer:
                consumer = consumer_for(payload.get("cwd"))
                continue
            if payload.get("type") == "token_count":
                info = payload.get("info") or {}
                # last_ is the per-turn delta; total_ is cumulative and would
                # be counted again on every subsequent turn
                last = info.get("last_token_usage") or {}
                rl = payload.get("rate_limits") or {}
                _record_limits(db, "codex", rl, d.get("timestamp") or now_iso())
                roll.add(_hour(d.get("timestamp")), "codex", consumer or "unknown",
                         info.get("model") or "codex",
                         calls=1,
                         throttled=1 if rl.get("rate_limit_reached_type") else 0,
                         inp=last.get("input_tokens") or 0,
                         out=last.get("output_tokens") or 0,
                         cread=last.get("cached_input_tokens") or 0,
                         cwrite=last.get("cache_write_input_tokens") or 0)
                stats["codex_turns"] += 1
            elif payload.get("type") in ("error", "stream_error"):
                if _looks_throttled(json.dumps(payload)):
                    roll.add(_hour(d.get("timestamp")), "codex", consumer or "unknown",
                             "codex", throttled=1)
        _save_cursor(db, path, st, offset, consumer)


def _record_limits(db, source: str, rl: dict, observed_at: str) -> None:
    """Persist the provider's own rate-limit readout (Codex reports a real %).

    Files are scanned in glob order, not chronological order, so a two-day-old
    session can be read after a fresh one. The upsert therefore only accepts a
    reading that is NEWER than the one already stored — otherwise the dashboard
    reports a stale 98% and the ramp gets sized against a number from Tuesday.
    """
    for slot in ("primary", "secondary"):
        w = rl.get(slot)
        if not isinstance(w, dict) or w.get("used_percent") is None:
            continue
        db.execute(
            "INSERT INTO usage_limits(source,limit_id,window_minutes,used_percent,"
            "resets_at,plan_type,reached_type,observed_at) VALUES(?,?,?,?,?,?,?,?) "
            "ON CONFLICT(source,limit_id,window_minutes) DO UPDATE SET "
            "used_percent=excluded.used_percent, resets_at=excluded.resets_at, "
            "plan_type=excluded.plan_type, reached_type=excluded.reached_type, "
            "observed_at=excluded.observed_at "
            "WHERE excluded.observed_at > usage_limits.observed_at",
            (source, rl.get("limit_id") or slot, int(w.get("window_minutes") or 0),
             float(w["used_percent"]), w.get("resets_at"), rl.get("plan_type"),
             rl.get("rate_limit_reached_type"), observed_at))


def scan(ctx: Ctx, days: int = 7, rescan: bool = False) -> dict:
    """Ingest anything appended to the CLI logs since the last scan."""
    t0 = time.time()
    since_ts = time.time() - days * 86400
    stats = {"claude_files": 0, "claude_requests": 0, "codex_files": 0, "codex_turns": 0}
    roll = _Roll()
    db = ctx.db()
    if rescan:
        for t in ("usage_cursor", "usage_samples", "usage_seen", "usage_limits"):
            db.execute(f"DELETE FROM {t}")
        db.commit()
    _scan_claude(ctx, roll, since_ts, stats)
    _scan_codex(ctx, roll, since_ts, stats)
    stats["buckets"] = roll.flush(db)
    # keep the dedup set bounded to the reporting window
    cutoff = (datetime.datetime.now(datetime.timezone.utc)
              - datetime.timedelta(days=days + 1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    db.execute("DELETE FROM usage_seen WHERE ts < ?", (cutoff,))
    db.commit()
    stats["seconds"] = round(time.time() - t0, 1)
    return stats


# ------------------------------------------------------------------ report

def _window_hours(hours: int) -> str:
    start = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=hours)
    return start.strftime("%Y-%m-%dT%H")


def report(ctx: Ctx, days: int = 7) -> dict:
    db = ctx.db()
    out: dict = {"generated_at": now_iso(), "days": days}

    # what the providers themselves say about the plan. A reading is only
    # actionable while its window is still open: past resets_at the counter has
    # already rolled over and the stored percentage describes a spent window.
    now_epoch = int(time.time())
    out["limits"] = []
    for r in db.execute("SELECT * FROM usage_limits ORDER BY source, window_minutes"):
        d = dict(r)
        d["expired"] = bool(d["resets_at"] and int(d["resets_at"]) <= now_epoch)
        d["age_hours"] = round(
            (datetime.datetime.now(datetime.timezone.utc)
             - datetime.datetime.strptime(d["observed_at"][:19], "%Y-%m-%dT%H:%M:%S")
             .replace(tzinfo=datetime.timezone.utc)).total_seconds() / 3600, 1)
        out["limits"].append(d)

    for label, hours in (("last_1h", 1), ("last_5h", 5), ("last_24h", 24),
                         ("last_7d", 24 * 7)):
        since = _window_hours(hours)
        out[label] = {
            "by_source": [dict(r) for r in db.execute(
                "SELECT source, SUM(calls) calls, SUM(throttled) throttled, "
                "SUM(input_tokens) inp, SUM(output_tokens) out, "
                "SUM(cache_read_tokens) cread, SUM(cache_write_tokens) cwrite "
                "FROM usage_samples WHERE hour >= ? GROUP BY source ORDER BY source",
                (since,))],
            "by_consumer": [dict(r) for r in db.execute(
                "SELECT source, consumer, SUM(calls) calls, SUM(throttled) throttled, "
                "SUM(input_tokens)+SUM(cache_read_tokens)+SUM(cache_write_tokens) inp, "
                "SUM(output_tokens) out FROM usage_samples WHERE hour >= ? "
                "GROUP BY source, consumer ORDER BY out DESC", (since,))],
        }

    # engine's own view: jobs and calls
    since_iso = (datetime.datetime.now(datetime.timezone.utc)
                 - datetime.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    out["engine_jobs"] = [dict(r) for r in db.execute(
        "SELECT status, COUNT(*) n, ROUND(AVG(julianday(updated_at)-julianday(created_at))"
        "*86400, 1) avg_sec FROM jobs WHERE created_at >= ? GROUP BY status",
        (since_iso,))]
    out["engine_calls"] = [dict(r) for r in db.execute(
        "SELECT provider, role, COUNT(*) n, SUM(ok) ok, SUM(throttled) throttled, "
        "SUM(cached) cached, ROUND(AVG(duration_s),1) avg_s FROM provider_calls "
        "WHERE ts >= ? GROUP BY provider, role ORDER BY provider, role", (since_iso,))]
    out["engine_throughput"] = [dict(r) for r in db.execute(
        "SELECT substr(created_at,1,10) day, COUNT(*) jobs, "
        "SUM(status='applied') applied FROM jobs WHERE created_at >= ? "
        "GROUP BY day ORDER BY day", (since_iso,))]
    return out


def _fmt_tokens(n) -> str:
    n = int(n or 0)
    for unit, div in (("B", 1_000_000_000), ("M", 1_000_000), ("k", 1_000)):
        if n >= div:
            return f"{n / div:.1f}{unit}"
    return str(n)


def _bar(pct: float, width: int = 24) -> str:
    filled = max(0, min(width, round(width * pct / 100)))
    return "#" * filled + "." * (width - filled)


def render(rep: dict) -> str:
    L: list[str] = []
    L.append("SUBSCRIPTION UTILIZATION")
    L.append(f"  generated {rep['generated_at']}  |  window {rep['days']}d")
    L.append("")

    L.append("PLAN LIMITS (as reported by the provider)")
    if rep["limits"]:
        for lim in rep["limits"]:
            win = int(lim["window_minutes"] or 0)
            win_s = (f"{win // 1440}d" if win >= 1440 else
                     f"{win // 60}h" if win >= 60 else f"{win}m")
            pct = float(lim["used_percent"] or 0)
            resets = ""
            if lim["resets_at"]:
                dt = datetime.datetime.fromtimestamp(int(lim["resets_at"]),
                                                     datetime.timezone.utc)
                resets = f"  resets {dt.strftime('%m-%d %H:%MZ')}"
            flag = f"  ** {lim['reached_type']} **" if lim["reached_type"] else ""
            if lim.get("expired"):
                flag += "  [WINDOW ALREADY RESET - stale, ignore]"
            elif (lim.get("age_hours") or 0) > 6:
                flag += f"  [reading is {lim['age_hours']:.0f}h old]"
            L.append(f"  {lim['source']:<7} {win_s:>4} window  {_bar(pct)} "
                     f"{pct:5.1f}% used  ({100 - pct:.1f}% headroom)"
                     f"  plan={lim['plan_type'] or '?'}{resets}{flag}")
    else:
        L.append("  (none observed yet - run `sg usage` to harvest the logs)")
    L.append("  claude   no published %: Claude Code does not write a rate-limit")
    L.append("           readout to disk. Consumption + throttle events below.")
    L.append("")

    for label, title in (("last_1h", "LAST HOUR"), ("last_5h", "LAST 5 HOURS"),
                         ("last_24h", "LAST 24 HOURS"), ("last_7d", "LAST 7 DAYS")):
        w = rep[label]
        if not w["by_source"]:
            continue
        L.append(title)
        for r in w["by_source"]:
            L.append(f"  {r['source']:<7} {r['calls'] or 0:>6} calls  "
                     f"in {_fmt_tokens(r['inp']):>7}  out {_fmt_tokens(r['out']):>7}  "
                     f"cache-read {_fmt_tokens(r['cread']):>7}  "
                     f"throttled {r['throttled'] or 0}")
        for r in w["by_consumer"]:
            L.append(f"      - {r['consumer']:<28} {r['source']:<7} "
                     f"{r['calls'] or 0:>6} calls  out {_fmt_tokens(r['out']):>7}"
                     + (f"  THROTTLED {r['throttled']}" if r["throttled"] else ""))
        L.append("")

    L.append("ENGINE (this repo)")
    for r in rep["engine_jobs"]:
        L.append(f"  jobs {r['status']:<12} {r['n']:>4}   avg {r['avg_sec'] or 0:.0f}s")
    for r in rep["engine_calls"]:
        L.append(f"  calls {r['provider']:<7} {r['role']:<11} {r['n']:>4}  "
                 f"ok={r['ok'] or 0} throttled={r['throttled'] or 0} "
                 f"cached={r['cached'] or 0} avg {r['avg_s'] or 0:.0f}s")
    if rep["engine_throughput"]:
        L.append("  throughput/day: " + "  ".join(
            f"{r['day'][5:]}={r['applied'] or 0}/{r['jobs']}"
            for r in rep["engine_throughput"]))
    return "\n".join(L)


def record_call(ctx: Ctx, provider: str, model: str | None, role: str,
                job_id: str | None, target: str | None, result, throttled: bool) -> None:
    """One row per provider invocation. Never raises — telemetry must not be
    able to fail a research job."""
    try:
        ctx.db().execute(
            "INSERT INTO provider_calls(ts,provider,model,role,job_id,target,ok,throttled,"
            "cached,duration_s,input_tokens,output_tokens,cost_usd,error) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (now_iso(), provider, model, role, job_id, target, 1 if result.ok else 0,
             1 if throttled else 0, 1 if getattr(result, "cached", False) else 0,
             round(result.duration_s or 0, 2), result.input_tokens, result.output_tokens,
             result.cost_usd, (result.error or "")[:300] or None))
        ctx.db().commit()
    except Exception as e:  # noqa: BLE001 — telemetry is never worth a job
        ctx.log.warn("usage.record_failed", error=str(e)[:200])
