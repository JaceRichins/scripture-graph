"""Deterministic validation: software checks mechanical truth.

- YAML frontmatter parses; managed markers balanced
- wikilinks resolve (titles, aliases, verse block anchors)
- canonical scripture integrity: hash drift detection + safe auto-restore
- quotations match source text (fuzzy, normalized)
- filenames legal on Windows; duplicate titles
- AI outputs conform to JSON schemas (see agents/schemas.py)
"""
from __future__ import annotations

import difflib
import json
from dataclasses import dataclass, field
from pathlib import Path

from scripturegraph.context import Ctx
from scripturegraph.util import is_legal_filename, norm_for_match, now_iso, read_text, sha256_text
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_CANONICAL, FOLDER_PERSONAL


@dataclass
class Issue:
    severity: str   # fatal | error | warn
    check: str
    path: str
    detail: str


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)
    stats: dict = field(default_factory=dict)

    def add(self, severity: str, check: str, path: str, detail: str):
        self.issues.append(Issue(severity, check, path, detail))

    @property
    def fatal(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "fatal"]

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.severity in ("fatal", "error")]

    def summary(self) -> dict:
        out = {"fatal": 0, "error": 0, "warn": 0}
        for i in self.issues:
            out[i.severity] = out.get(i.severity, 0) + 1
        return {**out, **self.stats}


# ------------------------------------------------------------- link index

def build_link_index(ctx: Ctx) -> dict:
    """Resolution index: note titles (file stems), aliases, verse block ids."""
    db = ctx.db()
    titles: set[str] = set()
    lower: set[str] = set()
    for p in ctx.vault.rglob("*.md"):
        if ".obsidian" in p.parts or ".scripture-engine" in p.parts:
            continue
        titles.add(p.stem)
        lower.add(p.stem.lower())
    for r in db.execute("SELECT alias FROM aliases"):
        titles.add(r["alias"])
        lower.add(r["alias"].lower())
    blocks = {r["slug"] for r in db.execute("SELECT slug FROM verses")}
    return {"titles": titles, "lower": lower, "blocks": blocks}


def _iter_md(ctx: Ctx, paths: list[str] | None):
    if paths is not None:
        for rel in paths:
            p = ctx.vault / rel
            if p.exists() and p.suffix == ".md":
                yield rel.replace("\\", "/"), p
        return
    for p in ctx.vault.rglob("*.md"):
        if ".obsidian" in p.parts or ".scripture-engine" in p.parts:
            continue
        yield str(p.relative_to(ctx.vault)).replace("\\", "/"), p


# ------------------------------------------------------------- checks

def check_files(ctx: Ctx, report: Report, paths: list[str] | None = None,
                link_index: dict | None = None) -> None:
    """Frontmatter, markers, links, filenames for the given files (or all)."""
    idx = link_index or build_link_index(ctx)
    n = 0
    for rel, p in _iter_md(ctx, paths):
        n += 1
        if not is_legal_filename(p.stem):
            report.add("error", "filename", rel, "illegal or unsafe filename")
        try:
            text = read_text(p)
        except OSError as e:
            report.add("error", "read", rel, str(e))
            continue
        fm, body = md.parse_note(text)
        if text.startswith("---\n") and not fm:
            report.add("error", "frontmatter", rel, "frontmatter present but unparseable")
        if not md.markers_balanced(body):
            report.add("fatal", "markers", rel, "unbalanced or duplicated SG markers")
        for target, anchor in md.extract_wikilinks(body):
            if target not in idx["titles"] and target.lower() not in idx["lower"]:
                report.add("warn", "link", rel, f"unresolved link [[{target}]]")
            if anchor.startswith("#^"):
                block = anchor[2:]
                if "-" in block and block not in idx["blocks"]:
                    report.add("error", "block-link", rel, f"missing block anchor {anchor}")
    report.stats["files_checked"] = n


def check_canonical(ctx: Ctx, report: Report, repair: bool = False) -> None:
    """Detect (and optionally repair) canonical scripture drift."""
    db = ctx.db()
    rows = db.execute(
        "SELECT path, content_hash FROM file_registry WHERE kind='scripture'").fetchall()
    drifted, missing = [], []
    for r in rows:
        p = ctx.vault / r["path"]
        if not p.exists():
            missing.append(r["path"])
            report.add("fatal", "canonical-missing", r["path"], "canonical file missing")
            continue
        h = sha256_text(read_text(p))
        if h != r["content_hash"]:
            drifted.append(r["path"])
            report.add("fatal", "canonical-drift", r["path"],
                       "canonical scripture content changed on disk")
    # unexpected files inside the canonical tree
    can_root = ctx.vault / FOLDER_CANONICAL
    if can_root.exists():
        known = {r["path"] for r in rows}
        for p in can_root.rglob("*.md"):
            rel = str(p.relative_to(ctx.vault)).replace("\\", "/")
            if rel not in known:
                report.add("error", "canonical-foreign", rel,
                           "unexpected file inside Canonical tree")
    report.stats["canonical_checked"] = len(rows)
    if (drifted or missing) and repair:
        restored = restore_canonical(ctx)
        report.stats["canonical_restored"] = restored


def restore_canonical(ctx: Ctx) -> int:
    """Regenerate canonical files from the verified database text.

    Safe because the DB text is itself hash-verified against the imported
    source corpus; every restoration is logged as an integrity event.
    """
    from scripturegraph.vaultgen.generate import generate_scriptures
    ctx.log.warn("canonical.integrity_violation", action="restoring from verified source")
    # clear registry hashes for scripture so generate_scriptures rewrites all
    ctx.db().execute("UPDATE file_registry SET content_hash='' WHERE kind='scripture'")
    ctx.db().commit()
    stats = generate_scriptures(ctx)
    ctx.log.warn("canonical.restored", files=stats["scripture_written"])
    return stats["scripture_written"]


def check_duplicate_titles(ctx: Ctx, report: Report) -> None:
    seen: dict[str, str] = {}
    for p in ctx.vault.rglob("*.md"):
        if ".obsidian" in p.parts or ".scripture-engine" in p.parts:
            continue
        key = p.stem.lower()
        rel = str(p.relative_to(ctx.vault))
        if key in seen:
            report.add("warn", "duplicate-title", rel, f"same note name as {seen[key]}")
        else:
            seen[key] = rel


def quote_matches(quote: str, source_text: str, threshold: float = 0.86) -> bool:
    """Does `quote` actually appear in `source_text` (normalized, fuzzy)?"""
    q = norm_for_match(quote)
    s = norm_for_match(source_text)
    if not q:
        return False
    if q in s:
        return True
    if len(q) > len(s):
        return difflib.SequenceMatcher(None, q, s).ratio() >= threshold
    m = difflib.SequenceMatcher(None, q, s).find_longest_match(0, len(q), 0, len(s))
    return m.size / max(len(q), 1) >= threshold


# ------------------------------------------------------------- entry points

def validate_changed(ctx: Ctx, paths: list[str]) -> Report:
    """Fast validation for a transaction: changed files + canonical guard."""
    report = Report()
    check_files(ctx, report, paths=paths)
    check_canonical(ctx, report, repair=False)
    return report


def validate_all(ctx: Ctx, repair: bool = False) -> Report:
    report = Report()
    check_files(ctx, report, paths=None)
    check_canonical(ctx, report, repair=repair)
    check_duplicate_titles(ctx, report)
    ctx.log.info("validate.done", **report.summary())
    return report
