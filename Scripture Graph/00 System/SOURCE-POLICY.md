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

- **General Conference is fetched politely from the Church's own site.**
  churchofjesuschrist.org's robots.txt permits /study/general-conference and
  its terms allow personal, noncommercial use; the engine uses the site's
  structured content API with a self-identifying User-Agent and a hard rate
  limit (≥1.5s/request), for personal study only. Full text lives in the
  PRIVATE local index; vault talk notes carry metadata + citations + a brief
  excerpt. Backfill runs a few sessions per night toward 1971.
- **No aggressive crawling of restricted sites.** josephsmithpapers.org's
  terms restrict copying its edited transcripts, so JSP is represented by
  reference-record notes (series metadata + URLs), the public-domain
  adjacent corpus, and drop folders (`sources/drop/<category>/`) with
  importer support for EPUB, PDF, HTML, TXT, MD, JSON, XML, CSV, and ZIP.
- **Public domain flows freely.** The KJV and LDS standard-works text
  (scriptures-json) are imported in full and tracked in git. From
  archive.org: the Journal of Discourses (26 vols, 1854-1886), Conference
  Reports through 1930, the History of the Church (B. H. Roberts ed.), and
  Lucy Mack Smith's 1853 history — bulk-downloaded once (`sg fetch history`)
  into the local index (OCR text; treat reported sermons as contemporaneous
  reports, not verbatim transcripts).
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
