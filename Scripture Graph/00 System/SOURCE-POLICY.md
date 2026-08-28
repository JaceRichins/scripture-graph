---
ownership: system
mutable: user
content_type: system-doc
---
# Source Policy

## Authority hierarchy (contextual, not absolute)

1. Canonized scripture
2. Official Church institutional material
3. First Presidency / Quorum of the Twelve / General Conference
4. Primary historical sources
5. Joseph Smith Papers and rigorous documentary editions
6. Peer-reviewed / reputable academic scholarship
7. Reputable secondary scholarship
8. Other commentary
9. AI inference (lowest; always provenance-tagged)

Authority is **domain-contextual**: an academic archaeologist outweighs a
devotional talk on archaeology; an official Church source outweighs an
academic on current Church doctrine. The judge weighs sources per domain,
and every source row carries its authority category.

## Copyright and acquisition rules

- **No aggressive crawling.** Sites whose terms prohibit automated copying
  (churchofjesuschrist.org study content, josephsmithpapers.org) are never
  scraped. Their corpora are registered `manual_download_required` with drop
  folders (`sources/drop/<category>/`) and importer support for EPUB, PDF,
  HTML, TXT, MD, JSON, XML, CSV, and ZIP.
- **Public domain flows freely.** The KJV and LDS standard-works text
  (scriptures-json) are imported in full and tracked in git.
- **Copyrighted texts stay in the private index.** Imported copyrighted
  material (e.g. conference talks you drop in) is chunked into the local
  database for search and connections; vault notes carry metadata, relationships, and
  brief excerpts (≤ ~100 words), never full reproductions.
- **Reference records are always allowed.** Title/author/date/URL + AI
  summary + relationships can represent any source that cannot be stored.

## The registry

Every corpus is a row in the `sources` table (and the human manifest at
`90 Sources/manifests/Source Registry.md`) with status:
`available · imported · update_available · manual_download_required ·
unavailable · blocked_by_terms · deprecated`.

Unavailable corpora never block the system (spec §39): the architecture is
ready, the registry records what is missing and how to get it, and imports
trigger targeted refinement automatically (corpus-version bump → affected
passes re-open → change detection queues affected chapters/topics).

## Provenance

Every AI-era claim records: originating sources and chunks, proposing agent
and model, prompt versions, judge outcome and rationale, deterministic
validation results, corpus version, and timestamps — in the database, not
cluttering the notes.
