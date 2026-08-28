"""Global parallel-passage detection (deterministic, corpus-wide).

Finds verses that share rare word-shingles — Isaiah in 2 Nephi, the Sermon on
the Mount in 3 Nephi, Moses/Genesis, JS—Matthew/Matthew 24, synoptic
parallels, Malachi in D&C, etc. Runs across the ENTIRE corpus at once (a
global wave, not per-chapter), so early books benefit from the full corpus by
construction.

Verifiable and threshold-based: every stored chapter edge carries its verse
pairs and shared-shingle counts.
"""
from __future__ import annotations

import json
import zlib
from collections import Counter, defaultdict

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso, words_of


def _shingles(words: list[str], k: int) -> set[int]:
    if len(words) < k:
        return {zlib.crc32(" ".join(words).encode())} if len(words) >= 3 else set()
    return {zlib.crc32(" ".join(words[i:i + k]).encode()) for i in range(len(words) - k + 1)}


def run_global_parallels(ctx: Ctx) -> dict:
    db = ctx.db()
    k = int(ctx.c("index.shingle_size", 5))
    df_cap = int(ctx.c("index.shingle_df_cap", 60))
    min_shared = int(ctx.c("index.min_shared_shingles", 2))
    strong_n = int(ctx.c("index.strong_verse_shingles", 4))
    pair_min = int(ctx.c("index.chapter_pair_min_verses", 2))

    verse_sh: dict[str, set[int]] = {}
    chapter_of: dict[str, str] = {}
    buckets: dict[int, list[str]] = defaultdict(list)
    for row in db.execute("SELECT slug, chapter_slug, text FROM verses"):
        sh = _shingles(words_of(row["text"]), k)
        if not sh:
            continue
        verse_sh[row["slug"]] = sh
        chapter_of[row["slug"]] = row["chapter_slug"]
        for h in sh:
            buckets[h].append(row["slug"])

    ctx.log.info("parallels.buckets", verses=len(verse_sh), shingles=len(buckets))

    cand: Counter[tuple[str, str]] = Counter()
    for h, vs in buckets.items():
        n = len(vs)
        if n < 2 or n > df_cap:
            continue
        for i in range(n):
            for j in range(i + 1, n):
                a, b = vs[i], vs[j]
                if chapter_of[a] == chapter_of[b]:
                    continue
                cand[(a, b) if a < b else (b, a)] += 1

    # verse pairs above threshold, with exact shared counts already in `cand`
    verse_pairs = [(a, b, c) for (a, b), c in cand.items() if c >= min_shared]
    ctx.log.info("parallels.verse_pairs", candidates=len(cand), kept=len(verse_pairs))

    ch_pairs: dict[tuple[str, str], list[tuple[str, str, int]]] = defaultdict(list)
    for a, b, c in verse_pairs:
        ca, cb = chapter_of[a], chapter_of[b]
        key = (ca, cb) if ca < cb else (cb, ca)
        va, vb = (a, b) if ca < cb else (b, a)
        ch_pairs[key].append((va, vb, c))

    db.execute("DELETE FROM edges WHERE rel='parallel_to' AND provenance='pass:parallels'")
    kept_edges = 0
    for (ca, cb), pairs in ch_pairs.items():
        strong = [p for p in pairs if p[2] >= strong_n]
        if len(pairs) < pair_min and not strong:
            continue
        pairs.sort(key=lambda p: -p[2])
        total = sum(p[2] for p in pairs)
        meta = {"verse_pairs": [[a, b, c] for a, b, c in pairs[:80]],
                "n_verse_pairs": len(pairs), "strong_pairs": len(strong)}
        db.execute(
            "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
            "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(src,dst,rel) DO UPDATE SET status=excluded.status, "
            "confidence=excluded.confidence, weight=excluded.weight, meta_json=excluded.meta_json, "
            "provenance=excluded.provenance, updated_at=excluded.updated_at",
            (f"chapter:{ca}", f"chapter:{cb}", "parallel_to", "accepted",
             0.97, float(total), json.dumps(meta), "pass:parallels", now_iso(), now_iso()))
        kept_edges += 1
    db.commit()
    ctx.log.info("parallels.done", chapter_edges=kept_edges)
    return {"verse_pairs": len(verse_pairs), "chapter_edges": kept_edges}
