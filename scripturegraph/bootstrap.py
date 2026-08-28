"""Bootstrap state machine (spec §36) — explicit, resumable, idempotent.

NOT_INITIALIZED → VAULT_CREATED → SCRIPTURES_IMPORTED → BASE_CORPORA_IMPORTED
→ NORMALIZED → GLOBAL_INDEX_BUILT → ENTITIES_EXTRACTED
→ SCRIPTURE_GRAPH_PASS_COMPLETE → TOPIC_PASS_COMPLETE
→ CONFERENCE_PASS_COMPLETE → HISTORY_PASS_COMPLETE → EVIDENCE_PASS_COMPLETE
→ CRITIQUE_PASS_COMPLETE → COVERAGE_EQUALIZATION → STEADY_STATE

Every stage handler can be re-run safely; heavy stages checkpoint through the
work queue, so a crash resumes mid-stage. Stages whose corpus is not yet
available complete as DEFERRED (recorded in meta) — importing that corpus
later re-opens the affected passes automatically via corpus versioning.
"""
from __future__ import annotations

import importlib.resources as res
import json
import shutil
from pathlib import Path

from scripturegraph import gitops
from scripturegraph.context import Ctx
from scripturegraph.util import atomic_write_text, now_iso
from scripturegraph.waves import enqueue_wave, process_queue, run_wave

STATES = [
    "NOT_INITIALIZED", "VAULT_CREATED", "SCRIPTURES_IMPORTED", "BASE_CORPORA_IMPORTED",
    "NORMALIZED", "GLOBAL_INDEX_BUILT", "ENTITIES_EXTRACTED",
    "SCRIPTURE_GRAPH_PASS_COMPLETE", "TOPIC_PASS_COMPLETE", "CONFERENCE_PASS_COMPLETE",
    "HISTORY_PASS_COMPLETE", "EVIDENCE_PASS_COMPLETE", "CRITIQUE_PASS_COMPLETE",
    "COVERAGE_EQUALIZATION", "STEADY_STATE",
]

DEFAULT_CONFIG_YAML = """\
# Scripture Graph engine configuration (deep-merged over built-in defaults).
# Modes: aggressive | balanced | economical  (budgets per mode are built in;
# override any value here, e.g.  budgets: {balanced: {nightly_ai_jobs: 50}} )
mode: balanced

automation:
  enabled: true       # master switch for scheduled runs
  ai_enabled: true    # allow AI provider calls during scheduled runs

bootstrap:
  ai_jobs: 2          # AI research jobs to run during bootstrap demonstration

# providers:
#   claude: {enabled: auto}   # auto-detects; run `claude /login` once to enable
#   codex:  {enabled: auto}
# embeddings:
#   provider: auto            # auto | hash | fastembed | openai
"""


def _state_file(ctx: Ctx) -> Path:
    return ctx.state_dir / "bootstrap.json"


def get_state(ctx: Ctx) -> str:
    return str(ctx.meta_get("bootstrap_state", "NOT_INITIALIZED"))


def _set_state(ctx: Ctx, state: str) -> None:
    ctx.meta_set("bootstrap_state", state)
    atomic_write_text(_state_file(ctx), json.dumps(
        {"state": state, "at": now_iso(), "corpus_version": ctx.corpus_version()}, indent=2))
    ctx.log.info("bootstrap.state", state=state)


# ------------------------------------------------------------------ stages

def _materialize_config(ctx: Ctx) -> None:
    """Copy prompts/schemas into the vault config dir (version-controlled),
    write default config.yaml + .env template."""
    cfg = ctx.config_dir
    (cfg / "prompts").mkdir(parents=True, exist_ok=True)
    (cfg / "schemas").mkdir(parents=True, exist_ok=True)
    for sub, pattern in (("prompts", "assets/prompts"), ("schemas", "assets/schemas")):
        folder = res.files("scripturegraph").joinpath(pattern)
        for entry in folder.iterdir():
            dest = cfg / sub / entry.name
            if not dest.exists():
                atomic_write_text(dest, entry.read_text(encoding="utf-8"))
    if not (cfg / "config.yaml").exists():
        atomic_write_text(cfg / "config.yaml", DEFAULT_CONFIG_YAML)
    env_example = cfg / ".env.example"
    if not env_example.exists():
        atomic_write_text(env_example,
                          "# Copy to .env (gitignored). Loaded into the engine's environment.\n"
                          "# OPENAI_API_KEY=sk-...        # only if using OpenAI embeddings\n"
                          "# CLAUDE_CODE_OAUTH_TOKEN=...  # from `claude setup-token` "
                          "(alternative to `claude /login`)\n")


def stage_vault_created(ctx: Ctx) -> None:
    from scripturegraph.corpus.registry import ensure_registry
    from scripturegraph.vaultgen.generate import generate_framework, write_system_docs
    Ctx(ctx.root, create=True)  # ensure engine tree
    _materialize_config(ctx)
    ctx.cfg = ctx._load_config()
    generate_framework(ctx)
    write_system_docs(ctx)
    ensure_registry(ctx)
    gitops.ensure_repo(ctx)
    gitops.commit_all(ctx, "bootstrap: vault framework, system docs, source registry")


def stage_scriptures_imported(ctx: Ctx) -> None:
    from scripturegraph.corpus.scriptures import import_standard_works
    from scripturegraph.vaultgen.generate import generate_scriptures
    stats = import_standard_works(ctx, strict=bool(ctx.c("bootstrap.strict_import", True)))
    if stats.get("missing_files") and ctx.c("bootstrap.strict_import", True):
        raise RuntimeError(
            f"scripture corpus incomplete — missing {stats['missing_files']}. "
            "Re-run the downloader (see README) and retry bootstrap.")
    if stats.get("changed"):
        ctx.bump_corpus_version("standard works imported")
    generate_scriptures(ctx)
    gitops.commit_all(ctx, "bootstrap: canonical scripture + study stubs + personal scaffolds")


def stage_base_corpora(ctx: Ctx) -> None:
    from scripturegraph.corpus.registry import scan_drop
    scan_drop(ctx)
    gitops.commit_all(ctx, "bootstrap: base corpora import (drop folders)")


def stage_normalized(ctx: Ctx) -> None:
    n = ctx.db().execute("SELECT COUNT(*) AS n FROM chunks").fetchone()["n"]
    if n < int(ctx.c("bootstrap.min_chunks", 30000)):
        raise RuntimeError(f"normalization incomplete: only {n} chunks")


def stage_global_index(ctx: Ctx) -> None:
    run_wave(ctx, "embed")
    from scripturegraph.db import rebuild_fts
    rebuild_fts(ctx.db())


def stage_entities(ctx: Ctx) -> None:
    from scripturegraph.indexing.entities import ensure_entities
    ensure_entities(ctx)
    _copy_seed_notes(ctx)
    run_wave(ctx, "entities")
    run_wave(ctx, "citations")
    gitops.commit_all(ctx, "bootstrap: entity notes + global entity/citation passes")


def stage_scripture_graph(ctx: Ctx) -> None:
    run_wave(ctx, "parallels")
    run_wave(ctx, "topics")
    run_wave(ctx, "semantic")
    run_wave(ctx, "synthesis")
    gitops.commit_all(ctx, "bootstrap: global cross-reference passes + study-guide synthesis")


def stage_topics(ctx: Ctx) -> None:
    run_wave(ctx, "topic-synthesis")
    gitops.commit_all(ctx, "bootstrap: gospel-topic dossiers (deterministic layer)")


def _deferred_stage(ctx: Ctx, key: str, wave: str, source_type: str) -> None:
    row = ctx.db().execute("SELECT 1 FROM sources WHERE type=? AND status='imported' LIMIT 1",
                           (source_type,)).fetchone()
    if row:
        run_wave(ctx, wave)
        ctx.meta_set(f"deferred:{key}", "0")
        gitops.commit_all(ctx, f"bootstrap: {key} pass")
    else:
        ctx.meta_set(f"deferred:{key}", "1")
        ctx.log.info("bootstrap.deferred", stage=key,
                     reason=f"no {source_type} corpus imported yet")


def stage_conference(ctx: Ctx) -> None:
    _deferred_stage(ctx, "conference", "conference", "conference")


def stage_history(ctx: Ctx) -> None:
    row = ctx.db().execute(
        "SELECT 1 FROM sources WHERE type IN ('jsp','history') AND status='imported' "
        "LIMIT 1").fetchone()
    if row:
        run_wave(ctx, "history")
        ctx.meta_set("deferred:history", "0")
        gitops.commit_all(ctx, "bootstrap: history pass")
    else:
        ctx.meta_set("deferred:history", "1")
        ctx.log.info("bootstrap.deferred", stage="history", reason="no history corpus yet")


def stage_evidence(ctx: Ctx) -> None:
    """Seed evidence exists (copied in ENTITIES). Run the demonstration AI
    research jobs here if a provider is ready; otherwise defer to nightly."""
    from scripturegraph.agents.providers import any_provider_available
    n_jobs = int(ctx.c("bootstrap.ai_jobs", 2))
    if any_provider_available(ctx) and ctx.c("automation.ai_enabled", True) and n_jobs > 0:
        from scripturegraph.coverage import update_all_coverage
        update_all_coverage(ctx)
        enqueue_wave(ctx, "research", limit=n_jobs, by_priority=False)
        process_queue(ctx, include_ai=True, ai_budget=n_jobs)
        ctx.meta_set("deferred:evidence_ai", "0")
    else:
        ctx.meta_set("deferred:evidence_ai", "1")
        ctx.log.info("bootstrap.deferred", stage="evidence_ai",
                     reason="no AI provider available/enabled")
    gitops.commit_all(ctx, "bootstrap: evidence stage")


def stage_critique(ctx: Ctx) -> None:
    """Deterministic re-audit of every stored claim's mechanical support."""
    from scripturegraph.agents.pipeline import validate_proposal  # reuse checker parts
    from scripturegraph.indexing.citations import resolve_reference
    db = ctx.db()
    n_checked = n_flagged = 0
    for r in db.execute("SELECT id, provenance_json FROM claims "
                        "WHERE tier IN ('ACCEPT','ACCEPT_LOW_VISIBILITY','TENTATIVE')").fetchall():
        prov = json.loads(r["provenance_json"] or "{}")
        n_checked += 1
        if prov.get("citations_verified") is False:
            db.execute("UPDATE claims SET tier='TENTATIVE', updated_at=? WHERE id=?",
                       (now_iso(), r["id"]))
            n_flagged += 1
    db.commit()
    ctx.log.info("bootstrap.critique", checked=n_checked, downgraded=n_flagged)


def stage_equalization(ctx: Ctx) -> None:
    from scripturegraph.coverage import stats, update_all_coverage
    update_all_coverage(ctx)
    s = stats(ctx)
    target = float(ctx.c("coverage.variance_target", 12.0))
    stddev = s.get("overall", {}).get("stddev", 0)
    ctx.meta_set("coverage_stddev", stddev)
    # deterministic dims are corpus-wide by construction; queue the weakest
    # for the next AI refinement rounds so nightly runs equalize further
    from scripturegraph import queue as q
    from scripturegraph.coverage import weakest_chapters
    batch = int(ctx.c("coverage.equalize_batch", 40))
    for w in weakest_chapters(ctx, batch):
        q.enqueue(ctx, "job", w["node_id"].split(":", 1)[1], pass_name="research",
                  priority=w["priority"] or 0)
    ctx.db().commit()
    ctx.log.info("bootstrap.equalization", stddev=stddev, target=target,
                 queued_for_ai=batch)


def stage_steady(ctx: Ctx) -> None:
    from scripturegraph.gardener import run_gardener
    from scripturegraph.statuscmd import write_status_note
    run_gardener(ctx, repair=True)
    write_status_note(ctx)
    gitops.commit_all(ctx, "bootstrap: complete → steady state")


def _copy_seed_notes(ctx: Ctx) -> None:
    """Curated exemplar evidence + question dossiers from package assets."""
    import re
    from scripturegraph.util import sha256_text, read_text
    from scripturegraph.vaultgen.generate import write_once
    from scripturegraph.vaultgen import md as mdkit
    from scripturegraph.util import slugify
    base = res.files("scripturegraph").joinpath("assets/seed_notes")
    for kind, folder_of in (("evidence", None), ("questions", "50 Questions")):
        src_dir = base.joinpath(kind)
        try:
            entries = list(src_dir.iterdir())
        except FileNotFoundError:
            continue
        for entry in entries:
            if not entry.name.endswith(".md"):
                continue
            text = entry.read_text(encoding="utf-8")
            fm, _body = mdkit.parse_note(text)
            rel = fm.get("sg-path") or f"{folder_of}/{entry.name}"
            text = re.sub(r"^sg-path: .*\n", "", text, flags=re.MULTILINE)
            if write_once(ctx, rel, "evidence" if kind == "evidence" else "question",
                          "librarian", text):
                title = Path(rel).stem
                node_kind = "evidence" if kind == "evidence" else "question"
                node_id = f"{node_kind}:{slugify(title)}"
                ctx.db().execute(
                    "INSERT INTO nodes(id,node_type,title,vault_path,created_at,updated_at) "
                    "VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
                    (node_id, node_kind, title, rel, now_iso(), now_iso()))
                ctx.db().execute(
                    "UPDATE file_registry SET node_id=? WHERE path=?", (node_id, rel))
    ctx.db().commit()


STAGE_HANDLERS = {
    "VAULT_CREATED": stage_vault_created,
    "SCRIPTURES_IMPORTED": stage_scriptures_imported,
    "BASE_CORPORA_IMPORTED": stage_base_corpora,
    "NORMALIZED": stage_normalized,
    "GLOBAL_INDEX_BUILT": stage_global_index,
    "ENTITIES_EXTRACTED": stage_entities,
    "SCRIPTURE_GRAPH_PASS_COMPLETE": stage_scripture_graph,
    "TOPIC_PASS_COMPLETE": stage_topics,
    "CONFERENCE_PASS_COMPLETE": stage_conference,
    "HISTORY_PASS_COMPLETE": stage_history,
    "EVIDENCE_PASS_COMPLETE": stage_evidence,
    "CRITIQUE_PASS_COMPLETE": stage_critique,
    "COVERAGE_EQUALIZATION": stage_equalization,
    "STEADY_STATE": stage_steady,
}


def run_bootstrap(ctx: Ctx, until: str | None = None) -> str:
    """Advance the state machine (resumable). Returns the final state."""
    until = until or "STEADY_STATE"
    if until not in STATES:
        raise ValueError(f"unknown stage {until!r}")
    current = get_state(ctx)
    ctx.log.info("bootstrap.start", state=current, until=until)
    while current != until:
        nxt = STATES[STATES.index(current) + 1]
        handler = STAGE_HANDLERS[nxt]
        ctx.log.info("bootstrap.stage", stage=nxt)
        handler(ctx)
        _set_state(ctx, nxt)
        current = nxt
        if current == "STEADY_STATE":
            break
    return current
