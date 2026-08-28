"""Universal importer: EPUB / HTML / TXT / MD / JSON / XML / CSV / ZIP / PDF
→ normalized documents + paragraph chunks in the index.

Copyright posture: imported document TEXT lives only in the local database
index (private study use). Vault notes for copyrighted material carry
metadata + relationships + brief excerpts, never full reproductions.
"""
from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path

from scripturegraph.context import Ctx
from scripturegraph.util import normalize_ws, now_iso, read_text, sha256_text

_BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br",
               "section", "article", "blockquote", "tr"}
_SKIP_TAGS = {"script", "style", "nav", "head", "svg"}


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP_TAGS:
            self._skip += 1
        if tag == "title":
            self._in_title = True
        if tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in _SKIP_TAGS and self._skip:
            self._skip -= 1
        if tag == "title":
            self._in_title = False
        if tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._skip:
            return
        if self._in_title and not self.title:
            self.title = data.strip()
        self.parts.append(data)


def html_to_text(html: str) -> tuple[str, str]:
    """(text, title)."""
    p = _TextExtractor()
    try:
        p.feed(html)
    except Exception:  # noqa: BLE001 — salvage whatever parsed
        pass
    text = "".join(p.parts)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip(), p.title


def epub_to_texts(path: Path) -> list[tuple[str, str]]:
    """[(member_title, text)] in archive order."""
    out = []
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist()
                 if n.lower().endswith((".xhtml", ".html", ".htm"))]
        names.sort()
        for n in names:
            try:
                html = z.read(n).decode("utf-8", errors="replace")
            except (KeyError, zipfile.BadZipFile):
                continue
            text, title = html_to_text(html)
            if len(text) > 80:
                out.append((title or Path(n).stem, text))
    return out


def extract_texts(path: Path) -> list[tuple[str, str]]:
    """Normalize any supported file into [(title, plain_text)]."""
    suffix = path.suffix.lower()
    if suffix in (".txt", ".md", ".markdown"):
        return [(path.stem, read_text(path))]
    if suffix in (".html", ".htm"):
        text, title = html_to_text(read_text(path))
        return [(title or path.stem, text)]
    if suffix == ".epub":
        return epub_to_texts(path)
    if suffix == ".json":
        data = json.loads(read_text(path))
        return [(path.stem, json.dumps(data, indent=1, ensure_ascii=False))]
    if suffix == ".xml":
        text, _ = html_to_text(read_text(path))
        return [(path.stem, text)]
    if suffix in (".csv", ".tsv"):
        delim = "\t" if suffix == ".tsv" else ","
        rows = list(csv.reader(io.StringIO(read_text(path)), delimiter=delim))
        return [(path.stem, "\n".join(" | ".join(r) for r in rows))]
    if suffix == ".zip":
        out = []
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if n.lower().endswith((".txt", ".md", ".html", ".htm", ".xhtml")):
                    raw = z.read(n).decode("utf-8", errors="replace")
                    if n.lower().endswith((".html", ".htm", ".xhtml")):
                        text, title = html_to_text(raw)
                        out.append((title or Path(n).stem, text))
                    else:
                        out.append((Path(n).stem, raw))
        return out
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as e:
            raise RuntimeError(
                "PDF import needs the optional dependency: pip install pypdf") from e
        reader = PdfReader(str(path))
        text = "\n\n".join((page.extract_text() or "") for page in reader.pages)
        return [(path.stem, text)]
    raise RuntimeError(f"unsupported file type: {path.suffix}")


def paragraphs_of(text: str, min_len: int = 60, max_len: int = 1800) -> list[str]:
    paras = []
    for block in re.split(r"\n\s*\n", text):
        block = normalize_ws(block)
        if len(block) < min_len:
            continue
        while len(block) > max_len:
            cut = block.rfind(". ", 0, max_len)
            cut = cut + 1 if cut > min_len else max_len
            paras.append(block[:cut].strip())
            block = block[cut:].strip()
        if block:
            paras.append(block)
    return paras


def store_document(ctx: Ctx, doc_id: str, source_id: str, doc_type: str, title: str,
                   text: str, *, author: str = "", date: str = "", url: str = "",
                   local_path: str = "", content_hash: str = "",
                   meta: dict | None = None) -> int:
    """Insert/refresh one document + its paragraph chunks + citation edges.
    Returns number of chunks stored."""
    from scripturegraph.indexing.citations import find_citations
    db = ctx.db()
    db.execute(
        "INSERT INTO documents(doc_id,source_id,doc_type,title,author,date,url,local_path,"
        "content_hash,meta_json) VALUES(?,?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(doc_id) DO UPDATE SET title=excluded.title, author=excluded.author, "
        "date=excluded.date, url=excluded.url, content_hash=excluded.content_hash, "
        "meta_json=excluded.meta_json",
        (doc_id, source_id, doc_type, title, author, date, url, local_path,
         content_hash, json.dumps(meta or {}, ensure_ascii=False)))
    db.execute("DELETE FROM chunks WHERE owner_type='document' AND owner_id=?", (doc_id,))
    paras = paragraphs_of(text)
    for i, p in enumerate(paras):
        db.execute(
            "INSERT INTO chunks(owner_type,owner_id,seq,text,text_hash) VALUES(?,?,?,?,?)",
            ("document", doc_id, i, p, sha256_text(p)))
    # explicit scripture citations → edges (document node → chapter node)
    node_id = f"doc:{doc_id}" if not doc_id.startswith(("talk:", "doc:")) else doc_id
    db.execute(
        "INSERT INTO nodes(id,node_type,title,meta_json,created_at,updated_at) "
        "VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, "
        "updated_at=excluded.updated_at",
        (node_id, "document" if doc_type != "talk" else "talk", title,
         json.dumps({"doc_type": doc_type, "author": author, "date": date, "url": url}),
         now_iso(), now_iso()))
    db.execute("DELETE FROM edges WHERE src=? AND rel='cites'", (node_id,))
    cited: dict[str, int] = {}
    for cit in find_citations(text):
        if cit.valid:
            exists = db.execute("SELECT 1 FROM chapters WHERE slug=?",
                                (cit.chapter_slug,)).fetchone()
            if exists:
                cited[cit.chapter_slug] = cited.get(cit.chapter_slug, 0) + 1
    for cslug, n in cited.items():
        db.execute(
            "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
            "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(src,dst,rel) DO UPDATE SET weight=excluded.weight, "
            "updated_at=excluded.updated_at",
            (node_id, f"chapter:{cslug}", "cites", "accepted", 0.99, float(n),
             "{}", "pass:doc-citations", now_iso(), now_iso()))
    db.commit()
    return len(paras)


def import_document_file(ctx: Ctx, path: Path, source_id: str, doc_type: str,
                         doc_key: str, content_hash: str) -> int:
    """Generic drop-folder import (non-conference)."""
    n_docs = 0
    for title, text in extract_texts(path):
        if len(text.strip()) < 120:
            continue
        # '#n' suffix keeps content docs distinct from the package-level row
        store_document(ctx, f"{doc_key}#{n_docs}", source_id, doc_type, title, text,
                       local_path=str(path), content_hash=content_hash)
        n_docs += 1
    ctx.log.info("import.document", file=path.name, docs=n_docs, type=doc_type)
    return n_docs
