---
ownership: system
mutable: user
content_type: system-doc
---
# Data Schemas

## Stable identifiers (permanent)

- Book slug: compact official slug, dashes removed — `1ne`, `wofm`, `dc`, `jsh`
- Chapter slug: `{book}-{chapter}` → `alma-36`
- Verse block ID: `{book}-{chapter}-{verse}` → `^alma-36-22`
  (link: `[[Alma 36#^alma-36-22]]`)
- Node IDs: `chapter:alma-36` · `book:alma` · `topic:faith` ·
  `person:alma-the-younger` · `place:zarahemla` · `talk:2025-april-...` ·
  `doc:file:...` · `evidence:...` · `question:...` · `pnote:<hash>`

## Frontmatter contracts

Canonical scripture: `ownership: canonical, mutable: false,
content_type: scripture` + volume/book/chapter/slug/verses.
Study guides: `ownership: system, mutable: ai, content_type: study-guide` +
`corpus_version_reviewed`. Personal: `ownership: personal, mutable: user,
content_type: personal-notes`. Every engine-created note carries the triple.

## Managed sections

AI-writable regions: `<!-- SG:BEGIN name --> … <!-- SG:END name -->`.
Chapter guides: overview · structure · people · places · related-scriptures ·
topics · doctrines · conference · history · language · literary · evidence ·
questions · further-study. Mechanical sections are machine-rendered;
prose sections are judge-approved AI text.

## Database (SQLite, `.scripture-engine/database/`)

- `meta`, `corpus_version_log` — engine state, corpus versioning
- `books`, `chapters`, `verses` — immutable scripture (text_hash per chapter)
- `sources`, `documents` — registry + imported documents
- `chunks` (+ `chunks_fts` FTS5), `embeddings(provider, model, vector)` 
- `nodes`, `aliases`, `edges(rel, status, confidence, weight, provenance)`
- `claims(tier, scores_json, consensus, provenance_json)` — judged claims
- `passes(name, target, corpus_version, mode)` — wave completion records
- `work_queue`, `jobs`, `runs` — durable work + audit
- `file_registry(path, kind, managed_by, content_hash)` — ownership map
- `coverage(completeness, citation_health, connectivity, priority, …)`
- `response_cache` — prompt-hash → response

## Edge relations

`mentions` · `cites` (explicit, deterministic) · `parallel_to` (text overlap,
deterministic) · `discusses` · `semantically_related` (candidates) ·
`supports` · `challenges` · `references` (personal notes) ·
`historical_context_for` · `quotes` · `fulfills`.
Statuses: `candidate · accepted · low_visibility · tentative · rejected`.

## Agent artifacts (JSON Schema-validated)

`proposal` · `critique` · `judgment` · `evidence_note` — schemas live in
`.scripture-engine/config/schemas/` (version-controlled; package copies are
the fallback). Malformed output → one repair retry → quarantine.

## Claim tiers

`ACCEPT` (visible) · `ACCEPT_LOW_VISIBILITY` (stored, minor) · `TENTATIVE`
(visible with uncertainty label, revisited) · `REJECT` (audit only) ·
`QUARANTINE` (malformed pipeline output, never content).
