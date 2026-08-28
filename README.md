# Scripture Graph

An autonomous, AI-maintained Obsidian knowledge graph for serious scripture
study — scripture + gospel + history + evidence, built by a **deterministic
Python orchestrator** that employs Claude Code and OpenAI Codex as
replaceable, independent AI workers.

```
SCRIPTURE GRAPH\
├── Scripture Graph\        ← the Obsidian vault (open this folder in Obsidian)
│   ├── Library\            YOURS (and family's) — My Study pages, Study Hub,
│   │                       verse notes; the engine NEVER edits here
│   ├── AI Library\         everything the engine maintains (read-only for humans):
│   │   ├── 01 Scriptures\  Canonical (immutable) · Study Guides · Annotated · JST
│   │   ├── 02–06 …\        Gospel Topics (+Essays/BD/TG) · People · Places · Events
│   │   ├── 10–30 …\        General Conference (full talks) · JSP · Church History
│   │   ├── 40–70 …\        Evidence · Questions · Scholarship · AI Study Guides
│   │   └── 00, 90\         System docs & Status · Sources registry
│   ├── Scripture Graph Home.md
│   └── .scripture-engine\  config, prompts, database, jobs, logs (runtime)
├── scripturegraph\         the Python engine
├── tests\                  automated test suite
├── scripts\                sg.ps1 CLI shim + scheduled-task runners
└── sources\                downloads\ (auto) + drop\ (manual corpora go here)
```

Scripture folders are numbered in canonical order (`03 Book of Mormon\09 Alma`)
so nothing sorts alphabetically out of sequence.

## 1. What it is

A knowledge graph over the complete standard works (87 books · 1,582
chapters · ~42,000 verses, public-domain text) with per-verse block links,
AI-maintained study guides, gospel-topic dossiers, people/places, scored
evidence notes, question dossiers, and a personal layer that belongs only to
you. It is built for **repeated corpus-wide refinement**, never a one-pass
conveyor belt: every import re-opens affected work, and coverage
equalization keeps early books as good as late ones.

## 2–3. The vault and how to open it

Open **`Scripture Graph`** (this repo's subfolder) as a vault in Obsidian.
Start at **Scripture Graph Home**. Enable the bundled CSS snippet if asked
(Settings → Appearance → CSS snippets → `scripture-graph` — it's pre-enabled
in the committed config). Study from the **“<Chapter> - My Notes”** files:
scripture text + study guide are embedded above your own writing space.

## 4. Starting / resuming the bootstrap

```powershell
.\scripts\sg.ps1 bootstrap        # runs or resumes the state machine
```

Safe to interrupt and re-run at any point; every stage checkpoints through a
durable work queue. `bootstrap --until STAGE` stops early.

## 5. Seeing progress

```powershell
.\scripts\sg.ps1 status           # console dashboard + writes 00 System/Status.md
.\scripts\sg.ps1 waves status     # per-pass completion vs. current corpus version
```

`00 System/Status.md` and `00 System/Graph Health.md` are Obsidian-readable
versions of the same information.

## 6. How Claude and Codex cooperate

Each research job: **two independent researchers** (Claude CLI + Codex CLI,
neither sees the other) → **cross-critique** (each attacks the other's
proposal) → **deterministic validation** (every scripture ref and quote is
checked mechanically against the canonical text) → **judge** (inspects
support; does *not* count votes) → **deterministic librarian** (writes only
judge-approved content into marked regions, inside a git transaction).
Supportive/skeptical emphasis rotates between providers per job. Degraded
modes (one provider, or none) are honest and recorded per job. See
`00 System/ARCHITECTURE.md`.

## 7. Scheduling

```powershell
.\scripts\sg.ps1 scheduler install   # 4 tasks: Study (every 30 min, all day) /
                                     # Frequent (2h) / Nightly (02:30) / Weekly (Sun 03:30)
.\scripts\sg.ps1 scheduler status
.\scripts\sg.ps1 scheduler remove
```

The **Study task** is the build-out engine: every 30 minutes it runs a
time-boxed slice of multi-agent chapter research (weakest chapters first,
~100-150 chapters/day in aggressive mode) until the daily cap. Slices are
overrun-safe (engine lock) and lossless (durable queue).

Windows Task Scheduler is only the clock; the Python orchestrator does the
thinking. Details + budgets: `00 System/OPERATIONS.md`.

## 8. Corpora: what fetches itself, what you can add

Fetched automatically (legitimately — see `00 System/SOURCE-POLICY.md`):

```powershell
.\scripts\sg.ps1 fetch conference --from-year 2015 --to-year 2026   # Church content API, rate-limited
.\scripts\sg.ps1 fetch history    # public domain: Journal of Discourses, Conference
                                  # Reports ≤1930, History of the Church, Lucy Mack Smith
.\scripts\sg.ps1 fetch jsp        # JSP series reference records (metadata + links)
```

The **Nightly task also backfills ~4 older conference sessions per night**
toward 1971, plus ~350 Gospel Library pages (chapter footnotes/headings,
then collections by priority) (config `acquisition.*`).

> **Privacy duty:** fetched church-published text lives in the vault in full
> for YOUR study. Keep this repo/vault private — never push it to a public
> remote or share it while that content is inside (see SOURCE-POLICY).

For anything else, drop files
(EPUB/PDF/HTML/TXT/MD/JSON/XML/CSV/ZIP) into
`sources\drop\{conference|jsp|history|reference|scholarship}\` and run
`.\scripts\sg.ps1 ingest` (or wait for the Frequent task). Any import bumps
the corpus version → affected chapters/topics automatically re-enter the
refinement queue. Registry: `Scripture Graph/90 Sources/manifests/Source Registry.md`.

## 9. Pausing / resuming automation

`Scripture Graph\.scripture-engine\config\config.yaml`:

```yaml
automation:
  enabled: true      # false = scheduled runs no-op
  ai_enabled: true   # false = deterministic work only, zero AI spend
```

## 10. Changing AI providers / models

Same config file: `providers.claude.models.*`, `providers.codex.model`,
`pipeline.researchers`, `pipeline.judge`, `embeddings.provider`
(`hash` → `fastembed` → `openai`). Prompts are files under
`.scripture-engine\config\prompts\` — version-controlled, provider-agnostic.

## 11. Keys and configuration

- Config: `Scripture Graph\.scripture-engine\config\config.yaml`
- Secrets: `.scripture-engine\config\.env` (gitignored; template `.env.example`)
- **Claude:** run `claude /login` once in any terminal (or `claude setup-token`
  → `CLAUDE_CODE_OAUTH_TOKEN` in `.env`). The engine auto-detects afterwards.
- **Codex:** works via the installed Codex app's login (auto-detected).

## 12. How Git protection works

Every engine write session: **checkpoint commit** (captures any of your
uncommitted edits first — they can never be eaten by a rollback) → apply →
validate → **commit**, or **hard-restore** of the vault subtree on fatal
issues. Canonical scripture is additionally hash-tracked, marked read-only,
and auto-restored from the verified database text (`validate --repair`).
Routine changes never wait for human approval; `git revert` is the undo.

## 13. Recovering from problems

See `00 System/OPERATIONS.md` § Recovery. Short version: re-run the command
(everything resumes); `validate --repair` fixes canonical drift; `git log` /
`git revert` undoes any automated change; deleting
`.scripture-engine\database\` is safe (`index --rebuild` + `bootstrap`
reconstruct it from Markdown + sources).

## 14. Coverage equalization

Every pass records the corpus version it ran against. Completeness measures
*applicable* dimensions only (a chapter with no places is complete on
"places" once scanned). Priority = low completeness + staleness + graph
importance + validation issues. Nightly runs always work the weakest/stalest
chapters first, so the graph self-balances forever. Non-negotiable: early
books never stay worse than late ones.

## Development

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q    # or: .\scripts\sg.ps1 test
```

Engineering decisions log: `docs\DECISIONS.md`.
