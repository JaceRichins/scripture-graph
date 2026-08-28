---
ownership: system
mutable: user
content_type: system-doc
---
# Scripture Graph — System README

This vault is a living, AI-maintained knowledge graph for serious scripture
study, built and maintained by a deterministic Python orchestrator
(`scripturegraph`) that lives beside the vault in the same repository.

**Start here:** [[Scripture Graph Home]]

## The three ownership classes

| Class | Where | Frontmatter | Who writes |
| --- | --- | --- | --- |
| **Canonical** | `01 Scriptures/Canonical/` | `ownership: canonical, mutable: false` | Only the generator, only from the verified imported text. Hash-guarded, read-only attribute, auto-restored on drift. |
| **System (AI)** | study guides, topics, people, places, evidence, questions, MOCs | `ownership: system, mutable: ai` | The engine's Librarian layer, inside marked sections, after research→critique→judge→validation. |
| **Personal** | `80 Personal Notes/` | `ownership: personal, mutable: user` | **You, only.** The engine reads/indexes/links toward your notes but never edits them. |

**Canonical text is immutable. AI knowledge is autonomously maintained.
Personal writing belongs only to you.**

## How to study

Open any chapter's **My Study** note (e.g. `Alma 36 - My Notes`): it embeds
the canonical scripture and the AI study guide above your own free-writing
space. Write there. Everything you write joins the graph automatically.

## Key entry points

- [[Scriptures]] — the five standard works
- [[Gospel Topics]] · [[People]] · [[Places]] · [[Questions]]
- [[Evidence]] — scored, honest evidence dossiers
- [[Status]] — live corpus/coverage dashboard · [[Graph Health]]

## Documentation

- [[ARCHITECTURE]] — how the engine works and why
- [[AI-CONSTITUTION]] — the epistemic rules every agent obeys
- [[SOURCE-POLICY]] — source hierarchy, copyright posture, acquisition
- [[OPERATIONS]] — running, scheduling, pausing, recovery
- [[DATA-SCHEMAS]] — IDs, frontmatter contracts, database tables
- [[CHANGELOG]] — notable system changes

The developer README (setup commands, CLI reference) is `README.md` at the
repository root, one level above this vault.
