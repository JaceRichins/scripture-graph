"""AI evaluation calls for the secondary layer (thin, schema-validated).

The AI proposes; deterministic code (rubric.py / ingest.py) decides. Both
calls reuse the pipeline's provider + validation machinery, so outputs are
schema-checked with one repair retry and raw artifacts land in a workspace.
"""
from __future__ import annotations

import json
from pathlib import Path

from scripturegraph.agents.pipeline import _call_validated, fill, load_prompt
from scripturegraph.agents.providers import Provider, available_providers
from scripturegraph.context import Ctx
from scripturegraph.util import now_iso


def pick_provider(ctx: Ctx) -> Provider | None:
    provs = available_providers(ctx)
    return provs[0] if provs else None


def _workspace(ctx: Ctx, kind: str, key: str) -> Path:
    ws = ctx.jobs_dir / "secondary" / f"{kind}-{key}-{now_iso()[:10]}"
    ws.mkdir(parents=True, exist_ok=True)
    return ws


def profile_source(ctx: Ctx, provider: Provider, source_id: str,
                   evidence: str) -> tuple[dict | None, dict]:
    """Evidence → SecondarySourceProfile JSON (validated) + call stats."""
    template, ver = load_prompt(ctx, "sec_source_profile")
    prompt = fill(template, evidence=evidence[:40_000])
    ws = _workspace(ctx, "profile", source_id)
    timeout = int(ctx.budget("job_timeout_sec") or 420)
    obj, stats = _call_validated(ctx, provider, "judge", prompt,
                                 "sec_source_profile", timeout, ws, None)
    stats["prompt_version"] = ver
    return obj, stats


CLAIM_TYPES = {"historical", "textual", "doctrinal", "linguistic",
               "archaeological", "scientific", "other"}
REF_KINDS = {"book", "article", "document", "lecture", "website", "primary-source"}
_LIST_CAPS = {"guests": 8, "scriptures": 40, "topics": 20, "people": 20,
              "places": 15, "events": 15, "segments": 30, "claims": 25,
              "insights": 20, "references": 25, "sensational_flags": 8}


def _s(v, cap: int) -> str:
    """Coerce to a trimmed string ('; '-join lists — models love arrays)."""
    if isinstance(v, list):
        v = "; ".join(str(x) for x in v if x is not None)
    return str(v)[:cap] if v is not None else ""


def normalize_analysis(obj):
    """Deterministically repair near-miss model output before validation.

    Real failures observed live: credentials as a list, invented claim_type
    values ('experiential', 'cultural'), references missing 'kind' or with a
    null title. Repairing these mechanically beats burning a model retry;
    anything beyond repair is dropped, never invented.
    """
    if not isinstance(obj, dict):
        return obj
    for key, cap in _LIST_CAPS.items():
        v = obj.get(key)
        if v is not None and not isinstance(v, list):
            obj[key] = [v]
        if isinstance(obj.get(key), list):
            obj[key] = obj[key][:cap]
    for g in obj.get("guests") or []:
        if isinstance(g, dict):
            if "credentials" in g and g["credentials"] is not None:
                g["credentials"] = _s(g["credentials"], 300)
            if isinstance(g.get("expertise"), str):
                g["expertise"] = [g["expertise"]]
            if isinstance(g.get("expertise"), list):
                g["expertise"] = [str(x)[:80] for x in g["expertise"][:6]]
    for c in obj.get("claims") or []:
        if isinstance(c, dict):
            if c.get("claim_type") not in CLAIM_TYPES:
                c["claim_type"] = "other"
            if c.get("confidence") not in ("low", "medium", "high", None):
                c["confidence"] = "low"
            if "text" in c:
                c["text"] = _s(c["text"], 600)
    refs = []
    for r in obj.get("references") or []:
        if not isinstance(r, dict) or not r.get("title"):
            continue  # a reference without a title is unusable — drop
        if r.get("kind") not in REF_KINDS:
            r["kind"] = "document"
        r["title"] = _s(r["title"], 300)
        refs.append(r)
    if "references" in obj:
        obj["references"] = refs
    segs = []
    for s in obj.get("segments") or []:
        if not isinstance(s, dict):
            continue
        if not s.get("label") and s.get("summary"):
            s["label"] = _s(s["summary"], 60)
        if not s.get("summary") and s.get("label"):
            s["summary"] = _s(s["label"], 200)
        if not (s.get("label") and s.get("summary")):
            continue
        s["label"] = _s(s["label"], 200)
        s["summary"] = _s(s["summary"], 600)
        if isinstance(s.get("links"), str):
            s["links"] = [s["links"]]
        if isinstance(s.get("links"), list):
            s["links"] = [str(x)[:100] for x in s["links"][:8]]
        segs.append(s)
    if "segments" in obj:
        obj["segments"] = segs
    for i in obj.get("insights") or []:
        if isinstance(i, dict) and "text" in i:
            i["text"] = _s(i["text"], 500)
    if "summary" in obj:
        obj["summary"] = _s(obj["summary"], 1500)
    if "verdict_reason" in obj and obj["verdict_reason"] is not None:
        obj["verdict_reason"] = _s(obj["verdict_reason"], 500)
    # plain string arrays: trim each entry to its schema cap
    for key, cap in (("scriptures", 60), ("topics", 80), ("people", 80),
                     ("places", 80), ("events", 80), ("sensational_flags", 200)):
        if isinstance(obj.get(key), list):
            obj[key] = [str(x)[:cap] for x in obj[key] if x is not None]
    if obj.get("verdict") not in ("ingest", "skip") and "verdict" in obj:
        obj["verdict"] = "skip"  # unparseable verdict = conservative default
    return obj


def analyze_item(ctx: Ctx, provider: Provider, source: dict, item: dict,
                 content: str, content_kind: str) -> tuple[dict | None, dict]:
    """Transcript/notes → SecondaryItemAnalysis JSON (validated) + stats."""
    template, ver = load_prompt(ctx, "sec_item_analysis")
    cap = int(ctx.c("secondary.transcript_max_chars", 240_000))
    source_context = "\n".join(filter(None, [
        f"Show: {source['name']} ({source.get('source_type')})",
        f"Hosts: {', '.join(json.loads(source.get('hosts_json') or '[]'))}",
        f"Source quality tier: {source.get('quality_tier') or 'unscored'} "
        f"(status {source.get('approval_status')})",
        f"Known strengths: {', '.join(json.loads(source.get('strengths_json') or '[]'))}",
        f"Known limitations: {', '.join(json.loads(source.get('limitations_json') or '[]'))}",
    ]))
    item_meta = "\n".join(filter(None, [
        f"Title: {item['title']}",
        f"Published: {item.get('published_at') or 'unknown'}",
        f"Duration: {item['duration_s'] // 60} min" if item.get("duration_s") else "",
        f"URL: {item.get('url') or ''}",
    ]))
    prompt = fill(template, source_context=source_context, item_meta=item_meta,
                  content_kind=content_kind, content=content[:cap])
    ws = _workspace(ctx, "item", item["item_id"])
    timeout = int(ctx.budget("job_timeout_sec") or 420)
    obj, stats = _call_validated(ctx, provider, "researcher", prompt,
                                 "sec_item_analysis", timeout, ws, None,
                                 normalize=normalize_analysis)
    stats["prompt_version"] = ver
    return obj, stats
