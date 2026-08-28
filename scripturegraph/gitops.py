"""Git as the transaction + rollback system.

Pattern for every automated production change:

    checkpoint(ctx, label)      # commits ANY pending drift (incl. user edits)
    …apply writes…
    report = validate_changed(…)
    if report.fatal: hard_restore(ctx)   # back to checkpoint, exactly
    else:            commit_all(ctx, msg)

The checkpoint commit protects user work: uncommitted personal edits are
committed BEFORE the engine writes, so a rollback can never eat them.
Routine changes never wait for human approval — git is the safety net.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from scripturegraph import VAULT_DIRNAME
from scripturegraph.context import Ctx

_CREATE_NO_WINDOW = 0x08000000  # keep scheduled runs silent


def _git(ctx: Ctx, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    cp = subprocess.run(["git", *args], cwd=str(ctx.root), capture_output=True,
                        text=True, encoding="utf-8", errors="replace",
                        creationflags=_CREATE_NO_WINDOW, timeout=300)
    if check and cp.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {cp.stderr.strip()[:400]}")
    return cp


def ensure_repo(ctx: Ctx) -> None:
    if not (ctx.root / ".git").exists():
        _git(ctx, "init")
    who = _git(ctx, "config", "user.name", check=False)
    if not who.stdout.strip():
        _git(ctx, "config", "user.name", "Scripture Graph Engine")
        _git(ctx, "config", "user.email", "engine@scripturegraph.local")


def current_rev(ctx: Ctx) -> str | None:
    cp = _git(ctx, "rev-parse", "--short", "HEAD", check=False)
    return cp.stdout.strip() or None


def is_dirty(ctx: Ctx) -> bool:
    cp = _git(ctx, "status", "--porcelain")
    return bool(cp.stdout.strip())


def commit_all(ctx: Ctx, message: str) -> str | None:
    """Stage everything and commit. Returns new rev, or None if nothing changed."""
    if not ctx.c("git.auto_commit", True):
        return None
    ensure_repo(ctx)
    _git(ctx, "add", "-A")
    staged = _git(ctx, "diff", "--cached", "--name-only")
    if not staged.stdout.strip():
        return None
    _git(ctx, "commit", "-m", message, "-m",
         "Automated commit by the Scripture Graph engine.")
    rev = current_rev(ctx)
    ctx.log.info("git.commit", rev=rev, message=message)
    return rev


def checkpoint(ctx: Ctx, label: str) -> str | None:
    """Commit any pending drift (including user's own edits) before engine writes."""
    return commit_all(ctx, f"checkpoint: {label}")


def hard_restore(ctx: Ctx) -> None:
    """Restore the vault subtree to HEAD exactly (tracked + remove untracked).

    Only the vault is touched; ignored files (database, logs, jobs) survive.
    Always preceded by checkpoint(), so user edits are already committed.
    """
    ensure_repo(ctx)
    vault_rel = VAULT_DIRNAME
    _git(ctx, "checkout", "--", vault_rel, check=False)
    _git(ctx, "clean", "-fd", "--", vault_rel, check=False)
    ctx.log.warn("git.hard_restore", scope=vault_rel)
