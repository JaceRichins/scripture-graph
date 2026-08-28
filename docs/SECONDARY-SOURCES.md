# Secondary sources: discovery, admission, ingestion

The goal is a **selective** library of trustworthy secondary voices —
podcasts, YouTube channels, lectures, articles — not a religious media
dump. A user should be able to trust: *"if Scripture Graph surfaced this
episode, there is probably something genuinely worth hearing."*

## The admission system (the "vibe check", made mechanical)

Every recurring source gets a **Source Quality Profile**: eight dimensions
(0–100) proposed by the AI evaluator **with evidence**, then decided
deterministically by `secondary/rubric.py` from config weights:

expertise · source_transparency · historical_accuracy · intellectual_honesty
· depth · reputation · citation_quality − **sensationalism_penalty**

- Overall = weighted mean of the seven positive dimensions minus
  `penalty × secondary.sensationalism_weight`.
- Tiers (config `secondary.tier_thresholds`): **A ≥85** (high trust, ingest
  freely) · **B ≥75** (good) · **C ≥60** (conditional, use selectively) ·
  **D** (do not ingest).
- Status: A/B → APPROVED, C → CONDITIONAL, D → REJECTED; the model's own
  recommendation can only make the outcome MORE conservative, never less.
- **Perspective ≠ quality (§7/§8).** `faith_orientation` is recorded as a
  neutral label and never feeds the score. Faithful ≠ accurate; critical ≠
  accurate. Rigorous apologetics and rigorous critical scholarship both
  qualify; low-quality polemics from either direction do not.

Seeds (§27): **followHIM** and **Church History Matters** start APPROVED by
spec. Weekly re-reviews record history and can downgrade them only on a
genuine quality collapse (tier D).

## Two-level quality (§5)

Source approval is necessary but not sufficient. Every episode gets its own
analysis: `episode_quality`, `novelty`, `relevance`, and an ingest/skip
verdict. Gates (config `secondary.*`): approved sources need
`episode_quality ≥ 70` and `novelty ≥ 30`; CONDITIONAL/tier-C sources need
`episode_quality ≥ 80`. Weak episodes from great shows are skipped;
repetitive devotional restatement scores low novelty on purpose (§17).

## What ingestion produces

Per accepted episode (`sec_items` + vault note under
`AI Library/65 Secondary Sources/<Show>/`):

- **Timestamped outline** (`sec_segments`): segment → `h:mm:ss`, label,
  summary, linked graph nodes. YouTube URLs become `?t=` jump links (§11).
- **Claims → TENTATIVE** (§13/§18): significant factual claims enter the
  normal `claims` table as TENTATIVE with speaker/timestamp/named-primary-
  source provenance. They are surfaced in the research pipeline's chapter
  context as "awaiting corroboration", and the touched chapters' research
  pass is re-queued — trusted creators never bypass the
  researcher→critic→judge pipeline. A podcast statement never silently
  becomes historical fact.
- **Insights** (§19): lower-stakes observations, attributed by name in the
  episode note ("Hank Smith observes…").
- **References** (`sec_mentions`, §14): books/articles/documents the episode
  names — discovery leads where the original outranks the podcast.
- **Guests** (`sec_guests`, §15): recurring-guest profiles; expertise is
  domain-specific and does not transfer.
- **Graph edges**: `secitem:<id> --discusses--> chapter:/topic:/person:…`
  make episodes navigable graph nodes, and every discussed study guide or
  entity page gets a maintained `secondary-sources` marker section (§31) —
  the curated list appears exactly where you study.

## Copyright & platform respect (§10/§20)

- Transcript preference: podcasting-2.0 `<podcast:transcript>` feeds →
  creator-provided transcript pages (robots.txt honored) → show notes only.
- **No YouTube page or caption scraping** (channel RSS metadata only), no
  josephsmithpapers.org fetching, robots.txt honored for all HTML pages.
- Full transcripts live only in the engine cache (gitignored, never synced);
  vault notes carry metadata, summaries, short attributed quotes,
  timestamps, and links. Attribution is preserved by name — commentary is
  never presented as Scripture Graph's anonymous voice.

## Discovery (§21/§28) — discovery ≠ admission

Weekly, up to `secondary.discovery_per_week` candidates from a curated,
config-extensible search-term pool spanning distinct expertise areas (§29:
LDS scholarship, Church history, Hebrew Bible, New Testament, ANE,
archaeology, critical scholarship, …) are resolved to real feeds via the
public iTunes Search API, registered as WATCHLIST, and evaluated through the
same rubric. Decisions land in
`AI Library/65 Secondary Sources/Secondary Source Discoveries.md`.
Popularity is never evidence of quality (§3); random YouTube is never
ingested (§22).

## Keeping primary sources current

`freshen_conference` runs every nightly before the backfill: the two most
recent conference sessions are re-fetched (existing talks skip instantly),
so a brand-new General Conference is ingested the night it is published and
late-published talks/corrections are picked up. The historical backfill
continues toward 1971 as before.

## Operations

```
sg secondary status     # registry overview
sg secondary seed       # ensure seeds + write vault notes
sg secondary refresh    # feeds only (no AI)
sg secondary nightly    # feeds + budgeted episode analyses (runs in nightly)
sg secondary weekly     # re-reviews + discovery (runs in weekly)
```

Budgets: `secondary.items_per_night` (default 3 deep analyses),
`secondary.backlog_per_night`, `secondary.discovery_per_week`. All AI calls
run through the engine's existing provider/budget/cache machinery. Disable
everything with `secondary.enabled: false`.
