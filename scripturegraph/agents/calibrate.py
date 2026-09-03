"""Evidence recalibration — the same quality of reasoning for every corpus.

The audit of 2026-09-03 found that the vault's evidence PROSE is mostly
honest and symmetric (every note says what it does not establish; none
uses proof language) but its NUMBERS are not: `evidence_strength` measured
"how sure is the observation" in some notes and "how much does this support
a contested claim" in others; no note named the proposition or the model it
bears on; alternatives were listed but never weighed, so "possible" read as
"equally plausible"; the default alternative differed by corpus
(transmission for the Bible, modern composition for the Book of Mormon); and
the same issue — KJV Isaiah in the Book of Mormon, say — carried weights
from 0.15 to 0.99 across different chapters' research runs.

This job rewrites evidence notes into a layered, model-first form and
scores them against a NAMED proposition, with one canonical assessment per
issue that every note on that issue reuses (the `issues` registry). Two
providers recalibrate independently (Claude and Codex, emphases rotating),
critique each other, and a judge — alternating provider — enforces the
standard in docs/EVIDENCE-STANDARD.md: evidentiary symmetry, calibrated
language, possibility ≠ support, named model and proposition, and registry
consistency. Same isolation and rollback as chapter research.

`apply=False` runs the whole pipeline but lands nothing: the judged result
is written as a review report instead — how the Bible is peer-reviewed
without being touched.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
import re
from pathlib import Path

from scripturegraph import gitops
from scripturegraph.agents import schemas
from scripturegraph.agents.pipeline import (LANDING, JobQuarantined, ProviderUnavailable,
                                            _call_validated, _quarantine, _select_judge,
                                            _select_researchers, fill, load_prompt)
from scripturegraph.context import Ctx
from scripturegraph.graphops import chapter_display
from scripturegraph.util import json_write, new_id, now_iso, read_text, slugify, truncate
from scripturegraph.validation import validate_changed
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import FOLDER_EVIDENCE, record_file
from scripturegraph.vaultgen.patch import PatchViolation, apply_ops

CALIBRATION_VERSION = 2
GROUP_SIZE = 5
CORPORA = ("Book of Mormon", "Bible", "Restoration")
TARGET_PREFIX = "calib:"

# the layered form every calibrated note carries, in order
# The layered form a note carries, in order.
#
# `adjudication` marks the sections that only make sense when a genuinely
# CONTESTED apologetic issue is in play. On an illumination note they are
# omitted entirely rather than filled with "not applicable" -- a mandatory
# "What It Does Not Establish" on an uncontested observation manufactures a
# controversy and closes on a disclaimer, which is how a library of
# individually fair notes ends up saying something false in aggregate.
SECTIONS = [
    ("observation", "Observation", False),
    ("interpretation", "Interpretation", False),
    ("historical-significance", "Historical Significance", False),
    ("how-it-fits", "How This Fits", False),
    ("apologetic-significance", "Apologetic Significance", True),
    ("does-not-establish", "What It Does Not Establish", True),
    ("models", "Models On The Table", True),
    ("alternatives", "Alternative Explanations", True),
    ("symmetry", "Comparative Check", True),
    ("weight", "Evidentiary Weight", True),
]
#: Sections every note carries, whichever kind it is.
CONTEXT_SECTIONS = [(k, t) for k, t, adj in SECTIONS if not adj]
#: ...and the ones reserved for `note_kind: contested`.
ADJUDICATION_SECTIONS = [(k, t) for k, t, adj in SECTIONS if adj]


def sections_for(note_kind: str) -> list[tuple[str, str]]:
    """Which sections this note carries.

    Illumination is the default and the majority: history, geography,
    language, culture and science that make a passage more intelligible.
    Those notes carry no weight, no models table and no disclaimer, because
    they make no evidentiary claim to disclaim.
    """
    if str(note_kind or "context").lower().startswith("contest"):
        return [(k, t) for k, t, _ in SECTIONS]
    return CONTEXT_SECTIONS
FM_FIELDS = ("note_kind", "evidence_strength", "claim_confidence", "weight_label",
             "direction", "issue", "proposition", "calibrated_at",
             "calibration_version")
#: Frontmatter that only an adjudication note carries. An illumination note
#: with an evidence_strength is a scoring error: it has scored something
#: nobody contests.
ADJUDICATION_FM = ("evidence_strength", "weight_label", "direction", "issue",
                   "proposition")
REGISTRY_NOTE = f"{FOLDER_EVIDENCE}/Evidence Assessments.md"


# ------------------------------------------------------------------ targets

def corpus_of(vault_path: str) -> str | None:
    for c in CORPORA:
        if f"{FOLDER_EVIDENCE}/{c}/" in vault_path.replace("\\", "/"):
            return c
    return None


def _fm(ctx: Ctx, relpath: str) -> tuple[dict, str]:
    p = ctx.vault / relpath
    if not p.exists():
        return {}, ""
    return mdkit.parse_note(read_text(p))


def evidence_notes(ctx: Ctx, corpus: str) -> list[dict]:
    rows = ctx.db().execute(
        "SELECT id, title, vault_path FROM nodes WHERE node_type='evidence' "
        "AND vault_path LIKE ? ORDER BY title",
        (f"%{FOLDER_EVIDENCE}/{corpus}/%",)).fetchall()
    out = []
    for r in rows:
        fm, _ = _fm(ctx, r["vault_path"])
        if not fm:
            continue
        out.append({"id": r["id"], "title": r["title"], "path": r["vault_path"],
                    "cls": str(fm.get("evidence_class") or "").lower(),
                    "calibrated": int(fm.get("calibration_version") or 0) >= CALIBRATION_VERSION})
    return out


def pending_groups(ctx: Ctx, corpora=None) -> list[str]:
    """Groups of up to GROUP_SIZE uncalibrated notes, like classes together so
    the judge sees siblings. The target is self-describing: the node ids
    joined by '|' behind the calib: prefix."""
    corpora = list(corpora or ctx.c("calibrate.corpora", ["Book of Mormon"]))
    targets: list[str] = []
    for corpus in corpora:
        todo = [n for n in evidence_notes(ctx, corpus) if not n["calibrated"]]
        todo.sort(key=lambda n: (n["cls"], n["title"]))
        for i in range(0, len(todo), GROUP_SIZE):
            targets.append(TARGET_PREFIX + "|".join(n["id"] for n in todo[i:i + GROUP_SIZE]))
    return targets


def group_ids(target: str) -> list[str]:
    return [x for x in target[len(TARGET_PREFIX):].split("|") if x]


# ------------------------------------------------------------------ context

_VERSE_LINK = re.compile(r"\[\[([^\]#|]+)#\^([a-z0-9-]+)\|([^\]]+)\]\]")


def _claim_for(ctx: Ctx, title: str):
    return ctx.db().execute(
        "SELECT id, node_id, text, tier, scores_json, consensus, provenance_json FROM claims "
        "WHERE json_extract(provenance_json, '$.evidence_note') = ? LIMIT 1", (title,)).fetchone()


def _registry(ctx: Ctx, corpus: str) -> list[dict]:
    rows = ctx.db().execute(
        "SELECT issue_key, corpus, title, proposition, weight_label, evidence_strength, "
        "direction, assessment FROM issues ORDER BY corpus=? DESC, issue_key LIMIT 90",
        (corpus,)).fetchall()
    return [dict(r) for r in rows]


def build_group_context(ctx: Ctx, target: str) -> dict:
    db = ctx.db()
    ids = group_ids(target)
    notes = []
    corpus = None
    for nid in ids:
        row = db.execute("SELECT id, title, vault_path FROM nodes WHERE id=?", (nid,)).fetchone()
        if row is None or not row["vault_path"]:
            continue
        fm, body = _fm(ctx, row["vault_path"])
        if not fm:
            continue
        corpus = corpus or corpus_of(row["vault_path"])
        claim = _claim_for(ctx, row["title"])
        verses = []
        for chap, vslug, disp in _VERSE_LINK.findall(body)[:8]:
            v = db.execute("SELECT text FROM verses WHERE slug=?", (vslug,)).fetchone()
            if v:
                verses.append({"ref": disp, "text": truncate(v["text"], 300)})
        chapter = None
        if claim and claim["node_id"].startswith("chapter:"):
            try:
                chapter = chapter_display(claim["node_id"].split(":", 1)[1])
            except KeyError:
                chapter = None
        notes.append({
            "note_id": row["id"], "title": row["title"], "path": row["vault_path"],
            "evidence_class": fm.get("evidence_class"),
            "current_scores": {k: fm.get(k) for k in ("claim_confidence", "evidence_strength",
                                                       "study_relevance", "source_quality",
                                                       "consensus_status")},
            "sections": mdkit.list_sections(body),
            "verses": verses, "chapter": chapter,
            "claim": ({"id": claim["id"], "node_id": claim["node_id"], "tier": claim["tier"],
                       "text": claim["text"],
                       "scores": json.loads(claim["scores_json"] or "{}"),
                       "judge_rationale": json.loads(claim["provenance_json"] or "{}")
                       .get("judge_rationale", "")} if claim else None),
        })
    corpus = corpus or "Book of Mormon"
    classes = {n["evidence_class"] for n in notes if n["evidence_class"]}
    ids_set = {n["note_id"] for n in notes}
    # siblings in this corpus and analogues in the others: how the vault has
    # weighed this CATEGORY elsewhere — the raw material of the symmetry check
    siblings, analogues = [], []
    for c in CORPORA:
        for n in evidence_notes(ctx, c):
            if n["id"] in ids_set or not classes:
                continue
            if any(cl and (cl in n["cls"] or n["cls"] in cl) for cl in classes):
                fm, _ = _fm(ctx, n["path"])
                entry = {"title": n["title"], "corpus": c,
                         "evidence_strength": fm.get("evidence_strength"),
                         "weight_label": fm.get("weight_label"), "issue": fm.get("issue")}
                (siblings if c == corpus else analogues).append(entry)
    return {"target": target, "corpus": corpus, "notes": notes,
            "siblings": siblings[:12], "analogues": analogues[:10],
            "registry": _registry(ctx, corpus), "corpus_version": ctx.corpus_version()}


def context_markdown(c: dict) -> str:
    lines = [f"### Corpus: {c['corpus']}  ·  {len(c['notes'])} evidence notes to recalibrate"]
    if c["registry"]:
        lines += ["", "#### Canonical issue registry (stable assessments — REUSE the weight for an "
                      "issue unless this note's evidence justifies changing it, and then say why)"]
        for r in c["registry"]:
            lines.append(f"- `{r['issue_key']}` [{r['corpus']}] {r['title']} — {r['weight_label']} "
                         f"({r['evidence_strength']}), {r['direction']}: {r['assessment']}")
    if c["siblings"]:
        lines += ["", f"#### Other {c['corpus']} notes of the same evidence class (current weights)"]
        for s in c["siblings"]:
            lines.append(f"- {s['title']} — evidence_strength {s['evidence_strength']}"
                         + (f", {s['weight_label']}" if s.get("weight_label") else "")
                         + (f", issue `{s['issue']}`" if s.get("issue") else ""))
    if c["analogues"]:
        lines += ["", "#### The SAME evidence class in the other corpora (current weights) — the symmetry check"]
        for s in c["analogues"]:
            lines.append(f"- [{s['corpus']}] {s['title']} — evidence_strength {s['evidence_strength']}"
                         + (f", {s['weight_label']}" if s.get("weight_label") else ""))
    for n in c["notes"]:
        lines += ["", f"---", f"### NOTE `{n['note_id']}` — {n['title']}",
                  f"evidence_class: {n['evidence_class']} · chapter: {n['chapter']} · current scores: "
                  f"{json.dumps(n['current_scores'])}"]
        for name, text in n["sections"].items():
            lines.append(f"[{name}]\n{truncate(text, 3000)}")
        if n["verses"]:
            lines.append("Verses cited (canonical text):")
            lines += [f"- {v['ref']}: {v['text']}" for v in n["verses"]]
        if n["claim"]:
            cl = n["claim"]
            lines.append(f"Underlying judged claim ({cl['tier']}, scores {json.dumps(cl['scores'])}): "
                         f"{truncate(cl['text'], 800)}")
            if cl.get("judge_rationale"):
                lines.append(f"Original judge rationale: {truncate(cl['judge_rationale'], 400)}")
    return "\n".join(lines)


# ---------------------------------------------------------------- rendering

def _bullets(items, fmt) -> str:
    return "\n".join(fmt(x) for x in items) if items else ""


class _Sections(dict):
    """Section text, with a missing section reading as empty rather than
    raising. A KeyError here takes down a whole group of five notes, and a
    section the model simply did not fill is not worth that."""

    def __missing__(self, key):        # noqa: D105
        return ""


def _sections_from(spec: dict) -> dict[str, str]:
    """The layered sections, rendered from one judged note object.

    Which of them a note actually carries is `sections_for(note_kind)`:
    an illumination note takes the first four and stops.
    """
    models = _bullets(spec.get("models") or [], lambda m: f"- **{m.get('name','?')}** — predicts: "
                      f"{m.get('predicts','?')}. Fit with this evidence: *{m.get('fit','?')}*.")
    alts = _bullets(spec.get("alternatives") or [], lambda a: f"- {a.get('explanation','?')} "
                    f"— *{str(a.get('status','?')).replace('_',' ')}*"
                    + (f": {a['why']}" if a.get("why") else ""))
    w = spec.get("weight") or {}
    prop = str(spec.get("proposition", "?")).strip().rstrip(".")
    weight = (f"**{str(w.get('label','?')).title()}** ({w.get('direction','?')}, "
              f"evidence_strength {w.get('evidence_strength','?')}) for the proposition: "
              f"*{prop}.*\n\n{w.get('sentence','')}")
    if spec.get("base_rate"):
        weight += f"\n\nBase rate / look-elsewhere: {spec['base_rate']}"
    if spec.get("discriminating_test"):
        weight += f"\n\nWhat would move this: {spec['discriminating_test']}"
    weight += (f"\n\nCanonical assessment: [[Evidence Assessments#{spec.get('issue_key','')}|"
               f"{spec.get('issue_title', spec.get('issue_key',''))}]]")
    return _Sections({
        "observation": spec.get("observation", ""),
        "interpretation": spec.get("interpretation", ""),
        "historical-significance": spec.get("historical_significance", ""),
        # The load-bearing section of an illumination note: what is known
        # about this world, and the possible reconstructions under which the
        # passage fits it. Offering one is the job -- labelled as a proposal,
        # not apologised for.
        "how-it-fits": spec.get("how_it_fits", ""),
        "apologetic-significance": spec.get("apologetic_significance", "")
        + (f"\n\n**Inspiration:** {spec['inspiration']}" if spec.get("inspiration") else ""),
        "does-not-establish": spec.get("does_not_establish", ""),
        "models": models or "_No historical model is discriminated by this evidence._",
        "alternatives": alts or "_None beyond the interpretation above._",
        "symmetry": spec.get("symmetry", ""),
        "weight": weight,
    })


def render_registry_note(ctx: Ctx) -> str:
    db = ctx.db()
    rows = db.execute("SELECT * FROM issues ORDER BY corpus, title").fetchall()
    lines = ["# Evidence Assessments", "",
             "One stable assessment per evidence issue, reused by every note that bears on it — so "
             "the same question does not get ten different weights from ten different runs. Weights "
             "name the proposition they support or challenge; *possible* is not *plausible*; the "
             "same reasoning is applied to every corpus (see the engine's EVIDENCE-STANDARD). "
             "When an assessment changes, the notes that cite it are re-rendered.", ""]
    cur = None
    for r in rows:
        if r["corpus"] != cur:
            cur = r["corpus"]
            lines += [f"## {cur}", ""]
        lines.append(f"### {r['issue_key']}")
        lines.append(f"**{r['title']}** — *{r['weight_label']}* ({r['direction']}, "
                     f"evidence_strength {r['evidence_strength']}) for: {r['proposition']}")
        lines.append("")
        lines.append(r["assessment"])
        notes = json.loads(r["notes_json"] or "[]")
        if notes:
            lines.append("")
            lines.append("Notes: " + " · ".join(f"[[{t}]]" for t in notes[:20]))
        lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------- job

def _normalizer(obj):
    if isinstance(obj, dict):
        obj.setdefault("notes", obj.pop("decisions", []) if "decisions" in obj and "notes" not in obj else obj.get("notes", []))
        for n in obj.get("notes", []) or []:
            if isinstance(n, dict):
                n.setdefault("alternatives", [])
                n.setdefault("models", [])
                if isinstance(n.get("issue_key"), str):
                    n["issue_key"] = slugify(n["issue_key"])[:80] or "unnamed-issue"
    return obj


def _chosen(decision: dict, proposals: dict) -> dict | None:
    """The judged note object: proposal a or b, or the judge's merge laid over it."""
    nid = decision.get("note_id")
    use = decision.get("use", "a")
    base = None
    for label in ("a", "b"):
        for n in proposals[label].get("notes", []):
            if n.get("note_id") == nid:
                if label == use or (use == "merged" and base is None):
                    base = dict(n)
    if base is None:
        return None
    if use == "merged" and isinstance(decision.get("merged"), dict):
        base.update({k: v for k, v in decision["merged"].items() if v not in (None, "", [])})
    # the judge's note_kind wins; an illumination note sheds every adjudication field
    kind = str(decision.get("note_kind") or (decision.get("merged") or {}).get("note_kind")
               or base.get("note_kind") or "context")
    base["note_kind"] = "contested" if kind.lower().startswith("contest") else "context"
    if base["note_kind"] == "context":
        for k in ("weight", "issue_key", "issue_title", "proposition", "models", "alternatives",
                  "does_not_establish", "apologetic_significance", "symmetry", "base_rate",
                  "discriminating_test", "model_scope"):
            base.pop(k, None)
        return base
    canon = decision.get("canonical") or {}
    base["issue_key"] = slugify(decision.get("issue_key") or base.get("issue_key") or "")[:80]
    if canon:
        base.setdefault("weight", {})
        base["issue_title"] = canon.get("issue_title") or base.get("issue_title")
        base["proposition"] = canon.get("proposition") or base.get("proposition")
        for k in ("weight_label", "evidence_strength", "direction"):
            if canon.get(k) not in (None, ""):
                base["weight"][k if k != "weight_label" else "label"] = canon[k]
    return base


def run_calibration_job(ctx: Ctx, target: str, apply: bool = True) -> dict:
    db = ctx.db()
    context = build_group_context(ctx, target)
    if not context["notes"]:
        raise ValueError(f"no evidence notes in target: {target}")
    corpus = context["corpus"]
    job_id = new_id(f"calib-{slugify(corpus)}")
    ws = ctx.jobs_dir / job_id
    for sub in ("source", "critiques", "judge", "librarian"):
        (ws / sub).mkdir(parents=True, exist_ok=True)
    seq = int(hashlib.sha1(job_id.encode()).hexdigest()[:8], 16)
    researchers, mode = _select_researchers(ctx)
    # a group carries five notes, two proposals and two critiques into the
    # judge — the longest prompt in the engine, so it gets a longer leash
    timeout = int(ctx.c("calibrate.job_timeout_sec", 0)
                  or max(900, int(ctx.budget("job_timeout_sec") or 420)))
    costs = {"usd": 0.0, "calls": 0}

    def track(stats):
        costs["usd"] += stats.get("cost_usd") or 0.0
        costs["calls"] += stats.get("calls", 0)

    def set_status(status, extra=None):
        db.execute(
            "INSERT INTO jobs(job_id,job_type,target,status,workspace,corpus_version,"
            "providers_json,cost_json,result_json,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET status=excluded.status, "
            "cost_json=excluded.cost_json, result_json=excluded.result_json, updated_at=excluded.updated_at",
            (job_id, "calibrate" if apply else "calibrate-review", target, status, str(ws),
             ctx.corpus_version(), json.dumps({"mode": mode, "researchers": [p.name for p in researchers]}),
             json.dumps(costs), json.dumps(extra or {}), now_iso(), now_iso()))
        db.commit()

    set_status("created")
    context["job_id"] = job_id
    context["chapter_slug"] = target[:80]
    ctx_md = context_markdown(context)
    json_write(ws / "source" / "context.json", context)
    (ws / "source" / "context.md").write_text(ctx_md, encoding="utf-8")

    constitution, _ = load_prompt(ctx, "_constitution_core")
    standard, _ = load_prompt(ctx, "_evidence_standard")
    res_tpl, res_ver = load_prompt(ctx, "calibrate_researcher")
    crit_tpl, crit_ver = load_prompt(ctx, "calibrate_skeptic")
    judge_tpl, judge_ver = load_prompt(ctx, "calibrate_judge")
    schema_txt = json.dumps(schemas.load_schema("calibration_proposal"), indent=1)
    emphases = [
        "Steelman the SUPPORTIVE reading first: what is the strongest honest case that this "
        "evidence supports the proposition, under which model, and how far — then subtract "
        "what does not survive scrutiny.",
        "Steelman the CRITICAL reading first: what is the strongest honest case that this "
        "evidence is weaker than it looks, or bears on a different proposition, or is explained "
        "by a well-supported alternative — then credit what genuinely survives.",
    ]
    if seq % 2 == 1:
        emphases.reverse()

    set_status("research")
    labels = ["a", "b"]
    proposals: dict[str, dict | None] = {}
    transport_down = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futs = {}
        for i, (prov, emphasis) in enumerate(zip(researchers, emphases)):
            sub = ws / labels[i]
            sub.mkdir(exist_ok=True)
            prompt = fill(res_tpl, CONSTITUTION=constitution, STANDARD=standard, EMPHASIS=emphasis,
                          SCHEMA=schema_txt, CONTEXT=ctx_md, CORPUS=corpus)
            futs[pool.submit(_call_validated, ctx, prov, "calibrator", prompt,
                             "calibration_proposal", timeout, sub, context, _normalizer)] = labels[i]
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
            raise ProviderUnavailable(f"{job_id}: provider unreachable")
        set_status("quarantined", {"reason": "no calibrator produced valid output"})
        _quarantine(ctx, ws, job_id)
        raise JobQuarantined(f"{job_id}: no valid calibrator output")
    for label in labels:
        if proposals[label] is None:
            proposals[label] = {"notes": []}

    set_status("critique")
    crit_schema_txt = json.dumps(schemas.load_schema("critique"), indent=1)
    critiques = {}
    for label, other in (("a", 1), ("b", 0)):
        prompt = fill(crit_tpl, CONSTITUTION=constitution, STANDARD=standard, SCHEMA=crit_schema_txt,
                      CONTEXT=ctx_md, CORPUS=corpus,
                      PROPOSAL=json.dumps(proposals[label], ensure_ascii=False, indent=1))
        obj, stats = _call_validated(ctx, researchers[other], "calibration-critic", prompt, "critique",
                                     timeout, ws / "critiques", {**context, "proposal": proposals[label]})
        track(stats)
        critiques[label] = obj or {"assessments": [], "overall": "critique unavailable"}
        json_write(ws / "critiques" / f"critique_of_{label}.json", critiques[label])

    set_status("judge")
    judge_provider = _select_judge(ctx, researchers, seq)
    judgment_schema_txt = json.dumps(schemas.load_schema("calibration_judgment"), indent=1)
    prompt = fill(judge_tpl, CONSTITUTION=constitution, STANDARD=standard, SCHEMA=judgment_schema_txt,
                  CONTEXT=ctx_md, CORPUS=corpus,
                  PROPOSAL_A=json.dumps(proposals["a"], ensure_ascii=False, indent=1),
                  CRITIQUE_A=json.dumps(critiques["a"], ensure_ascii=False, indent=1),
                  PROPOSAL_B=json.dumps(proposals["b"], ensure_ascii=False, indent=1),
                  CRITIQUE_B=json.dumps(critiques["b"], ensure_ascii=False, indent=1))
    judgment, stats = _call_validated(ctx, judge_provider, "calibration-judge", prompt,
                                      "calibration_judgment", timeout, ws / "judge",
                                      {**context, "proposals": proposals})
    track(stats)
    if judgment is None and stats.get("transport_failed"):
        # the judge prompt is the longest in the engine (five notes, two
        # proposals, two critiques); one provider timing out is not a verdict
        # on the work — let the other provider judge before giving up
        others = [p for p in researchers if p.name != judge_provider.name]
        if others:
            ctx.log.warn("calibrate.judge_fallback", job=job_id, failed=judge_provider.name,
                         fallback=others[0].name)
            judge_provider = others[0]
            judgment, stats = _call_validated(ctx, judge_provider, "calibration-judge", prompt,
                                              "calibration_judgment", timeout, ws / "judge",
                                              {**context, "proposals": proposals})
            track(stats)
        if judgment is None and stats.get("transport_failed"):
            set_status("provider_unavailable", {"reason": "judge providers unreachable"})
            raise ProviderUnavailable(f"{job_id}: judge providers unreachable")
    if judgment is None:
        set_status("quarantined", {"reason": "judge produced no valid output"})
        _quarantine(ctx, ws, job_id)
        raise JobQuarantined(f"{job_id}: no valid judgment")
    json_write(ws / "judge" / "decision.json", judgment)

    decided = []
    for d in judgment.get("decisions", []):
        spec = _chosen(d, proposals)
        note = next((n for n in context["notes"] if n["note_id"] == d.get("note_id")), None)
        if spec and note:
            decided.append((note, spec, d))

    if not apply:
        report = _review_report(context, decided, judgment, mode, judge_provider.name)
        (ws / "calibration-review.md").write_text(report, encoding="utf-8")
        set_status("reviewed", {"notes": len(decided), "report": str(ws / "calibration-review.md")})
        return {"job_id": job_id, "mode": mode, "reviewed": len(decided),
                "report": str(ws / "calibration-review.md"), "cost_usd": costs["usd"],
                "decisions": [{"note": n["title"], "before": n["current_scores"].get("evidence_strength"),
                               "after": (s.get("weight") or {}).get("evidence_strength"),
                               "label": (s.get("weight") or {}).get("label"),
                               "symmetry": d.get("symmetry_verdict")} for n, s, d in decided]}

    # ---- landing: notes + claims + registry + registry note, one transaction ----
    with LANDING:
        set_status("librarian")
        ops, changed_chapters, touched_issues = [], set(), {}
        stamp = now_iso()
        for note, spec, d in decided:
            secs = _sections_from(spec)
            kind = str(spec.get("note_kind") or "context")
            for name, heading in sections_for(kind):
                ops.append({"op": "ensure_section", "path": note["path"], "section": name,
                            "heading": heading, "content": secs[name]})
            if spec.get("summary"):
                ops.append({"op": "set_section", "path": note["path"], "section": "summary",
                            "content": spec["summary"].strip()})
            contested = kind.lower().startswith("contest")
            w = (spec.get("weight") or {}) if contested else {}
            for field, value in (("note_kind", kind),
                                 ("evidence_strength", w.get("evidence_strength")),
                                 ("claim_confidence", w.get("claim_confidence")),
                                 ("weight_label", w.get("label")), ("direction", w.get("direction")),
                                 ("issue", spec.get("issue_key")), ("proposition", spec.get("proposition")),
                                 ("calibrated_at", stamp), ("calibration_version", CALIBRATION_VERSION)):
                if value not in (None, ""):
                    ops.append({"op": "set_fm_field", "path": note["path"], "field": field, "value": value})
            if not contested:
                # an illumination note carries no weight: the old inflated
                # score and any sections a v1 pass gave it come off
                for field in ADJUDICATION_FM:
                    ops.append({"op": "set_fm_field", "path": note["path"], "field": field, "value": None})
                for name, _heading in ADJUDICATION_SECTIONS:
                    if name in note["sections"]:
                        ops.append({"op": "remove_section", "path": note["path"], "section": name})
            key = spec.get("issue_key") if contested else None
            if key:
                canon = d.get("canonical") or {}
                touched_issues.setdefault(key, {
                    "issue_key": key, "corpus": corpus,
                    "title": canon.get("issue_title") or spec.get("issue_title") or key,
                    "proposition": canon.get("proposition") or spec.get("proposition") or "",
                    "weight_label": canon.get("weight_label") or w.get("label") or "",
                    "evidence_strength": canon.get("evidence_strength", w.get("evidence_strength")),
                    "direction": canon.get("direction") or w.get("direction") or "",
                    "assessment": canon.get("assessment") or w.get("sentence") or "",
                    "notes": []})["notes"].append(note["title"])
        json_write(ws / "librarian" / "patch.json", {"ops": ops})
        gitops.checkpoint(ctx, f"before calibrate({corpus}: {len(decided)} notes)")
        try:
            result = apply_ops(ctx, ops, actor=f"librarian:{job_id}")
            # the claim behind each note follows the note — study-guide callouts re-render from it
            for note, spec, d in decided:
                if note.get("claim"):
                    contested = str(spec.get("note_kind") or "context").lower().startswith("contest")
                    w = (spec.get("weight") or {}) if contested else {}
                    row = db.execute("SELECT scores_json FROM claims WHERE id=?", (note["claim"]["id"],)).fetchone()
                    scores = json.loads(row["scores_json"] or "{}") if row else {}
                    if not contested:
                        # no weight to show: the guide callout keeps the claim
                        # and its confidence, and drops the strength meter
                        scores.pop("evidence_strength", None)
                    if w.get("evidence_strength") is not None:
                        scores["evidence_strength"] = w["evidence_strength"]
                    if w.get("claim_confidence") is not None:
                        scores["claim_confidence"] = w["claim_confidence"]
                    scores["calibration"] = {"note_kind": "contested" if contested else "context",
                                             "issue": spec.get("issue_key"), "label": w.get("label"),
                                             "direction": w.get("direction"), "job": job_id,
                                             "version": CALIBRATION_VERSION}
                    db.execute("UPDATE claims SET scores_json=?, updated_at=? WHERE id=?",
                               (json.dumps(scores), stamp, note["claim"]["id"]))
                    changed_chapters.add(note["claim"]["node_id"])
            for key, iss in touched_issues.items():
                prev = db.execute("SELECT * FROM issues WHERE issue_key=?", (key,)).fetchone()
                hist = json.loads(prev["history_json"] or "[]") if prev else []
                notes = sorted(set((json.loads(prev["notes_json"] or "[]") if prev else []) + iss["notes"]))
                if prev and (prev["evidence_strength"] != iss["evidence_strength"]
                             or prev["weight_label"] != iss["weight_label"]):
                    hist.append({"at": stamp, "job": job_id, "from": {"weight_label": prev["weight_label"],
                                 "evidence_strength": prev["evidence_strength"]},
                                 "why": next((c.get("why") for c in judgment.get("registry_changes", [])
                                              if c.get("issue_key") == key), "")})
                db.execute(
                    "INSERT INTO issues(issue_key,corpus,title,proposition,weight_label,evidence_strength,"
                    "direction,assessment,notes_json,history_json,updated_by,updated_at) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(issue_key) DO UPDATE SET "
                    "title=excluded.title, proposition=excluded.proposition, weight_label=excluded.weight_label, "
                    "evidence_strength=excluded.evidence_strength, direction=excluded.direction, "
                    "assessment=excluded.assessment, notes_json=excluded.notes_json, "
                    "history_json=excluded.history_json, updated_by=excluded.updated_by, updated_at=excluded.updated_at",
                    (key, iss["corpus"], iss["title"], iss["proposition"], iss["weight_label"],
                     iss["evidence_strength"], iss["direction"], iss["assessment"], json.dumps(notes),
                     json.dumps(hist), job_id, stamp))
            db.commit()
            record_file(ctx, REGISTRY_NOTE, "moc", "librarian", None,
                        mdkit.build_note({"ownership": "system", "mutable": "ai", "content_type": "moc"},
                                         render_registry_note(ctx)))
            report = validate_changed(ctx, [*result.changed_paths, REGISTRY_NOTE])
            if report.fatal:
                raise PatchViolation("; ".join(f"{i.check}:{i.path}" for i in report.fatal))
        except Exception as e:  # noqa: BLE001 — roll back BOTH stores
            gitops.hard_restore(ctx)
            db.rollback()
            set_status("failed", {"error": str(e)})
            ctx.log.error("calibrate.apply_failed", job=job_id, error=str(e))
            raise RuntimeError(f"{job_id}: apply failed and was rolled back: {e}") from e
        # the guides' evidence callouts are rendered from the claims: re-synthesize
        from scripturegraph import queue as q
        for node_id in changed_chapters:
            q.enqueue(ctx, "pass", node_id.split(":", 1)[1], pass_name="synthesis")
        db.commit()
        rev = gitops.commit_all(ctx, f"calibrate({corpus}): {len(decided)} evidence notes "
                                     f"[{mode}, judge {judge_provider.name}]")
    set_status("applied", {"git_rev": rev, "notes": len(decided), "issues": list(touched_issues)})
    ctx.log.info("calibrate.applied", job=job_id, corpus=corpus, notes=len(decided),
                 issues=len(touched_issues), mode=mode, cost_usd=round(costs["usd"], 4))
    return {"job_id": job_id, "mode": mode, "git_rev": rev, "notes": len(decided),
            "issues": list(touched_issues), "cost_usd": costs["usd"]}


def tidy_context_notes(ctx: Ctx) -> dict:
    """Repair notes that landed as `note_kind: context` before the landing
    knew what that meant: strip the adjudication frontmatter and sections,
    drop the claim's strength meter, and prune registry issues that no
    contested note cites. Idempotent; runs inside a git transaction."""
    db = ctx.db()
    stats = {"notes": 0, "claims": 0, "issues_pruned": 0}
    ops = []
    fixed_titles = []
    for corpus in CORPORA:
        for n in evidence_notes(ctx, corpus):
            fm, body = _fm(ctx, n["path"])
            if str(fm.get("note_kind") or "").lower() != "context":
                continue
            secs = mdkit.list_sections(body)
            has_fm = any(k in fm for k in ADJUDICATION_FM)
            has_sec = any(name in secs for name, _ in ADJUDICATION_SECTIONS)
            if not (has_fm or has_sec):
                continue
            for field in ADJUDICATION_FM:
                if field in fm:
                    ops.append({"op": "set_fm_field", "path": n["path"], "field": field, "value": None})
            for name, _heading in ADJUDICATION_SECTIONS:
                if name in secs:
                    ops.append({"op": "remove_section", "path": n["path"], "section": name})
            fixed_titles.append(n["title"])
    if not ops:
        return stats
    with LANDING:
        gitops.checkpoint(ctx, f"before calibrate tidy ({len(fixed_titles)} notes)")
        try:
            result = apply_ops(ctx, ops, actor="librarian:calibrate-tidy")
            stats["notes"] = len(fixed_titles)
            for title in fixed_titles:
                row = _claim_for(ctx, title)
                if row is None:
                    continue
                scores = json.loads(row["scores_json"] or "{}")
                if "evidence_strength" in scores or (scores.get("calibration") or {}).get("note_kind") != "context":
                    scores.pop("evidence_strength", None)
                    scores["calibration"] = {**(scores.get("calibration") or {}), "note_kind": "context",
                                             "issue": None, "label": None, "direction": None}
                    db.execute("UPDATE claims SET scores_json=?, updated_at=? WHERE id=?",
                               (json.dumps(scores), now_iso(), row["id"]))
                    stats["claims"] += 1
            # registry rows that only illumination notes ever cited
            contested_titles = set()
            for corpus in CORPORA:
                for n in evidence_notes(ctx, corpus):
                    fm, _ = _fm(ctx, n["path"])
                    if str(fm.get("note_kind") or "").lower().startswith("contest") and fm.get("issue"):
                        contested_titles.add((fm["issue"], n["title"]))
            live_keys = {k for k, _ in contested_titles}
            for r in db.execute("SELECT issue_key, notes_json FROM issues").fetchall():
                if r["issue_key"] not in live_keys:
                    db.execute("DELETE FROM issues WHERE issue_key=?", (r["issue_key"],))
                    stats["issues_pruned"] += 1
                else:
                    notes = sorted({t for k, t in contested_titles if k == r["issue_key"]})
                    db.execute("UPDATE issues SET notes_json=? WHERE issue_key=?",
                               (json.dumps(notes), r["issue_key"]))
            db.commit()
            record_file(ctx, REGISTRY_NOTE, "moc", "librarian", None,
                        mdkit.build_note({"ownership": "system", "mutable": "ai", "content_type": "moc"},
                                         render_registry_note(ctx)))
            report = validate_changed(ctx, [*result.changed_paths, REGISTRY_NOTE])
            if report.fatal:
                raise PatchViolation("; ".join(f"{i.check}:{i.path}" for i in report.fatal))
        except Exception as e:  # noqa: BLE001
            gitops.hard_restore(ctx)
            db.rollback()
            raise RuntimeError(f"calibrate tidy failed and was rolled back: {e}") from e
        gitops.commit_all(ctx, f"calibrate: tidy {len(fixed_titles)} illumination notes, "
                               f"prune {stats['issues_pruned']} registry rows")
    ctx.log.info("calibrate.tidy", **stats)
    return stats


def _review_report(context: dict, decided, judgment: dict, mode: str, judge: str) -> str:
    lines = [f"# Calibration review — {context['corpus']}", "",
             f"Mode {mode}, judge {judge}. Nothing below has been applied to the vault.", ""]
    for note, spec, d in decided:
        w = spec.get("weight") or {}
        lines += [f"## {note['title']}",
                  f"- current evidence_strength: {note['current_scores'].get('evidence_strength')} → "
                  f"proposed **{w.get('label')}** ({w.get('direction')}, {w.get('evidence_strength')}) for "
                  f"*{spec.get('proposition')}*",
                  f"- issue: `{spec.get('issue_key')}` — {spec.get('issue_title')}",
                  f"- symmetry verdict: {d.get('symmetry_verdict')} — {spec.get('symmetry','')}",
                  f"- judge: {d.get('rationale','')}",
                  f"- fixes: {'; '.join(d.get('fixes_applied') or [])}", ""]
        secs = _sections_from(spec)
        for name, heading in sections_for(spec.get("note_kind") or "context"):
            lines += [f"**{heading}.** {secs[name]}", ""]
    if judgment.get("overall_notes"):
        lines += ["## Judge's overall notes", judgment["overall_notes"], ""]
    return "\n".join(lines)
