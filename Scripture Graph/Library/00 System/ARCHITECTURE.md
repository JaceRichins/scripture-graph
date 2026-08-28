---
ownership: system
mutable: user
content_type: system-doc
---
# Architecture

## Shape of the system

```
Windows Task Scheduler          (outer clock only)
        │
        ▼
scripturegraph (Python)         DETERMINISTIC ORCHESTRATOR — the boss
  ├─ corpus importers           scriptures-json · drop folders · universal importer
  ├─ index layer                SQLite + FTS5 · embeddings (pluggable) · citation parser
  ├─ global waves               entities · citations · topics · parallels · semantic · synthesis
  ├─ agent pipeline             researcher×2 → cross-critique → validation → judge → librarian
  ├─ patch layer                ONLY writer of AI content; ownership boundaries enforced
  ├─ coverage engine            completeness · staleness · priority · equalization
  ├─ gardener / health          maintenance, integrity repair, reports
  └─ git transactions           checkpoint → apply → validate → commit | hard-restore
        │
        ▼
Obsidian vault (Markdown)       THE DURABLE LAYER — everything else is rebuildable
```

AI CLIs (Claude Code, OpenAI Codex) are **replaceable subprocess workers**.
Neither is the boss; prompts are shared version-controlled files; a provider
is enabled by config + a cached availability probe, so swapping or adding
models never requires redesigning the vault.

## Why no one-pass processing (the anti-conveyor-belt)

Work happens in **corpus-wide waves**, recorded per `(pass, target)` with the
**corpus version** at completion. Any import bumps the corpus version, which
makes every completed pass "stale" and re-opens it. Consequences:

- 1 Nephi is never permanently disadvantaged for having been processed first;
  the parallels/semantic passes are global by construction, and chapter
  passes re-run whenever the corpus has grown.
- The scheduler picks work by **priority** (low completeness + staleness +
  importance + validation issues), not by canonical order.
- Bootstrap ends with **coverage equalization**: weakest/stalest chapters are
  queued first for the next refinement rounds, forever.

## Job anatomy (multi-agent research)

```
.scripture-engine/jobs/<job_id>/
  manifest.json         target, mode, providers, corpus version
  source/context.{json,md}   chapter text + verified index data + candidates
  a/proposal.json       researcher A (independent)
  b/proposal.json       researcher B (independent)
  critiques/            each researcher attacks the OTHER's proposal
  validation/results.json    deterministic ref/quote verification
  judge/decision.json   per-claim outcomes + section approvals
  librarian/patch.json  the exact ops applied to the vault
```

Role emphasis (strongest-case vs most-skeptical) rotates between providers by
job parity, so no model is permanently "the believer." Degraded modes are
recorded honestly: `dual` (two providers) → `single` (one provider, both
emphases) → `stub` (deterministic only; used in tests and when no provider is
authenticated).

## Notable design decisions

- **Librarian is deterministic code.** Canonical naming resolves through the
  alias table; evidence/question notes are created from templates; only
  judge-approved prose is written. An AI-assisted librarian hook exists
  (`pipeline.librarian` + `librarian.md` prompt) for naming questions the
  alias table cannot answer. Rationale: precision, auditability, cost.
- **Mechanical sections are machine-rendered.** People / places / related
  scriptures / topics / evidence callouts / conference citations are rendered
  from database state (verified edges + judged claims), never free-typed by a
  model. AI writes only interpretive prose sections.
- **Verse granularity via block IDs, chapter granularity in the graph.**
  One file per chapter with a permanent `^slug-ch-v` anchor per verse; graph
  edges live at chapter level and carry verse-pair details in metadata.
- **Chapter study guides live beside a `Study Guides/` tree, not folder 70.**
  `70 AI Study Guides` holds cross-cutting synthesized guides; per-chapter
  guides mirror the canonical tree for navigation symmetry with
  `Canonical/` and `Library/Scriptures/`.
- **The database is an index, not the truth.** SQLite (WAL) + FTS5 + float32
  embedding blobs, all reproducible from Markdown + imported sources
  (`scripturegraph index --rebuild`).
- **Embeddings are candidates, not links.** Similarity discovers candidates;
  only judged decisions become visible Markdown. The zero-dependency hash
  embedder keeps the architecture exercised until a real model (fastembed /
  OpenAI) is enabled — its candidates are confidence-capped.

## Crash safety

Every heavy stage runs through a durable work queue (`running` rows from a
dead process are re-queued on the next run). Files are written atomically.
Claims use content-derived IDs so re-runs are idempotent. Git checkpoints
precede every engine write session; fatal validation triggers a scoped
hard-restore of the vault subtree. The bootstrap state machine resumes from
its last completed stage.
