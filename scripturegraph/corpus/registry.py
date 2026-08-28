"""Source registry: every corpus the system knows about, wants, or holds.

Machine registry = `sources` table. Human-readable manifest generated into
90 Sources/manifests/. Unavailable corpora are REGISTERED with acquisition
instructions instead of blocking the system (spec §38–40); when files appear
in the drop folders, ingestion + affected-refinement trigger automatically.
"""
from __future__ import annotations

import json
from pathlib import Path

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso, sha256_file
from scripturegraph.vaultgen.generate import FOLDER_SOURCES, record_file
from scripturegraph.vaultgen import md

# source_id, name, type, authority(1-9), acquisition, status, url, notes
SEED_SOURCES = [
    ("standard-works-json", "Standard Works (scriptures-json)", "scripture", 1,
     "download", "available", "https://github.com/bcbooks/scriptures-json",
     "Public-domain scripture text. Auto-downloaded to sources/downloads/scriptures-json."),
    ("general-conference", "General Conference talks", "conference", 3,
     "drop-folder", "manual_download_required", "https://www.churchofjesuschrist.org/study/general-conference",
     "Copyrighted; bulk scraping not used. Drop official EPUB/HTML/JSON files into "
     "sources/drop/conference/. Vault notes store metadata + citations + brief excerpts; "
     "full text stays in the local index only."),
    ("joseph-smith-papers", "Joseph Smith Papers", "jsp", 4,
     "drop-folder", "manual_download_required", "https://www.josephsmithpapers.org",
     "Site terms prohibit bulk copying. Drop permitted local packages/notes into "
     "sources/drop/jsp/. Reference records (title/date/URL) are always allowed."),
    ("gospel-topics", "Gospel Topics essays & entries", "reference", 2,
     "drop-folder", "manual_download_required", "https://www.churchofjesuschrist.org/study/manual/gospel-topics",
     "Copyrighted. Taxonomy seeded internally; drop saved pages into sources/drop/reference/."),
    ("bible-dictionary", "Bible Dictionary / Guide to the Scriptures", "reference", 2,
     "drop-folder", "manual_download_required",
     "https://www.churchofjesuschrist.org/study/scriptures/bd",
     "Copyrighted study helps. Drop saved pages into sources/drop/reference/."),
    ("church-history", "Church history materials (e.g. Saints, JS histories)", "history", 4,
     "drop-folder", "manual_download_required", "https://www.churchofjesuschrist.org/study/history",
     "Drop EPUB/PDF/HTML into sources/drop/history/. Public-domain 19th-century sources welcome."),
    ("scholarship", "Academic scholarship & journals", "scholarship", 6,
     "drop-folder", "manual_download_required", "",
     "Drop legally obtained PDFs/HTML into sources/drop/scholarship/."),
]

DROP_CATEGORIES = {
    "conference": ("general-conference", "conference"),
    "jsp": ("joseph-smith-papers", "jsp-document"),
    "history": ("church-history", "history"),
    "reference": ("gospel-topics", "reference-entry"),
    "scholarship": ("scholarship", "article"),
}


def ensure_registry(ctx: Ctx) -> None:
    db = ctx.db()
    for sid, name, typ, auth, acq, status, url, notes in SEED_SOURCES:
        db.execute(
            "INSERT INTO sources(source_id,name,type,authority_category,acquisition_method,"
            "status,source_url,notes) VALUES(?,?,?,?,?,?,?,?) "
            "ON CONFLICT(source_id) DO UPDATE SET name=excluded.name, notes=excluded.notes, "
            "source_url=excluded.source_url",
            (sid, name, typ, auth, acq, status, url, notes))
    db.commit()
    for cat in DROP_CATEGORIES:
        (ctx.drop_dir / cat).mkdir(parents=True, exist_ok=True)
    write_manifest(ctx)


def write_manifest(ctx: Ctx) -> None:
    rows = ctx.db().execute(
        "SELECT * FROM sources ORDER BY authority_category, source_id").fetchall()
    lines = ["# Source Registry", "",
             "| Source | Type | Authority | Status | Acquisition |",
             "| --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append(f"| {r['name']} | {r['type']} | {r['authority_category']} "
                     f"| **{r['status']}** | {r['acquisition_method']} |")
    lines += ["", "## Notes", ""]
    for r in rows:
        if r["notes"]:
            lines.append(f"- **{r['name']}** — {r['notes']}")
    lines += ["", "Authority categories: 1 canon · 2 official Church material · "
              "3 Conference/First Presidency · 4 primary historical sources · "
              "5 documentary editions (JSP) · 6 peer-reviewed scholarship · "
              "7 reputable secondary · 8 other commentary · 9 AI inference. "
              "Authority is contextual; see " + md.wikilink("SOURCE-POLICY") + "."]
    record_file(ctx, f"{FOLDER_SOURCES}/manifests/Source Registry.md", "moc", "generator",
                None, md.build_note(
                    {"ownership": "system", "mutable": "ai", "content_type": "manifest"},
                    "\n".join(lines)))
    ctx.db().commit()


def scan_drop(ctx: Ctx) -> dict:
    """Detect + import new/changed files in the drop folders. Returns stats;
    bumps the corpus version once when anything was imported."""
    from scripturegraph.corpus.conference import import_conference_file
    from scripturegraph.corpus.universal import import_document_file
    db = ctx.db()
    stats = {"imported": 0, "skipped": 0, "errors": 0}
    changed_types: set[str] = set()
    for cat, (source_id, doc_type) in DROP_CATEGORIES.items():
        folder = ctx.drop_dir / cat
        if not folder.exists():
            continue
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path.name.startswith("."):
                continue
            try:
                h = sha256_file(path)
            except OSError:
                continue
            doc_key = f"file:{path.relative_to(ctx.drop_dir)}".replace("\\", "/")
            row = db.execute("SELECT content_hash FROM documents WHERE doc_id=?",
                             (doc_key,)).fetchone()
            if row and row["content_hash"] == h:
                stats["skipped"] += 1
                continue
            try:
                if cat == "conference":
                    n = import_conference_file(ctx, path, source_id, doc_key, h)
                else:
                    n = import_document_file(ctx, path, source_id, doc_type, doc_key, h)
                if n:
                    stats["imported"] += n
                    changed_types.add(cat)
                    # package-level row = the change-detection anchor for this file
                    db.execute(
                        "INSERT INTO documents(doc_id,source_id,doc_type,title,local_path,"
                        "content_hash) VALUES(?,?,?,?,?,?) "
                        "ON CONFLICT(doc_id) DO UPDATE SET content_hash=excluded.content_hash",
                        (doc_key, source_id, "package-file", path.name, str(path), h))
                    db.execute(
                        "UPDATE sources SET status='imported', last_imported=?, "
                        "local_path=? WHERE source_id=?",
                        (now_iso(), str(folder), source_id))
                    db.commit()
            except Exception as e:  # noqa: BLE001 — one bad file must not stop the scan
                stats["errors"] += 1
                ctx.log.error("drop.import_failed", file=str(path), error=str(e)[:300])
    if changed_types:
        ctx.bump_corpus_version(f"drop import: {', '.join(sorted(changed_types))}")
        write_manifest(ctx)
        _enqueue_affected(ctx, changed_types)
    ctx.log.info("drop.scan", **stats)
    return stats


def _enqueue_affected(ctx: Ctx, changed_types: set[str]) -> None:
    """Change detection → targeted re-refinement, not a global rebuild."""
    from scripturegraph import queue as q
    if "conference" in changed_types:
        rows = ctx.db().execute(
            "SELECT DISTINCT dst FROM edges WHERE rel='cites' AND src LIKE 'talk:%'").fetchall()
        for r in rows:
            q.enqueue(ctx, "pass", r["dst"].split(":", 1)[1], pass_name="conference",
                      priority=1.0)
    # any corpus growth re-opens the global index passes (cheap incremental)
    q.enqueue(ctx, "pass", "__global__", pass_name="embed", priority=0.5)
    q.enqueue(ctx, "pass", "__global__", pass_name="semantic", priority=0.4)
    q.enqueue(ctx, "pass", "__global__", pass_name="parallels", priority=0.4)
    ctx.db().commit()
