"""Status dashboard: console + Obsidian-readable Status note."""
from __future__ import annotations

import json

from scripturegraph import __version__, queue
from scripturegraph.context import Ctx
from scripturegraph.coverage import stats as cov_stats, weakest_chapters
from scripturegraph.util import now_iso, today_utc
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_SYSTEM, record_file


def _count(ctx: Ctx, sql: str, *params) -> int:
    row = ctx.db().execute(sql, params).fetchone()
    return int(row[0] or 0)


def gather(ctx: Ctx) -> dict:
    db = ctx.db()
    from scripturegraph import gitops
    from scripturegraph.agents.providers import get_provider
    from scripturegraph.waves import waves_status
    providers = {}
    for name in ("claude", "codex"):
        p = get_provider(ctx, name)
        providers[name] = {"exe_found": bool(getattr(p, "exe", None)),
                           "available": p.available()}
    s = {
        "engine_version": __version__,
        "corpus_version": ctx.corpus_version(),
        "bootstrap_state": ctx.meta_get("bootstrap_state", "NOT_INITIALIZED"),
        "chapters": _count(ctx, "SELECT COUNT(*) FROM chapters"),
        "verses": _count(ctx, "SELECT COUNT(*) FROM verses"),
        "books": _count(ctx, "SELECT COUNT(*) FROM books"),
        "sources": {r["status"]: r["n"] for r in db.execute(
            "SELECT status, COUNT(*) AS n FROM sources GROUP BY status")},
        "talks": _count(ctx, "SELECT COUNT(*) FROM documents WHERE doc_type='talk'"),
        "documents": _count(ctx, "SELECT COUNT(*) FROM documents"),
        "topics": _count(ctx, "SELECT COUNT(*) FROM nodes WHERE node_type='topic'"),
        "people": _count(ctx, "SELECT COUNT(*) FROM nodes WHERE node_type='person'"),
        "places": _count(ctx, "SELECT COUNT(*) FROM nodes WHERE node_type='place'"),
        "evidence_notes": _count(ctx, "SELECT COUNT(*) FROM nodes WHERE node_type='evidence'"),
        "questions": _count(ctx, "SELECT COUNT(*) FROM nodes WHERE node_type='question'"),
        "personal_notes": _count(ctx, "SELECT COUNT(*) FROM nodes WHERE node_type='personal-note'"),
        "edges": {r["status"]: r["n"] for r in db.execute(
            "SELECT status, COUNT(*) AS n FROM edges GROUP BY status")},
        "claims": {r["tier"]: r["n"] for r in db.execute(
            "SELECT tier, COUNT(*) AS n FROM claims GROUP BY tier")},
        "chunks": _count(ctx, "SELECT COUNT(*) FROM chunks"),
        "embeddings": {f"{r['provider']}/{r['model']}": r["n"] for r in db.execute(
            "SELECT provider, model, COUNT(*) AS n FROM embeddings GROUP BY provider, model")},
        "queue": queue.counts(ctx),
        "jobs": {r["status"]: r["n"] for r in db.execute(
            "SELECT status, COUNT(*) AS n FROM jobs GROUP BY status")},
        "ai_spend_today_usd": round(_spend_today(ctx), 4),
        "providers": providers,
        "coverage": cov_stats(ctx),
        "weakest": weakest_chapters(ctx, 8),
        "dossiers": _dossier_progress(ctx),
        "git_rev": gitops.current_rev(ctx),
        "last_runs": [dict(r) for r in db.execute(
            "SELECT kind, started_at, finished_at, status FROM runs "
            "ORDER BY id DESC LIMIT 5")],
    }
    return s


def _dossier_progress(ctx: Ctx) -> dict:
    from scripturegraph.agents.dossier import SUBJECT_TYPES, research_progress
    marks = ",".join("?" * len(SUBJECT_TYPES))
    db = ctx.db()
    return {"done": db.execute("SELECT COUNT(*) AS n FROM passes WHERE name='dossier'")
            .fetchone()["n"],
            "total": db.execute(f"SELECT COUNT(*) AS n FROM nodes WHERE node_type IN ({marks}) "
                                f"AND vault_path IS NOT NULL", SUBJECT_TYPES).fetchone()["n"],
            "gate": research_progress(ctx)}


def _spend_today(ctx: Ctx) -> float:
    total = 0.0
    for r in ctx.db().execute(
            "SELECT cost_json FROM jobs WHERE created_at LIKE ?", (today_utc() + "%",)):
        try:
            total += float(json.loads(r["cost_json"] or "{}").get("usd") or 0.0)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    return total


def print_status(ctx: Ctx, write_note: bool = True) -> dict:
    s = gather(ctx)
    lines = [
        f"Scripture Graph v{s['engine_version']} — corpus v{s['corpus_version']} — "
        f"bootstrap {s['bootstrap_state']} — git {s['git_rev'] or '—'}",
        f"Scripture: {s['books']} books · {s['chapters']} chapters · {s['verses']} verses",
        f"Graph: {s['topics']} topics · {s['people']} people · {s['places']} places · "
        f"{s['evidence_notes']} evidence · {s['questions']} questions · "
        f"{s['personal_notes']} personal notes",
        f"Edges: {s['edges']} | Claims: {s['claims'] or '—'}",
        f"Dossiers: {s['dossiers']['done']}/{s['dossiers']['total']} subjects · "
        f"gate: canon read {s['dossiers']['gate']['done']}/{s['dossiers']['gate']['total']}"
        f"{'' if s['dossiers']['gate']['complete'] else ' (waiting)'}",
        f"Corpus: {s['documents']} documents ({s['talks']} talks) · {s['chunks']} chunks · "
        f"embeddings {s['embeddings'] or '—'}",
        f"Sources: {s['sources']}",
        f"Queue: {s['queue'] or 'empty'} | Jobs: {s['jobs'] or '—'} | "
        f"AI spend today: ${s['ai_spend_today_usd']}",
        f"Providers: " + ", ".join(
            f"{k}={'READY' if v['available'] else 'exe found, not authed' if v['exe_found'] else 'not found'}"
            for k, v in s["providers"].items()),
    ]
    cov = s["coverage"]
    if cov.get("overall"):
        o = cov["overall"]
        lines.append(f"Coverage: mean {o['mean']} · stddev {o['stddev']} · min {o['min']}")
        for vol, st in cov["volumes"].items():
            lines.append(f"  {vol:26s} mean {st['mean']:5} min {st['min']:5} p10 {st['p10']}")
    print("\n".join(lines))
    if write_note:
        write_status_note(ctx, s)
    return s


def _today_line(ctx: Ctx) -> str:
    """Visible momentum: what the engine got done since midnight UTC."""
    try:
        from scripturegraph.util import today_utc
        db = ctx.db()
        day = today_utc() + "%"
        ticks = db.execute("SELECT COUNT(*) n FROM runs WHERE kind='study' "
                           "AND started_at LIKE ?", (day,)).fetchone()["n"]
        applied = db.execute("SELECT COUNT(*) n FROM jobs WHERE status='applied' "
                             "AND created_at LIKE ?", (day,)).fetchone()["n"]
        claims = db.execute("SELECT COUNT(*) n FROM claims WHERE created_at LIKE ?",
                            (day,)).fetchone()["n"]
        return (f"- **Today:** {ticks} study ticks · {applied} research jobs applied · "
                f"{claims} new claims")
    except Exception:  # noqa: BLE001
        return "- Today: —"


def _secondary_line(ctx: Ctx) -> str:
    try:
        db = ctx.db()
        srcs = db.execute(
            "SELECT COUNT(*) n FROM sec_sources WHERE approval_status='APPROVED'"
        ).fetchone()["n"]
        items = db.execute("SELECT COUNT(*) n FROM sec_items").fetchone()["n"]
        ingested = db.execute(
            "SELECT COUNT(*) n FROM sec_items WHERE status='ingested'").fetchone()["n"]
        return (f"- Secondary sources: {srcs} approved · {items} episodes tracked · "
                f"{ingested} ingested")
    except Exception:  # noqa: BLE001 — status must never crash on a fresh DB
        return "- Secondary sources: not initialized"


def write_status_note(ctx: Ctx, s: dict | None = None) -> None:
    s = s or gather(ctx)
    lines = ["# Status", "", f"*Generated {now_iso()}.*", "",
             f"- Engine: v{s['engine_version']} · corpus **v{s['corpus_version']}** · "
             f"bootstrap **{s['bootstrap_state']}** · git `{s['git_rev'] or '—'}`",
             f"- Scripture: {s['books']} books, {s['chapters']} chapters, {s['verses']} verses",
             f"- Graph: {s['topics']} topics · {s['people']} people · {s['places']} places · "
             f"{s['evidence_notes']} evidence notes · {s['questions']} questions",
             f"- Personal notes indexed: {s['personal_notes']}",
             f"- Documents: {s['documents']} ({s['talks']} conference talks)",
             f"- Index: {s['chunks']} chunks · embeddings: "
             + (", ".join(f"{k} ({v})" for k, v in s["embeddings"].items()) or "none"),
             f"- Work queue: {s['queue'] or 'empty'}",
             _today_line(ctx),
             _secondary_line(ctx),
             f"- AI providers: " + ", ".join(
                 f"{k}: {'ready' if v['available'] else 'needs login' if v['exe_found'] else 'not installed'}"
                 for k, v in s["providers"].items()),
             ""]
    cov = s["coverage"]
    if cov.get("overall"):
        o = cov["overall"]
        lines += ["## Coverage", "",
                  f"Overall: mean **{o['mean']}**, stddev {o['stddev']}, min {o['min']}", ""]
        lines += ["| Volume | Mean | Min | P10 |", "| --- | --- | --- | --- |"]
        for vol, st in cov["volumes"].items():
            lines.append(f"| {vol} | {st['mean']} | {st['min']} | {st['p10']} |")
        lines.append("")
    if s["weakest"]:
        lines += ["## Next in the refinement queue", ""]
        for w in s["weakest"]:
            lines.append(f"- `{w['node_id']}` — completeness {w['completeness']}")
        lines.append("")
    lines += ["## Recent runs", ""]
    for r in s["last_runs"] or []:
        lines.append(f"- {r['kind']}: {r['started_at']} → {r['finished_at'] or '…'} "
                     f"({r['status']})")
    record_file(ctx, f"{FOLDER_SYSTEM}/Status.md", "system", "generator", None,
                md.build_note({"ownership": "system", "mutable": "ai",
                               "content_type": "report"}, "\n".join(lines)))
    ctx.db().commit()
