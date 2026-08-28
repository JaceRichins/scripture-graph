"""Secondary-source ingestion orchestration.

Nightly: refresh approved feeds → analyze a budgeted handful of episodes
(new releases first) → persist structured knowledge (segments, mentions,
claims-as-TENTATIVE, guests, graph nodes/edges, vault notes).
Weekly: re-evaluate stale sources, run discovery, retry failures.
"""
from __future__ import annotations

import hashlib
import json

from scripturegraph.context import Ctx
from scripturegraph.indexing.citations import resolve_reference
from scripturegraph.secondary import evaluate, feeds, registry, rubric
from scripturegraph.util import now_iso, slugify

ACTIVE_STATUSES = ("APPROVED", "CONDITIONAL")


# ------------------------------------------------------------ node resolve

# when a title matches several nodes ("Joseph Smith" is a person AND a Gospel
# Library document), prefer the page a person actually studies on
_PREFERRED_TYPES = ("chapter", "topic", "person", "place", "event", "doctrine",
                    "evidence", "question", "practice")


def _rank_node(row) -> int:
    t = row["node_type"]
    return _PREFERRED_TYPES.index(t) if t in _PREFERRED_TYPES else len(_PREFERRED_TYPES)


def resolve_target(ctx: Ctx, name: str | None) -> str | None:
    """'Alma 36' → chapter:alma-36 · 'Faith' → topic:faith · else None."""
    if not name:
        return None
    name = str(name).strip().strip("[]")
    if not name:
        return None
    cit = resolve_reference(name)
    if cit is not None:
        row = ctx.db().execute("SELECT 1 FROM chapters WHERE slug=?",
                               (cit.chapter_slug,)).fetchone()
        if row:
            return f"chapter:{cit.chapter_slug}"
    db = ctx.db()
    # title matches AND alias matches compete together — a person page whose
    # canonical title is "Joseph Smith Jr." must beat a document titled
    # "Joseph Smith" for the alias "Joseph Smith"
    cands: list[tuple[int, int, str]] = []
    for r in db.execute("SELECT id, node_type FROM nodes WHERE title=?", (name,)):
        cands.append((_rank_node(r), 0, r["id"]))
    for r in db.execute(
            "SELECT n.id, n.node_type FROM aliases a JOIN nodes n ON n.id=a.node_id "
            "WHERE a.alias=?", (name,)):
        cands.append((_rank_node(r), 1, r["id"]))
    if not cands:
        return None
    return min(cands)[2]


def _ensure_node(ctx: Ctx, node_id: str, node_type: str, title: str,
                 vault_path: str | None = None, meta: dict | None = None) -> None:
    ctx.db().execute(
        "INSERT INTO nodes(id,node_type,title,vault_path,meta_json,created_at,updated_at) "
        "VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET "
        "title=excluded.title, vault_path=COALESCE(excluded.vault_path, nodes.vault_path), "
        "updated_at=excluded.updated_at",
        (node_id, node_type, title, vault_path,
         json.dumps(meta or {}), now_iso(), now_iso()))


def _edge(ctx: Ctx, src: str, dst: str, rel: str, meta: dict | None,
          provenance: str) -> None:
    ctx.db().execute(
        "INSERT INTO edges(src,dst,rel,status,confidence,weight,meta_json,provenance,"
        "created_at,updated_at) VALUES(?,?,?,'accepted',NULL,1.0,?,?,?,?) "
        "ON CONFLICT(src,dst,rel) DO UPDATE SET meta_json=excluded.meta_json, "
        "updated_at=excluded.updated_at",
        (src, dst, rel, json.dumps(meta or {}), provenance, now_iso(), now_iso()))


# --------------------------------------------------------------- persist

def persist_analysis(ctx: Ctx, source: dict, item: dict, analysis: dict,
                     analysis_depth: str) -> dict:
    """Store one validated SecondaryItemAnalysis. Deterministic; idempotent
    per item (re-analysis replaces prior derived rows)."""
    db = ctx.db()
    iid = item["item_id"]
    ok, reason = rubric.may_ingest(ctx, source, analysis.get("episode_quality"),
                                   analysis.get("novelty"), analysis.get("verdict"))
    status = "ingested" if ok else "skipped"
    reason = analysis.get("verdict_reason") or reason if ok else reason
    db.execute(
        "UPDATE sec_items SET episode_quality=?, novelty=?, relevance=?, summary=?, "
        "guests_json=?, insights_json=?, scores_json=?, status=?, verdict_reason=?, "
        "analysis_depth=?, updated_at=? WHERE item_id=?",
        (rubric.clamp(analysis.get("episode_quality")),
         rubric.clamp(analysis.get("novelty")),
         rubric.clamp(analysis.get("relevance")),
         (analysis.get("summary") or "")[:1500],
         json.dumps(analysis.get("guests") or []),
         json.dumps(analysis.get("insights") or []),
         json.dumps({k: analysis.get(k) for k in
                     ("episode_quality", "novelty", "relevance", "sensational_flags")}),
         status, reason[:500], analysis_depth, now_iso(), iid))

    # replace derived rows (idempotent re-analysis)
    db.execute("DELETE FROM sec_segments WHERE item_id=?", (iid,))
    db.execute("DELETE FROM sec_mentions WHERE item_id=?", (iid,))
    db.execute("DELETE FROM edges WHERE src=? AND provenance=?",
               (f"secitem:{iid}", f"secitem:{iid}"))
    db.execute("DELETE FROM claims WHERE provenance_json LIKE ?",
               (f'%"item_id": "{iid}"%',))

    stats = {"item": iid, "status": status, "segments": 0, "claims": 0,
             "insights": 0, "mentions": 0, "targets": 0}
    if not ok:
        db.commit()
        ctx.log.info("sec.item_skipped", item=iid, reason=reason[:160])
        return stats

    src_node = f"secsource:{source['source_id']}"
    item_node = f"secitem:{iid}"
    _ensure_node(ctx, src_node, "sec-source", source["name"])
    _ensure_node(ctx, item_node, "sec-item",
                 f"{source['name']} — {item['title']}"[:200],
                 meta={"url": item.get("url"), "published": item.get("published_at")})
    _edge(ctx, item_node, src_node, "part_of", None, item_node)

    resolved_targets: set[str] = set()

    def _resolve_many(names) -> list[str]:
        out = []
        for n in names or []:
            nid = resolve_target(ctx, n)
            if nid:
                out.append(nid)
                resolved_targets.add(nid)
        return out

    # segments + discusses edges (segment edges carry the jump timestamp)
    segment_targets: set[str] = set()
    for seg in analysis.get("segments") or []:
        t0 = rubric.parse_ts(seg.get("t_start"))
        t1 = rubric.parse_ts(seg.get("t_end"))
        nodes = _resolve_many(seg.get("links"))
        db.execute(
            "INSERT INTO sec_segments(item_id,t_start_s,t_end_s,label,summary,nodes_json) "
            "VALUES (?,?,?,?,?,?)",
            (iid, t0, t1, (seg.get("label") or "")[:200],
             (seg.get("summary") or "")[:600], json.dumps(nodes)))
        for nid in nodes:
            if nid not in segment_targets:  # first (earliest) segment wins the meta
                _edge(ctx, item_node, nid, "discusses",
                      {"t_start": t0, "t_end": t1, "label": seg.get("label")}, item_node)
                segment_targets.add(nid)
        stats["segments"] += 1

    # top-level targets without a segment still get (timestamp-less) edges
    for nid in _resolve_many((analysis.get("scriptures") or [])
                             + (analysis.get("topics") or [])
                             + (analysis.get("people") or [])
                             + (analysis.get("places") or [])
                             + (analysis.get("events") or [])):
        if nid not in segment_targets:
            _edge(ctx, item_node, nid, "discusses", None, item_node)

    # claims → TENTATIVE rows in the evidence pipeline (§18: no bypass)
    for c in analysis.get("claims") or []:
        target = resolve_target(ctx, c.get("target"))
        t_s = rubric.parse_ts(c.get("t"))
        cid = "sec-" + hashlib.sha1(
            f"{iid}|{c.get('text', '')}".encode()).hexdigest()[:16]
        db.execute(
            "INSERT OR REPLACE INTO claims(id,node_id,claim_type,text,tier,scores_json,"
            "consensus,sources_json,provenance_json,created_at,updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (cid, target, "evidence" if c.get("claim_type") in
             ("historical", "archaeological", "textual", "linguistic", "scientific")
             else "interpretation",
             c.get("text", "")[:600], "TENTATIVE",
             json.dumps({"claim_confidence": c.get("confidence") or "low",
                         "source_quality": source.get("quality_tier")}),
             "secondary-claim",
             json.dumps([{"kind": "secondary", "source": source["name"],
                          "item": item["title"], "url": item.get("url"),
                          "speaker": c.get("speaker"),
                          "primary_source_named": c.get("primary_source_named")}]),
             json.dumps({"kind": "secondary", "item_id": iid, "t_s": t_s,
                         "speaker": c.get("speaker"),
                         "claim_type": c.get("claim_type"),
                         "primary_source_named": c.get("primary_source_named")}),
             now_iso(), now_iso()))
        stats["claims"] += 1

    # references → mentions (discovery leads; original outranks the podcast)
    for ref in analysis.get("references") or []:
        db.execute(
            "INSERT INTO sec_mentions(item_id,kind,title,author,detail,t_s,"
            "resolved_node_id) VALUES (?,?,?,?,?,?,?)",
            (iid, ref.get("kind") or "book", (ref.get("title") or "")[:300],
             ref.get("author"), ref.get("detail"),
             rubric.parse_ts(ref.get("t")), resolve_target(ctx, ref.get("title"))))
        stats["mentions"] += 1

    # guests
    for g in analysis.get("guests") or []:
        if g.get("name"):
            registry.upsert_guest(ctx, g["name"], g.get("expertise"),
                                  g.get("credentials"))

    stats["insights"] = len(analysis.get("insights") or [])
    stats["targets"] = len(resolved_targets)
    db.commit()

    # touched chapters get their research pass revisited (claims corroboration)
    from scripturegraph import queue
    chapters = sorted(t.split(":", 1)[1] for t in resolved_targets
                      if t.startswith("chapter:"))[:4]
    if stats["claims"]:
        for cslug in chapters:
            queue.enqueue(ctx, "job", cslug, pass_name="research", priority=0.5)
        db.commit()

    ctx.log.info("sec.item_ingested", item=iid, **{k: v for k, v in stats.items()
                                                   if k != "item"})
    return stats


def relink_targets(ctx: Ctx) -> int:
    """Re-point secitem 'discusses' edges (and segment node lists) that landed
    on a non-preferred node when a studyable node shares the same title —
    e.g. doc:… 'Joseph Smith' → person:… 'Joseph Smith'. Self-healing for
    items ingested before a better target existed."""
    db = ctx.db()
    moved = 0
    for e in db.execute(
            "SELECT e.id, e.src, e.dst, n.title FROM edges e JOIN nodes n ON n.id=e.dst "
            "WHERE e.src LIKE 'secitem:%' AND e.rel='discusses' "
            "AND n.node_type NOT IN ({})".format(
                ",".join(f"'{t}'" for t in _PREFERRED_TYPES))).fetchall():
        better = resolve_target(ctx, e["title"])
        if not better or better == e["dst"]:
            continue
        dup = db.execute("SELECT 1 FROM edges WHERE src=? AND dst=? AND rel='discusses'",
                         (e["src"], better)).fetchone()
        if dup:
            db.execute("DELETE FROM edges WHERE id=?", (e["id"],))
        else:
            db.execute("UPDATE edges SET dst=?, updated_at=? WHERE id=?",
                       (better, now_iso(), e["id"]))
        iid = e["src"].split(":", 1)[1]
        for seg in db.execute("SELECT id, nodes_json FROM sec_segments WHERE item_id=?",
                              (iid,)).fetchall():
            nodes = json.loads(seg["nodes_json"] or "[]")
            if e["dst"] in nodes:
                nodes = [better if n == e["dst"] else n for n in nodes]
                db.execute("UPDATE sec_segments SET nodes_json=? WHERE id=?",
                           (json.dumps(nodes), seg["id"]))
        moved += 1
    if moved:
        db.commit()
        ctx.log.info("sec.relinked", edges=moved)
    return moved


# --------------------------------------------------------------- nightly

def _pick_items(ctx: Ctx, budget: int) -> list[dict]:
    """Newest releases across active sources first, then bounded backlog."""
    db = ctx.db()
    rows = [dict(r) for r in db.execute(
        f"""SELECT i.* FROM sec_items i JOIN sec_sources s ON s.source_id=i.source_id
            WHERE i.status='discovered' AND s.approval_status IN
            ({','.join('?' * len(ACTIVE_STATUSES))})
            ORDER BY i.published_at DESC LIMIT ?""",
        (*ACTIVE_STATUSES, budget * 3)).fetchall()]
    if not rows:
        return []
    cutoff = (now_iso()[:10])
    import datetime
    recent_floor = (datetime.date.fromisoformat(cutoff)
                    - datetime.timedelta(days=45)).isoformat()
    fresh = [r for r in rows if (r.get("published_at") or "") >= recent_floor]
    backlog = [r for r in rows if r not in fresh]
    max_backlog = int(ctx.c("secondary.backlog_per_night", 2))
    picked = fresh[:budget]
    if len(picked) < budget:
        picked += backlog[:min(budget - len(picked), max_backlog)]
    return picked


def secondary_nightly(ctx: Ctx) -> dict:
    if not ctx.c("secondary.enabled", True):
        return {"skipped": "disabled"}
    registry.seed(ctx)
    stats: dict = {"feeds": [], "analyzed": 0, "ingested": 0, "skipped": 0,
                   "failed": 0}
    for source in registry.list_sources(ctx, ACTIVE_STATUSES):
        try:
            stats["feeds"].append(feeds.refresh_source_items(ctx, source))
        except Exception as e:  # noqa: BLE001 — network trouble must not sink the run
            ctx.log.warn("sec.feed_failed", source=source["source_id"],
                         error=str(e)[:200])
    provider = evaluate.pick_provider(ctx)
    if provider is None or not ctx.c("automation.ai_enabled", True):
        stats["note"] = "no provider / ai disabled — feeds refreshed only"
        return stats
    budget = int(ctx.c("secondary.items_per_night", 3))
    for item in _pick_items(ctx, budget):
        source = registry.get_source(ctx, item["source_id"]) or {}
        try:
            text, tstatus = feeds.acquire_transcript(ctx, item)
            if text:
                cache = ctx.cache_dir / "secondary" / f"transcript-{item['item_id']}.txt"
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_text(text, encoding="utf-8", errors="replace")
                content, kind, depth = text, "creator-provided transcript", "full"
                ctx.db().execute(
                    "UPDATE sec_items SET transcript_status=?, transcript_path=? "
                    "WHERE item_id=?", (tstatus, str(cache), item["item_id"]))
            else:
                desc = item.get("description") or ""
                if len(desc) < 200:
                    ctx.db().execute(
                        "UPDATE sec_items SET status='skipped', transcript_status=?, "
                        "verdict_reason='no lawful transcript and no substantive notes', "
                        "updated_at=? WHERE item_id=?",
                        (tstatus, now_iso(), item["item_id"]))
                    ctx.db().commit()
                    stats["skipped"] += 1
                    continue
                content, kind, depth = desc, "show notes only (no transcript)", "notes-only"
                ctx.db().execute("UPDATE sec_items SET transcript_status=? WHERE item_id=?",
                                 (tstatus, item["item_id"]))
            ctx.db().commit()
            analysis, call_stats = evaluate.analyze_item(
                ctx, provider, source, item, content, kind)
            if analysis is None:
                raise RuntimeError(call_stats.get("error") or "analysis failed")
            r = persist_analysis(ctx, source, item, analysis, depth)
            stats["analyzed"] += 1
            stats["ingested" if r["status"] == "ingested" else "skipped"] += 1
        except Exception as e:  # noqa: BLE001 — isolate per-item failures
            ctx.db().execute(
                "UPDATE sec_items SET status='failed', verdict_reason=?, updated_at=? "
                "WHERE item_id=?", (str(e)[:400], now_iso(), item["item_id"]))
            ctx.db().commit()
            stats["failed"] += 1
            ctx.log.warn("sec.item_failed", item=item["item_id"], error=str(e)[:200])
    from scripturegraph.secondary.vaultout import (update_secondary_sections,
                                                   write_all_notes)
    stats["vault"] = write_all_notes(ctx)
    stats["sections"] = update_secondary_sections(ctx)
    return stats


# ---------------------------------------------------------------- weekly

def build_source_evidence(ctx: Ctx, source: dict) -> str:
    """Gather profile evidence: registry facts + recent episode metadata +
    homepage about text (robots-gated)."""
    from scripturegraph.secondary import net
    lines = [f"Name: {source['name']}",
             f"Type: {source.get('source_type')}",
             f"Hosts/creators: {', '.join(json.loads(source.get('hosts_json') or '[]'))}",
             f"Institution: {source.get('institution') or 'unknown'}",
             f"Homepage: {source.get('homepage') or 'unknown'}"]
    rows = ctx.db().execute(
        "SELECT title, published_at, description FROM sec_items WHERE source_id=? "
        "ORDER BY published_at DESC LIMIT 12", (source["source_id"],)).fetchall()
    if rows:
        lines.append("\nRecent episodes:")
        for r in rows:
            lines.append(f"- {r['published_at']} — {r['title']}")
            if r["description"]:
                lines.append(f"  {r['description'][:400]}")
    if source.get("homepage"):
        page = net.fetch_page(ctx, source["homepage"])
        if page:
            from scripturegraph.corpus.universal import html_to_text
            text, _ = html_to_text(page)
            lines.append("\nHomepage/about text (excerpt):\n" + text[:6000])
    ing = ctx.db().execute(
        "SELECT COUNT(*) n, AVG(episode_quality) q FROM sec_items "
        "WHERE source_id=? AND episode_quality IS NOT NULL",
        (source["source_id"],)).fetchone()
    if ing and ing["n"]:
        lines.append(f"\nAnalyzed episodes so far: {ing['n']}, "
                     f"average episode quality {ing['q']:.0f}/100")
    return "\n".join(lines)


def secondary_weekly(ctx: Ctx) -> dict:
    if not ctx.c("secondary.enabled", True):
        return {"skipped": "disabled"}
    registry.seed(ctx)
    stats: dict = {"rereviewed": 0, "discovery": {}, "failed_reset": 0}
    db = ctx.db()
    stats["relinked"] = relink_targets(ctx)
    # failed items get one more chance next nightly
    cur = db.execute(
        "UPDATE sec_items SET status='discovered', verdict_reason=NULL "
        "WHERE status='failed'")
    stats["failed_reset"] = cur.rowcount
    db.commit()
    provider = evaluate.pick_provider(ctx)
    if provider is None or not ctx.c("automation.ai_enabled", True):
        stats["note"] = "no provider — maintenance only"
        return stats
    # stale sources re-reviewed (§26) — oldest first, small budget
    days = int(ctx.c("secondary.rereview_days", 60))
    import datetime
    stale_before = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
    stale = [dict(r) for r in db.execute(
        "SELECT * FROM sec_sources WHERE approval_status IN ('APPROVED','CONDITIONAL') "
        "AND (last_reviewed IS NULL OR last_reviewed < ?) "
        "ORDER BY last_reviewed LIMIT 2", (stale_before,)).fetchall()]
    for source in stale:
        try:
            profile, _ = evaluate.profile_source(
                ctx, provider, source["source_id"], build_source_evidence(ctx, source))
            if profile:
                registry.apply_evaluation(ctx, source["source_id"], profile)
                stats["rereviewed"] += 1
        except Exception as e:  # noqa: BLE001
            ctx.log.warn("sec.rereview_failed", source=source["source_id"],
                         error=str(e)[:200])
    from scripturegraph.secondary.discovery import run_discovery
    try:
        stats["discovery"] = run_discovery(ctx, provider)
    except Exception as e:  # noqa: BLE001
        ctx.log.warn("sec.discovery_failed", error=str(e)[:200])
    from scripturegraph.secondary.vaultout import (update_secondary_sections,
                                                   write_all_notes)
    stats["vault"] = write_all_notes(ctx)
    stats["sections"] = update_secondary_sections(ctx)
    return stats
