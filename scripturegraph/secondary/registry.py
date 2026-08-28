"""Approved-source registry (§SEC 6): CRUD, seeds, review history, guests."""
from __future__ import annotations

import json

from scripturegraph.context import Ctx
from scripturegraph.secondary import rubric
from scripturegraph.util import now_iso, slugify


def get_source(ctx: Ctx, source_id: str) -> dict | None:
    row = ctx.db().execute("SELECT * FROM sec_sources WHERE source_id=?",
                           (source_id,)).fetchone()
    return dict(row) if row else None


def list_sources(ctx: Ctx, statuses: tuple[str, ...] | None = None) -> list[dict]:
    q = "SELECT * FROM sec_sources"
    params: list = []
    if statuses:
        q += f" WHERE approval_status IN ({','.join('?' * len(statuses))})"
        params = list(statuses)
    q += " ORDER BY overall_score DESC NULLS LAST, name"
    return [dict(r) for r in ctx.db().execute(q, params).fetchall()]


def upsert_source(ctx: Ctx, source: dict) -> str:
    """Insert or update; only provided keys overwrite."""
    sid = source.get("source_id") or slugify(source["name"])
    db = ctx.db()
    existing = get_source(ctx, sid)
    now = now_iso()
    row = {
        "source_id": sid,
        "name": source.get("name") or (existing or {}).get("name") or sid,
        "source_type": source.get("source_type") or (existing or {}).get("source_type") or "podcast",
        "hosts_json": json.dumps(source["hosts"]) if "hosts" in source
            else (existing or {}).get("hosts_json"),
        "institution": source.get("institution", (existing or {}).get("institution")),
        "homepage": source.get("homepage", (existing or {}).get("homepage")),
        "feed_url": source.get("feed_url", (existing or {}).get("feed_url")),
        "youtube_channel": source.get("youtube_channel", (existing or {}).get("youtube_channel")),
        "quality_tier": source.get("quality_tier", (existing or {}).get("quality_tier")),
        "overall_score": source.get("overall_score", (existing or {}).get("overall_score")),
        "scores_json": json.dumps(source["scores"]) if "scores" in source
            else (existing or {}).get("scores_json"),
        "expertise_domains_json": json.dumps(source["expertise_domains"])
            if "expertise_domains" in source else (existing or {}).get("expertise_domains_json"),
        "faith_orientation": source.get("faith_orientation", (existing or {}).get("faith_orientation")),
        "perspective": source.get("perspective", (existing or {}).get("perspective")),
        "strengths_json": json.dumps(source["strengths"]) if "strengths" in source
            else (existing or {}).get("strengths_json"),
        "limitations_json": json.dumps(source["limitations"]) if "limitations" in source
            else (existing or {}).get("limitations_json"),
        "approval_status": source.get("approval_status",
                                      (existing or {}).get("approval_status") or "WATCHLIST"),
        "seed": int(source.get("seed", (existing or {}).get("seed") or 0)),
        "last_reviewed": source.get("last_reviewed", (existing or {}).get("last_reviewed")),
        "notes": source.get("notes", (existing or {}).get("notes")),
        "created_at": (existing or {}).get("created_at") or now,
        "updated_at": now,
    }
    db.execute("""
        INSERT INTO sec_sources(source_id,name,source_type,hosts_json,institution,homepage,
            feed_url,youtube_channel,quality_tier,overall_score,scores_json,
            expertise_domains_json,faith_orientation,perspective,strengths_json,
            limitations_json,approval_status,seed,last_reviewed,notes,created_at,updated_at)
        VALUES (:source_id,:name,:source_type,:hosts_json,:institution,:homepage,
            :feed_url,:youtube_channel,:quality_tier,:overall_score,:scores_json,
            :expertise_domains_json,:faith_orientation,:perspective,:strengths_json,
            :limitations_json,:approval_status,:seed,:last_reviewed,:notes,:created_at,:updated_at)
        ON CONFLICT(source_id) DO UPDATE SET
            name=excluded.name, source_type=excluded.source_type,
            hosts_json=excluded.hosts_json, institution=excluded.institution,
            homepage=excluded.homepage, feed_url=excluded.feed_url,
            youtube_channel=excluded.youtube_channel, quality_tier=excluded.quality_tier,
            overall_score=excluded.overall_score, scores_json=excluded.scores_json,
            expertise_domains_json=excluded.expertise_domains_json,
            faith_orientation=excluded.faith_orientation, perspective=excluded.perspective,
            strengths_json=excluded.strengths_json, limitations_json=excluded.limitations_json,
            approval_status=excluded.approval_status, seed=excluded.seed,
            last_reviewed=excluded.last_reviewed, notes=excluded.notes,
            updated_at=excluded.updated_at""", row)
    db.commit()
    return sid


def record_review(ctx: Ctx, source_id: str, decision: dict, scores: dict,
                  notes: str = "") -> None:
    ctx.db().execute(
        "INSERT INTO sec_reviews(source_id,at,overall,tier,status,scores_json,notes) "
        "VALUES (?,?,?,?,?,?,?)",
        (source_id, now_iso(), decision["overall"], decision["tier"],
         decision["status"], json.dumps(scores), notes[:2000]))
    ctx.db().commit()


def apply_evaluation(ctx: Ctx, source_id: str, profile: dict, notes: str = "") -> dict:
    """Store an AI-proposed profile through the deterministic rubric.
    Seed sources are spec-APPROVED: evaluation records history and can only
    DOWNGRADE them on materially bad scores (tier D), per §1/§26."""
    scores = profile.get("scores") or {}
    decision = rubric.evaluate(ctx, scores, profile.get("recommendation"))
    src = get_source(ctx, source_id) or {}
    status = decision["status"]
    if src.get("seed") and decision["tier"] in ("A", "B", "C"):
        status = "APPROVED"  # seeds hold approval unless quality collapses
    upsert_source(ctx, {
        "source_id": source_id,
        "name": src.get("name") or profile.get("name") or source_id,
        "quality_tier": decision["tier"],
        "overall_score": decision["overall"],
        "scores": scores,
        "expertise_domains": profile.get("expertise_domains") or [],
        "faith_orientation": profile.get("faith_orientation"),
        "perspective": profile.get("perspective"),
        "strengths": profile.get("strengths") or [],
        "limitations": profile.get("limitations") or [],
        "approval_status": status,
        "institution": profile.get("institution") or src.get("institution"),
        "hosts": profile.get("hosts") or json.loads(src.get("hosts_json") or "[]"),
        "last_reviewed": now_iso(),
    })
    record_review(ctx, source_id, {**decision, "status": status}, scores,
                  profile.get("rationale") or notes)
    ctx.log.info("sec.source_evaluated", source=source_id, tier=decision["tier"],
                 overall=decision["overall"], status=status)
    return {**decision, "status": status}


def upsert_guest(ctx: Ctx, name: str, expertise: list | None = None,
                 credentials: str | None = None) -> str:
    gid = slugify(name)
    if not gid:
        return ""
    db = ctx.db()
    row = db.execute("SELECT * FROM sec_guests WHERE guest_id=?", (gid,)).fetchone()
    if row:
        merged = sorted(set(json.loads(row["expertise_json"] or "[]") + (expertise or [])))
        db.execute(
            "UPDATE sec_guests SET expertise_json=?, credentials=COALESCE(?,credentials), "
            "appearances=appearances+1, updated_at=? WHERE guest_id=?",
            (json.dumps(merged), credentials, now_iso(), gid))
    else:
        db.execute(
            "INSERT INTO sec_guests(guest_id,name,expertise_json,credentials,quality,"
            "appearances,updated_at) VALUES (?,?,?,?, 'UNKNOWN', 1, ?)",
            (gid, name, json.dumps(expertise or []), credentials, now_iso()))
    db.commit()
    return gid


# ------------------------------------------------------------------- seeds

SEED_SOURCES: list[dict] = [
    {
        "source_id": "followhim",
        "name": "followHIM",
        "source_type": "podcast",
        "hosts": ["Hank Smith", "John Bytheway"],
        "homepage": "https://followhim.co",
        "approval_status": "APPROVED",
        "quality_tier": "A",
        "seed": 1,
        "expertise_domains": ["scripture study", "Come Follow Me", "Gospel Topics",
                              "scholarly interviews", "historical context",
                              "language and literary insights"],
        "faith_orientation": "faithful_lds",
        "perspective": "Faithful weekly scripture-study interviews with rotating "
                       "scholar/teacher guests; guest interpretation distinguished "
                       "from official doctrine.",
        "strengths": ["expert guests", "serious scripture focus", "points to sources",
                      "substantial discussion depth"],
        "limitations": ["guest quality varies by episode", "devotional framing on some episodes"],
        "notes": "Spec-approved seed source (§1/§27).",
    },
    {
        "source_id": "church-history-matters",
        "name": "Church History Matters",
        "source_type": "podcast",
        "hosts": ["Scott Woodward", "Casey Griffiths"],
        "institution": "Scripture Central",
        "homepage": "https://doctrineandcovenantscentral.org/church-history-matters-podcast/",
        "approval_status": "APPROVED",
        "quality_tier": "A",
        "seed": 1,
        "expertise_domains": ["Church history", "Restoration history",
                              "difficult historical questions", "primary sources",
                              "Joseph Smith Papers"],
        "faith_orientation": "lds_academic",
        "perspective": "Historians engaging difficult Church-history questions with "
                       "primary documents; facts distinguished from interpretation.",
        "strengths": ["engages hard questions directly", "primary-document driven",
                      "distinguishes fact from interpretation"],
        "limitations": ["hosted perspective is faithful-academic; check critical "
                        "literature for counterpoints on contested topics"],
        "notes": "Spec-approved seed source (§1/§27). Institutional affiliation does "
                 "NOT auto-approve other Scripture Central programs.",
    },
]


def seed(ctx: Ctx) -> int:
    """Idempotent: insert seeds only when absent (never clobber later reviews)."""
    n = 0
    for s in SEED_SOURCES:
        if get_source(ctx, s["source_id"]) is None:
            upsert_source(ctx, dict(s))
            n += 1
    if n:
        ctx.log.info("sec.seeded", sources=n)
    return n
