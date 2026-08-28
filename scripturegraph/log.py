"""Structured JSONL logging with simple retention, plus console mirroring."""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


class Logger:
    def __init__(self, logs_dir: str | Path, retention_days: int = 21, echo: bool = True):
        self.dir = Path(logs_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.retention_days = retention_days
        self.echo = echo and sys.stderr is not None
        self._fh = None
        self._fh_day = None
        self._prune()

    def _handle(self):
        day = datetime.now(timezone.utc).strftime("%Y%m%d")
        if self._fh is None or self._fh_day != day:
            if self._fh:
                self._fh.close()
            self._fh = open(self.dir / f"engine-{day}.jsonl", "a", encoding="utf-8")
            self._fh_day = day
        return self._fh

    def _prune(self):
        cutoff = time.time() - self.retention_days * 86400
        try:
            for f in self.dir.glob("engine-*.jsonl"):
                if f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
        except OSError:
            pass

    def _write(self, level: str, event: str, fields: dict):
        rec = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "level": level, "event": event, "pid": os.getpid(), **fields}
        try:
            fh = self._handle()
            fh.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
            fh.flush()
        except OSError:
            pass
        if self.echo and level != "debug":
            extras = " ".join(f"{k}={v}" for k, v in fields.items()
                              if k not in ("traceback",) and len(str(v)) <= 120)
            print(f"[{level}] {event} {extras}".rstrip(), file=sys.stderr)

    def debug(self, event: str, **fields):
        self._write("debug", event, fields)

    def info(self, event: str, **fields):
        self._write("info", event, fields)

    def warn(self, event: str, **fields):
        self._write("warn", event, fields)

    def error(self, event: str, **fields):
        self._write("error", event, fields)
