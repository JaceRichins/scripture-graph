"""Command-line interface for the Scripture Graph engine."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from scripturegraph import __version__
from scripturegraph.context import Ctx


def _ctx(args) -> Ctx:
    if getattr(args, "root", None):
        return Ctx(args.root)
    return Ctx.locate()


def cmd_init(args):
    ctx = Ctx(args.root, create=True) if args.root else Ctx.locate()
    from scripturegraph.bootstrap import get_state, run_bootstrap
    if get_state(ctx) == "NOT_INITIALIZED":
        run_bootstrap(ctx, until="VAULT_CREATED")
    print(f"Vault initialized at: {ctx.vault}")
    print("Next: scripturegraph bootstrap")
    return 0


def cmd_bootstrap(args):
    ctx = _ctx(args)
    from scripturegraph.bootstrap import get_state, run_bootstrap
    final = run_bootstrap(ctx, until=args.until)
    print(f"Bootstrap state: {final}")
    return 0


def cmd_status(args):
    ctx = _ctx(args)
    from scripturegraph.statuscmd import print_status
    print_status(ctx, write_note=not args.no_note)
    return 0


def cmd_ingest(args):
    ctx = _ctx(args)
    from scripturegraph.corpus.registry import ensure_registry, scan_drop
    ensure_registry(ctx)
    if args.file:
        from scripturegraph.corpus.registry import DROP_CATEGORIES
        from scripturegraph.corpus.conference import import_conference_file
        from scripturegraph.corpus.universal import import_document_file
        from scripturegraph.util import sha256_file
        path = Path(args.file)
        cat = args.category or "reference"
        source_id, doc_type = DROP_CATEGORIES[cat]
        h = sha256_file(path)
        key = f"manual:{path.name}"
        if cat == "conference":
            n = import_conference_file(ctx, path, source_id, key, h)
        else:
            n = import_document_file(ctx, path, source_id, doc_type, key, h)
        ctx.bump_corpus_version(f"manual import {path.name}")
        print(f"Imported {n} document(s) from {path.name}")
    else:
        stats = scan_drop(ctx)
        print(f"Drop scan: {stats}")
    return 0


def cmd_index(args):
    ctx = _ctx(args)
    from scripturegraph.db import rebuild_fts
    from scripturegraph.indexing.embeddings import embed_missing
    if args.rebuild:
        from scripturegraph.corpus.scriptures import import_standard_works
        from scripturegraph.vaultgen.generate import generate_scriptures
        import_standard_works(ctx, force=True)
        generate_scriptures(ctx)
    rebuild_fts(ctx.db())
    stats = embed_missing(ctx)
    print(f"Index: FTS rebuilt; embeddings: {stats}")
    return 0


def cmd_run(args):
    ctx = _ctx(args)
    from scripturegraph import runners
    if args.nightly:
        stats = runners.run_nightly(ctx)
    elif args.weekly:
        stats = runners.run_weekly(ctx)
    elif args.study:
        stats = runners.run_study(ctx)
    else:
        stats = runners.run_frequent(ctx)
    print(json.dumps(stats, indent=2, default=str))
    return 0


def cmd_refine(args):
    ctx = _ctx(args)
    from scripturegraph.booksdata import chapter_slug, find_chapter_by_title
    from scripturegraph.waves import PASS_DEFS, enqueue_wave, process_queue
    if args.target:
        found = find_chapter_by_title(args.target)
        if found is None:
            print(f"Cannot resolve chapter: {args.target!r}", file=sys.stderr)
            return 2
        book, n = found
        cslug = chapter_slug(book, n)
        if args.ai:
            from scripturegraph.agents.pipeline import run_chapter_job
            result = run_chapter_job(ctx, cslug)
            from scripturegraph.waves import mark_pass
            mark_pass(ctx, "research", cslug, "ai")
            print(json.dumps(result, indent=2, default=str))
        else:
            from scripturegraph.synthesis import synthesize_chapter
            print(json.dumps(synthesize_chapter(ctx, cslug), indent=2))
        return 0
    count = args.count or 10
    if args.ai:
        enqueue_wave(ctx, "research", limit=count, by_priority=True)
        stats = process_queue(ctx, include_ai=True, ai_budget=count)
    else:
        enqueue_wave(ctx, "synthesis", limit=count, by_priority=True)
        stats = process_queue(ctx, include_ai=False)
    print(json.dumps(stats, indent=2))
    return 0


def cmd_waves(args):
    ctx = _ctx(args)
    from scripturegraph.waves import PASS_DEFS, run_wave, waves_status
    if args.action == "status":
        print(json.dumps(waves_status(ctx), indent=2))
        return 0
    if args.pass_name not in PASS_DEFS:
        print(f"Unknown pass. Available: {', '.join(PASS_DEFS)}", file=sys.stderr)
        return 2
    stats = run_wave(ctx, args.pass_name, limit=args.limit)
    from scripturegraph import gitops
    gitops.commit_all(ctx, f"wave: {args.pass_name}")
    print(json.dumps(stats, indent=2))
    return 0


def cmd_gardener(args):
    ctx = _ctx(args)
    from scripturegraph import gitops
    from scripturegraph.gardener import run_gardener
    stats = run_gardener(ctx, repair=not args.no_repair)
    gitops.commit_all(ctx, "gardener: maintenance")
    print(json.dumps({k: v for k, v in stats.items() if not isinstance(v, dict)},
                     indent=2, default=str))
    return 0


def cmd_health(args):
    return cmd_gardener(args)


def cmd_translations(args):
    ctx = _ctx(args)
    from scripturegraph import gitops
    from scripturegraph.lockfile import EngineBusy, engine_lock
    from scripturegraph.translations import build_translations
    try:
        with engine_lock(ctx):
            gitops.checkpoint(ctx, "translations: pre-build checkpoint")
            stats = build_translations(ctx, refresh=args.refresh)
            gitops.commit_all(ctx, "translations: public-domain bibles (WEB/ASV/YLT)")
    except EngineBusy:
        print("engine busy — another run holds the lock; try again shortly")
        return 1
    print(json.dumps(stats, indent=2))
    return 0


def cmd_queue(args):
    ctx = _ctx(args)
    from scripturegraph import queue as q
    if args.revive:
        n = q.revive_dead(ctx, only_provider_errors=not args.all)
        print(json.dumps({"revived": n, "queue": q.counts(ctx)}, indent=2))
        return 0
    print(json.dumps(q.counts(ctx), indent=2))
    return 0


def cmd_dictionary(args):
    ctx = _ctx(args)
    from scripturegraph import gitops
    from scripturegraph.dictionary import build_dictionary
    from scripturegraph.lockfile import EngineBusy, engine_lock
    try:
        with engine_lock(ctx):
            gitops.checkpoint(ctx, "dictionary: pre-build checkpoint")
            stats = build_dictionary(ctx, refresh=args.refresh)
            gitops.commit_all(ctx, "dictionary: Easton + Smith (public domain)")
    except EngineBusy:
        print("engine busy — another run holds the lock; try again shortly")
        return 1
    print(json.dumps(stats, indent=2))
    return 0


def cmd_crossrefs(args):
    ctx = _ctx(args)
    from scripturegraph import gitops
    from scripturegraph.crossrefs import build_crossrefs
    from scripturegraph.lockfile import EngineBusy, engine_lock
    try:
        with engine_lock(ctx):
            gitops.checkpoint(ctx, "crossrefs: pre-build checkpoint")
            stats = build_crossrefs(ctx)
            gitops.commit_all(ctx, "crossrefs: deterministic verse parallels")
    except EngineBusy:
        print("engine busy — another run holds the lock; try again shortly")
        return 1
    print(json.dumps(stats, indent=2))
    return 0


def cmd_validate(args):
    ctx = _ctx(args)
    from scripturegraph.validation import validate_all
    report = validate_all(ctx, repair=args.repair)
    print(json.dumps(report.summary(), indent=2))
    for issue in report.errors[:40]:
        print(f"  [{issue.severity}] {issue.check}: {issue.path} — {issue.detail}")
    return 1 if report.fatal and not args.repair else 0


def cmd_ask(args):
    ctx = _ctx(args)
    from scripturegraph.ask import ask
    print(ask(ctx, " ".join(args.question)))
    return 0


def cmd_fetch(args):
    ctx = _ctx(args)
    from scripturegraph.corpus import fetchers, glib
    from scripturegraph.corpus.registry import ensure_registry
    from scripturegraph.lockfile import EngineBusy, engine_lock
    try:
        with engine_lock(ctx):
            return _cmd_fetch_locked(ctx, args, fetchers, glib, ensure_registry)
    except EngineBusy:
        print("Another engine run (study tick / nightly / fetch) holds the lock — "
              "try again shortly.", file=sys.stderr)
        return 3


def _cmd_fetch_locked(ctx, args, fetchers, glib, ensure_registry):
    ensure_registry(ctx)
    fetchers.register_acquisition_sources(ctx)
    out = {}
    if args.what in ("conference", "all"):
        out["conference"] = fetchers.fetch_conference_range(
            ctx, args.from_year, args.to_year)
    if args.what in ("history", "all"):
        out["history"] = fetchers.fetch_public_domain_history(ctx)
        ctx.bump_corpus_version("public-domain history corpus")
        from scripturegraph.corpus.registry import _enqueue_affected, write_manifest
        _enqueue_affected(ctx, {"history", "conference"})
        write_manifest(ctx)
    if args.what in ("jsp", "all"):
        from scripturegraph.corpus.jsp_refs import write_jsp_reference_notes
        out["jsp_reference_notes"] = write_jsp_reference_notes(ctx)
    if args.what in ("od", "gospel-library", "all"):
        out["official_declarations"] = glib.fetch_official_declarations(ctx)
    if args.what in ("apparatus", "gospel-library", "all"):
        out["apparatus"] = glib.fetch_all_apparatus(ctx, limit=args.limit)
    if args.what in ("collections", "gospel-library", "all"):
        budget = args.limit or 10000
        for name, spec in sorted(glib.COLLECTIONS.items(),
                                 key=lambda kv: kv[1]["priority"]):
            if args.collection and name != args.collection:
                continue
            if spec["priority"] > args.max_priority and not args.collection:
                continue
            out[name] = glib.crawl_collection(ctx, name, budget)
    if args.what in ("collections", "gospel-library", "all"):
        out["collection_notes"] = glib.write_collection_notes(ctx)
    if args.what in ("od", "apparatus", "collections", "gospel-library", "all"):
        ctx.bump_corpus_version(f"gospel-library fetch: {args.what}")
        from scripturegraph.corpus.registry import _enqueue_affected, write_manifest
        _enqueue_affected(ctx, {"reference", "history"})
        write_manifest(ctx)
    from scripturegraph import gitops
    gitops.commit_all(ctx, f"acquire: {args.what} corpus fetch")
    print(json.dumps(out, indent=2, default=str))
    return 0


def cmd_scheduler(args):
    ctx = _ctx(args)
    from scripturegraph import scheduler_win
    fn = {"install": scheduler_win.install, "remove": scheduler_win.remove,
          "status": scheduler_win.status}[args.action]
    print(json.dumps(fn(ctx), indent=2))
    return 0


def cmd_source(args):
    ctx = _ctx(args)
    from scripturegraph.corpus.registry import ensure_registry, write_manifest
    ensure_registry(ctx)
    if args.action == "list":
        rows = ctx.db().execute(
            "SELECT source_id, type, authority_category, status, last_imported "
            "FROM sources ORDER BY authority_category").fetchall()
        for r in rows:
            print(f"{r['source_id']:24s} {r['type']:12s} auth={r['authority_category']} "
                  f"{r['status']:28s} imported={r['last_imported'] or '—'}")
    elif args.action == "manifest":
        write_manifest(ctx)
        print("Manifest written to 90 Sources/manifests/Source Registry.md")
    return 0


def cmd_secondary(args):
    ctx = _ctx(args)
    from scripturegraph.lockfile import EngineBusy, engine_lock
    from scripturegraph.secondary import registry
    if args.action == "status":
        rows = ctx.db().execute(
            "SELECT s.name, s.approval_status, s.quality_tier, s.overall_score, "
            "COUNT(i.item_id) AS items, "
            "SUM(CASE WHEN i.status='ingested' THEN 1 ELSE 0 END) AS ingested "
            "FROM sec_sources s LEFT JOIN sec_items i ON i.source_id=s.source_id "
            "GROUP BY s.source_id ORDER BY s.overall_score DESC").fetchall()
        for r in rows:
            score = f"{r['overall_score']:.0f}" if r["overall_score"] else "—"
            print(f"{r['name'][:38]:38s} {r['approval_status']:12s} "
                  f"tier={r['quality_tier'] or '—'} score={score:>3s} "
                  f"items={r['items']} ingested={r['ingested'] or 0}")
        return 0
    try:
        with engine_lock(ctx):
            from scripturegraph import gitops
            from scripturegraph.secondary.ingest import (secondary_nightly,
                                                         secondary_weekly)
            if args.action == "seed":
                out = {"seeded": registry.seed(ctx)}
                from scripturegraph.secondary.vaultout import write_all_notes
                out["vault"] = write_all_notes(ctx)
            elif args.action == "nightly":
                out = secondary_nightly(ctx)
            elif args.action == "weekly":
                out = secondary_weekly(ctx)
            else:  # refresh: feeds only, no AI
                from scripturegraph.secondary.feeds import refresh_source_items
                registry.seed(ctx)
                out = {"feeds": [refresh_source_items(ctx, s) for s in
                                 registry.list_sources(ctx, ("APPROVED", "CONDITIONAL"))]}
            gitops.commit_all(ctx, f"secondary: {args.action}")
            print(json.dumps(out, indent=2, default=str))
            return 0
    except EngineBusy:
        print("Another engine run holds the lock — try again shortly.", file=sys.stderr)
        return 3


def cmd_test(args):
    import subprocess
    root = Path(args.root) if args.root else Ctx.locate().root
    cp = subprocess.run([sys.executable, "-m", "pytest", str(root / "tests"), "-q",
                        *(args.pytest_args or [])], cwd=str(root))
    return cp.returncode


def cmd_version(args):
    print(f"scripturegraph {__version__}")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(
        prog="scripturegraph",
        description="Scripture Graph — deterministic orchestrator for an AI-maintained "
                    "Obsidian scripture knowledge graph.")
    p.add_argument("--root", help="project root (default: auto-locate / SG_ROOT)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="create the vault skeleton + config").set_defaults(fn=cmd_init)

    sp = sub.add_parser("bootstrap", help="run/resume the bootstrap state machine")
    sp.add_argument("--until", default=None, help="stop after reaching this stage")
    sp.set_defaults(fn=cmd_bootstrap)

    sub.add_parser("crossrefs", help="rebuild deterministic verse-parallel cross-references") \
        .set_defaults(fn=cmd_crossrefs)

    sp = sub.add_parser("translations", help="fetch public-domain Bible translations (WEB/ASV/YLT)")
    sp.add_argument("--refresh", action="store_true", help="re-download even if cached")
    sp.set_defaults(fn=cmd_translations)

    sp = sub.add_parser("queue", help="queue status; --revive returns dead items to work")
    sp.add_argument("--revive", action="store_true",
                    help="return dead items (provider/rate-limit victims) to pending")
    sp.add_argument("--all", action="store_true",
                    help="with --revive: revive every dead item, not just provider errors")
    sp.set_defaults(fn=cmd_queue)

    sp = sub.add_parser("dictionary", help="fetch the public-domain Bible dictionary (Easton + Smith)")
    sp.add_argument("--refresh", action="store_true", help="re-download even if cached")
    sp.set_defaults(fn=cmd_dictionary)

    sp = sub.add_parser("status", help="status dashboard (console + Status.md)")
    sp.add_argument("--no-note", action="store_true")
    sp.set_defaults(fn=cmd_status)

    sp = sub.add_parser("ingest", help="scan drop folders / import a file")
    sp.add_argument("--file", help="import one specific file")
    sp.add_argument("--category", choices=["conference", "jsp", "history", "reference",
                                           "scholarship"])
    sp.set_defaults(fn=cmd_ingest)

    sp = sub.add_parser("index", help="rebuild FTS + embeddings")
    sp.add_argument("--rebuild", action="store_true",
                    help="also re-import scripture + regenerate canonical files")
    sp.set_defaults(fn=cmd_index)

    sp = sub.add_parser("run", help="scheduled run entry points")
    g = sp.add_mutually_exclusive_group()
    g.add_argument("--frequent", action="store_true")
    g.add_argument("--nightly", action="store_true")
    g.add_argument("--weekly", action="store_true")
    g.add_argument("--study", action="store_true",
                   help="time-boxed study tick (AI research on weakest chapters)")
    sp.set_defaults(fn=cmd_run)

    sp = sub.add_parser("refine", help="refine chapters (deterministic or --ai)")
    sp.add_argument("--target", help='chapter title, e.g. "Alma 36"')
    sp.add_argument("--count", type=int, help="number of chapters (priority order)")
    sp.add_argument("--ai", action="store_true", help="full multi-agent research job")
    sp.set_defaults(fn=cmd_refine)

    sp = sub.add_parser("waves", help="run or inspect global passes")
    sp.add_argument("action", choices=["run", "status"])
    sp.add_argument("--pass", dest="pass_name", help="pass name (waves run)")
    sp.add_argument("--limit", type=int)
    sp.set_defaults(fn=cmd_waves)

    sp = sub.add_parser("gardener", help="maintenance + Graph Health report")
    sp.add_argument("--no-repair", action="store_true")
    sp.set_defaults(fn=cmd_gardener)

    sp = sub.add_parser("health", help="alias of gardener")
    sp.add_argument("--no-repair", action="store_true")
    sp.set_defaults(fn=cmd_health)

    sp = sub.add_parser("validate", help="deterministic validation suite")
    sp.add_argument("--repair", action="store_true",
                    help="auto-restore drifted canonical scripture")
    sp.set_defaults(fn=cmd_validate)

    sp = sub.add_parser("ask", help="answer a question from the local graph")
    sp.add_argument("question", nargs="+")
    sp.set_defaults(fn=cmd_ask)

    sp = sub.add_parser("fetch", help="acquire corpora (conference API / Gospel Library / "
                                      "public-domain history / JSP records)")
    sp.add_argument("what", choices=["conference", "history", "jsp", "od", "apparatus",
                                     "collections", "gospel-library", "all"])
    sp.add_argument("--from-year", type=int, default=2015)
    sp.add_argument("--to-year", type=int, default=2026)
    sp.add_argument("--limit", type=int, help="page cap for apparatus/collections")
    sp.add_argument("--collection", help="fetch just this named collection")
    sp.add_argument("--max-priority", type=int, default=2,
                    help="collections: include priorities <= N (default 2)")
    sp.set_defaults(fn=cmd_fetch)

    sp = sub.add_parser("scheduler", help="Windows Task Scheduler tasks")
    sp.add_argument("action", choices=["install", "remove", "status"])
    sp.set_defaults(fn=cmd_scheduler)

    sp = sub.add_parser("source", help="source registry")
    sp.add_argument("action", choices=["list", "manifest"])
    sp.set_defaults(fn=cmd_source)

    sp = sub.add_parser("secondary", help="secondary-source registry + ingestion")
    sp.add_argument("action", choices=["status", "seed", "refresh", "nightly", "weekly"])
    sp.set_defaults(fn=cmd_secondary)

    sp = sub.add_parser("test", help="run the automated test suite")
    sp.add_argument("pytest_args", nargs="*")
    sp.set_defaults(fn=cmd_test)

    sub.add_parser("version", help="engine version").set_defaults(fn=cmd_version)

    args = p.parse_args(argv)
    try:
        return args.fn(args)
    except KeyboardInterrupt:
        print("Interrupted (state is checkpointed; re-run to resume).", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
