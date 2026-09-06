"""The subject dossier job: deep, judged research on ONE subject — a person,
a place, a gospel topic, or a hard question — run only after the whole canon
has been read.

Chapter research walks the scriptures a chapter at a time and leaves what it
finds (claims, links, evidence, chronology) on the chapters. A dossier is the
other axis: everything the canon and that reading found about Moses, or
Kirtland, or Faith, or "How reliable is the biblical text", gathered into one
honest page. It deliberately waits for the reading to finish — a dossier
written from a third of the canon is a dossier that is wrong about the other
two thirds, and it would have to be thrown away and paid for again.

Same shape as `pipeline.run_chapter_job`: two independent researchers →
cross-critique → mechanical validation of every reference and quote → judge →
deterministic librarian inside a git transaction. Same isolation (nothing
touches the vault before the landing lock), same rollback.

What the AI writes and what software writes are kept apart on the page: the
prose sections below are the model's, judged; the mentions ledger on people
and places, the scriptural-foundation anchors on topics and the timeline
section stay deterministic — lines software can defend.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from scripturegraph import gitops
from scripturegraph.agents import schemas
from scripturegraph.agents.pipeline import (LANDING, JobQuarantined, ProviderUnavailable,
                                            _call_validated, _persist_outcomes,
                                            _prefix_claims, _quarantine,
                                            _rollback_job_outcomes, _select_judge,
                                            _select_researchers, enforce_floors, fill,
                                            load_prompt, validate_proposal)
from scripturegraph.context import Ctx
from scripturegraph.graphops import chapter_display
from scripturegraph.util import json_write, new_id, now_iso, read_text, truncate
from scripturegraph.validation import validate_changed
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.patch import PatchViolation, apply_ops

SUBJECT_TYPES = ("question", "person", "place", "topic")

# the sections the researchers may write, per subject; every other section on
# the page is rendered deterministically (mentions, scriptural-foundation, the
# conference list on topics, the timeline)
PROSE: dict[str, tuple[str, ...]] = {
    "person": ("overview", "scripture-profile", "conference", "related"),
    "place": ("overview", "scripture-profile", "geography", "related"),
    "topic": ("definition", "doctrinal-summary", "history", "evidence", "questions",
              "objections", "scholarship", "study-pathways", "synthesis"),
    "question": ("concise-answer", "strongest-evidence", "objections", "responses",
                 "frameworks", "assessment", "further-study", "related"),
}
ALL_PROSE = tuple(sorted({s for v in PROSE.values() for s in v}))

SECTION_GUIDE = {
    "overview": "who or what this is, in a paragraph a serious student would trust",
    "scripture-profile": "what the canon itself shows — role, arc, turning points, "
                         "character — anchored in verse references",
    "conference": "how prophets and apostles have taught this subject; ONLY talks "
                  "named in the context, and omit the section if there are none",
    "related": "the handful of people, places, topics and chapters to read next, "
               "and why — wiki-links to vocabulary titles only",
    "geography": "identification and location: what is known, what is proposed, "
                 "what is disputed",
    "definition": "what the term means in scripture and in the tradition",
    "doctrinal-summary": "the doctrine as the canon teaches it, official statements "
                         "kept distinct from interpretation",
    "history": "how understanding of this developed across dispensations and eras",
    "evidence": "the evidence and study findings the reading surfaced, graded honestly",
    "questions": "the significant open questions a thoughtful student meets here",
    "objections": "the strongest real objections and alternative views, at full "
                  "strength — hiding them is falsification by omission",
    "scholarship": "what believing and non-believing scholarship says, and where "
                   "they part",
    "study-pathways": "how to study this subject through the canon, in order",
    "synthesis": "the whole picture on one honest page",
    "concise-answer": "the answer in one paragraph, honest about what is settled "
                      "and what is not",
    "strongest-evidence": "the strongest supporting points, each one checkable",
    "responses": "how thoughtful believers answer the objections, without overreach",
    "frameworks": "the discovery step (standard §18): what the text itself requires as "
                  "distinct from what readers assumed; EVERY serious model the text "
                  "permits, in both directions, each labelled possible / plausible / "
                  "independently supported / ad hoc with what supports it; and what was "
                  "considered and set aside, with the reason",
    "assessment": "what is established, what is open, and what is a matter of faith",
    "further-study": "where to read next: chapters, topics, primary sources",
}


# `## Heading` a question section gets when the page never had it (the
# seed scaffolds predate some sections); the marker name is the key
QUESTION_HEADINGS = {
    "concise-answer": "Concise answer", "strongest-evidence": "Strongest supporting points",
    "objections": "Strongest objections", "responses": "Responses",
    "frameworks": "Frameworks — how this can fit, and how it cannot",
    "assessment": "Honest assessment", "related": "Related", "further-study": "Further study",
}


# ------------------------------------------------------------------- the gate

def research_progress(ctx: Ctx) -> dict:
    """How far the reading has come, and whether dossiers may start.

    `read-once` (default): every chapter has landed at least one research
    job — the canon has been read. `current`: every chapter's research is
    current at this corpus version, which re-closes the gate on every
    corpus bump (new talks, new documents) and would keep dossiers waiting
    on a moving target; opt in only if that is what you want."""
    db = ctx.db()
    total = db.execute("SELECT COUNT(*) AS n FROM chapters").fetchone()["n"]
    gate = str(ctx.c("dossier.gate", "read-once"))
    if gate == "current":
        done = db.execute(
            "SELECT COUNT(*) AS n FROM passes WHERE name='research' AND corpus_version>=?",
            (ctx.corpus_version(),)).fetchone()["n"]
    else:
        done = db.execute(
            "SELECT COUNT(DISTINCT target) AS n FROM passes WHERE name='research'"
        ).fetchone()["n"]
    return {"done": done, "total": total, "gate": gate,
            "complete": total > 0 and done >= total}


def pending_subjects(ctx: Ctx, ignore_gate: bool = False) -> list[str]:
    """Subjects still owed a dossier, most-connected first.

    Nothing until the canon is read (the gate above). Then every subject of
    the configured types that has no dossier yet; a dossier is redone only
    when the corpus has grown since AND it is older than `refresh_days` —
    not on every corpus bump, because a subject dossier is the most expensive
    page the engine writes. Hard questions go first (there are few and they
    are the point); everything else in order of how much the graph already
    knows about it — Jesus Christ, Moses and Jerusalem before Akish."""
    if not ignore_gate and ctx.c("dossier.after_research", True) \
            and not research_progress(ctx)["complete"]:
        return []
    types = [t for t in ctx.c("dossier.types", list(SUBJECT_TYPES)) if t in SUBJECT_TYPES]
    if not types:
        return []
    refresh_days = int(ctx.c("dossier.refresh_days", 90))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=refresh_days)) \
        .strftime("%Y-%m-%dT%H:%M:%SZ")
    marks = ",".join("?" * len(types))
    # a dossier written EARLY (before the canon was read — mode 'ai-early')
    # is owed a second pass once the reading is complete
    rows = ctx.db().execute(
        f"SELECT n.id, n.node_type FROM nodes n "
        f"LEFT JOIN passes p ON p.name='dossier' AND p.target=n.id "
        f"WHERE n.node_type IN ({marks}) AND n.vault_path IS NOT NULL "
        f"AND (p.target IS NULL OR p.mode='ai-early' "
        f"     OR (p.corpus_version < ? AND p.completed_at < ?)) "
        f"ORDER BY (SELECT COALESCE(SUM(COALESCE(e.weight, 1)), 0) FROM edges e "
        f" WHERE (e.dst = n.id OR e.src = n.id) "
        f" AND e.status IN ('accepted','tentative')) DESC, n.title",
        (*types, ctx.corpus_version(), cutoff)).fetchall()
    # the owner's order: the people and places a hard question NAMES come
    # first (a question page that mentions Helen Mar Kimball without a page on
    # her is a page with a hole in it), then the questions, then the rest by
    # how much the graph knows
    cited = question_cited_subjects(ctx)
    first = [r["id"] for r in rows if r["id"] in cited]
    questions = [r["id"] for r in rows if r["node_type"] == "question"]
    rest = [r["id"] for r in rows if r["id"] not in cited and r["node_type"] != "question"]
    return first + questions + rest


def question_cited_subjects(ctx: Ctx) -> set[str]:
    """Person/place/topic/event node ids wiki-linked from any question page."""
    from scripturegraph.graphops import resolve_name
    db = ctx.db()
    out: set[str] = set()
    for r in db.execute("SELECT vault_path FROM nodes WHERE node_type='question' AND vault_path IS NOT NULL"):
        p = ctx.vault / r["vault_path"]
        if not p.exists():
            continue
        _, body = mdkit.parse_note(read_text(p))
        for m in re.findall(r"\[\[([^\]|#]+)", body):
            for n in resolve_name(ctx, " ".join(m.split()))[:1]:
                if n["node_type"] in ("person", "place", "topic", "event"):
                    out.add(n["id"])
    return out


def resolve_subject(ctx: Ctx, ref: str) -> str | None:
    """A node id, an exact title, or an alias → node id (dossier types only)."""
    db = ctx.db()
    marks = ",".join("?" * len(SUBJECT_TYPES))
    row = db.execute(f"SELECT id FROM nodes WHERE id=? AND node_type IN ({marks})",
                     (ref, *SUBJECT_TYPES)).fetchone()
    if row:
        return row["id"]
    row = db.execute(f"SELECT id FROM nodes WHERE title=? AND node_type IN ({marks})",
                     (ref, *SUBJECT_TYPES)).fetchone()
    if row:
        return row["id"]
    row = db.execute(
        f"SELECT n.id FROM aliases a JOIN nodes n ON n.id=a.node_id "
        f"WHERE a.alias=? AND n.node_type IN ({marks})", (ref, *SUBJECT_TYPES)).fetchone()
    return row["id"] if row else None


# ---------------------------------------------------------------- the context

def _name_pattern(kind: str, title: str, aliases: list[str], meta: dict) -> re.Pattern:
    """Word-bounded matcher for the subject's names. People and places match
    case-sensitively (Abel is not a label; Cana is not Canaan); topics add
    their seed keywords and match loosely."""
    names = {title, *aliases}
    # "Nephi (son of Lehi)" is also just "Nephi" in the text
    names |= {re.sub(r"\s*\(.*\)\s*$", "", n).strip() for n in list(names)}
    if kind == "topic":
        names |= {str(k) for k in (meta.get("keywords") or [])}
    keys = sorted((k for k in names if k), key=len, reverse=True)
    flags = re.I if kind == "topic" else 0
    return re.compile(r"\b(" + "|".join(re.escape(k) for k in keys) + r")\b", flags)


def _label(ctx: Ctx, node_id: str) -> str:
    if node_id.startswith("chapter:"):
        try:
            return chapter_display(node_id.split(":", 1)[1])
        except KeyError:
            return node_id
    row = ctx.db().execute("SELECT title FROM nodes WHERE id=?", (node_id,)).fetchone()
    return row["title"] if row else node_id


def build_subject_context(ctx: Ctx, node_id: str) -> dict:
    """Everything the graph knows about one subject, for the researchers:
    the chapters that carry it, the verses that name it, the judged findings
    of the chapter research that touch it, the talks that discuss it, its
    timeline moments, and the prose already on its page."""
    db = ctx.db()
    node = db.execute("SELECT * FROM nodes WHERE id=?", (node_id,)).fetchone()
    if node is None or node["node_type"] not in SUBJECT_TYPES:
        raise ValueError(f"not a dossier subject: {node_id}")
    kind, title = node["node_type"], node["title"]
    aliases = [r["alias"] for r in db.execute(
        "SELECT alias FROM aliases WHERE node_id=? ORDER BY alias", (node_id,))
        if r["alias"] != title]
    meta = json.loads(node["meta_json"] or "{}")
    rx = _name_pattern(kind, title, aliases, meta) if kind != "question" else None

    # ---- the chapters that carry the subject ----
    chapters: list[dict] = []
    rel = {"person": "mentions", "place": "mentions", "topic": "discusses"}.get(kind)
    if rel:
        rows = db.execute(
            "SELECT e.src, e.status, e.weight FROM edges e WHERE e.dst=? AND e.rel=? "
            "AND e.src LIKE 'chapter:%' AND e.status IN ('accepted','tentative') "
            "ORDER BY CASE e.status WHEN 'accepted' THEN 0 ELSE 1 END, e.weight DESC "
            "LIMIT 60", (node_id, rel)).fetchall()
    else:
        # a question is tied to chapters by whatever relation the graph gave it
        rows = db.execute(
            "SELECT CASE WHEN src=? THEN dst ELSE src END AS src, status, weight FROM edges "
            "WHERE (src=? OR dst=?) AND status IN ('accepted','tentative') "
            "AND (src LIKE 'chapter:%' OR dst LIKE 'chapter:%') "
            "ORDER BY weight DESC LIMIT 60", (node_id, node_id, node_id)).fetchall()
    for r in rows:
        if not str(r["src"]).startswith("chapter:"):
            continue
        slug = r["src"].split(":", 1)[1]
        try:
            ch_title = chapter_display(slug)
        except KeyError:
            continue   # a slug the books table does not know must not sink the job
        chapters.append({"slug": slug, "title": ch_title,
                         "weight": int(r["weight"] or 0), "status": r["status"]})

    # ---- the verses that name it (top chapters only; the canon is 42k verses) ----
    verses: list[dict] = []
    if rx is not None:
        per_ch = int(ctx.c("dossier.verses_per_chapter", 4))
        cap = int(ctx.c("dossier.verse_cap", 60))
        for ch in chapters[:15]:
            if len(verses) >= cap:
                break
            n = 0
            for v in db.execute(
                    "SELECT slug, verse, text FROM verses WHERE chapter_slug=? ORDER BY verse",
                    (ch["slug"],)):
                if rx.search(v["text"]):
                    verses.append({"ref": f"{ch['title']}:{v['verse']}", "slug": v["slug"],
                                   "text": truncate(v["text"], 320)})
                    n += 1
                    if n >= per_ch or len(verses) >= cap:
                        break

    # ---- what the reading found: judged claims that touch the subject ----
    findings: list[dict] = []
    cap_f = int(ctx.c("dossier.findings_cap", 40))
    tier_order = "CASE c.tier WHEN 'ACCEPT' THEN 0 WHEN 'TENTATIVE' THEN 1 ELSE 2 END"
    if rx is not None:
        keys = [title, *aliases][:6]
        where = " OR ".join("c.text LIKE ?" for _ in keys)
        rows = db.execute(
            f"SELECT c.node_id, c.text, c.tier, c.claim_type FROM claims c "
            f"WHERE c.tier IN ('ACCEPT','ACCEPT_LOW_VISIBILITY','TENTATIVE') AND ({where}) "
            f"ORDER BY {tier_order}, c.updated_at DESC LIMIT ?",
            (*[f"%{k}%" for k in keys], cap_f * 3)).fetchall()
        rows = [r for r in rows if rx.search(r["text"])][:cap_f]   # LIKE has no word edges
    else:
        linked = [f"chapter:{c['slug']}" for c in chapters] + [
            r["o"] for r in db.execute(
                "SELECT CASE WHEN src=? THEN dst ELSE src END AS o FROM edges "
                "WHERE (src=? OR dst=?) AND status IN ('accepted','tentative') LIMIT 40",
                (node_id, node_id, node_id))]
        rows = []
        if linked:
            marks = ",".join("?" * len(linked))
            rows = db.execute(
                f"SELECT c.node_id, c.text, c.tier, c.claim_type FROM claims c "
                f"WHERE c.node_id IN ({marks}) AND c.tier IN ('ACCEPT','TENTATIVE') "
                f"ORDER BY {tier_order} LIMIT ?", (*linked, cap_f)).fetchall()
    for r in rows:
        findings.append({"where": _label(ctx, r["node_id"]), "type": r["claim_type"],
                         "tier": r["tier"], "text": truncate(r["text"], 600)})

    # ---- talks that discuss it, moments on the timeline ----
    talks = [r["title"] for r in db.execute(
        "SELECT DISTINCT n.title FROM edges e JOIN nodes n ON n.id=e.src "
        "WHERE e.dst=? AND e.src LIKE 'talk:%' AND e.status IN ('accepted','tentative') "
        "ORDER BY e.weight DESC LIMIT 12", (node_id,))]
    moments: list[dict] = []
    try:
        from scripturegraph.timeline import _resolve_subject, merged_events
        for e in merged_events(ctx):
            names = [n for k in ("people", "places", "things") for n in e.get(k, [])]
            if any(_resolve_subject(db, n) == node_id for n in names):
                moments.append({"y0": e["y0"], "y1": e["y1"], "title": e["t"],
                                "dating": e.get("dating", "")})
        moments = sorted(moments, key=lambda m: (m["y0"], m["title"]))[:12]
    except Exception:  # noqa: BLE001 — the timeline is context, never a blocker
        moments = []

    # ---- the page as it stands ----
    sections: dict[str, str] = {}
    body = ""
    path = ctx.vault / node["vault_path"]
    if path.exists():
        _, body = mdkit.parse_note(read_text(path))
        sections = {k: v for k, v in mdkit.list_sections(body).items()
                    if not mdkit.section_is_empty(v)}
    vocab = [r["title"] for r in db.execute(
        "SELECT title FROM nodes WHERE node_type IN ('topic','person','place','event','question') "
        "ORDER BY node_type, title")]
    out = {"node_id": node_id, "kind": kind, "title": title, "aliases": aliases,
           "meta": {k: v for k, v in meta.items() if k in ("era", "region", "keywords")},
           "vault_path": node["vault_path"], "chapters": chapters, "verses": verses,
           "findings": findings, "talks": talks, "moments": moments,
           "existing_sections": sections, "prose_sections": list(PROSE[kind]),
           "vocabulary": vocab, "topic_titles": vocab,
           "corpus_version": ctx.corpus_version()}
    if kind == "question":
        # a question has no edges of its own — its research lives on the
        # pages it links to, in the calibrated evidence registry, and in the
        # library. Gather all three, or the dossier is written from memory.
        if path.exists():
            fm_q, _ = mdkit.parse_note(read_text(path))
            meta = {**meta, "scope": fm_q.get("scope") or meta.get("scope")}
        q = _question_context(ctx, title, body, meta)
        out.update(q)
        out["chapters"] = q["chapters"] or chapters
        out["findings"] = (q["findings"] + findings)[:60]
        out["vocabulary"] = sorted(set(vocab) | set(q["extra_vocab"]))
        out["topic_titles"] = out["vocabulary"]
    else:
        # deep scholarship on a person or place means the library too — the
        # Joseph Smith Papers printings, History of the Church, Times and
        # Seasons, talks — not only the chapters that name them
        names = [title] + aliases[:3]
        out["library"] = _library(ctx, [n for n in names if len(n) > 2], k=int(ctx.c("dossier.library_passages", 14)))
        out["vocabulary"] = sorted(set(vocab) | {x["title"] for x in out["library"] if x.get("title")})
        out["topic_titles"] = out["vocabulary"]
    return out


def _library(ctx: Ctx, terms: list[str], k: int = 14, any_terms: bool = False) -> list[dict]:
    """Passages from the library's documents (essays, talks, histories,
    periodicals) that match the terms, each with the vault page it lives on.
    `any_terms` ORs the terms (the frameworks search casts wide)."""
    library: list[dict] = []
    if not terms:
        return library
    try:
        from scripturegraph.ask import _passage_label
        from scripturegraph.indexing.semantic import fts_search
        # exact phrases for multi-word names, so "John C. Bennett" is not "John"
        quoted = [f'"{t}"' if " " in t else t for t in terms]
        query = (" OR ".join(quoted) if any_terms else " ".join(quoted))
        seen = set()
        for d in fts_search(ctx, query, k=k * 3, owner_types=("document",)):
            if d["owner_id"] in seen:
                continue
            seen.add(d["owner_id"])
            library.append({"label": _passage_label(ctx, d["owner_type"], d["owner_id"]),
                            "kind": d["owner_type"],
                            "text": truncate((d.get("text") or "").replace("\n", " "), 520),
                            "title": _doc_note_title(ctx, d["owner_type"], d["owner_id"])})
            if len(library) >= k:
                break
    except Exception as e:  # noqa: BLE001 — retrieval is context, never a blocker
        ctx.log.warn("dossier.retrieve_failed", error=str(e)[:200])
    return library


_STOP = set("a an the of in on to for and or is are was were do does did how why what when "
            "which who whom whose can could should would there their its it be been being "
            "from with by as at into than then that this these those not no about really "
            "actually evidence question questions did does".split())
# words that name the whole corpus rather than this question
_GENERIC = set("book mormon bible biblical scripture scriptures church ancient record records "
               "historical history text texts testament saints latter-day gospel christian "
               "christians christianity people".split())


def _question_context(ctx: Ctx, title: str, body: str, meta: dict) -> dict:
    """Research for a hard question: (1) the pages the question links to and
    the chapters/claims behind them, (2) calibrated evidence-registry issues
    and evidence notes that match the question's keywords, (3) passages from
    the library — essays, talks, histories, verses — by full-text and
    semantic retrieval. Everything comes back with a title the writer may
    wiki-link, so the page can cross-reference instead of gesturing."""
    from scripturegraph.booksdata import chapter_slug, find_chapter_by_title
    from scripturegraph.graphops import resolve_name
    db = ctx.db()
    # distinctive terms only: acronyms count (DNA), corpus-generic words do
    # not — "book", "mormon", "bible" match every page in the vault
    raw = [w.strip("?.,;:'\"()") for w in re.split(r"\s+", title)]
    keywords = [w.lower() for w in raw
                if (len(w) >= 3 and w.isupper()) or (len(w) > 3 and w.lower() not in _STOP)]
    keywords = [k for k in keywords if k not in _GENERIC]
    keywords += [str(k).lower() for k in (meta.get("keywords") or [])]
    # ---- 1. related pages → nodes and chapters ----
    related_nodes: list[dict] = []
    chapter_slugs: list[str] = []
    seen = set()
    for m in re.findall(r"\[\[([^\]|#]+)", body):
        name = " ".join(m.split())
        if name in seen:
            continue
        seen.add(name)
        found = find_chapter_by_title(name)
        if found:
            chapter_slugs.append(chapter_slug(found[0], found[1]))
            continue
        for n in resolve_name(ctx, name)[:1]:
            if n["node_type"] in ("topic", "person", "place", "event", "evidence", "question"):
                related_nodes.append({"id": n["id"], "title": n["title"], "kind": n["node_type"]})
    for n in related_nodes[:12]:
        rel = "discusses" if n["kind"] == "topic" else "mentions"
        for r in db.execute(
                "SELECT src, weight FROM edges WHERE dst=? AND rel=? AND src LIKE 'chapter:%' "
                "AND status IN ('accepted','tentative') ORDER BY weight DESC LIMIT 6",
                (n["id"], rel)):
            chapter_slugs.append(r["src"].split(":", 1)[1])
    chapters, cs = [], set()
    for slug in chapter_slugs:
        if slug in cs:
            continue
        cs.add(slug)
        try:
            chapters.append({"slug": slug, "title": chapter_display(slug), "weight": 0,
                             "status": "accepted"})
        except KeyError:
            continue
        if len(chapters) >= 30:
            break
    # ---- 2. what the reading found on those chapters, and by keyword ----
    findings: list[dict] = []
    tier_order = "CASE c.tier WHEN 'ACCEPT' THEN 0 WHEN 'TENTATIVE' THEN 1 ELSE 2 END"
    if chapters:
        ids = [f"chapter:{c['slug']}" for c in chapters]
        marks = ",".join("?" * len(ids))
        for r in db.execute(
                f"SELECT c.node_id, c.text, c.tier, c.claim_type FROM claims c "
                f"WHERE c.node_id IN ({marks}) AND c.tier IN ('ACCEPT','TENTATIVE') "
                f"AND c.claim_type IN ('evidence','connection','interpretation') "
                f"ORDER BY {tier_order} LIMIT 30", ids):
            findings.append({"where": _label(ctx, r["node_id"]), "type": r["claim_type"],
                             "tier": r["tier"], "text": truncate(r["text"], 500)})
    kw = keywords[:8]
    if kw:
        where = " OR ".join("c.text LIKE ?" for _ in kw)
        for r in db.execute(
                f"SELECT c.node_id, c.text, c.tier, c.claim_type FROM claims c "
                f"WHERE c.tier IN ('ACCEPT','TENTATIVE') AND ({where}) ORDER BY {tier_order} LIMIT 25",
                [f"%{k}%" for k in kw]):
            findings.append({"where": _label(ctx, r["node_id"]), "type": r["claim_type"],
                             "tier": r["tier"], "text": truncate(r["text"], 500)})
    # ---- calibrated evidence: registry issues + evidence notes ----
    registry, ev_notes, frameworks = [], [], []
    if kw:
        where = " OR ".join("(title LIKE ? OR assessment LIKE ? OR proposition LIKE ?)" for _ in kw)
        params = [x for k in kw for x in (f"%{k}%", f"%{k}%", f"%{k}%")]
        for r in db.execute(
                f"SELECT issue_key, title, weight_label, evidence_strength, direction, assessment, "
                f"notes_json FROM issues WHERE {where} LIMIT 15", params):
            registry.append({"key": r["issue_key"], "title": r["title"], "weight": r["weight_label"],
                             "strength": r["evidence_strength"], "direction": r["direction"],
                             "assessment": r["assessment"],
                             "notes": json.loads(r["notes_json"] or "[]")[:6]})
        where = " OR ".join("title LIKE ?" for _ in kw)
        for r in db.execute(
                f"SELECT title, vault_path FROM nodes WHERE node_type='evidence' AND ({where}) "
                f"LIMIT 15", [f"%{k}%" for k in kw]):
            fm, nbody = {}, ""
            p = ctx.vault / (r["vault_path"] or "")
            if r["vault_path"] and p.exists():
                fm, nbody = mdkit.parse_note(read_text(p))
            ev_notes.append({"title": r["title"], "kind": fm.get("note_kind", ""),
                             "weight": fm.get("weight_label", ""), "issue": fm.get("issue", "")})
            # the frameworks a calibrated assessment already worked out: the
            # models table and the labelled alternatives, so the question
            # page starts from the vault's discovery rather than from memory
            if str(fm.get("note_kind") or "").startswith("contest") and nbody:
                secs = mdkit.list_sections(nbody)
                text = "\n".join(t for t in (secs.get("models"), secs.get("alternatives")) if t)
                if text and not mdkit.section_is_empty(text):
                    frameworks.append({"title": r["title"], "text": truncate(text, 1400)})
    # ---- 3. the library ----
    library: list[dict] = []
    if kw:
        try:
            # documents (essays, talks, histories) on the distinctive terms
            # only — the chapters above already cover the verses
            from scripturegraph.ask import _passage_label
            from scripturegraph.indexing.semantic import fts_search
            k = int(ctx.c("dossier.library_passages", 14))
            seen_docs = set()
            for d in fts_search(ctx, " ".join(kw), k=k * 3, owner_types=("document",)):
                if d["owner_id"] in seen_docs:
                    continue
                seen_docs.add(d["owner_id"])
                library.append({"label": _passage_label(ctx, d["owner_type"], d["owner_id"]),
                                "kind": d["owner_type"],
                                "text": truncate((d.get("text") or "").replace("\n", " "), 520),
                                "title": _doc_note_title(ctx, d["owner_type"], d["owner_id"])})
                if len(library) >= k:
                    break
        except Exception as e:  # noqa: BLE001 — retrieval is context, never a blocker
            ctx.log.warn("dossier.retrieve_failed", error=str(e)[:200])
    # ---- 4. the frameworks search (standard §18): scholarship that PROPOSES
    # models — geographies, source theories, reconciliations, critical
    # reconstructions — searched with the question's terms plus the words
    # such proposals use, in both directions ----
    proposals = _library(ctx, kw[:5] + ["model", "theory", "hypothesis", "proposal", "framework"],
                         k=int(ctx.c("dossier.framework_passages", 8)), any_terms=True) if kw else []
    seen_labels = {x["label"] for x in library}
    proposals = [x for x in proposals if x["label"] not in seen_labels]
    # ---- 5. the corpus-level cumulative assessment, when the question sits
    # in a corpus that has one: required reading, so no finding is dismissed
    # one at a time against the whole picture ----
    cumulative = _cumulative_reading(ctx, meta, keywords)
    extra_vocab = [n["title"] for n in related_nodes] + [e["title"] for e in ev_notes] + \
                  [x["title"] for x in library + proposals if x.get("title")]
    if cumulative:
        extra_vocab.append(cumulative["title"])
    return {"keywords": kw, "related_nodes": related_nodes, "chapters": chapters,
            "findings": findings, "registry_hits": registry, "evidence_notes": ev_notes,
            "frameworks": frameworks, "framework_sources": proposals, "cumulative": cumulative,
            "library": library, "extra_vocab": extra_vocab}


def _cumulative_reading(ctx: Ctx, meta: dict, keywords: list[str]) -> dict | None:
    """The corpus assessment page a question must be written against.

    The question's `scope` (frontmatter: book-of-mormon / restoration /
    christianity) picks the corpus; the Restoration and Bible pages are
    used the same way once they exist, so the treatment stays symmetric."""
    from scripturegraph.agents.cumulative import CORPUS_BY_SCOPE, page_path, page_title
    scope = str(meta.get("scope") or "")
    corpus = CORPUS_BY_SCOPE.get(scope)
    if not corpus:
        return None
    p = ctx.vault / page_path(corpus)
    if not p.exists():
        return None
    _, body = mdkit.parse_note(read_text(p))
    secs = {k: v for k, v in mdkit.list_sections(body).items() if not mdkit.section_is_empty(v)}
    if not secs:
        return None
    return {"title": page_title(corpus), "corpus": corpus,
            "sections": {k: truncate(v, 2200) for k, v in secs.items() if k != "registry"}}


def _doc_note_title(ctx: Ctx, owner_type: str, owner_id: str) -> str | None:
    """The vault page a retrieved passage lives on, if it has one — talks and
    documents are nodes with a vault_path; verses belong to a chapter page."""
    if owner_type == "verse":
        try:
            return chapter_display(owner_id.rsplit("-", 1)[0])
        except (KeyError, ValueError):
            return None
    if owner_type == "document":
        row = ctx.db().execute(
            "SELECT title, vault_path FROM nodes WHERE vault_path IS NOT NULL AND "
            "(id=? OR id=? OR id=?) LIMIT 1",
            (f"talk:{owner_id}", f"doc:{owner_id}", f"document:{owner_id}")).fetchone()
        if row is None:
            row = ctx.db().execute(
                "SELECT n.title, n.vault_path FROM documents d JOIN nodes n ON n.title=d.title "
                "WHERE d.doc_id=? AND n.vault_path IS NOT NULL LIMIT 1", (owner_id,)).fetchone()
        if row and row["vault_path"]:
            return Path(row["vault_path"]).stem
    return None


def _year(y: int) -> str:
    return f"{-y} BC" if y < 0 else f"AD {y}"


def subject_context_markdown(c: dict) -> str:
    kind, title = c["kind"], c["title"]
    head = f"### {kind.title()}: {title}"
    if c["aliases"]:
        head += "  (also: " + ", ".join(c["aliases"]) + ")"
    lines = [head]
    for k, v in c["meta"].items():
        lines.append(f"{k}: {v if not isinstance(v, list) else ', '.join(map(str, v))}")
    if c["chapters"]:
        lines += ["", "#### In the canon (verified index data — chapters that carry the subject)"]
        for ch in c["chapters"][:40]:
            tag = "" if ch["status"] == "accepted" else " (ambiguous name match)"
            w = f" — {ch['weight']} mention{'s' if ch['weight'] != 1 else ''}" if ch["weight"] else ""
            lines.append(f"- {ch['title']}{w}{tag}")
    if c["verses"]:
        lines += ["", "#### Verses that name the subject (canonical; cite as e.g. "
                      f"\"{c['verses'][0]['ref']}\")"]
        for v in c["verses"]:
            lines.append(f"- {v['ref']}: {v['text']}")
    if c["findings"]:
        lines += ["", "#### What the chapter-by-chapter reading found (judged claims; "
                      "ACCEPT = verified and accepted, TENTATIVE = plausible, unproven)"]
        for f in c["findings"]:
            lines.append(f"- [{f['tier']} · {f['type']} · {f['where']}] {f['text']}")
    if c["talks"]:
        lines += ["", "#### Talks and addresses the index ties to the subject"]
        lines += [f"- {t}" for t in c["talks"]]
    if c["moments"]:
        lines += ["", "#### On the timeline"]
        for m in c["moments"]:
            span = _year(m["y0"]) if m["y0"] == m["y1"] else f"{_year(m['y0'])}–{_year(m['y1'])}"
            lines.append(f"- {span}: {m['title']} ({m['dating']})")
    if c.get("related_nodes"):
        lines += ["", "#### Pages this question links to (wiki-link them by these exact titles)"]
        lines += [f"- [[{n['title']}]] ({n['kind']})" for n in c["related_nodes"]]
    if c.get("registry_hits"):
        lines += ["", "#### Calibrated evidence on this question — the registry's stable verdicts "
                      "(REUSE these weights; link the evidence notes)"]
        for r in c["registry_hits"]:
            lines.append(f"- **{r['title']}** — {r['weight']} ({r['direction']}, {r['strength']}): "
                         f"{r['assessment']}" + (f"  Notes: " + ", ".join(f"[[{t}]]" for t in r["notes"])
                                                 if r["notes"] else ""))
    if c.get("evidence_notes"):
        lines += ["", "#### Evidence notes that bear on it (link by exact title)"]
        lines += [f"- [[{e['title']}]]" + (f" — {e['kind']}" if e["kind"] else "")
                  + (f", {e['weight']}" if e["weight"] else "") for e in c["evidence_notes"]]
    if c.get("library"):
        lines += ["", "#### From the library — essays, talks, histories, verses (cite by the "
                      "label; wiki-link the page title where one is given)"]
        for x in c["library"]:
            page = f" → [[{x['title']}]]" if x.get("title") else ""
            lines.append(f"- {x['label']}{page}: {x['text']}")
    if c.get("frameworks"):
        lines += ["", "#### Frameworks the vault has already worked out (from calibrated "
                      "assessments — start the `frameworks` section here, then search further)"]
        for f in c["frameworks"]:
            lines.append(f"- From [[{f['title']}]]:\n{f['text']}")
    if c.get("framework_sources"):
        lines += ["", "#### Scholarship proposing frameworks — models, theories, reconstructions, "
                      "in either direction (cite by the label)"]
        for x in c["framework_sources"]:
            page = f" → [[{x['title']}]]" if x.get("title") else ""
            lines.append(f"- {x['label']}{page}: {x['text']}")
    if c.get("cumulative"):
        cu = c["cumulative"]
        lines += ["", f"#### REQUIRED READING — the corpus-level assessment [[{cu['title']}]]",
                  "The findings of this corpus are weighed TOGETHER on that page: independent "
                  "lines, a judged synthesis, and the frameworks the whole picture leaves open. "
                  "Write this question against it. Do not dismiss a finding one at a time as "
                  "coincidence when the page has weighed it as part of a line; do not inflate one "
                  "when the page has not. Link the page from `assessment` or `further-study`."]
        for name, text in cu["sections"].items():
            lines.append(f"[{name}]\n{text}")
    if c["existing_sections"]:
        lines += ["", "#### Existing prose on the page (improve, don't degrade)"]
        for name, text in c["existing_sections"].items():
            lines.append(f"[{name}]\n{truncate(text, 1500)}")
    lines += ["", "#### Sections to write (key → what belongs there)"]
    lines += [f"- `{s}` — {SECTION_GUIDE[s]}" for s in c["prose_sections"]]
    lines += ["", "#### Canonical vocabulary (the ONLY note titles you may wiki-link, "
                  "besides scripture chapter titles like [[Alma 36]])",
              ", ".join(c["vocabulary"])]
    return "\n".join(lines)


# -------------------------------------------------------------------- the job

def _normalizer(kind: str):
    """Deterministic repair of near-miss shapes before schema validation —
    cheaper than a model retry: the familiar `study_sections` key, and
    sections that belong to another subject type, which are dropped rather
    than failing the whole proposal."""
    allowed = set(PROSE[kind])

    def norm(obj):
        if not isinstance(obj, dict):
            return obj
        secs = obj.get("sections")
        if not isinstance(secs, dict):
            secs = obj.get("study_sections") if isinstance(obj.get("study_sections"), dict) else {}
        obj["sections"] = {k: v for k, v in secs.items() if k in allowed and isinstance(v, str)}
        obj.pop("study_sections", None)
        obj.setdefault("claims", [])
        obj.setdefault("candidate_links", [])
        return obj
    return norm


def _librarian_ops(ctx: Ctx, context: dict, proposals: dict, judgment: dict) -> list[dict]:
    kind, relpath = context["kind"], context["vault_path"]
    allowed = PROSE[kind]
    ops: list[dict] = []
    for section, spec in (judgment.get("section_approvals") or {}).items():
        if section not in allowed or not isinstance(spec, dict):
            continue
        use = spec.get("use")
        text = ""
        if use == "a":
            text = proposals["a"].get("sections", {}).get(section, "")
        elif use == "b":
            text = proposals["b"].get("sections", {}).get(section, "")
        elif use == "merged":
            text = spec.get("merged_text", "")
        if text and use != "none":
            # ensure_section: a section the page never had is appended under
            # its heading (the seed scaffolds predate `frameworks`)
            ops.append({"op": "ensure_section", "path": relpath, "section": section,
                        "heading": QUESTION_HEADINGS.get(section, section.replace("-", " ").title()),
                        "content": text.strip()})
    # the mentions ledger is software's, not the model's: every line is an
    # index edge the engine can defend
    if kind in ("person", "place") and context["chapters"]:
        lines = []
        for ch in context["chapters"][:40]:
            if ch["status"] == "accepted":
                w = ch["weight"]
                lines.append(f"- {mdkit.wikilink(ch['title'])} — {w} mention{'s' if w != 1 else ''}")
            else:
                lines.append(f"- {mdkit.wikilink(ch['title'])} *(ambiguous name match)*")
        ops.append({"op": "set_section", "path": relpath, "section": "mentions",
                    "content": "\n".join(lines)})
    ops.append({"op": "set_fm_field", "path": relpath,
                "field": "corpus_version_reviewed", "value": ctx.corpus_version()})
    status_field = {"topic": "topic-status", "question": "status"}.get(kind)
    if status_field:
        ops.append({"op": "set_fm_field", "path": relpath, "field": status_field,
                    "value": "developed"})
    return ops


def run_dossier_job(ctx: Ctx, node_id: str) -> dict:
    db = ctx.db()
    context = build_subject_context(ctx, node_id)   # ValueError for a non-subject
    kind, title, relpath = context["kind"], context["title"], context["vault_path"]
    job_id = new_id(f"dossier-{node_id.split(':', 1)[1]}")
    ws = ctx.jobs_dir / job_id
    for sub in ("source", "critiques", "judge", "librarian", "validation"):
        (ws / sub).mkdir(parents=True, exist_ok=True)
    seq = int(hashlib.sha1(job_id.encode()).hexdigest()[:8], 16)
    researchers, mode = _select_researchers(ctx)
    timeout = int(ctx.c("dossier.job_timeout_sec", 0) or ctx.budget("job_timeout_sec") or 420)
    costs = {"usd": 0.0, "calls": 0}

    def track(stats: dict):
        costs["usd"] += stats.get("cost_usd") or 0.0
        costs["calls"] += stats.get("calls", 0)

    def set_status(status: str, extra: dict | None = None):
        db.execute(
            "INSERT INTO jobs(job_id,job_type,target,status,workspace,corpus_version,"
            "providers_json,cost_json,result_json,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(job_id) DO UPDATE SET status=excluded.status, "
            "cost_json=excluded.cost_json, result_json=excluded.result_json, "
            "updated_at=excluded.updated_at",
            (job_id, "dossier", node_id, status, str(ws), ctx.corpus_version(),
             json.dumps({"mode": mode, "researchers": [p.name for p in researchers]}),
             json.dumps(costs), json.dumps(extra or {}), now_iso(), now_iso()))
        db.commit()

    set_status("created")
    context["job_id"] = job_id
    context["chapter_slug"] = node_id   # usage telemetry's "target" column
    ctx_md = subject_context_markdown(context)
    json_write(ws / "source" / "context.json", context)
    (ws / "source" / "context.md").write_text(ctx_md, encoding="utf-8")
    json_write(ws / "manifest.json", {
        "job_id": job_id, "target": node_id, "kind": kind, "mode": mode,
        "researchers": [p.name for p in researchers],
        "corpus_version": ctx.corpus_version(), "created_at": now_iso()})

    constitution, _ = load_prompt(ctx, "_constitution_core")
    res_tpl, res_ver = load_prompt(ctx, "dossier_researcher")
    skeptic_tpl, skeptic_ver = load_prompt(ctx, "dossier_skeptic")
    judge_tpl, judge_ver = load_prompt(ctx, "dossier_judge")
    schema_txt = json.dumps(schemas.load_schema("dossier_proposal"), indent=1)
    sections_txt = "\n".join(f"- `{s}` — {SECTION_GUIDE[s]}" for s in PROSE[kind])
    subject = f"{kind}: {title}"
    emphases = [
        "Build the STRONGEST well-supported portrait of this subject — what the canon "
        "and the reading genuinely establish, connections a student would thank you "
        "for — while obeying every epistemic rule above.",
        "Be maximally CAREFUL and skeptical-minded: prefer fewer, bulletproof "
        "statements; actively flag conflations (same name, different person), "
        "later tradition presented as text, and overreads.",
    ]
    if ctx.c("pipeline.role_rotation", True) and seq % 2 == 1:
        emphases.reverse()
    norm = _normalizer(kind)

    # ---- researchers (independent, parallel) ----
    set_status("research")
    labels = ["a", "b"]
    proposals: dict[str, dict | None] = {}
    transport_down = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futs = {}
        for i, (prov, emphasis) in enumerate(zip(researchers, emphases)):
            sub = ws / labels[i]
            sub.mkdir(exist_ok=True)
            prompt = fill(res_tpl, CONSTITUTION=constitution, EMPHASIS=emphasis,
                          SCHEMA=schema_txt, CONTEXT=ctx_md, SECTIONS=sections_txt,
                          SUBJECT=subject)
            futs[pool.submit(_call_validated, ctx, prov, "researcher", prompt,
                             "dossier_proposal", timeout, sub, context, norm)] = labels[i]
        for fut, label in futs.items():
            obj, stats = fut.result()
            track(stats)
            if stats.get("transport_failed"):
                transport_down += 1
            proposals[label] = obj
            if obj is not None:
                json_write(ws / label / "proposal.json", obj)

    if proposals.get("a") is None and proposals.get("b") is None:
        if transport_down:
            set_status("provider_unavailable", {"reason": "provider unreachable"})
            raise ProviderUnavailable(f"{job_id}: provider unreachable during research")
        set_status("quarantined", {"reason": "no researcher produced valid output"})
        _quarantine(ctx, ws, job_id)
        raise JobQuarantined(f"{job_id}: no valid researcher output")
    for label in labels:
        if proposals[label] is None:
            proposals[label] = {"claims": [], "candidate_links": [], "sections": {}}

    # ---- cross critique ----
    set_status("critique")
    critique_schema_txt = json.dumps(schemas.load_schema("critique"), indent=1)
    critiques: dict[str, dict] = {}
    for label, other_idx in (("a", 1), ("b", 0)):
        critic = researchers[other_idx]
        prompt = fill(skeptic_tpl, CONSTITUTION=constitution, SCHEMA=critique_schema_txt,
                      CONTEXT=ctx_md, SUBJECT=subject,
                      PROPOSAL=json.dumps(proposals[label], ensure_ascii=False, indent=1))
        crit_ctx = {**context, "proposal": proposals[label]}
        obj, stats = _call_validated(ctx, critic, "critic", prompt, "critique",
                                     timeout, ws / "critiques", crit_ctx)
        track(stats)
        critiques[label] = obj or {"assessments": [], "overall": "critique unavailable"}
        json_write(ws / "critiques" / f"critique_of_{label}.json", critiques[label])

    # ---- deterministic validation (every ref and quote against the canon) ----
    validation = {}
    for label in labels:
        v = validate_proposal(ctx, proposals[label], node_id)
        for cid, res in v.items():
            validation[f"{label.upper()}:{cid}"] = res
    json_write(ws / "validation" / "results.json", validation)

    # ---- judge ----
    set_status("judge")
    judge_provider = _select_judge(ctx, researchers, seq)
    judgment_schema_txt = json.dumps(schemas.load_schema("dossier_judgment"), indent=1)
    pa = _prefix_claims(proposals["a"], "A")
    pb = _prefix_claims(proposals["b"], "B")
    prompt = fill(judge_tpl, CONSTITUTION=constitution, SCHEMA=judgment_schema_txt,
                  CONTEXT=ctx_md, SUBJECT=subject,
                  PROPOSAL_A=json.dumps(pa, ensure_ascii=False, indent=1),
                  CRITIQUE_A=json.dumps(critiques["a"], ensure_ascii=False, indent=1),
                  PROPOSAL_B=json.dumps(pb, ensure_ascii=False, indent=1),
                  CRITIQUE_B=json.dumps(critiques["b"], ensure_ascii=False, indent=1),
                  VALIDATION=json.dumps(validation, indent=1))
    judge_ctx = {**context, "validation": validation}
    judgment, stats = _call_validated(ctx, judge_provider, "judge", prompt,
                                      "dossier_judgment", timeout, ws / "judge", judge_ctx)
    track(stats)
    if judgment is None:
        judgment = {"decisions": [
            {"claim_id": cid, "outcome": "TENTATIVE" if v["refs_ok"] and v["quotes_ok"]
             else "REJECT", "rationale": "deterministic fallback (judge unavailable)"}
            for cid, v in validation.items()],
            "link_decisions": [], "section_approvals": {}}
    judgment["decisions"] = enforce_floors(judgment.get("decisions", []), validation)
    json_write(ws / "judge" / "decision.json", judgment)

    # ---- landing: DB outcomes + vault writes + git transaction (one at a time) ----
    with LANDING:
        persisted = _persist_outcomes(ctx, job_id, node_id, {"a": pa, "b": pb}, judgment,
                                      validation, mode,
                                      {"researcher": res_ver, "skeptic": skeptic_ver,
                                       "judge": judge_ver}, node_id=node_id)
        set_status("librarian")
        ops = _librarian_ops(ctx, context, {"a": proposals["a"], "b": proposals["b"]},
                             judgment)
        json_write(ws / "librarian" / "patch.json", {"ops": ops})
        gitops.checkpoint(ctx, f"before dossier({title})")
        applied = {"changed": [], "created": []}
        try:
            result = apply_ops(ctx, ops, actor=f"librarian:{job_id}")
            applied = {"changed": result.changed_paths, "created": result.created_paths}
            report = validate_changed(ctx, [relpath])
            if report.fatal:
                raise PatchViolation("; ".join(f"{i.check}:{i.path}" for i in report.fatal))
        except Exception as e:  # noqa: BLE001 — ANY failure here rolls back BOTH stores
            gitops.hard_restore(ctx)
            _rollback_job_outcomes(ctx, job_id)
            set_status("failed", {"error": str(e)})
            ctx.log.error("dossier.apply_failed", job=job_id, error=str(e))
            raise RuntimeError(f"{job_id}: apply failed and was rolled back: {e}") from e
        rev = gitops.commit_all(ctx, f"dossier({title}): "
                                     f"{persisted['n_accepted']} accepted, "
                                     f"{persisted['n_tentative']} tentative [{mode}]")
    n_sections = sum(1 for o in ops if o["op"] == "set_section")
    set_status("applied", {"git_rev": rev, **persisted["counts"], "applied": applied,
                           "sections": n_sections})
    ctx.log.info("dossier.applied", job=job_id, target=node_id, kind=kind, mode=mode,
                 sections=n_sections, cost_usd=round(costs["usd"], 4), **persisted["counts"])
    return {"job_id": job_id, "target": node_id, "kind": kind, "mode": mode,
            # a dossier written before the canon is read is owed a second
            # pass; the queue records this mode when it marks the pass
            "pass_mode": "ai" if research_progress(ctx)["complete"] else "ai-early",
            "git_rev": rev, "sections": n_sections, **persisted["counts"],
            "cost_usd": costs["usd"]}
