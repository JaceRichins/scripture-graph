"""Markdown primitives: YAML frontmatter, managed-section markers, wikilinks.

AI-writable regions are delimited by HTML-comment markers:

    <!-- SG:BEGIN overview -->
    …content…
    <!-- SG:END overview -->

Only marker interiors are ever rewritten by the engine's Librarian layer;
everything outside markers in a librarian-managed file, and every byte of a
human-managed file, is off limits. Canonical scripture files contain no
markers at all and are regenerated only from the immutable database text.
"""
from __future__ import annotations

import re

import yaml

PLACEHOLDER = "_Not yet developed._"

_MARKER_NAME = r"[a-z0-9_\-]+"
_BEGIN = "<!-- SG:BEGIN {name} -->"
_END = "<!-- SG:END {name} -->"
_MARKER_RE = re.compile(
    r"<!-- SG:BEGIN (?P<name>" + _MARKER_NAME + r") -->\n(?P<body>.*?)\n?<!-- SG:END (?P=name) -->",
    re.DOTALL)

WIKILINK_RE = re.compile(r"\[\[([^\[\]|#]+)(#[^\[\]|]*)?(?:\|([^\[\]]*))?\]\]")


# ------------------------------------------------------------- frontmatter

def render_frontmatter(fm: dict) -> str:
    text = yaml.safe_dump(fm, sort_keys=False, allow_unicode=True, width=1000).strip()
    return f"---\n{text}\n---\n"


def parse_note(text: str) -> tuple[dict, str]:
    """Return (frontmatter dict, body). Empty dict when no frontmatter."""
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end == -1 and text.rstrip().endswith("\n---"):
            end = len(text.rstrip()) - 4
        if end != -1:
            fm_text = text[4:end]
            body = text[end + 5:]
            try:
                fm = yaml.safe_load(fm_text) or {}
                if not isinstance(fm, dict):
                    fm = {}
            except yaml.YAMLError:
                fm = {}
            return fm, body
    return {}, text


def build_note(fm: dict, body: str) -> str:
    body = body.lstrip("\n")
    return render_frontmatter(fm) + "\n" + body.rstrip() + "\n"


# ------------------------------------------------------------- markers

def marker_block(name: str, content: str = PLACEHOLDER) -> str:
    return (_BEGIN.format(name=name) + "\n" + content.rstrip() + "\n"
            + _END.format(name=name))


def list_sections(body: str) -> dict[str, str]:
    return {m.group("name"): m.group("body").strip() for m in _MARKER_RE.finditer(body)}


def get_section(body: str, name: str) -> str | None:
    for m in _MARKER_RE.finditer(body):
        if m.group("name") == name:
            return m.group("body").strip()
    return None


def set_section(body: str, name: str, content: str) -> str:
    """Replace the interior of one managed section. Raises KeyError if absent."""
    content = content.rstrip()
    if "<!-- SG:" in content:
        raise ValueError("section content may not contain SG markers")
    out, found = [], False
    last = 0
    for m in _MARKER_RE.finditer(body):
        if m.group("name") == name:
            out.append(body[last:m.start()])
            out.append(marker_block(name, content if content else PLACEHOLDER))
            last = m.end()
            found = True
    if not found:
        raise KeyError(f"managed section '{name}' not found")
    out.append(body[last:])
    return "".join(out)


def section_is_empty(content: str | None) -> bool:
    return not content or content.strip() in ("", PLACEHOLDER)


def markers_balanced(body: str) -> bool:
    begins = re.findall(r"<!-- SG:BEGIN (" + _MARKER_NAME + r") -->", body)
    ends = re.findall(r"<!-- SG:END (" + _MARKER_NAME + r") -->", body)
    return begins == ends and len(begins) == len(set(begins))


# ------------------------------------------------------------- links

def wikilink(target: str, display: str | None = None, anchor: str = "") -> str:
    if display and display != target:
        return f"[[{target}{anchor}|{display}]]"
    return f"[[{target}{anchor}]]"


def verse_link(chapter_title: str, verse_slug: str, display: str | None = None) -> str:
    return wikilink(chapter_title, display or None, anchor=f"#^{verse_slug}")


def extract_wikilinks(text: str) -> list[tuple[str, str]]:
    """Return [(target, anchor)] for every wikilink in text."""
    return [(m.group(1).strip(), (m.group(2) or "").strip())
            for m in WIKILINK_RE.finditer(text)]
