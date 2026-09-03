"""The ONLY code path that writes AI/engine content into the production vault.

Enforced boundaries (violations raise PatchViolation and quarantine the job):
- Canonical scripture (01 Scriptures/Canonical/**, kind 'scripture') is
  rejected outright — the persistence layer will not carry an AI patch there.
- Personal files (80 Personal Notes/**, managed_by 'human', ownership
  personal) are rejected outright.
- Existing system files may only have marker interiors replaced
  (set_section) or whitelisted frontmatter fields set.
- New notes may only be created in allowed folders for known kinds, and
  never overwrite an existing file.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

from scripturegraph.context import Ctx
from scripturegraph.util import is_legal_filename, now_iso, read_text, sanitize_filename, slugify
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import (FOLDER_AI_GUIDES, FOLDER_DOCTRINES, FOLDER_EVENTS,
                                              FOLDER_EVIDENCE, FOLDER_HISTORY, FOLDER_PEOPLE,
                                              FOLDER_PLACES, FOLDER_QUESTIONS,
                                              FOLDER_SCHOLARSHIP, FOLDER_TOPICS,
                                              is_canonical_path, is_personal_path, record_file,
                                              refresh_registry_hash)

FM_WHITELIST = {"corpus_version_reviewed", "topic-status", "status", "review-status",
                # evidence calibration (agents/calibrate.py): the weight and what it is FOR
                "note_kind", "evidence_strength", "claim_confidence", "weight_label",
                "direction",
                "issue", "proposition", "calibrated_at", "calibration_version"}

# kind -> (folder, sections template name)
CREATABLE_KINDS: dict[str, str] = {
    "topic": FOLDER_TOPICS,
    "person": FOLDER_PEOPLE,
    "place": FOLDER_PLACES,
    "event": FOLDER_EVENTS,
    "doctrine": FOLDER_DOCTRINES,
    "evidence": FOLDER_EVIDENCE,       # + required subfolder from op
    "question": FOLDER_QUESTIONS,
    "scholarship": FOLDER_SCHOLARSHIP,
    "history": FOLDER_HISTORY,
    "ai-guide": FOLDER_AI_GUIDES,
}

MAX_SECTION_BYTES = 24_000
MAX_NOTE_BYTES = 80_000


class PatchViolation(Exception):
    pass


@dataclass
class PatchResult:
    changed_paths: list[str]
    created_paths: list[str]
    violations: list[str]


def _normalize_target(ctx: Ctx, relpath: str) -> str:
    """Canonicalize an op's target path and refuse anything that could reach
    outside the vault or dodge the ownership prefixes (absolute paths, '..',
    case variants on Windows's case-insensitive filesystem, non-.md)."""
    from pathlib import Path, PurePosixPath
    rel = str(relpath).replace("\\", "/").strip()
    if not rel or rel.startswith("/") or Path(rel).is_absolute() or ":" in rel.split("/")[0]:
        raise PatchViolation(f"illegal target path (absolute): {relpath!r}")
    parts = PurePosixPath(rel).parts
    if any(p in ("..", ".") for p in parts):
        raise PatchViolation(f"illegal target path (traversal): {relpath!r}")
    if not rel.endswith(".md"):
        raise PatchViolation(f"illegal target path (not .md): {relpath!r}")
    resolved = (ctx.vault / rel).resolve()
    vault_resolved = ctx.vault.resolve()
    if not resolved.is_relative_to(vault_resolved):
        raise PatchViolation(f"illegal target path (escapes vault): {relpath!r}")
    if resolved.exists() and resolved.is_symlink():
        raise PatchViolation(f"illegal target path (symlink): {relpath!r}")
    return rel


def _guard_target(ctx: Ctx, relpath: str) -> str:
    from scripturegraph.vaultgen.generate import FOLDER_CANONICAL, FOLDER_PERSONAL
    rel = _normalize_target(ctx, relpath)
    low = rel.lower()
    if low.startswith(FOLDER_CANONICAL.lower() + "/"):
        raise PatchViolation(f"IMMUTABLE: refusing to touch canonical scripture: {rel}")
    if low.startswith(FOLDER_PERSONAL.lower() + "/"):
        raise PatchViolation(f"PERSONAL: refusing to touch user-owned file: {rel}")
    row = ctx.db().execute(
        "SELECT kind, managed_by FROM file_registry WHERE lower(path)=?", (low,)).fetchone()
    if row is not None:
        if row["kind"] == "scripture":
            raise PatchViolation(f"IMMUTABLE: {rel} is canonical scripture")
        if row["managed_by"] == "human":
            raise PatchViolation(f"PERSONAL: {rel} is human-managed")
    return rel


def _load(ctx: Ctx, relpath: str) -> tuple[dict, str]:
    p = ctx.vault / relpath
    if not p.exists():
        raise PatchViolation(f"target does not exist: {relpath}")
    return md.parse_note(read_text(p))


def _store(ctx: Ctx, relpath: str, fm: dict, body: str) -> None:
    text = md.build_note(fm, body)
    if len(text.encode()) > MAX_NOTE_BYTES:
        raise PatchViolation(f"note too large after patch: {relpath}")
    from scripturegraph.util import atomic_write_text
    atomic_write_text(ctx.vault / relpath, text)
    refresh_registry_hash(ctx, relpath)


def apply_ops(ctx: Ctx, ops: list[dict], actor: str) -> PatchResult:
    """Apply a list of patch operations. Raises PatchViolation on any breach
    (caller wraps in a git transaction, so partial applies roll back)."""
    changed: list[str] = []
    created: list[str] = []
    for op in ops:
        kind = op.get("op")
        if kind == "set_section":
            relpath = _guard_target(ctx, op["path"])
            content = str(op.get("content", ""))
            if len(content.encode()) > MAX_SECTION_BYTES:
                raise PatchViolation(f"section content too large ({relpath})")
            fm, body = _load(ctx, relpath)
            try:
                body = md.set_section(body, op["section"], content)
            except (KeyError, ValueError) as e:
                raise PatchViolation(str(e)) from e
            _store(ctx, relpath, fm, body)
            changed.append(relpath)
        elif kind == "ensure_section":
            # like set_section, but a section the note never had is appended
            # under its heading — how an evidence note gains its nine layers
            relpath = _guard_target(ctx, op["path"])
            content = str(op.get("content", ""))
            if len(content.encode()) > MAX_SECTION_BYTES:
                raise PatchViolation(f"section content too large ({relpath})")
            fm, body = _load(ctx, relpath)
            heading = str(op.get("heading") or op["section"].replace("-", " ").title())
            try:
                body = md.ensure_section(body, op["section"], heading, content)
            except ValueError as e:
                raise PatchViolation(str(e)) from e
            _store(ctx, relpath, fm, body)
            changed.append(relpath)
        elif kind == "set_fm_field":
            relpath = _guard_target(ctx, op["path"])
            field = op["field"]
            if field not in FM_WHITELIST:
                raise PatchViolation(f"frontmatter field not whitelisted: {field}")
            fm, body = _load(ctx, relpath)
            if op.get("value") is None:
                fm.pop(field, None)          # null = remove the field
            else:
                fm[field] = op.get("value")
            _store(ctx, relpath, fm, body)
            changed.append(relpath)
        elif kind == "remove_section":
            relpath = _guard_target(ctx, op["path"])
            fm, body = _load(ctx, relpath)
            body = md.remove_section(body, op["section"])
            _store(ctx, relpath, fm, body)
            changed.append(relpath)
        elif kind == "add_alias":
            relpath = _guard_target(ctx, op["path"])
            alias = str(op["alias"]).strip()
            if not alias or not is_legal_filename(sanitize_filename(alias)):
                raise PatchViolation(f"illegal alias: {alias!r}")
            fm, body = _load(ctx, relpath)
            aliases = list(fm.get("aliases") or [])
            if alias not in aliases:
                aliases.append(alias)
                fm["aliases"] = aliases
                _store(ctx, relpath, fm, body)
                changed.append(relpath)
            row = ctx.db().execute("SELECT node_id FROM file_registry WHERE path=?",
                                   (relpath,)).fetchone()
            if row and row["node_id"]:
                ctx.db().execute("INSERT OR IGNORE INTO aliases(alias,node_id) VALUES(?,?)",
                                 (alias, row["node_id"]))
        elif kind == "create_note":
            relpath, node_id = _create_note(ctx, op, actor)
            created.append(relpath)
        else:
            raise PatchViolation(f"unknown patch op: {kind!r}")
    ctx.db().commit()
    return PatchResult(changed, created, [])


def _create_note(ctx: Ctx, op: dict, actor: str) -> tuple[str, str]:
    note_kind = op.get("kind")
    if note_kind not in CREATABLE_KINDS:
        raise PatchViolation(f"cannot create notes of kind {note_kind!r}")
    title = sanitize_filename(str(op.get("title", "")).strip())
    if not title or len(title) < 3:
        raise PatchViolation(f"illegal note title: {op.get('title')!r}")
    folder = CREATABLE_KINDS[note_kind]
    sub = op.get("subfolder", "")
    if sub:
        sub = "/".join(sanitize_filename(part) for part in str(sub).split("/") if part)
        folder = f"{folder}/{sub}"
    from scripturegraph.vaultgen.generate import (FOLDER_CANONICAL, FOLDER_PERSONAL,
                                                  FOLDER_SYSTEM)
    relpath = _normalize_target(ctx, f"{folder}/{title}.md")
    low = relpath.lower()
    if low.startswith((FOLDER_CANONICAL.lower() + "/", FOLDER_PERSONAL.lower() + "/",
                       FOLDER_SYSTEM.lower() + "/")):
        raise PatchViolation(f"create_note outside allowed area: {relpath}")
    if (ctx.vault / relpath).exists():
        raise PatchViolation(f"note already exists (reuse it instead): {relpath}")
    # duplicate-title guard across the graph
    dup = ctx.db().execute(
        "SELECT id FROM nodes WHERE title=? UNION "
        "SELECT node_id FROM aliases WHERE alias=?", (title, title)).fetchone()
    if dup:
        raise PatchViolation(f"title/alias already in use by {dup[0]}: {title!r}")

    sections = op.get("sections") or {}
    node_id = f"{note_kind}:{slugify(title)}"
    # sg-id: stable anchor for plugin annotations — survives file renames (§39)
    fm = {"ownership": "system", "mutable": "ai", "content_type": note_kind,
          "sg-id": node_id, "created_by": actor, "created_at": now_iso()}
    if op.get("aliases"):
        fm["aliases"] = [str(a) for a in op["aliases"]][:8]
    if op.get("frontmatter"):
        for k, v in dict(op["frontmatter"]).items():
            if k in FM_WHITELIST or k.startswith("sg-") or k in (
                    "claim_confidence", "evidence_strength", "study_relevance",
                    "source_quality", "consensus_status", "evidence_class", "cssclasses"):
                fm[k] = v
    lines = [f"# {title}", ""]
    for name, content in sections.items():
        name = slugify(str(name))
        content = str(content)
        if len(content.encode()) > MAX_SECTION_BYTES:
            raise PatchViolation(f"section too large in new note {title!r}")
        if "<!-- SG:" in content:
            raise PatchViolation("nested markers in new note content")
        heading = name.replace("-", " ").title()
        lines.append(f"## {heading}")
        lines.append(md.marker_block(name, content or md.PLACEHOLDER))
        lines.append("")
    record_file(ctx, relpath, note_kind, "librarian", node_id,
                md.build_note(fm, "\n".join(lines)))
    ctx.db().execute(
        "INSERT INTO nodes(id,node_type,title,vault_path,meta_json,created_at,updated_at) "
        "VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET vault_path=excluded.vault_path, "
        "updated_at=excluded.updated_at",
        (node_id, note_kind, title, relpath, json.dumps({"created_by": actor}),
         now_iso(), now_iso()))
    for a in fm.get("aliases", []):
        ctx.db().execute("INSERT OR IGNORE INTO aliases(alias,node_id) VALUES(?,?)", (a, node_id))
    return relpath, node_id
