"""Single-instance engine lock.

Overlapping engine processes (a long nightly run + the 2-hourly frequent
task, or a manual run during either) must not interleave: queue claiming,
git checkpoints, and hard restores all assume one writer. An OS-level file
lock (auto-released on process death — no stale-lock cleanup needed) makes
every runner entry point mutually exclusive.

The lock always targets byte 0 of the lock file and never writes into the
locked region (msvcrt.locking operates at the CURRENT file position, so any
write would silently shift which byte gets locked/unlocked).
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path


class EngineBusy(Exception):
    pass


def _try_lock(f) -> bool:
    f.seek(0)
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except OSError:
        return False


def _unlock(f) -> None:
    try:
        f.seek(0)
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except OSError:
        pass


@contextmanager
def engine_lock(ctx):
    path: Path = ctx.state_dir / "engine.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    # ensure the byte we lock exists
    if not path.exists() or path.stat().st_size == 0:
        path.write_bytes(b"\0")
    f = open(path, "r+b")
    if not _try_lock(f):
        f.close()
        raise EngineBusy("another engine run holds the lock")
    try:
        yield
    finally:
        _unlock(f)
        f.close()
