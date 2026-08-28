"""Source-admission rubric: the "vibe check" made mechanical.

The AI *proposes* dimension scores with evidence; THIS module decides the
overall score, tier, and approval status deterministically from config, so
admission policy is inspectable and adjustable without touching prompts.
"""
from __future__ import annotations

from scripturegraph.context import Ctx

DIMENSIONS = ("expertise", "source_transparency", "historical_accuracy",
              "intellectual_honesty", "depth", "reputation", "citation_quality")
PENALTY = "sensationalism_penalty"

STATUSES = ("APPROVED", "CONDITIONAL", "WATCHLIST", "REJECTED", "BLOCKED", "DEPRECATED")
# ordering used when merging code policy with the model's recommendation:
# lower index = more permissive; we always keep the MORE CONSERVATIVE of the two
_STATUS_RANK = {"APPROVED": 0, "CONDITIONAL": 1, "WATCHLIST": 2,
                "REJECTED": 3, "DEPRECATED": 3, "BLOCKED": 4}

FAITH_ORIENTATIONS = ("official_church", "faithful_lds", "lds_academic",
                      "neutral_academic", "other_christian", "secular_academic",
                      "critical_lds", "former_lds", "other")


def clamp(x, lo=0.0, hi=100.0) -> float:
    try:
        return max(lo, min(hi, float(x)))
    except (TypeError, ValueError):
        return 0.0


def overall_score(ctx: Ctx, scores: dict) -> float:
    """Weighted positive dimensions minus the sensationalism penalty."""
    weights: dict = ctx.c("secondary.weights", {}) or {}
    total_w = sum(float(weights.get(d, 0)) for d in DIMENSIONS) or 1.0
    acc = sum(clamp(scores.get(d)) * float(weights.get(d, 0)) for d in DIMENSIONS)
    base = acc / total_w
    penalty = clamp(scores.get(PENALTY)) * float(ctx.c("secondary.sensationalism_weight", 0.25))
    return round(max(0.0, base - penalty), 1)


def tier_for(ctx: Ctx, overall: float) -> str:
    th: dict = ctx.c("secondary.tier_thresholds", {}) or {}
    if overall >= float(th.get("A", 85)):
        return "A"
    if overall >= float(th.get("B", 75)):
        return "B"
    if overall >= float(th.get("C", 60)):
        return "C"
    return "D"


def status_for_tier(tier: str) -> str:
    return {"A": "APPROVED", "B": "APPROVED", "C": "CONDITIONAL", "D": "REJECTED"}[tier]


def merge_status(policy_status: str, model_recommendation: str | None) -> str:
    """Keep the more conservative of code policy and model recommendation.
    Perspective/faith orientation never factors in — quality only (§7)."""
    rec = (model_recommendation or "").upper()
    if rec not in _STATUS_RANK:
        return policy_status
    return policy_status if _STATUS_RANK[policy_status] >= _STATUS_RANK[rec] else rec


def evaluate(ctx: Ctx, scores: dict, model_recommendation: str | None = None,
             auto_approve: bool | None = None) -> dict:
    """Full deterministic decision: overall, tier, status."""
    overall = overall_score(ctx, scores)
    tier = tier_for(ctx, overall)
    status = merge_status(status_for_tier(tier), model_recommendation)
    if auto_approve is None:
        auto_approve = bool(ctx.c("secondary.auto_approve", True))
    if not auto_approve and status == "APPROVED":
        status = "CONDITIONAL"  # human can promote later
    return {"overall": overall, "tier": tier, "status": status}


def may_ingest(ctx: Ctx, source_row: dict, episode_quality: float | None,
               novelty: float | None, verdict: str | None) -> tuple[bool, str]:
    """§25 auto-accept policy. Returns (ok, reason)."""
    status = source_row.get("approval_status")
    tier = source_row.get("quality_tier") or "D"
    if status in ("REJECTED", "BLOCKED", "DEPRECATED", "WATCHLIST"):
        return False, f"source status {status}"
    if verdict == "skip":
        return False, "analysis verdict: skip"
    q = clamp(episode_quality if episode_quality is not None else 0)
    n = clamp(novelty if novelty is not None else 0)
    if n < float(ctx.c("secondary.novelty_floor", 30)):
        return False, f"novelty {n:.0f} below floor"
    if status == "CONDITIONAL" or tier == "C":
        floor = float(ctx.c("secondary.conditional_quality_floor", 80))
        if q < floor:
            return False, f"conditional source needs episode quality ≥{floor:.0f}, got {q:.0f}"
        return True, "conditional source, strong episode"
    min_tier = str(ctx.c("secondary.min_ingest_tier", "B"))
    if tier > min_tier:  # letters compare correctly: A < B < C < D
        return False, f"tier {tier} below ingest floor {min_tier}"
    floor = float(ctx.c("secondary.episode_quality_floor", 70))
    if q < floor:
        return False, f"episode quality {q:.0f} below floor {floor:.0f}"
    return True, "approved source, quality episode"


# ---------------------------------------------------------------- timestamps

def parse_ts(value) -> int | None:
    """'1:12:35' / '12:35' / '95' / 95 → seconds. None when unparseable."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        s = int(value)
        return s if s >= 0 else None
    text = str(value).strip()
    if not text:
        return None
    parts = text.split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    if any(n < 0 for n in nums) or len(nums) > 3:
        return None
    s = 0
    for n in nums:
        s = s * 60 + n
    return s


def fmt_ts(seconds: int | None) -> str:
    if seconds is None:
        return "?"
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def jump_url(base_url: str | None, seconds: int | None) -> str | None:
    """Deep link when the platform supports it (YouTube ?t=)."""
    if not base_url or seconds is None:
        return None
    if "youtube.com" in base_url or "youtu.be" in base_url:
        sep = "&" if "?" in base_url else "?"
        return f"{base_url}{sep}t={int(seconds)}"
    return None
