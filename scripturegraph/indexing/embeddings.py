"""Replaceable embedding providers + vector storage.

Providers (config `embeddings.provider`):
- "hash"      deterministic feature-hash embedder; zero dependencies, always
              available, used for tests and as a structural fallback. Weak
              semantics — candidate links from it stay low-confidence.
- "fastembed" local ONNX model (BAAI/bge-small-en-v1.5) if the optional
              `fastembed` package is installed. Good local semantics.
- "openai"    text-embedding-3-small via API (needs OPENAI_API_KEY).
- "auto"      fastembed if importable, else hash.

Vectors are float32 blobs in SQLite keyed by (chunk, provider, model), so
switching providers re-embeds without destroying prior work.
"""
from __future__ import annotations

import hashlib
import json
import math
import urllib.request

import numpy as np

from scripturegraph.context import Ctx
from scripturegraph.util import words_of


class EmbeddingProvider:
    name = "base"
    model = "base"
    dim = 0

    def embed(self, texts: list[str]) -> np.ndarray:  # (n, dim) float32, L2-normalized
        raise NotImplementedError


class HashEmbedder(EmbeddingProvider):
    name = "hash"
    model = "hash-ngram-v1"
    dim = 384

    def _tokens(self, text: str) -> list[str]:
        ws = words_of(text)
        return ws + [f"{a}_{b}" for a, b in zip(ws, ws[1:])]

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for i, t in enumerate(texts):
            counts: dict[str, int] = {}
            for tok in self._tokens(t):
                counts[tok] = counts.get(tok, 0) + 1
            for tok, c in counts.items():
                h = hashlib.md5(tok.encode()).digest()
                idx = int.from_bytes(h[:4], "little") % self.dim
                sign = 1.0 if h[4] & 1 else -1.0
                out[i, idx] += sign * (1.0 + math.log(c))
            n = float(np.linalg.norm(out[i]))
            if n > 0:
                out[i] /= n
        return out


class FastembedProvider(EmbeddingProvider):
    name = "fastembed"
    model = "BAAI/bge-small-en-v1.5"
    dim = 384

    def __init__(self):
        from fastembed import TextEmbedding  # lazy; optional dependency
        self._m = TextEmbedding(model_name=self.model)

    def embed(self, texts: list[str]) -> np.ndarray:
        vecs = np.array(list(self._m.embed(texts)), dtype=np.float32)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return vecs / norms


class OpenAIProvider(EmbeddingProvider):
    name = "openai"
    model = "text-embedding-3-small"
    dim = 1536

    def __init__(self):
        import os
        self.key = os.environ.get("OPENAI_API_KEY")
        if not self.key:
            raise RuntimeError("OPENAI_API_KEY not set")

    def embed(self, texts: list[str]) -> np.ndarray:
        req = urllib.request.Request(
            "https://api.openai.com/v1/embeddings",
            data=json.dumps({"model": self.model, "input": texts}).encode(),
            headers={"Authorization": f"Bearer {self.key}",
                     "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
        vecs = np.array([d["embedding"] for d in data["data"]], dtype=np.float32)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return vecs / norms


_provider_cache: dict[str, EmbeddingProvider] = {}


def get_provider(ctx: Ctx) -> EmbeddingProvider:
    want = ctx.c("embeddings.provider", "auto")
    if want in _provider_cache:
        return _provider_cache[want]
    prov = _build_provider(ctx, want)
    _provider_cache[want] = prov
    return prov


def _build_provider(ctx: Ctx, want: str) -> EmbeddingProvider:
    if want in ("auto", "fastembed"):
        try:
            return FastembedProvider()
        except Exception as e:  # noqa: BLE001 — any import/download failure → fallback
            if want == "fastembed":
                raise
            ctx.log.debug("embeddings.fastembed_unavailable", error=str(e))
    if want == "openai":
        return OpenAIProvider()
    return HashEmbedder()


def embed_missing(ctx: Ctx, owner_types: tuple[str, ...] = ("verse", "document"),
                  limit: int | None = None) -> dict:
    """Embed chunks lacking vectors for the active provider."""
    db = ctx.db()
    prov = get_provider(ctx)
    batch = int(ctx.c("embeddings.batch", 128))
    q = ("SELECT c.id, c.text FROM chunks c "
         "LEFT JOIN embeddings e ON e.chunk_id=c.id AND e.provider=? AND e.model=? "
         f"WHERE e.chunk_id IS NULL AND c.owner_type IN ({','.join('?' * len(owner_types))}) "
         "ORDER BY c.id")
    params = [prov.name, prov.model, *owner_types]
    if limit:
        q += " LIMIT ?"
        params.append(limit)
    rows = db.execute(q, params).fetchall()
    done = 0
    for i in range(0, len(rows), batch):
        chunk_rows = rows[i:i + batch]
        vecs = prov.embed([r["text"] for r in chunk_rows])
        for r, v in zip(chunk_rows, vecs):
            db.execute(
                "INSERT OR REPLACE INTO embeddings(chunk_id,provider,model,dim,vector) "
                "VALUES(?,?,?,?,?)",
                (r["id"], prov.name, prov.model, prov.dim, v.astype(np.float32).tobytes()))
        db.commit()
        done += len(chunk_rows)
        if done % 4096 < batch:
            ctx.log.info("embeddings.progress", done=done, total=len(rows), provider=prov.name)
    ctx.log.info("embeddings.done", embedded=done, provider=prov.name, model=prov.model)
    return {"embedded": done, "provider": prov.name, "model": prov.model}


def load_vectors(ctx: Ctx, owner_type: str) -> tuple[list[str], np.ndarray] | None:
    """(owner_ids, matrix) for the active provider; None when nothing embedded."""
    db = ctx.db()
    prov = get_provider(ctx)
    rows = db.execute(
        "SELECT c.owner_id, e.vector, e.dim FROM embeddings e "
        "JOIN chunks c ON c.id=e.chunk_id "
        "WHERE e.provider=? AND e.model=? AND c.owner_type=? ORDER BY c.id",
        (prov.name, prov.model, owner_type)).fetchall()
    if not rows:
        return None
    dim = rows[0]["dim"]
    mat = np.frombuffer(b"".join(r["vector"] for r in rows), dtype=np.float32).reshape(len(rows), dim)
    return [r["owner_id"] for r in rows], mat.copy()


def embed_query(ctx: Ctx, text: str) -> np.ndarray:
    return get_provider(ctx).embed([text])[0]
