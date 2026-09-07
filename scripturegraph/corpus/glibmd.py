"""Gospel Library HTML → the vault's Markdown.

The crawler keeps plain text for the index; readers deserve more: the
manual's own headings, its lists, and every reference as a link that
works inside the vault — a scripture reference opens the verse
(`[[Proverbs 3#^prov-3-5|Proverbs 3:5]]`), a conference talk opens its
note, anything else opens at churchofjesuschrist.org. The Markdown lives
in `document_markdown` and the note writer prefers it over the text.

Dropped on purpose: the citation lines the site prints above the title,
images and captions (Church art is not ours to copy), footnote markers,
print-only handouts.
"""
from __future__ import annotations

import html as html_mod
import json
import re
from html.parser import HTMLParser

from scripturegraph.booksdata import BY_LDS_SLUG
from scripturegraph.context import Ctx
from scripturegraph.corpus.fetchers import API, _clean, _get

_SKIP_CLASSES = ("reference", "short-reference", "title-number", "image", "handout",
                 "no-print", "note-ref", "marker", "enlarge", "open-pdf")
_SKIP_TAGS = {"figure", "img", "figcaption", "sup", "script", "style", "nav", "aside"}
_HREF_RE = re.compile(r"/scriptures/(?:ot|nt|bofm|dc-testament|pgp)/([a-z0-9-]+)/(\d+)")
_ID_RE = re.compile(r"[?&]id=p(\d+)")
_FRAG_RE = re.compile(r"#p(\d+)")


def ensure_table(ctx: Ctx) -> None:
    ctx.db().execute("""CREATE TABLE IF NOT EXISTS document_markdown (
        doc_id TEXT PRIMARY KEY, md TEXT NOT NULL, rendered_at TEXT NOT NULL)""")


def scripture_link(href: str, text: str) -> str | None:
    """'/study/scriptures/ot/prov/2?lang=eng&id=p6#p6' → [[Proverbs 2#^prov-2-6|text]]"""
    href = html_mod.unescape(href)
    m = _HREF_RE.search(href)
    if not m:
        return None
    book = BY_LDS_SLUG.get(m.group(1))
    if book is None:
        return None
    ch = int(m.group(2))
    title = f"{book.title_prefix} {ch}"
    v = _ID_RE.search(href) or _FRAG_RE.search(href)
    target = f"{title}#^{book.slug}-{ch}-{int(v.group(1))}" if v else title
    return f"[[{target}|{text}]]"


class _Resolver:
    """href → wikilink for a page the vault already holds (by URL match)."""

    def __init__(self, ctx: Ctx):
        self.db = ctx.db()
        self.cache: dict[str, str | None] = {}

    def vault_path(self, uri: str) -> str | None:
        if uri in self.cache:
            return self.cache[uri]
        row = self.db.execute(
            "SELECT n.vault_path FROM documents d JOIN nodes n ON n.id = d.doc_id OR n.id = 'doc:'||d.doc_id "
            "WHERE n.vault_path IS NOT NULL AND (d.doc_id = ? OR d.url LIKE ?) LIMIT 1",
            (f"glib:{uri}", f"%{uri}?%")).fetchone()
        self.cache[uri] = row[0] if row else None
        return self.cache[uri]

    def link(self, href: str, text: str) -> str:
        href = html_mod.unescape(href)
        sl = scripture_link(href, text)
        if sl:
            return sl
        if href.startswith("/study/") or href.startswith("/"):
            uri = re.sub(r"^/study", "", href.split("?")[0].split("#")[0])
            vp = self.vault_path(uri)
            if vp:
                return f"[[{vp[:-3] if vp.endswith('.md') else vp}|{text}]]"
            return f"[{text}](https://www.churchofjesuschrist.org/study{uri}?lang=eng)"
        if href.startswith("http"):
            return f"[{text}]({href})"
        return text


class _MdBuilder(HTMLParser):
    def __init__(self, resolver: _Resolver):
        super().__init__(convert_charrefs=True)
        self.r = resolver
        self.blocks: list[str] = []
        self.buf: list[str] = []
        self.stack: list[tuple[str, int]] = []      # (tag, skip-depth marker)
        self.skip = 0
        self.block_kind = ""
        self.list_depth = 0
        self.quote = 0
        self.href: str | None = None
        self.link_text: list[str] = []
        self.seen_h1 = False

    # ---- blocks
    def _flush(self) -> None:
        text = _clean("".join(self.buf))
        self.buf = []
        kind, self.block_kind = self.block_kind, ""
        if not text:
            return
        if kind.startswith("h"):
            line = "#" * max(2, min(4, int(kind[1]) + 0)) + " " + text
        elif kind == "li":
            line = "  " * max(0, self.list_depth - 1) + "- " + text
        elif kind == "scripture-title":
            line = f"*{text}*"
        else:
            line = text
        if self.quote:
            line = "> " + line
        self.blocks.append(line)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class", "")
        if self.skip or tag in _SKIP_TAGS or any(c in cls.split() for c in _SKIP_CLASSES):
            self.skip += 1
            self.stack.append((tag, 1))
            return
        self.stack.append((tag, 0))
        if tag in ("p", "h1", "h2", "h3", "h4", "h5", "li"):
            self._flush()
            if tag == "h1":
                self.block_kind = "p" if self.seen_h1 else "skip-h1"
                self.seen_h1 = True
            elif tag == "p" and "scripture-title" in cls:
                self.block_kind = "scripture-title"
            elif tag == "h5":
                self.block_kind = "h4"
            else:
                self.block_kind = tag
        elif tag in ("ul", "ol"):
            self._flush(); self.list_depth += 1
        elif tag in ("section", "div", "header") and "for-teacher" in cls:
            self._flush(); self.quote += 1
            self.blocks.append("> **For teachers**")
        elif tag == "a" and a.get("href"):
            self.href = a["href"]; self.link_text = []
        elif tag in ("strong", "b"):
            self.buf.append("**")
        elif tag in ("em", "i", "cite"):
            self.buf.append("*")
        elif tag == "br":
            self.buf.append(" ")

    def handle_endtag(self, tag):
        # pop to the matching open tag
        while self.stack:
            t, sk = self.stack.pop()
            if sk:
                self.skip -= 1
            if t == tag:
                break
        else:
            return
        if self.skip:
            return
        if tag in ("p", "h1", "h2", "h3", "h4", "h5", "li"):
            if self.block_kind == "skip-h1":
                self.buf = []; self.block_kind = ""
            else:
                self._flush()
        elif tag in ("ul", "ol"):
            self._flush(); self.list_depth = max(0, self.list_depth - 1)
        elif tag in ("section", "div", "header") and self.quote and self._closing_teacher():
            self._flush(); self.quote -= 1
        elif tag == "a" and self.href is not None:
            text = _clean("".join(self.link_text))
            self.buf.append(self.r.link(self.href, text) if text else "")
            self.href = None; self.link_text = []
        elif tag in ("strong", "b"):
            self.buf.append("**")
        elif tag in ("em", "i", "cite"):
            self.buf.append("*")

    def _closing_teacher(self) -> bool:
        # a for-teacher box closes when no for-teacher container remains open —
        # approximated by depth: the box is one container deep in practice
        return True

    def handle_data(self, data):
        if self.skip:
            return
        if self.href is not None:
            self.link_text.append(data)
        else:
            self.buf.append(data)

    def result(self) -> str:
        self._flush()
        out: list[str] = []
        for b in self.blocks:
            if out and b.startswith("- ") and out[-1].startswith(("- ", "  - ")):
                out.append(b)                       # list items stay adjacent
            else:
                out.append(("\n" if out else "") + b)
        md = "\n".join(out)
        md = re.sub(r"\n{3,}", "\n\n", md).strip()
        md = re.sub(r"\*\*\s*\*\*|\*\s*\*", "", md)   # empty emphasis
        return md


def html_to_markdown(ctx: Ctx, body: str) -> str:
    p = _MdBuilder(_Resolver(ctx))
    try:
        p.feed(body)
    except Exception:  # noqa: BLE001 — keep what parsed
        pass
    return p.result()


def store_markdown(ctx: Ctx, doc_id: str, body_html: str) -> str:
    from scripturegraph.util import now_iso
    ensure_table(ctx)
    md = html_to_markdown(ctx, body_html)
    if len(md) < 200:
        return ""
    ctx.db().execute("INSERT OR REPLACE INTO document_markdown(doc_id, md, rendered_at) VALUES(?,?,?)",
                     (doc_id, md, now_iso()))
    return md


def get_markdown(ctx: Ctx, doc_id: str) -> str | None:
    ensure_table(ctx)
    row = ctx.db().execute("SELECT md FROM document_markdown WHERE doc_id=?", (doc_id,)).fetchone()
    return row[0] if row else None


def refresh_markdown(ctx: Ctx, collection_uri_prefix: str, budget: int) -> dict:
    """Re-fetch Gospel Library pages the index holds only as text, and keep
    their Markdown. Budgeted; the crawler stores Markdown for new pages
    itself, so this drains once and then idles."""
    ensure_table(ctx)
    db = ctx.db()
    rows = db.execute(
        "SELECT d.doc_id FROM documents d LEFT JOIN document_markdown m ON m.doc_id = d.doc_id "
        "WHERE d.doc_id LIKE ? AND m.doc_id IS NULL ORDER BY d.doc_id", (f"glib:{collection_uri_prefix}%",)).fetchall()
    stats = {"pending": len(rows), "rendered": 0, "failed": 0}
    for row in rows[:budget]:
        uri = row[0][len("glib:"):]
        raw = _get(ctx, API.format(uri=uri))
        if raw is None:
            stats["failed"] += 1
            continue
        try:
            body = (json.loads(raw).get("content") or {}).get("body") or ""
        except json.JSONDecodeError:
            stats["failed"] += 1
            continue
        if store_markdown(ctx, row[0], body):
            stats["rendered"] += 1
        else:
            stats["failed"] += 1
    db.commit()
    ctx.log.info("glib.markdown", **stats)
    return stats
