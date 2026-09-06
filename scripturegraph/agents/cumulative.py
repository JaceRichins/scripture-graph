"""The cumulative assessment: one page per corpus where the contested
findings are weighed TOGETHER.

The registry (`issues`) holds one stable assessment per contested issue,
and the calibration pass keeps each honest on its own. But a library of
individually fair assessments can still mislead in aggregate, in either
direction: forty findings each dismissed as "coincidence, weak" say
something false if they are independent and point the same way; forty
findings that share one cause (KJV register, quoted Isaiah) say something
false if they are counted forty times. The owner's concern (2026-09-05) was
the first; the standard's no-double-counting rule is the second. This page
answers both, symmetrically, for every corpus.

What software does: group the registry into lines by category (the folder a
finding lives in — Chiasmus, Names, Geography, Manuscripts …) and direction,
and render that table deterministically. What the models do, judged: decide
which lines are genuinely INDEPENDENT (shared cause → one line), write a
synthesis that is a judgment and not a sum — no probability arithmetic over
weights, ever — say what the whole picture does to each serious framework
(the models the text permits, both directions), and end with what a
believer and a skeptic can each honestly hold. Same pipeline shape as the
rest of the engine: two researchers (Claude and Codex, emphases rotating) →
cross-critique → judge (alternating) → deterministic landing in a git
transaction. Same isolation, same rollback.

The page is required reading for every hard-question dossier in the corpus,
so a question page cannot dismiss one at a time what this page weighs as a
line — and cannot inflate what it does not.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
from pathlib import Path

from scripturegraph import gitops
from scripturegraph.agents import schemas
from scripturegraph.agents.pipeline import (LANDING, JobQuarantined, ProviderUnavailable,
                                            _call_validated, _quarantine, _select_judge,
                                            _select_researchers, fill, load_prompt)
from scripturegraph.context import Ctx
from scripturegraph.util import json_write, new_id, now_iso, read_text, slugify, truncate
from scripturegraph.validation import validate_changed
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import FOLDER_EVIDENCE, record_file

CORPORA = ("Book of Mormon", "Bible", "Restoration")
#: a hard question's `scope` frontmatter → the corpus whose page it reads
CORPUS_BY_SCOPE = {"book-of-mormon": "Book of Mormon", "restoration": "Restoration",
                   "christianity": "Bible"}
PASS_NAME = "cumulative"

# the page's prose sections, in order, and the heading each gets
SECTIONS: list[tuple[str, str]] = [
    ("how-to-read", "How to read this page"),
    ("lines", "Independent lines"),
    ("synthesis", "What the whole picture shows"),
    ("frameworks", "Frameworks — what the whole picture leaves open"),
    ("believer", "What a believer can hold"),
    ("skeptic", "What a skeptic can hold"),
    ("would-move", "What would move this"),
    ("inspiration", "Inspiration"),
]
REGISTRY_SECTION = ("registry", "The registry, by category")


def page_title(corpus: str) -> str:
    return f"{corpus} Assessment"


def page_path(corpus: str) -> str:
    return f"{FOLDER_EVIDENCE}/{corpus}/{page_title(corpus)}.md"


# ------------------------------------------------------------------ targets

def issue_rows(ctx: Ctx, corpus: str) -> list[dict]:
    """Every registry issue of the corpus, with the category each cited
    finding lives in (its folder) — the raw material of the lines table."""
    db = ctx.db()
    rows = db.execute("SELECT * FROM issues WHERE corpus=? ORDER BY evidence_strength DESC, title",
                      (corpus,)).fetchall()
    out = []
    for r in rows:
        notes = json.loads(r["notes_json"] or "[]")
        cats: dict[str, int] = {}
        for t in notes:
            n = db.execute("SELECT vault_path FROM nodes WHERE title=? AND node_type='evidence'",
                           (t,)).fetchone()
            if n and n["vault_path"]:
                parts = n["vault_path"].replace("\\", "/").split("/")
                # .../40 Findings/<corpus>/<category>/<note>.md
                cat = parts[-2] if len(parts) >= 2 and parts[-2] != corpus else "General"
                cats[cat] = cats.get(cat, 0) + 1
        category = max(cats, key=cats.get) if cats else "General"
        out.append({"issue_key": r["issue_key"], "title": r["title"], "proposition": r["proposition"],
                    "weight_label": r["weight_label"], "evidence_strength": r["evidence_strength"],
                    "direction": r["direction"], "assessment": r["assessment"],
                    "notes": notes, "category": category})
    return out


def registry_signature(ctx: Ctx, corpus: str) -> str:
    """Changes when any assessment of the corpus changes — the trigger."""
    rows = ctx.db().execute(
        "SELECT issue_key, weight_label, evidence_strength, direction FROM issues "
        "WHERE corpus=? ORDER BY issue_key", (corpus,)).fetchall()
    h = hashlib.sha1()
    for r in rows:
        h.update(f"{r['issue_key']}|{r['weight_label']}|{r['evidence_strength']}|{r['direction']}\n".encode())
    return f"{len(rows)}:{h.hexdigest()[:12]}"


def pending_corpora(ctx: Ctx) -> list[str]:
    """Corpora whose page is missing or whose registry has moved enough
    since the page was written. `cumulative.min_changed` (default 5) is how
    many assessments must be new or changed before the page is redone —
    it is the most expensive synthesis the engine writes."""
    db = ctx.db()
    out = []
    min_changed = int(ctx.c("cumulative.min_changed", 5))
    corpora = [c for c in ctx.c("cumulative.corpora", list(ctx.c("calibrate.corpora", ["Book of Mormon"])))
               if c in CORPORA]
    for corpus in corpora:
        n = db.execute("SELECT COUNT(*) AS n FROM issues WHERE corpus=?", (corpus,)).fetchone()["n"]
        if n < int(ctx.c("cumulative.min_issues", 3)):
            continue
        row = db.execute("SELECT mode FROM passes WHERE name=? AND target=?",
                         (PASS_NAME, corpus)).fetchone()
        if row is None or not (ctx.vault / page_path(corpus)).exists():
            out.append(corpus)
            continue
        # mode holds "<n>:<hash>" from the run that wrote the page
        try:
            prev_n = int(str(row["mode"]).split(":", 1)[0])
        except ValueError:
            prev_n = -1
        sig = registry_signature(ctx, corpus)
        if sig != row["mode"] and (n - prev_n >= min_changed or prev_n < 0
                                   or _changed_since(ctx, corpus, row) >= min_changed):
            out.append(corpus)
    return out


def _changed_since(ctx: Ctx, corpus: str, pass_row) -> int:
    done = ctx.db().execute("SELECT completed_at FROM passes WHERE name=? AND target=?",
                            (PASS_NAME, corpus)).fetchone()
    if not done:
        return 10 ** 6
    return ctx.db().execute("SELECT COUNT(*) AS n FROM issues WHERE corpus=? AND updated_at > ?",
                            (corpus, done["completed_at"])).fetchone()["n"]


# ------------------------------------------------------------------ context

def build_corpus_context(ctx: Ctx, corpus: str) -> dict:
    if corpus not in CORPORA:
        raise ValueError(f"not a corpus: {corpus}")
    rows = issue_rows(ctx, corpus)
    by_cat: dict[str, list[dict]] = {}
    for r in rows:
        by_cat.setdefault(r["category"], []).append(r)
    # the frameworks the calibrated findings already worked out (their
    # models tables), strongest issues first — what the text permits
    frameworks = []
    for r in rows[:int(ctx.c("cumulative.framework_notes", 24))]:
        for t in r["notes"][:1]:
            n = ctx.db().execute("SELECT vault_path FROM nodes WHERE title=? AND node_type='evidence'",
                                 (t,)).fetchone()
            if not n or not n["vault_path"] or not (ctx.vault / n["vault_path"]).exists():
                continue
            _, body = mdkit.parse_note(read_text(ctx.vault / n["vault_path"]))
            secs = mdkit.list_sections(body)
            text = secs.get("models") or ""
            if text and not mdkit.section_is_empty(text):
                frameworks.append({"issue": r["issue_key"], "note": t, "text": truncate(text, 900)})
    # the hard questions of this corpus, as they stand — the synthesis must
    # know what is being asked of it
    scope = next((s for s, c in CORPUS_BY_SCOPE.items() if c == corpus), None)
    questions = []
    for q in ctx.db().execute("SELECT title, vault_path FROM nodes WHERE node_type='question' "
                              "AND vault_path IS NOT NULL ORDER BY title"):
        p = ctx.vault / q["vault_path"]
        if not p.exists():
            continue
        fm, body = mdkit.parse_note(read_text(p))
        if str(fm.get("scope") or "") != scope:
            continue
        ans = mdkit.get_section(body, "concise-answer")
        questions.append({"title": q["title"],
                          "answer": truncate(ans, 700) if ans and not mdkit.section_is_empty(ans) else ""})
    # the page as it stands (improve, don't degrade)
    existing = {}
    p = ctx.vault / page_path(corpus)
    if p.exists():
        _, body = mdkit.parse_note(read_text(p))
        existing = {k: v for k, v in mdkit.list_sections(body).items()
                    if k != REGISTRY_SECTION[0] and not mdkit.section_is_empty(v)}
    others = [c for c in CORPORA if c != corpus]
    return {"corpus": corpus, "issues": rows, "by_category": by_cat, "frameworks": frameworks,
            "questions": questions, "existing_sections": existing,
            "other_corpora": others, "signature": registry_signature(ctx, corpus),
            "corpus_version": ctx.corpus_version(),
            "vocabulary": sorted({r["title"] for r in ctx.db().execute(
                "SELECT title FROM nodes WHERE node_type IN ('topic','person','place','event','question','evidence')")}
                                 | {page_title(c) for c in CORPORA} | {"Assessments"})}


def render_registry_table(c: dict) -> str:
    lines = []
    for cat in sorted(c["by_category"]):
        lines.append(f"**{cat}**")
        for r in c["by_category"][cat]:
            lines.append(f"- [[Assessments#{r['issue_key']}|{r['title']}]] — *{r['weight_label']}* "
                         f"({r['direction']}, {r['evidence_strength']}): {r['proposition']}")
        lines.append("")
    return "\n".join(lines).rstrip()


def context_markdown(c: dict) -> str:
    lines = [f"### Corpus: {c['corpus']}  ·  {len(c['issues'])} contested assessments in the registry",
             "", "#### The registry, by category (weights are DISCRIMINATION between serious "
             "models for the named proposition, 0–1; direction is which way)"]
    for cat in sorted(c["by_category"]):
        lines.append(f"\n**{cat}**")
        for r in c["by_category"][cat]:
            lines.append(f"- `{r['issue_key']}` {r['title']} — {r['weight_label']} ({r['direction']}, "
                         f"{r['evidence_strength']}) for: {r['proposition']}\n  {r['assessment']}"
                         + (f"\n  Findings: " + ", ".join(f"[[{t}]]" for t in r["notes"][:6]) if r["notes"] else ""))
    if c["frameworks"]:
        lines += ["", "#### Frameworks the calibrated findings already worked out (models tables)"]
        for f in c["frameworks"]:
            lines.append(f"- `{f['issue']}` from [[{f['note']}]]:\n{f['text']}")
    if c["questions"]:
        lines += ["", "#### The hard questions of this corpus, as they stand"]
        for q in c["questions"]:
            lines.append(f"- [[{q['title']}]]" + (f": {q['answer']}" if q["answer"] else " (not yet developed)"))
    if c["existing_sections"]:
        lines += ["", "#### The page as it stands (improve, don't degrade)"]
        for k, v in c["existing_sections"].items():
            lines.append(f"[{k}]\n{truncate(v, 1800)}")
    lines += ["", "#### Sections to write (key → what belongs there)"]
    lines += [f"- `{k}` — {_GUIDE[k]}" for k, _h in SECTIONS]
    lines += ["", "#### Canonical vocabulary (the ONLY note titles you may wiki-link, besides "
                  "scripture chapter titles like [[Alma 36]] and [[Assessments#issue-key|…]])",
              ", ".join(c["vocabulary"])]
    return "\n".join(lines)


_GUIDE = {
    "how-to-read": "two or three paragraphs: what this page is and is not — a judged reading of "
                   "the whole registry, not a probability, not a verdict on the book; how "
                   "independence was decided; why one-at-a-time dismissal and one-at-a-time "
                   "inflation are both errors",
    "lines": "the INDEPENDENT lines: each a bullet with a name, the registry issues it gathers "
             "(link them as [[Assessments#issue-key|title]]), why they share a cause or do not, "
             "which direction the line points and how strong the line is as a line — a judgment, "
             "never a sum. Findings with one shared cause are ONE line",
    "synthesis": "what the whole picture shows, honestly: where independent lines converge, where "
                 "they conflict, which reading of the text they favour and which they close; where "
                 "the picture is lopsided say so; where it is genuinely open say that",
    "frameworks": "the serious models the text permits, in BOTH directions, and what the cumulative "
                  "picture does to each — raises it, lowers it, leaves it untouched — each labelled "
                  "possible / plausible / independently supported / ad hoc, with what supports it; "
                  "and what was considered and set aside, with the reason",
    "believer": "what a believer can honestly hold in light of all of it — at full strength, "
                "without overreach; faith-building through honesty, never instead of it",
    "skeptic": "what a skeptic can honestly hold in light of all of it — at full strength, without "
               "overreach",
    "would-move": "the discriminating tests: what finding, if made, would strengthen the strongest "
                  "line, and what would weaken it; dated",
    "inspiration": "one paragraph on what all of this does and does not say about whether the text "
                   "is inspired — usually much less than either side assumes — and what is a "
                   "matter of faith",
}


# -------------------------------------------------------------------- the job

def _normalizer(obj):
    if isinstance(obj, dict):
        secs = obj.get("sections")
        if not isinstance(secs, dict):
            secs = {}
        allowed = {k for k, _ in SECTIONS}
        obj["sections"] = {k: v for k, v in secs.items() if k in allowed and isinstance(v, str)}
        obj.setdefault("lines", [])
        obj.setdefault("frameworks", [])
    return obj


def _chosen(judgment: dict, proposals: dict) -> dict[str, str]:
    """Per section: proposal a or b, or the judge's merged text."""
    out: dict[str, str] = {}
    for key, _heading in SECTIONS:
        spec = (judgment.get("section_approvals") or {}).get(key) or {}
        use = spec.get("use", "none")
        text = ""
        if use == "a":
            text = (proposals["a"].get("sections") or {}).get(key, "")
        elif use == "b":
            text = (proposals["b"].get("sections") or {}).get(key, "")
        elif use == "merged":
            text = spec.get("merged_text", "")
        if text and use != "none":
            out[key] = text.strip()
    return out


def run_cumulative_job(ctx: Ctx, corpus: str, apply: bool = True) -> dict:
    db = ctx.db()
    context = build_corpus_context(ctx, corpus)
    if not context["issues"]:
        raise ValueError(f"no contested assessments in the registry for {corpus}")
    job_id = new_id(f"cumul-{slugify(corpus)}")
    ws = ctx.jobs_dir / job_id
    for sub in ("source", "critiques", "judge", "librarian"):
        (ws / sub).mkdir(parents=True, exist_ok=True)
    seq = int(hashlib.sha1(job_id.encode()).hexdigest()[:8], 16)
    researchers, mode = _select_researchers(ctx)
    timeout = int(ctx.c("cumulative.job_timeout_sec", 0)
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
            (job_id, PASS_NAME if apply else "cumulative-review", corpus, status, str(ws),
             ctx.corpus_version(), json.dumps({"mode": mode, "researchers": [p.name for p in researchers]}),
             json.dumps(costs), json.dumps(extra or {}), now_iso(), now_iso()))
        db.commit()

    set_status("created")
    context["job_id"] = job_id
    context["chapter_slug"] = corpus
    ctx_md = context_markdown(context)
    json_write(ws / "source" / "context.json", context)
    (ws / "source" / "context.md").write_text(ctx_md, encoding="utf-8")

    constitution, _ = load_prompt(ctx, "_constitution_core")
    standard, _ = load_prompt(ctx, "_evidence_standard")
    res_tpl, _ = load_prompt(ctx, "cumulative_researcher")
    crit_tpl, _ = load_prompt(ctx, "cumulative_skeptic")
    judge_tpl, _ = load_prompt(ctx, "cumulative_judge")
    schema_txt = json.dumps(schemas.load_schema("cumulative_proposal"), indent=1)
    emphases = [
        "Steelman the CONVERGENT reading first: where do independent lines genuinely point the "
        "same way, and how strong is that as a whole — then subtract shared causes and "
        "look-elsewhere costs honestly.",
        "Steelman the DEFLATIONARY reading first: how much of the registry shares one cause, how "
        "much is expected under any model, where the lines conflict — then credit what "
        "genuinely survives as independent and pointed.",
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
            futs[pool.submit(_call_validated, ctx, prov, "cumulative-researcher", prompt,
                             "cumulative_proposal", timeout, sub, context, _normalizer)] = labels[i]
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
        set_status("quarantined", {"reason": "no researcher produced valid output"})
        _quarantine(ctx, ws, job_id)
        raise JobQuarantined(f"{job_id}: no valid researcher output")
    for label in labels:
        if proposals[label] is None:
            proposals[label] = {"sections": {}, "lines": [], "frameworks": []}

    set_status("critique")
    crit_schema_txt = json.dumps(schemas.load_schema("critique"), indent=1)
    critiques = {}
    for label, other in (("a", 1), ("b", 0)):
        prompt = fill(crit_tpl, CONSTITUTION=constitution, STANDARD=standard, SCHEMA=crit_schema_txt,
                      CONTEXT=ctx_md, CORPUS=corpus,
                      PROPOSAL=json.dumps(proposals[label], ensure_ascii=False, indent=1))
        obj, stats = _call_validated(ctx, researchers[other], "cumulative-critic", prompt, "critique",
                                     timeout, ws / "critiques", {**context, "proposal": proposals[label]})
        track(stats)
        critiques[label] = obj or {"assessments": [], "overall": "critique unavailable"}
        json_write(ws / "critiques" / f"critique_of_{label}.json", critiques[label])

    set_status("judge")
    judge_provider = _select_judge(ctx, researchers, seq)
    judgment_schema_txt = json.dumps(schemas.load_schema("cumulative_judgment"), indent=1)
    prompt = fill(judge_tpl, CONSTITUTION=constitution, STANDARD=standard, SCHEMA=judgment_schema_txt,
                  CONTEXT=ctx_md, CORPUS=corpus,
                  PROPOSAL_A=json.dumps(proposals["a"], ensure_ascii=False, indent=1),
                  CRITIQUE_A=json.dumps(critiques["a"], ensure_ascii=False, indent=1),
                  PROPOSAL_B=json.dumps(proposals["b"], ensure_ascii=False, indent=1),
                  CRITIQUE_B=json.dumps(critiques["b"], ensure_ascii=False, indent=1))
    judgment, stats = _call_validated(ctx, judge_provider, "cumulative-judge", prompt,
                                      "cumulative_judgment", timeout, ws / "judge",
                                      {**context, "proposals": proposals})
    track(stats)
    if judgment is None and stats.get("transport_failed"):
        others = [p for p in researchers if p.name != judge_provider.name]
        if others:
            ctx.log.warn("cumulative.judge_fallback", job=job_id, failed=judge_provider.name,
                         fallback=others[0].name)
            judge_provider = others[0]
            judgment, stats = _call_validated(ctx, judge_provider, "cumulative-judge", prompt,
                                              "cumulative_judgment", timeout, ws / "judge",
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

    chosen = _chosen(judgment, proposals)
    if not chosen:
        set_status("quarantined", {"reason": "judge approved no section"})
        _quarantine(ctx, ws, job_id)
        raise JobQuarantined(f"{job_id}: no section approved")

    if not apply:
        report = _review_report(context, chosen, judgment, mode, judge_provider.name)
        (ws / "cumulative-review.md").write_text(report, encoding="utf-8")
        set_status("reviewed", {"sections": len(chosen), "report": str(ws / "cumulative-review.md")})
        return {"job_id": job_id, "corpus": corpus, "mode": mode, "sections": len(chosen),
                "report": str(ws / "cumulative-review.md"), "cost_usd": costs["usd"]}

    # ---- landing: the page, one transaction ----
    with LANDING:
        set_status("librarian")
        relpath = page_path(corpus)
        content = render_page(ctx, context, chosen, judgment, job_id)
        json_write(ws / "librarian" / "page.json", {"path": relpath, "sections": chosen})
        gitops.checkpoint(ctx, f"before cumulative({corpus})")
        try:
            record_file(ctx, relpath, "moc", "librarian", None, content)
            db.commit()
            report = validate_changed(ctx, [relpath])
            if report.fatal:
                raise RuntimeError("; ".join(f"{i.check}:{i.path}" for i in report.fatal))
        except Exception as e:  # noqa: BLE001 — roll back BOTH stores
            gitops.hard_restore(ctx)
            db.rollback()
            set_status("failed", {"error": str(e)})
            ctx.log.error("cumulative.apply_failed", job=job_id, error=str(e))
            raise RuntimeError(f"{job_id}: apply failed and was rolled back: {e}") from e
        rev = gitops.commit_all(ctx, f"cumulative({corpus}): {len(chosen)} sections "
                                     f"[{mode}, judge {judge_provider.name}]")
    set_status("applied", {"git_rev": rev, "sections": len(chosen), "signature": context["signature"]})
    ctx.log.info("cumulative.applied", job=job_id, corpus=corpus, sections=len(chosen), mode=mode,
                 cost_usd=round(costs["usd"], 4))
    return {"job_id": job_id, "corpus": corpus, "mode": mode, "git_rev": rev,
            "sections": len(chosen), "pass_mode": context["signature"], "cost_usd": costs["usd"]}


def render_page(ctx: Ctx, context: dict, chosen: dict[str, str], judgment: dict, job_id: str) -> str:
    corpus = context["corpus"]
    # keep prose the judge did not replace this run (improve, don't degrade)
    prose = {**context.get("existing_sections", {}), **chosen}
    fm = {"ownership": "system", "mutable": "ai", "content_type": "assessment",
          "corpus": corpus, "issues": len(context["issues"]),
          "registry_signature": context["signature"], "updated_by": job_id,
          "updated_at": now_iso(), "cssclasses": ["sg-assessment"]}
    lines = [f"# {page_title(corpus)}", "",
             f"The contested findings of the {corpus} corpus, weighed together. One stable "
             f"assessment per issue lives in [[Assessments]]; the findings themselves are under "
             f"[[{corpus} Findings]]. This page is a judgment, not a sum — no weight here is "
             f"added to another — and it is not a verdict on the book: the project is not here to "
             f"prove or disprove scripture. It exists so that no finding is dismissed one at a "
             f"time as coincidence when it belongs to a line, and none is counted twice when it "
             f"shares a cause. The same page exists for every corpus.", ""]
    for key, heading in SECTIONS:
        lines += [f"## {heading}", mdkit.marker_block(key, prose.get(key) or mdkit.PLACEHOLDER), ""]
    lines += [f"## {REGISTRY_SECTION[1]}",
              mdkit.marker_block(REGISTRY_SECTION[0], render_registry_table(context)), ""]
    return mdkit.build_note(fm, "\n".join(lines))


def _review_report(context: dict, chosen: dict, judgment: dict, mode: str, judge: str) -> str:
    lines = [f"# Cumulative assessment review — {context['corpus']}", "",
             f"Mode {mode}, judge {judge}. Nothing below has been applied to the vault.", ""]
    for key, heading in SECTIONS:
        if key in chosen:
            lines += [f"## {heading}", chosen[key], ""]
    if judgment.get("overall_notes"):
        lines += ["## Judge's overall notes", judgment["overall_notes"], ""]
    return "\n".join(lines)
