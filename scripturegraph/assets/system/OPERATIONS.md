---
ownership: system
mutable: user
content_type: system-doc
---
# Operations

All commands run from the repository root (the folder above this vault), via
`scripts\sg.ps1` or the venv: `.venv\Scripts\scripturegraph.exe`.

## Everyday commands

```
scripturegraph status              # dashboard (also refreshes 00 System/Status.md)
scripturegraph bootstrap           # run/resume the bootstrap state machine
scripturegraph ingest              # scan sources/drop/** for new corpora
scripturegraph refine --target "Alma 36" --ai   # full multi-agent job on one chapter
scripturegraph refine --count 20 --ai           # 20 highest-priority chapters
scripturegraph waves run --pass parallels       # re-run a global pass
scripturegraph validate [--repair] # deterministic validation (+ canonical restore)
scripturegraph gardener            # maintenance + Graph Health report
scripturegraph ask "What is the strongest evidence for ...?"
scripturegraph test                # automated test suite
```

## Scheduling (Windows Task Scheduler)

`scripturegraph scheduler install` registers three current-user tasks:

| Task | Default | Does |
| --- | --- | --- |
| ScriptureGraph Frequent | every 2 h | drop-folder scan, personal-note indexing, deterministic queue work |
| ScriptureGraph Nightly | 02:30 | the above + budgeted AI research on weakest/stalest chapters, coverage, status |
| ScriptureGraph Weekly | Sun 03:30 | gardener, full validation with canonical repair, equalization queueing |

- **Pause everything:** set `automation.enabled: false` in
  `.scripture-engine/config/config.yaml` (tasks still fire but no-op), or
  `schtasks /Change /TN "ScriptureGraph Nightly" /DISABLE`.
- **Pause only AI spending:** `automation.ai_enabled: false`.
- **Remove:** `scripturegraph scheduler remove`.
- Logs: `.scripture-engine/logs/` (engine JSONL + scheduler transcripts).

## Cost controls

`mode: aggressive | balanced | economical` in config.yaml selects budgets
(AI jobs per nightly/weekly run, daily USD cap, per-job timeout). Identical
prompts are cached; unchanged sources are never reanalyzed (content hashes);
deterministic filtering always precedes AI calls.

## AI providers

- **Codex CLI** — auto-detected; works when the Codex app/CLI is signed in.
- **Claude Code CLI** — auto-detected; needs one-time terminal login
  (`claude /login`, or `claude setup-token` and put
  `CLAUDE_CODE_OAUTH_TOKEN=...` in `.scripture-engine/config/.env`).
- Availability probes re-run daily (or delete `probe:*` rows in `meta`).
- Force modes: `providers.claude.enabled: true|false|auto` (same for codex).
- Both absent → engine still runs every deterministic layer, and research
  jobs use the stub only in tests, never to fake content in the vault.

## Recovery

- **Bad automated change:** `git log` in the repo root; every engine write
  session is one commit preceded by a checkpoint commit → `git revert <rev>`.
- **Scripture text tampered:** `scripturegraph validate --repair`
  (regenerates canonical files from the verified database text; logged).
- **Crash mid-run:** just re-run (`bootstrap`, `run --nightly`, …) — the
  work queue and state machine resume; `running` items are re-queued.
- **Rebuild the whole index:** delete `.scripture-engine/database/` and run
  `scripturegraph index --rebuild` then `scripturegraph bootstrap`.
- **Something is deeply wrong:** the vault + `sources/` + git history are the
  durable layer; everything else is derived.
