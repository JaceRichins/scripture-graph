"""Seeded entities (people, places, gospel topics): nodes, stub notes, and the
deterministic mention/keyword scanning waves.

Seeds live in package assets (assets/seeds/*.json) and were curated for
collision-free canonical names (e.g. "Jacob (son of Lehi)" vs the book
"Jacob"). Aliases may be ambiguous ("Alma" → two people); ambiguous mentions
become TENTATIVE edges unless a book-scope hint resolves them, and later AI
passes may refine them. This is documented heuristic behavior, not certainty.
"""
from __future__ import annotations

import importlib.resources as res
import json
import re
from functools import lru_cache

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso, slugify
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import (FOLDER_PEOPLE, FOLDER_PLACES, FOLDER_TOPICS,
                                              record_file)

PERSON_SECTIONS = [("overview", "Overview"), ("scripture-profile", "In Scripture"),
                   ("mentions", "Mentioned In"), ("conference", "Teachings & Conference"),
                   ("related", "Related")]
PLACE_SECTIONS = [("overview", "Overview"), ("scripture-profile", "In Scripture"),
                  ("mentions", "Mentioned In"), ("geography", "Geography & Identification"),
                  ("related", "Related")]
TOPIC_SECTIONS = [("definition", "Definition"), ("doctrinal-summary", "Doctrinal Summary"),
                  ("scriptural-foundation", "Scriptural Foundation"),
                  ("conference", "General Conference"), ("history", "Historical Development"),
                  ("evidence", "Evidence & Study Notes"), ("questions", "Significant Questions"),
                  ("objections", "Objections & Alternative Views"),
                  ("scholarship", "Scholarship"), ("related", "Related"),
                  ("study-pathways", "Study Pathways"), ("synthesis", "Synthesis")]


def load_seed(name: str) -> list[dict]:
    data = res.files("scripturegraph").joinpath(f"assets/seeds/{name}.json").read_text(encoding="utf-8")
    return json.loads(data)


def _entity_note(kind: str, title: str, aliases: list[str], sections, extra_fm=None) -> str:
    fm = {"ownership": "system", "mutable": "ai", "content_type": kind,
          "cssclasses": [f"sg-{kind}"]}
    if aliases:
        fm["aliases"] = aliases
    fm.update(extra_fm or {})
    lines = [f"# {title}", ""]
    for name, heading in sections:
        lines.append(f"## {heading}")
        lines.append(md.marker_block(name))
        lines.append("")
    return md.build_note(fm, "\n".join(lines))


def ensure_entities(ctx: Ctx) -> dict:
    """Create nodes, aliases, and stub notes for all seeded entities."""
    db = ctx.db()
    stats = {"people": 0, "places": 0, "topics": 0}
    specs = [
        ("person", "people", FOLDER_PEOPLE, PERSON_SECTIONS),
        ("place", "places", FOLDER_PLACES, PLACE_SECTIONS),
        ("topic", "topics", FOLDER_TOPICS, TOPIC_SECTIONS),
    ]
    for kind, seed_name, folder, sections in specs:
        for ent in load_seed(seed_name):
            title = ent["name"]
            node_id = f"{kind}:{slugify(title)}"
            relpath = f"{folder}/{title}.md"
            aliases = ent.get("aliases", [])
            meta = {k: v for k, v in ent.items() if k not in ("name", "aliases")}
            db.execute(
                "INSERT INTO nodes(id,node_type,title,vault_path,meta_json,created_at,updated_at) "
                "VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET "
                "title=excluded.title, vault_path=excluded.vault_path, meta_json=excluded.meta_json, "
                "updated_at=excluded.updated_at",
                (node_id, kind, title, relpath, json.dumps(meta, ensure_ascii=False),
                 now_iso(), now_iso()))
            db.execute("DELETE FROM aliases WHERE node_id=?", (node_id,))
            for a in {title, *aliases}:
                db.execute("INSERT OR IGNORE INTO aliases(alias,node_id) VALUES(?,?)", (a, node_id))
            if not (ctx.vault / relpath).exists():
                extra = {"topic-status": "seeded"} if kind == "topic" else None
                record_file(ctx, relpath, kind, "librarian", node_id,
                            _entity_note(kind, title, aliases, sections, extra))
                stats[seed_name] += 1
    db.commit()
    ctx.log.info("entities.ensure", **stats)
    return stats


# ------------------------------------------------------------- mention scan

@lru_cache(maxsize=4)
def _mention_pattern(seed_key: str) -> tuple[re.Pattern, dict[str, list[str]]]:
    """Compiled alternation of person+place aliases -> {alias: [node_ids]}."""
    people = load_seed("people")
    places = load_seed("places")
    amap: dict[str, list[str]] = {}
    scopes: dict[str, dict] = {}
    for kind, ents in (("person", people), ("place", places)):
        for ent in ents:
            node_id = f"{kind}:{slugify(ent['name'])}"
            skip = set(ent.get("no_scan_aliases", []))
            for alias in {ent["name"], *ent.get("aliases", [])}:
                if ent.get("no_scan") or alias in skip or len(alias) < 3:
                    continue
                if alias == ent["name"] and "(" in alias:
                    continue  # parenthetical canonical titles never appear verbatim in text
                amap.setdefault(alias, []).append(node_id)
            for scope_alias, hints in (ent.get("scope_hints") or {}).items():
                scopes.setdefault(scope_alias, {}).update({h: node_id for h in hints})
    alts = sorted(amap.keys(), key=len, reverse=True)
    pat = re.compile(r"(?<![A-Za-z])(" + "|".join(re.escape(a) for a in alts) + r")(?![a-z])")
    _mention_pattern.scopes = scopes  # type: ignore[attr-defined]
    return pat, amap


def scan_chapter_mentions(ctx: Ctx, chapter_slug: str) -> dict:
    db = ctx.db()
    rows = db.execute("SELECT text FROM verses WHERE chapter_slug=? ORDER BY verse",
                      (chapter_slug,)).fetchall()
    text = "\n".join(r["text"] for r in rows)
    pat, amap = _mention_pattern("default")
    scopes = getattr(_mention_pattern, "scopes", {})
    book_slug = chapter_slug.rsplit("-", 1)[0]
    counts: dict[tuple[str, str], int] = {}
    for m in pat.finditer(text):
        alias = m.group(1)
        nodes = amap[alias]
        if len(nodes) > 1 and alias in scopes and book_slug in scopes[alias]:
            nodes = [scopes[alias][book_slug]]
        for nid in nodes:
            counts[(nid, alias)] = counts.get((nid, alias), 0) + 1
    per_node: dict[str, dict] = {}
    for (nid, alias), n in counts.items():
        d = per_node.setdefault(nid, {"count": 0, "aliases": [], "ambiguous": False})
        d["count"] += n
        d["aliases"].append(alias)
        if len(amap[alias]) > 1 and not (alias in scopes and book_slug in scopes[alias]):
            d["ambiguous"] = True
    src = f"chapter:{chapter_slug}"
    db.execute("DELETE FROM edges WHERE src=? AND rel='mentions' AND provenance='pass:entities'",
               (src,))
    for nid, d in per_node.items():
        status = "tentative" if d["ambiguous"] else "accepted"
        conf = 0.5 if d["ambiguous"] else 0.95
        db.execute(
            "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
            "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(src,dst,rel) DO UPDATE SET status=excluded.status, "
            "confidence=excluded.confidence, weight=excluded.weight, meta_json=excluded.meta_json, "
            "provenance=excluded.provenance, updated_at=excluded.updated_at",
            (src, nid, "mentions", status, conf, float(d["count"]),
             json.dumps({"aliases": d["aliases"], "ambiguous": d["ambiguous"]}),
             "pass:entities", now_iso(), now_iso()))
    db.commit()
    return {"mentions": len(per_node)}


# ------------------------------------------------------------- topic keywords

@lru_cache(maxsize=1)
def _topic_keywords() -> list[tuple[str, re.Pattern, str]]:
    """[(node_id, compiled keyword pattern, anchor_refs_json)] per topic."""
    out = []
    for ent in load_seed("topics"):
        node_id = f"topic:{slugify(ent['name'])}"
        kws = ent.get("keywords", [])
        if not kws:
            continue
        pat = re.compile(r"(?<![a-z])(" + "|".join(re.escape(k.lower()) for k in kws) + r")(?![a-z])")
        out.append((node_id, pat, json.dumps(ent.get("anchors", []))))
    return out


def scan_chapter_topics(ctx: Ctx, chapter_slug: str) -> dict:
    from scripturegraph.indexing.citations import resolve_reference
    db = ctx.db()
    rows = db.execute("SELECT text FROM verses WHERE chapter_slug=? ORDER BY verse",
                      (chapter_slug,)).fetchall()
    text = " ".join(r["text"] for r in rows).lower()
    n_words = max(len(text.split()), 1)
    src = f"chapter:{chapter_slug}"
    scored: list[tuple[str, float, int, bool]] = []
    for node_id, pat, anchors_json in _topic_keywords():
        hits = len(pat.findall(text))
        anchored = False
        for ref in json.loads(anchors_json):
            cit = resolve_reference(ref)
            if cit and cit.chapter_slug == chapter_slug:
                anchored = True
        score = hits * 1000.0 / n_words
        if anchored or (hits >= 3 and score >= 1.2):
            scored.append((node_id, score, hits, anchored))
    scored.sort(key=lambda t: (not t[3], -t[1]))
    keep = scored[: int(ctx.c("links.max_topics_per_chapter", 8))]
    db.execute("DELETE FROM edges WHERE src=? AND rel='discusses' AND provenance='pass:topics'",
               (src,))
    for node_id, score, hits, anchored in keep:
        db.execute(
            "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
            "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(src,dst,rel) DO UPDATE SET status=excluded.status, "
            "confidence=excluded.confidence, weight=excluded.weight, meta_json=excluded.meta_json, "
            "provenance=excluded.provenance, updated_at=excluded.updated_at",
            (src, node_id, "discusses",
             "accepted" if anchored else "tentative",
             0.9 if anchored else 0.55, score,
             json.dumps({"keyword_hits": hits, "anchored": anchored}),
             "pass:topics", now_iso(), now_iso()))
    db.commit()
    return {"topics": len(keep)}
