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
                                 "sec_item_analysis", timeout, ws, None)
    stats["prompt_version"] = ver
    return obj, stats
