"""The multi-agent research job: independent researchers → cross-critique →
deterministic validation → judge → deterministic librarian → git transaction.

Isolation: researchers/critics/judge write ONLY inside the job workspace
(.scripture-engine/jobs/<job_id>/). Production writes happen exclusively in
the librarian phase through the patch layer, inside a git transaction, after
validation. Role emphasis (supportive vs skeptical) rotates between providers
per job so neither model becomes "the believer" permanently.

Degraded modes (recorded in the job row):
- dual        two independent providers (claude + codex)
- single      one provider running both emphases (still critiqued + judged)
- stub        deterministic stub only (tests / zero-credential operation)
"""
from __future__ import annotations

import concurrent.futures
import threading
import hashlib
import json
import time
from pathlib import Path

from scripturegraph.agents import schemas
from scripturegraph.agents.providers import (Provider, available_providers, get_provider)
from scripturegraph.booksdata import split_chapter_slug
from scripturegraph.context import Ctx
from scripturegraph.coverage import update_chapter_coverage
from scripturegraph.graphops import chapter_display, resolve_name
from scripturegraph.indexing.citations import resolve_reference
from scripturegraph.util import json_write, new_id, now_iso, read_text, sha256_text, truncate
from scripturegraph.validation import quote_matches, validate_changed
from scripturegraph import gitops, usage
from scripturegraph.vaultgen import md as mdkit
from scripturegraph.vaultgen.generate import study_relpath
from scripturegraph.vaultgen.patch import PatchViolation, apply_ops

PROSE_SECTIONS = ("overview", "structure", "doctrines", "language", "literary",
                  "questions", "further-study")
LINK_STATUS = {"ACCEPT": "accepted", "ACCEPT_LOW_VISIBILITY": "low_visibility",
               "TENTATIVE": "tentative"}


LANDING = threading.RLock()
"""Serialises the write phase of a research job across parallel workers.

Everything before it — researchers, critics, judge — is minutes of waiting on
provider subprocesses and may overlap freely. Everything after it must not:
the write phase checkpoints git, writes the vault, validates, and on ANY
failure calls `gitops.hard_restore`, which reverts the whole vault subtree to
HEAD. Two workers landing at once would mean one of them rolling back the
other's finished chapter. The section costs seconds against a job's minutes,
so serialising it gives up almost nothing."""


class JobQuarantined(Exception):
    """The model produced content we will not accept. Terminal for this job."""


class ProviderUnavailable(Exception):
    """The provider itself could not be reached (rate limit, CLI/transport
    error, timeout) — NOT a content judgement. The job is untouched and must
    be retried later; quarantining it would throw away good work and hide a
    provider outage as if it were bad scholarship."""


# ------------------------------------------------------------------ prompts

def prompts_dir(ctx: Ctx) -> Path:
    return ctx.config_dir / "prompts"


def load_prompt(ctx: Ctx, name: str) -> tuple[str, str]:
    """(text, version-hash). Reads the vault's version-controlled prompt dir,
    falling back to package assets."""
    p = prompts_dir(ctx) / f"{name}.md"
    if p.exists():
        text = read_text(p)
    else:
        import importlib.resources as res
        text = res.files("scripturegraph").joinpath(f"assets/prompts/{name}.md") \
            .read_text(encoding="utf-8")
    return text, sha256_text(text)[:12]


def fill(template: str, **kw: str) -> str:
    out = template
    for k, v in kw.items():
        out = out.replace("{{" + k + "}}", v)
    return out


# ------------------------------------------------------------------ context

def build_context(ctx: Ctx, cslug: str) -> dict:
    db = ctx.db()
    book, n = split_chapter_slug(cslug)
    title = chapter_display(cslug)
    verses = [{"ref": f"{book.title_prefix} {n}:{r['verse']}", "slug": r["slug"],
               "text": r["text"]}
              for r in db.execute(
                  "SELECT slug, verse, text FROM verses WHERE chapter_slug=? ORDER BY verse",
                  (cslug,))]
    guide_path = study_relpath(book, n)
    sections = {}
    gp = ctx.vault / guide_path
    if gp.exists():
        _, body = mdkit.parse_note(read_text(gp))
        sections = {k: v for k, v in mdkit.list_sections(body).items()
                    if not mdkit.section_is_empty(v)}
    me = f"chapter:{cslug}"
    ents = {"person": [], "place": []}
    for r in db.execute(
            "SELECT n.node_type t, n.title ti, e.status s FROM edges e "
            "JOIN nodes n ON n.id=e.dst WHERE e.src=? AND e.rel='mentions' "
            "AND e.status IN ('accepted','tentative') ORDER BY e.weight DESC", (me,)):
        if r["t"] in ents:
            ents[r["t"]].append(r["ti"] + (" (?)" if r["s"] == "tentative" else ""))
    topics_linked = [r["ti"] for r in db.execute(
        "SELECT n.title ti FROM edges e JOIN nodes n ON n.id=e.dst "
        "WHERE e.src=? AND e.rel='discusses' ORDER BY e.weight DESC", (me,))]
    parallels = []
    for r in db.execute(
            "SELECT src, dst, weight, meta_json FROM edges WHERE (src=? OR dst=?) "
            "AND rel='parallel_to' AND status='accepted' ORDER BY weight DESC LIMIT 10",
            (me, me)):
        other_id = r["dst"] if r["src"] == me else r["src"]
        # these relations are not chapter-only (topics ride them too), and a
        # topic slug fed to chapter_display KeyErrors the whole job
        if not other_id.startswith("chapter:"):
            continue
        meta = json.loads(r["meta_json"] or "{}")
        parallels.append({"other": chapter_display(other_id.split(":", 1)[1]),
                          "n": meta.get("n_verse_pairs", 0)})
    candidates = []
    for r in db.execute(
            "SELECT src, dst, weight FROM edges WHERE (src=? OR dst=?) "
            "AND rel='semantically_related' ORDER BY weight DESC LIMIT 8", (me, me)):
        other_id = r["dst"] if r["src"] == me else r["src"]
        if not other_id.startswith("chapter:"):
            continue
        candidates.append({"other": chapter_display(other_id.split(":", 1)[1]),
                           "score": round(r["weight"] or 0, 3)})
    topic_titles = [r["title"] for r in db.execute(
        "SELECT title FROM nodes WHERE node_type='topic' ORDER BY title")]
    # secondary-source claims awaiting corroboration (§13: commentary is not
    # evidence; researchers weigh them, the judge rules, tier can then change)
    sec_claims = []
    for r in db.execute(
            "SELECT text, provenance_json, sources_json FROM claims "
            "WHERE node_id=? AND tier='TENTATIVE' AND consensus='secondary-claim' "
            "LIMIT 8", (me,)):
        prov = json.loads(r["provenance_json"] or "{}")
        srcs = json.loads(r["sources_json"] or "[]")
        sec_claims.append({
            "text": r["text"], "speaker": prov.get("speaker") or "unknown speaker",
            "source": (srcs[0].get("source") if srcs else "secondary source"),
            "primary_source_named": prov.get("primary_source_named")})
    return {"chapter_slug": cslug, "title": title, "volume": book.volume,
            "book": book.name, "chapter": n, "verses": verses,
            "existing_sections": sections, "entities": ents,
            "topics_linked": topics_linked, "parallels": parallels,
            "semantic_candidates": candidates, "topic_titles": topic_titles,
            "secondary_claims": sec_claims,
            "corpus_version": ctx.corpus_version()}


def context_markdown(c: dict) -> str:
    lines = [f"### Chapter: {c['title']}  ({c['volume']} — {c['book']} {c['chapter']})",
             "", "#### Scripture text (canonical; cite as e.g. "
             f"\"{c['title']}:{c['verses'][0]['ref'].rsplit(':', 1)[-1] if c['verses'] else 1}\")", ""]
    for v in c["verses"]:
        lines.append(f"{v['ref'].rsplit(':', 1)[-1]}. {v['text']}")
    lines += ["", "#### Verified index data (deterministic, trustworthy)"]
    if c["entities"]["person"]:
        lines.append("People mentioned: " + ", ".join(c["entities"]["person"][:20]))
    if c["entities"]["place"]:
        lines.append("Places mentioned: " + ", ".join(c["entities"]["place"][:15]))
    if c["parallels"]:
        lines.append("Text-overlap parallels (verified): " +
                     "; ".join(f"{p['other']} ({p['n']} verses)" for p in c["parallels"]))
    if c["topics_linked"]:
        lines.append("Topics currently linked: " + ", ".join(c["topics_linked"]))
    if c["semantic_candidates"]:
        lines.append("Semantic CANDIDATES (unverified, judge before trusting): " +
                     "; ".join(f"{s['other']} ({s['score']})" for s in c["semantic_candidates"]))
    if c.get("secondary_claims"):
        lines += ["", "#### Secondary-source claims AWAITING CORROBORATION",
                  "These are interpretations/claims from podcasts or lectures — "
                  "commentary, NOT primary evidence. If your research corroborates one "
                  "from primary sources, you may propose it (attributed); if it is "
                  "wrong or unsupported, say so."]
        for sc in c["secondary_claims"]:
            extra = (f" [names primary source: {sc['primary_source_named']}]"
                     if sc.get("primary_source_named") else "")
            lines.append(f"- {sc['speaker']} ({sc['source']}): {sc['text']}{extra}")
    if c["existing_sections"]:
        lines += ["", "#### Existing study-guide prose (improve, don't degrade)"]
        for name, text in c["existing_sections"].items():
            if name in PROSE_SECTIONS:
                lines.append(f"[{name}]\n{truncate(text, 1200)}")
    lines += ["", "#### Canonical vocabulary (the ONLY note titles you may wiki-link, "
                  "besides scripture chapter titles like [[Alma 36]])",
              ", ".join(c["topic_titles"])]
    return "\n".join(lines)


# ------------------------------------------------------- provider execution

_THROTTLE_HINTS = ("rate limit", "rate_limit", "429", "usage limit", "quota",
                   "overloaded", "too many requests")


def _is_throttle(err: str | None) -> bool:
    """Is this transport failure the plan pushing back, or a real error?

    Distinguishing them is what lets the ramp back off against throttling
    instead of against ordinary flakiness."""
    low = (err or "").lower()
    return any(h in low for h in _THROTTLE_HINTS)


def _call_validated(ctx: Ctx, provider: Provider, role: str, prompt: str,
                    schema_name: str, timeout: int, ws: Path,
                    context: dict | None, normalize=None) -> tuple[dict | None, dict]:
    """Run provider, parse+validate JSON. Returns (obj | None, stats).

    Two failure kinds are handled differently, because they mean different
    things. A TRANSPORT failure (rate limit, CLI error, timeout) says nothing
    about the work — we wait and try again, with growing backoff, because
    burning through it costs real research. A SCHEMA failure is the model
    getting the shape wrong — we retry immediately with the error quoted back.
    `normalize` (optional) deterministically repairs near-miss shapes BEFORE
    validation — cheaper than a model retry."""
    stats = {"provider": provider.name, "role": role, "cost_usd": 0.0, "calls": 0}
    max_schema = max(1, int(ctx.c("pipeline.schema_retries", 2)))
    max_transport = max(1, int(ctx.c("pipeline.transport_retries", 4)))
    backoff = float(ctx.c("pipeline.transport_backoff_s", 6))
    attempt_prompt = prompt
    last_err = ""
    schema_tries = 0
    transport_tries = 0
    attempt = 0
    while True:
        attempt += 1
        r = provider.run(attempt_prompt, role=role, timeout=timeout, workspace=ws,
                         context=context)
        stats["calls"] += 1
        stats["cost_usd"] += r.cost_usd or 0.0
        throttled = not r.ok and _is_throttle(r.error)
        # duck-typed on purpose: a provider stand-in must not have to implement
        # the telemetry surface just to be callable
        model = getattr(provider, "model_for_role", lambda _role: None)(role)
        usage.record_call(ctx, getattr(provider, "name", "?"), model, role,
                          (context or {}).get("job_id"),
                          (context or {}).get("chapter_slug"), r, throttled)
        if not r.ok:
            transport_tries += 1
            last_err = r.error
            ctx.log.warn("agent.call_failed", provider=provider.name, role=role,
                         attempt=attempt, transport_try=transport_tries,
                         error=r.error[:200])
            if transport_tries >= max_transport:
                stats["error"] = last_err
                stats["transport_failed"] = True
                return None, stats
            # 6s, 12s, 24s … a rate-limit window is usually shorter than this
            time.sleep(backoff * (2 ** (transport_tries - 1)))
            continue
        (ws / f"{role}_{provider.name}_raw_{attempt}.txt").write_text(
            r.text, encoding="utf-8", errors="replace")
        try:
            obj = schemas.extract_json(r.text)
            if normalize is not None:
                obj = normalize(obj)
            schemas.validate(obj, schema_name)
            return obj, stats
        except schemas.SchemaError as e:
            schema_tries += 1
            last_err = str(e)
            ctx.log.warn("agent.schema_invalid", provider=provider.name, role=role,
                         attempt=attempt, schema_try=schema_tries, error=str(e)[:300])
            if schema_tries >= max_schema:
                stats["error"] = last_err
                return None, stats
            attempt_prompt = (prompt + "\n\nYOUR PREVIOUS OUTPUT FAILED VALIDATION: "
                              + str(e)[:800] + "\nOutput ONLY the corrected JSON object.")


# --------------------------------------------------- deterministic checking

def validate_proposal(ctx: Ctx, proposal: dict, cslug: str) -> dict:
    """Mechanical verification of every claim's refs and quotes."""
    db = ctx.db()
    out: dict[str, dict] = {}
    for claim in proposal.get("claims", []):
        cid = str(claim.get("id"))
        res = {"refs_ok": True, "quotes_ok": True, "has_refs": bool(claim.get("scripture_refs")),
               "bad_refs": [], "bad_quotes": []}
        for ref in claim.get("scripture_refs", []) or []:
            cit = resolve_reference(str(ref))
            if cit is None or not db.execute(
                    "SELECT 1 FROM chapters WHERE slug=?", (cit.chapter_slug,)).fetchone():
                res["refs_ok"] = False
                res["bad_refs"].append(str(ref))
        for qspec in claim.get("quotes", []) or []:
            cit = resolve_reference(str(qspec.get("ref", "")))
            ok = False
            if cit is not None:
                verses = cit.verses() or None
                if verses:
                    rows = db.execute(
                        f"SELECT text FROM verses WHERE chapter_slug=? AND verse IN "
                        f"({','.join('?' * len(verses))})",
                        (cit.chapter_slug, *verses)).fetchall()
                else:
                    rows = db.execute("SELECT text FROM verses WHERE chapter_slug=?",
                                      (cit.chapter_slug,)).fetchall()
                source = " ".join(r["text"] for r in rows)
                ok = quote_matches(str(qspec.get("quote", "")), source)
            if not ok:
                res["quotes_ok"] = False
                res["bad_quotes"].append(str(qspec.get("ref", "?")))
        out[cid] = res
    return out


def enforce_floors(decisions: list[dict], validation: dict) -> list[dict]:
    """Code-level guarantees the judge cannot override."""
    order = ["REJECT", "QUARANTINE", "TENTATIVE", "ACCEPT_LOW_VISIBILITY", "ACCEPT"]

    def cap(outcome: str, ceiling: str) -> str:
        return ceiling if order.index(outcome) > order.index(ceiling) else outcome

    out = []
    for d in decisions:
        v = validation.get(d["claim_id"].split(":", 1)[-1]) or validation.get(d["claim_id"])
        outcome = d["outcome"]
        if v:
            if not v["quotes_ok"]:
                outcome = "REJECT"
            elif not v["refs_ok"]:
                outcome = cap(outcome, "TENTATIVE")
            elif not v["has_refs"]:
                outcome = cap(outcome, "TENTATIVE")
        out.append({**d, "outcome": outcome})
    return out


# ------------------------------------------------------------------ the job

def _select_researchers(ctx: Ctx) -> tuple[list[Provider], str]:
    pref = [str(x) for x in ctx.c("pipeline.researchers", ["claude", "codex"])]
    avail = {p.name: p for p in available_providers(ctx)}
    chosen = [avail[n] for n in pref if n in avail]
    if len(chosen) >= 2:
        return chosen[:2], "dual"
    if len(chosen) == 1:
        return [chosen[0], chosen[0]], "single"
    stub = get_provider(ctx, "stub")
    return [stub, stub], "stub"


def _claim_uid(cslug: str, text: str) -> str:
    return "clm-" + hashlib.sha1(f"{cslug}|{text}".encode()).hexdigest()[:12]


def run_chapter_job(ctx: Ctx, cslug: str) -> dict:
    db = ctx.db()
    row = db.execute("SELECT 1 FROM chapters WHERE slug=?", (cslug,)).fetchone()
    if row is None:
        raise ValueError(f"unknown chapter slug: {cslug}")
    job_id = new_id(f"job-{cslug}")
    ws = ctx.jobs_dir / job_id
    for sub in ("source", "critiques", "judge", "librarian", "validation"):
        (ws / sub).mkdir(parents=True, exist_ok=True)
    # Which researcher argues the supportive case, and which provider judges,
    # alternate per job. A COUNT(*) of the jobs table gave that alternation
    # while one job ran at a time; two workers starting together read the same
    # count and both take the same side. The job id is already unique, so
    # derive the parity from it and the alternation survives concurrency.
    seq = int(hashlib.sha1(job_id.encode()).hexdigest()[:8], 16)
    researchers, mode = _select_researchers(ctx)
    timeout = int(ctx.budget("job_timeout_sec") or 420)
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
            (job_id, "chapter-research", cslug, status, str(ws), ctx.corpus_version(),
             json.dumps({"mode": mode, "researchers": [p.name for p in researchers]}),
             json.dumps(costs), json.dumps(extra or {}), now_iso(), now_iso()))
        db.commit()

    set_status("created")
    context = build_context(ctx, cslug)
    context["job_id"] = job_id  # so each provider call can be attributed (usage telemetry)
    ctx_md = context_markdown(context)
    json_write(ws / "source" / "context.json", context)
    (ws / "source" / "context.md").write_text(ctx_md, encoding="utf-8")
    json_write(ws / "manifest.json", {
        "job_id": job_id, "target": cslug, "mode": mode,
        "researchers": [p.name for p in researchers],
        "corpus_version": ctx.corpus_version(), "created_at": now_iso()})

    constitution, _ = load_prompt(ctx, "_constitution_core")
    res_tpl, res_ver = load_prompt(ctx, "researcher")
    skeptic_tpl, skeptic_ver = load_prompt(ctx, "skeptic")
    judge_tpl, judge_ver = load_prompt(ctx, "judge")
    schema_txt = json.dumps(schemas.load_schema("proposal"), indent=1)

    # role-emphasis rotation (§17): who argues the strongest supportive case
    emphases = [
        "Build the STRONGEST well-supported case for meaningful findings in this "
        "chapter (connections, literary features, honest evidence) — while obeying "
        "every epistemic rule above.",
        "Be maximally CAREFUL and skeptical-minded: prefer fewer, bulletproof "
        "findings; actively flag weaknesses, ambiguities, and overreads.",
    ]
    if ctx.c("pipeline.role_rotation", True) and seq % 2 == 1:
        emphases.reverse()

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
                          SCHEMA=schema_txt, CONTEXT=ctx_md)
            futs[pool.submit(_call_validated, ctx, prov, "researcher", prompt,
                             "proposal", timeout, sub, context)] = labels[i]
        for fut, label in futs.items():
            obj, stats = fut.result()
            track(stats)
            if stats.get("transport_failed"):
                transport_down += 1
            proposals[label] = obj
            if obj is not None:
                json_write(ws / label / "proposal.json", obj)

    if proposals.get("a") is None and proposals.get("b") is None:
        # the provider being unreachable is not a verdict on the scholarship —
        # leave the job clean and let it be retried when the provider recovers
        if transport_down:
            set_status("provider_unavailable", {"reason": "provider unreachable"})
            raise ProviderUnavailable(f"{job_id}: provider unreachable during research")
        set_status("quarantined", {"reason": "no researcher produced valid output"})
        _quarantine(ctx, ws, job_id)
        raise JobQuarantined(f"{job_id}: no valid researcher output")
    for label in labels:
        if proposals[label] is None:
            proposals[label] = {"claims": [], "candidate_links": [], "study_sections": {}}

    # ---- cross critique ----
    set_status("critique")
    critique_schema_txt = json.dumps(schemas.load_schema("critique"), indent=1)
    critiques: dict[str, dict] = {}
    for label, other_idx in (("a", 1), ("b", 0)):
        critic = researchers[other_idx]
        prompt = fill(skeptic_tpl, CONSTITUTION=constitution, SCHEMA=critique_schema_txt,
                      CONTEXT=ctx_md,
                      PROPOSAL=json.dumps(proposals[label], ensure_ascii=False, indent=1))
        crit_ctx = {**context, "proposal": proposals[label]}
        obj, stats = _call_validated(ctx, critic, "critic", prompt, "critique",
                                     timeout, ws / "critiques", crit_ctx)
        track(stats)
        critiques[label] = obj or {"assessments": [], "overall": "critique unavailable"}
        json_write(ws / "critiques" / f"critique_of_{label}.json", critiques[label])

    # ---- deterministic validation ----
    validation = {}
    for label in labels:
        v = validate_proposal(ctx, proposals[label], cslug)
        for cid, res in v.items():
            validation[f"{label.upper()}:{cid}"] = res
    json_write(ws / "validation" / "results.json", validation)

    # ---- judge ----
    set_status("judge")
    judge_provider = _select_judge(ctx, researchers, seq)
    judgment_schema_txt = json.dumps(schemas.load_schema("judgment"), indent=1)
    # prefix claim ids so the judge can address A:c1 / B:c1 unambiguously
    pa = _prefix_claims(proposals["a"], "A")
    pb = _prefix_claims(proposals["b"], "B")
    prompt = fill(judge_tpl, CONSTITUTION=constitution, SCHEMA=judgment_schema_txt,
                  CONTEXT=ctx_md,
                  PROPOSAL_A=json.dumps(pa, ensure_ascii=False, indent=1),
                  CRITIQUE_A=json.dumps(critiques["a"], ensure_ascii=False, indent=1),
                  PROPOSAL_B=json.dumps(pb, ensure_ascii=False, indent=1),
                  CRITIQUE_B=json.dumps(critiques["b"], ensure_ascii=False, indent=1),
                  VALIDATION=json.dumps(validation, indent=1))
    judge_ctx = {**context, "validation": validation}
    judgment, stats = _call_validated(ctx, judge_provider, "judge", prompt, "judgment",
                                      timeout, ws / "judge", judge_ctx)
    track(stats)
    if judgment is None:
        # deterministic fallback: only mechanically verified claims, TENTATIVE
        judgment = {"decisions": [
            {"claim_id": cid, "outcome": "TENTATIVE" if v["refs_ok"] and v["quotes_ok"]
             else "REJECT", "rationale": "deterministic fallback (judge unavailable)"}
            for cid, v in validation.items()],
            "link_decisions": [], "section_approvals": {}}
    judgment["decisions"] = enforce_floors(judgment.get("decisions", []), validation)
    json_write(ws / "judge" / "decision.json", judgment)

    # ---- landing: DB outcomes + vault writes + git transaction ----
    # ONE worker at a time from here to the commit (see LANDING above).
    with LANDING:
        # ---- persist claims + link decisions ----
        persisted = _persist_outcomes(ctx, job_id, cslug, {"a": pa, "b": pb}, judgment,
                                      validation, mode,
                                      {"researcher": res_ver, "skeptic": skeptic_ver,
                                       "judge": judge_ver})

        # ---- chronology proposals → timeline (deterministic gate; non-fatal) ----
        try:
            from scripturegraph.timeline import ingest_chronology
            chron = ingest_chronology(ctx, cslug, [proposals["a"], proposals["b"]])
            if chron.get("proposed"):
                json_write(ws / "chronology.json", chron)
        except Exception as e:  # noqa: BLE001 — the timeline must never sink a job
            ctx.log.warn("research.chronology_failed", job=job_id, error=str(e)[:200])

        # ---- librarian (deterministic write phase, git transaction) ----
        set_status("librarian")
        ops = _librarian_ops(ctx, cslug, {"a": proposals["a"], "b": proposals["b"]}, judgment)
        json_write(ws / "librarian" / "patch.json", {"ops": ops})
        gitops.checkpoint(ctx, f"before research({context['title']})")
        applied = {"changed": [], "created": []}
        try:
            if ops:
                result = apply_ops(ctx, ops, actor=f"librarian:{job_id}")
                applied = {"changed": result.changed_paths, "created": result.created_paths}
            ev_created = _create_evidence_notes(ctx, job_id, cslug,
                                                persisted["accepted_evidence"])
            applied["created"].extend(ev_created)
            from scripturegraph.synthesis import synthesize_chapter
            synthesize_chapter(ctx, cslug)
            book, n = split_chapter_slug(cslug)
            report = validate_changed(ctx, [study_relpath(book, n), *applied["created"]])
            if report.fatal:
                raise PatchViolation("; ".join(f"{i.check}:{i.path}" for i in report.fatal))
        except Exception as e:  # noqa: BLE001 — ANY failure here must roll back BOTH stores
            gitops.hard_restore(ctx)
            _rollback_job_outcomes(ctx, job_id)
            set_status("failed", {"error": str(e)})
            ctx.log.error("job.apply_failed", job=job_id, error=str(e))
            raise RuntimeError(f"{job_id}: apply failed and was rolled back: {e}") from e
        rev = gitops.commit_all(ctx, f"research({context['title']}): "
                                     f"{persisted['n_accepted']} accepted, "
                                     f"{persisted['n_tentative']} tentative [{mode}]")
        update_chapter_coverage(ctx, cslug)
    set_status("applied", {"git_rev": rev, **persisted["counts"], "applied": applied})
    ctx.log.info("job.applied", job=job_id, target=cslug, mode=mode,
                 cost_usd=round(costs["usd"], 4), **persisted["counts"])
    return {"job_id": job_id, "mode": mode, "git_rev": rev, **persisted["counts"],
            "cost_usd": costs["usd"]}


# ------------------------------------------------------------------ helpers

def _rollback_job_outcomes(ctx: Ctx, job_id: str) -> None:
    """Compensating DB rollback when the write phase fails: this job's edges
    are removed and its claims quarantined, so no later synthesis can render
    outcomes whose files were rolled back. (The DB and the vault are separate
    stores; this keeps them consistent without cross-store transactions.)"""
    db = ctx.db()
    db.execute("DELETE FROM edges WHERE provenance=?", (f"job:{job_id}",))
    db.execute(
        "UPDATE claims SET tier='QUARANTINE', updated_at=? "
        "WHERE provenance_json LIKE ?", (now_iso(), f'%"{job_id}"%'))
    db.commit()


def _select_judge(ctx: Ctx, researchers: list[Provider], seq: int) -> Provider:
    want = ctx.c("pipeline.judge", "alternate")
    if want != "alternate":
        try:
            p = get_provider(ctx, str(want))
            if p.available():
                return p
        except KeyError:
            pass
    uniq: list[Provider] = []
    for p in researchers:
        if p.name not in [u.name for u in uniq]:
            uniq.append(p)
    return uniq[seq % len(uniq)]


def _prefix_claims(proposal: dict, prefix: str) -> dict:
    out = json.loads(json.dumps(proposal))
    for c in out.get("claims", []):
        c["id"] = f"{prefix}:{c.get('id')}"
    return out


def _quarantine(ctx: Ctx, ws: Path, job_id: str) -> None:
    import shutil
    dest = ctx.quarantine_dir / job_id
    try:
        shutil.copytree(ws, dest, dirs_exist_ok=True)
    except OSError:
        pass


def _persist_outcomes(ctx: Ctx, job_id: str, cslug: str, proposals: dict,
                      judgment: dict, validation: dict, mode: str,
                      prompt_versions: dict, node_id: str | None = None) -> dict:
    """Judged claims and links -> DB. `node_id` lets a subject dossier
    (agents/dossier.py) land its outcomes on the subject itself; chapter
    research leaves it unset and lands on the chapter."""
    db = ctx.db()
    by_id: dict[str, dict] = {}
    for label in ("a", "b"):
        for c in proposals[label].get("claims", []):
            by_id[str(c["id"])] = c
    counts = {"n_accepted": 0, "n_tentative": 0, "n_rejected": 0, "n_low": 0}
    accepted_evidence: list[dict] = []
    node_id = node_id or f"chapter:{cslug}"
    for d in judgment.get("decisions", []):
        claim = by_id.get(str(d["claim_id"]))
        if claim is None:
            continue
        tier = d["outcome"]
        if tier == "QUARANTINE":
            continue
        counts["n_accepted" if tier == "ACCEPT" else
               "n_low" if tier == "ACCEPT_LOW_VISIBILITY" else
               "n_tentative" if tier == "TENTATIVE" else "n_rejected"] += 1
        scores = dict(d.get("scores") or {})
        ev = claim.get("evidence") or {}
        for k in ("claim_confidence", "evidence_strength", "study_relevance",
                  "source_quality"):
            scores.setdefault(k, ev.get(k))
        if ev.get("class"):
            scores["class"] = ev["class"]
        v = validation.get(str(d["claim_id"])) or {}
        prov = {"job": job_id, "mode": mode, "prompt_versions": prompt_versions,
                "citations_verified": bool(v.get("refs_ok") and v.get("quotes_ok")),
                "judge_rationale": d.get("rationale", "")[:400]}
        uid = _claim_uid(cslug, claim["text"])
        db.execute(
            "INSERT INTO claims(id,node_id,claim_type,text,tier,scores_json,consensus,"
            "sources_json,provenance_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET claim_type=excluded.claim_type, "
            "text=excluded.text, tier=excluded.tier, scores_json=excluded.scores_json, "
            "consensus=excluded.consensus, sources_json=excluded.sources_json, "
            "provenance_json=excluded.provenance_json, updated_at=excluded.updated_at",
            (uid, node_id, claim.get("type"), claim["text"], tier,
             json.dumps(scores), d.get("consensus_status") or ev.get("consensus_status"),
             json.dumps(claim.get("sources") or []), json.dumps(prov),
             now_iso(), now_iso()))
        if tier in ("ACCEPT", "TENTATIVE") and claim.get("type") == "evidence":
            accepted_evidence.append({**claim, "tier": tier, "uid": uid, "scores": scores})
    # judged candidate links
    n_links = 0
    for ld in judgment.get("link_decisions", []):
        if ld["outcome"] not in LINK_STATUS:
            continue
        target_id = _resolve_link_target(ctx, str(ld["target"]))
        if target_id is None or target_id == node_id:
            continue
        from scripturegraph.graphops import add_edge
        add_edge(ctx, node_id, target_id, str(ld.get("rel", "semantically_related")),
                 LINK_STATUS[ld["outcome"]], None, None,
                 {"rationale": str(ld.get("rationale", ""))[:300]}, f"job:{job_id}")
        n_links += 1
    db.commit()
    return {"counts": {**counts, "n_links": n_links},
            "n_accepted": counts["n_accepted"], "n_tentative": counts["n_tentative"],
            "accepted_evidence": accepted_evidence}


def _resolve_link_target(ctx: Ctx, target: str) -> str | None:
    cit = resolve_reference(target)
    if cit is not None:
        row = ctx.db().execute("SELECT 1 FROM chapters WHERE slug=?",
                               (cit.chapter_slug,)).fetchone()
        return f"chapter:{cit.chapter_slug}" if row else None
    matches = resolve_name(ctx, target)
    if len(matches) == 1:
        return matches[0]["id"]
    return None


def _librarian_ops(ctx: Ctx, cslug: str, proposals: dict, judgment: dict) -> list[dict]:
    book, n = split_chapter_slug(cslug)
    relpath = study_relpath(book, n)
    ops: list[dict] = []
    for section, spec in (judgment.get("section_approvals") or {}).items():
        if section not in PROSE_SECTIONS or not isinstance(spec, dict):
            continue
        use = spec.get("use")
        text = ""
        if use == "a":
            text = proposals["a"].get("study_sections", {}).get(section, "")
        elif use == "b":
            text = proposals["b"].get("study_sections", {}).get(section, "")
        elif use == "merged":
            text = spec.get("merged_text", "")
        if text and use != "none":
            ops.append({"op": "set_section", "path": relpath, "section": section,
                        "content": text.strip()})
    ops.append({"op": "set_fm_field", "path": relpath,
                "field": "corpus_version_reviewed", "value": ctx.corpus_version()})
    return ops


_EVIDENCE_SUBFOLDER = {
    "chiasmus": "Chiasmus", "hebraism": "Hebraisms", "wordplay": "Names",
    "name": "Names", "etymology": "Names", "geography": "Geography",
    "archaeology": "Archaeology", "culture": "Ancient Culture",
    "legal": "Ancient Culture", "covenant": "Ancient Culture",
    "translation": "Translation", "manuscript": "Manuscripts",
    "textual": "Textual Criticism", "language": "Languages",
}


def _create_evidence_notes(ctx: Ctx, job_id: str, cslug: str,
                           accepted_evidence: list[dict]) -> list[str]:
    """Create full evidence dossier notes for high-relevance accepted evidence."""
    from scripturegraph.booksdata import BY_SLUG
    book_slug = cslug.rsplit("-", 1)[0]
    volume = BY_SLUG[book_slug].volume
    area = ("Book of Mormon" if volume == "Book of Mormon"
            else "Restoration" if volume in ("Doctrine and Covenants",)
            else "Bible" if volume in ("Old Testament", "New Testament")
            else "Book of Mormon")
    created: list[str] = []
    title_base = chapter_display(cslug)
    for ev in accepted_evidence:
        scores = ev.get("scores") or {}
        # study_relevance is model output: it arrives as 0.94, as "0.94", or as
        # a word. Comparing a str against the floor raises inside the write
        # phase, and EVERY judged claim for the chapter is then rolled back —
        # so coerce, and treat a genuinely non-numeric score as below the floor
        # (the claim is still persisted and rendered; only the dossier note,
        # which the floor exists to ration, is skipped).
        if _as_score(scores.get("study_relevance")) < 0.6 or ev["tier"] != "ACCEPT":
            continue
        cls = (ev.get("evidence") or {}).get("class") or "Evidence"
        sub = next((v for k, v in _EVIDENCE_SUBFOLDER.items() if k in cls.lower()),
                   "Literary" if area != "Restoration" else "")
        subfolder = f"{area}/{sub}" if sub else area
        title = f"{cls.title()} in {title_base}"
        body_lines = [ev["text"], ""]
        evd = ev.get("evidence") or {}
        if evd.get("does_not_establish"):
            body_lines += [f"**Does not establish:** {evd['does_not_establish']}", ""]
        if evd.get("alternative_explanations"):
            body_lines += ["**Alternative explanations:**"] + \
                [f"- {a}" for a in evd["alternative_explanations"]] + [""]
        refs = ev.get("scripture_refs") or []
        if refs:
            links: list[str] = []
            for r in refs:
                link = _ref_to_link(str(r))
                if link and link not in links:
                    links.append(link)
            if links:
                body_lines += ["**Scripture:** " + ", ".join(links[:10])]
        srcs = ev.get("sources") or []
        if srcs:
            body_lines += ["", "**Sources:**"] + [
                f"- {s.get('author', '?')} — *{s.get('title', '?')}*"
                f"{' (' + str(s['year']) + ')' if s.get('year') else ''}" for s in srcs]
        try:
            result = apply_ops(ctx, [{
                "op": "create_note", "kind": "evidence", "title": title,
                "subfolder": subfolder,
                "frontmatter": {
                    "evidence_class": cls, "claim_confidence": scores.get("claim_confidence"),
                    "evidence_strength": scores.get("evidence_strength"),
                    "study_relevance": scores.get("study_relevance"),
                    "source_quality": scores.get("source_quality"),
                    "consensus_status": evd.get("consensus_status"),
                },
                "sections": {"summary": "\n".join(body_lines)},
            }], actor=f"librarian:{job_id}")
            created.extend(result.created_paths)
            ctx.db().execute(
                "UPDATE claims SET provenance_json=json_set(provenance_json,"
                "'$.evidence_note', ?) WHERE id=?", (title, ev["uid"]))
            ctx.db().commit()
        except PatchViolation as e:
            ctx.log.warn("evidence_note.skipped", title=title, reason=str(e)[:200])
    return created


def _as_score(v) -> float:
    """Model-supplied 0–1 score as a float; 0.0 when it is not a number."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _ref_to_title(ref: str) -> str | None:
    cit = resolve_reference(str(ref))
    return chapter_display(cit.chapter_slug) if cit else None


def _ref_to_link(ref: str) -> str | None:
    """'Alma 36:22' -> verse-anchored wikilink; 'Alma 36' -> chapter link."""
    cit = resolve_reference(ref)
    if cit is None:
        return None
    title = chapter_display(cit.chapter_slug)
    verses = cit.verses()
    if verses:
        return mdkit.verse_link(title, f"{cit.chapter_slug}-{verses[0]}", cit.display())
    return mdkit.wikilink(title)
