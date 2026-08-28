"""`scripturegraph ask` — answer from the curated local graph, not from vibes.

Retrieval: FTS5 + (when embedded) semantic similarity over verses, documents,
and personal notes. If an AI provider is available it composes a grounded
answer FROM THE RETRIEVED PASSAGES ONLY, with citations; otherwise the ranked
passages themselves are the answer.
"""
from __future__ import annotations

import json

from scripturegraph.context import Ctx
from scripturegraph.graphops import chapter_display, verse_display
from scripturegraph.indexing.semantic import fts_search, semantic_search
from scripturegraph.util import truncate


def _passage_label(ctx: Ctx, owner_type: str, owner_id: str) -> str:
    if owner_type == "verse":
        return verse_display(owner_id)
    if owner_type == "document":
        row = ctx.db().execute("SELECT title, author, date FROM documents WHERE doc_id=?",
                               (owner_id,)).fetchone()
        if row:
            bits = [row["title"] or owner_id]
            if row["author"]:
                bits.append(row["author"])
            if row["date"]:
                bits.append(row["date"])
            return " — ".join(bits)
    if owner_type == "note":
        return f"Personal note: {owner_id.rsplit('/', 1)[-1].removesuffix('.md')}"
    return owner_id


def retrieve(ctx: Ctx, question: str, k: int | None = None) -> list[dict]:
    k = k or int(ctx.c("ask.max_passages", 14))
    scored: dict[tuple[str, str], dict] = {}
    for rank, hit in enumerate(fts_search(ctx, question, k=k * 2)):
        key = (hit["owner_type"], hit["owner_id"])
        scored[key] = {"owner_type": hit["owner_type"], "owner_id": hit["owner_id"],
                       "text": hit["text"], "score": 1.0 / (rank + 3)}
    try:
        for rank, hit in enumerate(semantic_search(ctx, question, k=k * 2)):
            key = (hit["owner_type"], hit["owner_id"])
            entry = scored.setdefault(key, {"owner_type": hit["owner_type"],
                                            "owner_id": hit["owner_id"], "text": None,
                                            "score": 0.0})
            entry["score"] += 1.0 / (rank + 3)
    except Exception:  # noqa: BLE001 — semantic layer optional
        pass
    out = sorted(scored.values(), key=lambda d: -d["score"])[:k]
    for d in out:
        if d["text"] is None:
            row = ctx.db().execute(
                "SELECT text FROM chunks WHERE owner_type=? AND owner_id=? ORDER BY seq "
                "LIMIT 1", (d["owner_type"], d["owner_id"])).fetchone()
            d["text"] = row["text"] if row else ""
        d["label"] = _passage_label(ctx, d["owner_type"], d["owner_id"])
    return out


def ask(ctx: Ctx, question: str) -> str:
    passages = retrieve(ctx, question)
    if not passages:
        return "No indexed material matched. Run `scripturegraph index` first."
    from scripturegraph.agents.providers import available_providers
    provs = available_providers(ctx)
    if not provs:
        lines = [f"No AI provider available — showing the top passages for: {question}", ""]
        for p in passages:
            lines.append(f"[{p['label']}]  {truncate(p['text'], 300)}")
        return "\n\n".join(lines)
    ctx_lines = [f"[{i + 1}] ({p['label']}) {p['text']}" for i, p in enumerate(passages)]
    prompt = f"""Answer the question strictly from the numbered passages below (curated local
scripture-study index). Rules: cite passages as [n]; distinguish what the
sources establish from interpretation; if the passages are insufficient, say
so plainly rather than improvising; keep it concise and honest.

Question: {question}

Passages:
{chr(10).join(ctx_lines)}"""
    r = provs[0].run(prompt, role="light", timeout=180,
                     workspace=ctx.cache_dir / "ask")
    if not r.ok:
        return f"Provider error: {r.error}\n\nTop passages:\n" + "\n\n".join(
            f"[{p['label']}] {truncate(p['text'], 240)}" for p in passages[:6])
    refs = "\n".join(f"[{i + 1}] {p['label']}" for i, p in enumerate(passages))
    return f"{r.text.strip()}\n\n---\nPassages:\n{refs}"
