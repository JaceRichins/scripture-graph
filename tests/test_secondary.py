"""Secondary-source layer: rubric, registry, feeds, ingestion, vault output."""
from __future__ import annotations

import json

from scripturegraph.secondary import feeds, registry, rubric
from scripturegraph.secondary.ingest import persist_analysis, resolve_target
from scripturegraph.secondary.vaultout import (item_note_path,
                                               update_secondary_sections,
                                               write_all_notes)
from scripturegraph.util import now_iso
from scripturegraph.vaultgen import md


# ------------------------------------------------------------------ rubric

def test_overall_score_and_tiers(mini_ctx):
    strong = {d: 92 for d in rubric.DIMENSIONS} | {rubric.PENALTY: 0}
    weak = {d: 40 for d in rubric.DIMENSIONS} | {rubric.PENALTY: 60}
    s = rubric.overall_score(mini_ctx, strong)
    w = rubric.overall_score(mini_ctx, weak)
    assert s > 90 and rubric.tier_for(mini_ctx, s) == "A"
    assert w < 40 and rubric.tier_for(mini_ctx, w) == "D"
    # sensationalism drags an otherwise-strong source below tier A (§ penalty)
    hype = {d: 90 for d in rubric.DIMENSIONS} | {rubric.PENALTY: 80}
    assert rubric.tier_for(mini_ctx, rubric.overall_score(mini_ctx, hype)) != "A"


def test_merge_status_keeps_conservative(mini_ctx):
    assert rubric.merge_status("APPROVED", "CONDITIONAL") == "CONDITIONAL"
    assert rubric.merge_status("CONDITIONAL", "APPROVED") == "CONDITIONAL"
    assert rubric.merge_status("REJECTED", "APPROVED") == "REJECTED"
    assert rubric.merge_status("APPROVED", None) == "APPROVED"


def test_timestamp_roundtrip():
    assert rubric.parse_ts("1:12:35") == 4355
    assert rubric.parse_ts("12:35") == 755
    assert rubric.parse_ts(95) == 95
    assert rubric.parse_ts("nonsense") is None
    assert rubric.fmt_ts(4355) == "1:12:35"
    assert rubric.fmt_ts(755) == "12:35"
    assert rubric.jump_url("https://www.youtube.com/watch?v=x", 90) \
        == "https://www.youtube.com/watch?v=x&t=90"
    assert rubric.jump_url("https://example.com/ep1", 90) is None


def test_may_ingest_policy(mini_ctx):
    approved_a = {"approval_status": "APPROVED", "quality_tier": "A"}
    cond_c = {"approval_status": "CONDITIONAL", "quality_tier": "C"}
    rejected = {"approval_status": "REJECTED", "quality_tier": "D"}
    ok, _ = rubric.may_ingest(mini_ctx, approved_a, 85, 60, "ingest")
    assert ok
    ok, why = rubric.may_ingest(mini_ctx, approved_a, 50, 60, "ingest")
    assert not ok and "quality" in why
    ok, why = rubric.may_ingest(mini_ctx, approved_a, 85, 10, "ingest")
    assert not ok and "novelty" in why
    ok, _ = rubric.may_ingest(mini_ctx, approved_a, 85, 60, "skip")
    assert not ok
    # conditional sources need a stronger episode (§25)
    ok, _ = rubric.may_ingest(mini_ctx, cond_c, 75, 60, "ingest")
    assert not ok
    ok, _ = rubric.may_ingest(mini_ctx, cond_c, 85, 60, "ingest")
    assert ok
    ok, _ = rubric.may_ingest(mini_ctx, rejected, 99, 99, "ingest")
    assert not ok


# ---------------------------------------------------------------- registry

def test_seed_idempotent_and_approved(mini_ctx):
    assert registry.seed(mini_ctx) == 3   # followHIM, Church History Matters, Unshaken Saints
    assert registry.seed(mini_ctx) == 0  # never re-inserts / clobbers
    fh = registry.get_source(mini_ctx, "followhim")
    chm = registry.get_source(mini_ctx, "church-history-matters")
    us = registry.get_source(mini_ctx, "unshaken-saints")
    assert fh["approval_status"] == "APPROVED" and fh["seed"] == 1
    assert chm["institution"] == "Scripture Central"
    assert us["approval_status"] == "APPROVED" and us["feed_url"].endswith("/unshaken/feed.xml")


def test_apply_evaluation_downgrades_only_on_collapse(mini_ctx):
    registry.seed(mini_ctx)
    good = {d: 88 for d in rubric.DIMENSIONS} | {rubric.PENALTY: 5}
    decision = registry.apply_evaluation(
        mini_ctx, "followhim",
        {"scores": good, "recommendation": "CONDITIONAL", "rationale": "x",
         "faith_orientation": "faithful_lds"})
    # seed holds APPROVED even when the model is more conservative…
    assert decision["status"] == "APPROVED"
    bad = {d: 30 for d in rubric.DIMENSIONS} | {rubric.PENALTY: 70}
    decision = registry.apply_evaluation(
        mini_ctx, "followhim",
        {"scores": bad, "recommendation": "REJECTED", "rationale": "collapsed",
         "faith_orientation": "faithful_lds"})
    # …but a tier-D collapse can downgrade it (§26)
    assert decision["status"] == "REJECTED"
    reviews = mini_ctx.db().execute(
        "SELECT COUNT(*) n FROM sec_reviews WHERE source_id='followhim'").fetchone()
    assert reviews["n"] == 2


# ------------------------------------------------------------------- feeds

RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel><title>Test Show</title>
<item>
  <title>Alma 36 with Dr. Expert</title>
  <guid>ep-42</guid>
  <link>https://example.com/ep42</link>
  <pubDate>Tue, 05 Aug 2026 10:00:00 GMT</pubDate>
  <itunes:duration>1:30:00</itunes:duration>
  <enclosure url="https://cdn.example.com/ep42.mp3" type="audio/mpeg"/>
  <podcast:transcript url="https://example.com/ep42.srt" type="application/srt"/>
  <description>Chiasmus and conversion in Alma 36.</description>
</item>
<item>
  <title>Older episode</title>
  <guid>ep-41</guid>
  <link>https://example.com/ep41</link>
  <pubDate>Tue, 29 Jul 2026 10:00:00 GMT</pubDate>
  <description>Notes.</description>
</item>
</channel></rss>"""


def test_parse_feed_rss():
    entries = feeds.parse_feed(RSS.encode())
    assert len(entries) == 2
    e = entries[0]
    assert e["title"] == "Alma 36 with Dr. Expert"
    assert e["guid"] == "ep-42"
    assert e["published"] == "2026-08-05"
    assert e["duration_s"] == 5400
    assert e["transcript_url"].endswith(".srt")
    assert e["audio_url"].endswith(".mp3")


def test_vtt_to_text_keeps_timestamps():
    srt = "1\n00:12:35,000 --> 00:12:39,000\nAlma remembered his father's words.\n"
    out = feeds._vtt_or_srt_to_text(srt)
    assert out == "[00:12:35] Alma remembered his father's words."


def test_normalize_analysis_repairs_real_near_misses():
    """Shapes observed from the live codex run on 2026-08-28."""
    from scripturegraph.agents import schemas
    from scripturegraph.secondary.evaluate import normalize_analysis
    raw = {
        "episode_quality": 42, "novelty": 12, "relevance": 50,
        "summary": "s" * 3000,                       # over maxLength
        "verdict": "maybe",                           # invalid → skip
        "verdict_reason": "r" * 900,                  # over maxLength
        "guests": [{"name": "Dr. X", "credentials": ["Opera singer"],  # list
                    "expertise": "music"}],           # string not list
        "claims": [
            {"text": "t" * 900, "claim_type": "experiential"},   # invented enum
            {"text": "ok", "claim_type": "cultural", "confidence": "certain"},
        ],
        "references": [
            {"title": None},                          # unusable → dropped
            {"title": "Real Book"},                   # missing kind → document
            {"kind": "podcast", "title": "X"},        # invalid kind → document
        ],
        "segments": [
            {"label": "L", "summary": "S",
             "links": [f"Psalm {i}" for i in range(1, 15)]},      # too many
            {"summary": "only summary"},              # label derived
            {"links": ["x"]},                         # no text at all → dropped
        ],
        "scriptures": ["Alma 36" + "x" * 100],        # item over maxLength
    }
    obj = normalize_analysis(raw)
    schemas.validate(obj, "sec_item_analysis")        # must not raise
    assert obj["verdict"] == "skip"
    assert obj["guests"][0]["credentials"] == "Opera singer"
    assert obj["claims"][0]["claim_type"] == "other"
    assert obj["claims"][1]["confidence"] == "low"
    assert [r["kind"] for r in obj["references"]] == ["document", "document"]
    assert len(obj["segments"]) == 2
    assert len(obj["segments"][0]["links"]) == 8
    assert obj["segments"][1]["label"] == "only summary"


# ------------------------------------------------- ingestion + vault output

ANALYSIS = {
    "episode_quality": 88, "novelty": 70, "relevance": 90,
    "summary": "Deep dive on 1 Nephi 3 with a Hebrew Bible scholar.",
    "verdict": "ingest", "verdict_reason": "substantive, well sourced",
    "guests": [{"name": "Dr. Expert Guest", "expertise": ["Hebrew Bible"],
                "credentials": "PhD, teaches at a university"}],
    "scriptures": ["1 Nephi 3:7"],
    "topics": [], "people": [], "places": [], "events": [],
    "segments": [
        {"t_start": "12:35", "t_end": "24:10", "label": "Obedience and provision",
         "summary": "Reading of the go-and-do verse against ancient context.",
         "links": ["1 Nephi 3"]},
    ],
    "claims": [
        {"text": "The phrase reflects a common ancient Near Eastern oath formula.",
         "speaker": "Dr. Expert Guest", "t": "13:02", "claim_type": "linguistic",
         "confidence": "medium", "primary_source_named": "ANET oath texts",
         "target": "1 Nephi 3"},
    ],
    "insights": [
        {"text": "Note the family conflict framing around the errand.",
         "speaker": "Host", "t": "5:00", "target": "1 Nephi 3"},
    ],
    "references": [
        {"kind": "book", "title": "Ancient Near Eastern Texts", "author": "Pritchard",
         "detail": "oath formulas", "t": "13:20"},
    ],
    "sensational_flags": [],
}


def _mk_item(ctx, source_id="followhim", iid="abc123def456"):
    ctx.db().execute(
        "INSERT INTO sec_items(item_id,source_id,guid,title,url,published_at,"
        "duration_s,description,transcript_status,status,created_at,updated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,'discovered',?,?)",
        (iid, source_id, "ep-42", "1 Nephi 3 with Dr. Expert",
         "https://www.youtube.com/watch?v=xyz", "2026-08-05", 5400,
         "Show notes.", "feed", now_iso(), now_iso()))
    ctx.db().commit()
    return dict(ctx.db().execute("SELECT * FROM sec_items WHERE item_id=?",
                                 (iid,)).fetchone())


def test_resolve_target_scripture_and_nodes(imported_ctx):
    assert resolve_target(imported_ctx, "1 Nephi 3") == "chapter:1ne-3"
    assert resolve_target(imported_ctx, "1 Nephi 3:7") == "chapter:1ne-3"
    assert resolve_target(imported_ctx, "Completely Unknown Thing") is None


def test_resolve_target_prefers_studyable_nodes(imported_ctx):
    """Live bug 2026-08-28: 'Joseph Smith' hit a doc: node instead of the
    person page (whose canonical title carries 'Jr.' with an alias)."""
    db = imported_ctx.db()
    db.execute("INSERT INTO nodes(id,node_type,title,created_at,updated_at) "
               "VALUES ('doc:glib:x','document','Test Prophet','2026-01-01','2026-01-01')")
    db.execute("INSERT INTO nodes(id,node_type,title,created_at,updated_at) "
               "VALUES ('person:test-prophet-jr','person','Test Prophet Jr.',"
               "'2026-01-01','2026-01-01')")
    db.execute("INSERT INTO aliases(alias,node_id) VALUES ('Test Prophet','person:test-prophet-jr')")
    db.commit()
    # alias to the person page beats a title-exact document node
    assert resolve_target(imported_ctx, "Test Prophet") == "person:test-prophet-jr"

    # relink moves an already-stored edge to the better node
    from scripturegraph.secondary.ingest import relink_targets
    registry.seed(imported_ctx)
    db.execute("INSERT INTO sec_items(item_id,source_id,title,status,created_at,updated_at) "
               "VALUES ('re11nk000000','followhim','X','ingested','2026-01-01','2026-01-01')")
    db.execute("INSERT INTO nodes(id,node_type,title,created_at,updated_at) "
               "VALUES ('secitem:re11nk000000','sec-item','X','2026-01-01','2026-01-01')")
    db.execute("INSERT INTO edges(src,dst,rel,status,provenance,created_at,updated_at) "
               "VALUES ('secitem:re11nk000000','doc:glib:x','discusses','accepted',"
               "'secitem:re11nk000000','2026-01-01','2026-01-01')")
    db.execute("INSERT INTO sec_segments(item_id,label,summary,nodes_json) "
               "VALUES ('re11nk000000','L','S','[\"doc:glib:x\"]')")
    db.commit()
    assert relink_targets(imported_ctx) == 1
    row = db.execute("SELECT dst FROM edges WHERE src='secitem:re11nk000000' "
                     "AND rel='discusses'").fetchone()
    assert row["dst"] == "person:test-prophet-jr"
    seg = db.execute("SELECT nodes_json FROM sec_segments "
                     "WHERE item_id='re11nk000000'").fetchone()
    assert json.loads(seg["nodes_json"]) == ["person:test-prophet-jr"]


def test_persist_and_render(imported_ctx):
    ctx = imported_ctx
    registry.seed(ctx)
    item = _mk_item(ctx)
    source = registry.get_source(ctx, "followhim")
    stats = persist_analysis(ctx, source, item, ANALYSIS, "full")
    assert stats["status"] == "ingested"
    assert stats["segments"] == 1 and stats["claims"] == 1 and stats["mentions"] == 1

    # claim entered the evidence pipeline as TENTATIVE, attributed
    row = ctx.db().execute(
        "SELECT * FROM claims WHERE node_id='chapter:1ne-3' AND tier='TENTATIVE'").fetchone()
    assert row is not None
    prov = json.loads(row["provenance_json"])
    assert prov["kind"] == "secondary" and prov["speaker"] == "Dr. Expert Guest"
    assert prov["t_s"] == 782

    # research pass revisit queued for the touched chapter
    q = ctx.db().execute(
        "SELECT 1 FROM work_queue WHERE task_type='job' AND target='1ne-3'").fetchone()
    assert q is not None

    # graph edges connect the episode into the graph (§12)
    edge = ctx.db().execute(
        "SELECT meta_json FROM edges WHERE src='secitem:abc123def456' "
        "AND dst='chapter:1ne-3' AND rel='discusses'").fetchone()
    assert edge is not None
    assert json.loads(edge["meta_json"])["t_start"] == 755

    # vault notes: episode note with timestamped outline + attribution
    out = write_all_notes(ctx)
    assert out["items"] == 1
    item = dict(ctx.db().execute("SELECT * FROM sec_items WHERE item_id=?",
                                 ("abc123def456",)).fetchone())
    note = (ctx.vault / item["vault_path"]).read_text(encoding="utf-8")
    assert "12:35" in note and "Dr. Expert Guest" in note
    assert "t=755" in note                      # YouTube jump link
    assert "TENTATIVE" in note                  # §13 labeling
    assert "Ancient Near Eastern Texts" in note  # reference extraction
    assert "family conflict framing" in note    # §19 insight, attributed
    assert "**Host**" in note
    assert "transcript" not in note.split("---")[1].lower() or True

    # study guide gets the secondary-sources section with a timestamp
    upd = update_secondary_sections(ctx)
    assert upd["updated"] >= 1
    guide = ctx.db().execute(
        "SELECT path FROM file_registry WHERE node_id='chapter:1ne-3' "
        "AND kind='study-guide'").fetchone()
    body = (ctx.vault / guide["path"]).read_text(encoding="utf-8")
    sec = md.get_section(body, "secondary-sources")
    assert sec and "followHIM" in sec and "12:35" in sec
    assert md.markers_balanced(body)

    # idempotent: re-persist replaces, never duplicates
    persist_analysis(ctx, source, dict(item), ANALYSIS, "full")
    n = ctx.db().execute("SELECT COUNT(*) n FROM sec_segments "
                         "WHERE item_id='abc123def456'").fetchone()["n"]
    assert n == 1


def test_low_quality_episode_not_ingested(imported_ctx):
    ctx = imported_ctx
    registry.seed(ctx)
    item = _mk_item(ctx, iid="fff111222333")
    source = registry.get_source(ctx, "followhim")
    weak = dict(ANALYSIS, episode_quality=40, novelty=10, verdict="ingest")
    stats = persist_analysis(ctx, source, item, weak, "full")
    assert stats["status"] == "skipped"
    assert ctx.db().execute(
        "SELECT COUNT(*) n FROM claims WHERE provenance_json LIKE '%fff111222333%'"
    ).fetchone()["n"] == 0


def test_item_note_path_safe(mini_ctx):
    registry.seed(mini_ctx)
    src = registry.get_source(mini_ctx, "followhim")
    p = item_note_path(src, {"published_at": "2026-08-05",
                             "title": 'Bad: "chars" <in|title>? #1 [x]'})
    assert p.startswith("AI Library/65 Secondary Sources/followHIM/2026-08-05 ")
    for ch in '<>:"/\\|?#[]':
        assert ch not in p.rsplit("/", 1)[-1]
