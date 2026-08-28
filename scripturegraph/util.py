"""Small shared utilities: atomic writes, hashing, slugs, Windows-safe names."""
from __future__ import annotations

import hashlib
import json
import os
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------- time / ids

def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def new_id(prefix: str) -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------- hashing

def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 16), b""):
            h.update(block)
    return h.hexdigest()


# ---------------------------------------------------------------- fs

def ensure_dir(path: str | Path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def atomic_write_text(path: str | Path, text: str) -> None:
    """Write file atomically (tmp + os.replace). Always UTF-8, LF newlines."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + f".{os.getpid()}.tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, p)


def read_text(path: str | Path) -> str:
    with open(path, "r", encoding="utf-8-sig") as f:
        return f.read()


def json_read(path: str | Path):
    with open(path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def json_write(path: str | Path, obj, indent: int = 2) -> None:
    atomic_write_text(path, json.dumps(obj, indent=indent, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------- names

_WINDOWS_RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10)),
}
_ILLEGAL_FS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
# Obsidian additionally treats these as link-breaking inside note names.
_ILLEGAL_OBSIDIAN = re.compile(r"[#^\[\]|]")


def sanitize_filename(name: str) -> str:
    """Make a string safe as a Windows + Obsidian note filename (no extension)."""
    name = unicodedata.normalize("NFC", name)
    name = _ILLEGAL_FS.sub("", name)
    name = _ILLEGAL_OBSIDIAN.sub("", name)
    name = re.sub(r"\s+", " ", name).strip().rstrip(". ")
    if not name:
        name = "untitled"
    if name.split(".")[0].upper() in _WINDOWS_RESERVED:
        name = name + "_"
    return name[:180]


def is_legal_filename(name: str) -> bool:
    return name == sanitize_filename(name) and bool(name)


def slugify(name: str) -> str:
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower()
    name = re.sub(r"[''`]", "", name)
    name = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
    return name or "x"


# ---------------------------------------------------------------- text

_WS = re.compile(r"\s+")


def normalize_ws(text: str) -> str:
    return _WS.sub(" ", text).strip()


_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)


def norm_for_match(text: str) -> str:
    """Aggressive normalization for quote comparison / shingling."""
    text = text.lower()
    text = text.replace("’", "'").replace("‘", "'")
    text = _PUNCT.sub(" ", text)
    return _WS.sub(" ", text).strip()


def words_of(text: str) -> list[str]:
    return norm_for_match(text).split()


def truncate(text: str, n: int) -> str:
    return text if len(text) <= n else text[: n - 1] + "…"


def chunked(seq, n: int):
    buf = []
    for item in seq:
        buf.append(item)
        if len(buf) >= n:
            yield buf
            buf = []
    if buf:
        yield buf
