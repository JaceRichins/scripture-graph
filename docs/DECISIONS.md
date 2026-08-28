# Engineering Decisions Log

Dated, terse, with rationale. Newest first.

## 2026-08-27 — Initial build

**D1. Repo layout: engine at root, vault as `Scripture Graph/` subfolder.**
Obsidian names a vault after its folder; "Scripture Graph" beats "vault".
Engine runtime state lives inside the vault at `.scripture-engine/` (per
spec §6) — dot-folders are invisible to Obsidian.

**D2. Three-class ownership enforced at the persistence layer.**
canonical (immutable, hash-guarded, read-only attr, auto-restore) / system
(AI-managed, marker-scoped writes only) / personal (never written after the
one-time scaffold). The patch layer refuses violations regardless of what
any model outputs; validation re-checks; git restores.

**D3. Per-chapter files + per-verse block IDs (`^alma-36-22`).**
One file per verse would be 42k files and terrible in Obsidian; block IDs
give verse-granular links at chapter-file granularity. Slugs are compact
official slugs with dashes removed so IDs always split unambiguously.

**D4. Study guides mirror the canonical tree under `01 Scriptures/Study
Guides/`;** `70 AI Study Guides` is reserved for cross-cutting synthesized
guides. Deviation from the spec's flat layout, for navigation symmetry with
`Canonical/` and `80 Personal Notes/Scriptures/`.

**D5. Personal "My Study" scaffolds are pre-generated write-once.**
`![[chapter]]` + `![[study guide]]` + free space, one per chapter. Gives the
combined study view everywhere (desktop/mobile) with zero plugins. The
engine records creation and never touches them again; user deletions are
respected (registry remembers, no recreation).

**D6. Librarian is deterministic code, not a fourth AI call.**
Canonical naming via the alias table; evidence/question notes from
templates; only judge-approved prose lands in markers; mechanical sections
(people/places/related/topics/evidence callouts/conference) are always
machine-rendered from verified DB state. An optional AI-librarian hook +
prompt exist for naming questions the alias table can't answer. Rationale:
precision, auditability, fewer failure modes, lower cost.

**D7. Deterministic global passes run BEFORE any AI.**
Entity mentions (seeded, scope-hinted), explicit citations, topic keywords,
corpus-wide parallel-passage detection (5-word shingle overlap; finds
Isaiah↔2 Nephi, Mosiah 14↔Isaiah 53, 3 Nephi 12–14↔Matthew 5–7, Moses↔
Genesis, synoptics, etc.), semantic candidates. The vault is genuinely
useful with zero AI spend, and AI jobs start from verified context.

**D8. Embedding provider abstraction with an honest fallback.**
`hash` (zero-dep feature hashing; deterministic; candidates confidence-
capped) → `fastembed` (local ONNX bge-small) → `openai`. Vectors keyed by
(provider, model) so switching never destroys prior work. fastembed is
declared as an optional extra rather than installed by default (onnxruntime
weight); enabling it is a one-line config change + pip install.

**D9. Codex is the live AI worker on this machine today; Claude is
auth-ready.** Headless `claude -p` on this box lacks credentials (desktop-app
OAuth doesn't reach child CLIs; probing credential stores was out of
bounds). The Claude adapter is complete and auto-activates after
`claude /login`. Job records honestly mark `dual` / `single` / `stub` mode.

**D10. Claim IDs are content-derived** (`sha1(chapter|text)`), so re-running
a job after a crash cannot duplicate claims (INSERT OR REPLACE).

**D11. Git transactions via checkpoint-then-restore, not branches.**
`checkpoint` commits any pending drift (including the user's own edits —
they can never be rolled back away), then apply → validate → commit, or
`checkout -- vault` + `clean -fd vault` back to the checkpoint. Branch
machinery adds Windows-path pain for no additional safety here.

**D12. LF enforced repo-wide (.gitattributes `eol=lf`).**
Canonical hashes must survive `git checkout` byte-for-byte on Windows.

**D13. Copyright posture.** No scraping of sites whose terms forbid it
(church study content, JSP). Drop folders + universal importer (EPUB/PDF/
HTML/TXT/MD/JSON/XML/CSV/ZIP). Copyrighted text lives in the private index
only; vault notes get metadata + citations + ≤~100-word excerpts.

**D14. Conference/history bootstrap stages complete as DEFERRED when their
corpus is absent** (recorded in meta), instead of blocking. Importing later
bumps the corpus version and re-opens exactly the affected passes.

**D15. Graph granularity: nodes for chapters/books/entities/documents;
verses are addressed via block anchors in edge metadata** rather than 42k
verse nodes. Keeps the graph legible and queries fast; loses nothing (verse
pairs ride on chapter edges).

**D16. Windows read-only attribute is best-effort defense**, not the real
guard (sync/mobile tooling may strip it). The real guards are the patch
layer, content hashes, validation restore, and git history.
