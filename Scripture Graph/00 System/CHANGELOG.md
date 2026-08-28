---
ownership: system
mutable: user
content_type: system-doc
---
# Changelog

## 0.1.0 — 2026-08-27

Initial build of the complete foundational system:

- Obsidian vault with three-class ownership (canonical / system / personal),
  per-verse block IDs, per-chapter study guides, personal My-Study scaffolds
  with transclusion, MOCs, custom callout styling.
- Full standard-works import (public-domain scriptures-json corpus):
  87 books, 1,582 chapters, ~42k verses, hash-guarded canonical files.
- SQLite + FTS5 index, pluggable embeddings (hash fallback / fastembed /
  OpenAI), deterministic citation parser, seeded entity/topic registries.
- Global waves: entities, citations, topics, parallel-passage detection
  (corpus-wide shingle overlap), semantic candidates, study-guide synthesis,
  topic dossiers, conference/history sections.
- Multi-agent pipeline: independent researchers (Claude CLI + Codex CLI,
  role-emphasis rotation) → cross-critique → deterministic ref/quote
  validation → judge → deterministic librarian → git transaction.
- Coverage scoring + priority queue + corpus-version staleness + coverage
  equalization; bootstrap state machine (resumable); Windows Task Scheduler
  integration (frequent / nightly / weekly); structured logging; cost modes.
- Test suite; system documentation; source registry with drop-folder
  acquisition for corpora that cannot be auto-downloaded.
