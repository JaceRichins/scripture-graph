# Engineering Decisions Log

## 2026-09-06 -- The plugin syncs the vault; Obsidian Sync is not needed

**Why.** Four dollars a month bought a copy service the family server can
run itself, and running it ourselves lets each device choose what it
carries. `ecosystem/server/src/vault.ts` + `/vault/*` routes; plugin
`src/sync/vaultSync.ts`; SDK `vaultVersion/vaultManifest/vaultBatch/
personal*`. Plugin v0.71.0.

**Shared tree** (read-only on devices): everything under the vault except
`.git`, `.scripture-engine`, `.trash`, `sources`, `Library/`, and
`.obsidian` other than the plugin's own folder. The server keeps a manifest
(path, 24-hex sha256, size, mtime) with hashes cached per (path, size,
mtime): cold 1.0 s for 95 MB / 13,385 files, warm 1 ms; the manifest is
2.1 MB of JSON in 19 ms; a batch of 120 files (4.9 MB) 58 ms on the LAN.
A device checks `/vault/version`, diffs the manifest against its own index
(kept in the plugin's local store, never in the vault), fetches only what
changed in batches of 120 with four in flight, and deletes what the
manifest no longer lists. Shelves are per device (Scriptures and the
topic/people/places pages always come).

**Personal tree** (`Library/`, per user, two-way): a push carries the hash
the file was edited from; the server accepts when nothing moved underneath
and returns its copy when something did -- the device keeps both, the
server's as "<name> (conflict from another device).md". The owner's files
mirror to the vault on disk (`SG_OWNER_MIRROR`) so the engine keeps
reading them; the owner's laptop is the *source* device (it detects the
engine config) and only pushes/pulls personal notes.

**Reach.** Wherever the phone can reach the server: home Wi-Fi now, anywhere
once the server is exposed (Tailscale or a port-forward). That is the one
thing Obsidian Sync gave that this does not, and it is a networking choice,
not a plugin one.

**Bootstrapping a new device** still needs the plugin's three files once
(`main.js`, `manifest.json`, `styles.css` from `http://<server>:8930/plugin/`)
in `.obsidian/plugins/scripture-graph/`; after that the plugin updates
itself through the same sync.

## 2026-09-06 -- What Gospel Library does that we did not (closed in one pass)

Ranked by payoff over difficulty (languages scored zero by the owner's
call), and everything under difficulty seven built the same day, plugin
v0.69.0-0.70.1:

- **Footnotes on the verse.** `vaultgen/footnotes.py` writes one note per
  chapter from `chapter_apparatus` (already fetched for all 1,584); the
  reader shows a superscript chip; the sheet peeks each reference.
- **Share a verse** through the phone's share sheet.
- **Hymns.** `corpus/hymns.py` indexes the 341 hymns from the Gospel Library
  API -- titles, numbers, the Church's own recordings on its public assets
  host -- into one note; the shelf streams the recording and links Spotify,
  Apple Music, YouTube and the hymn's page. No lyrics or music stored.
- **Come, Follow Me.** The year's manual is a glib collection
  (`cfm-<year>`); `corpus/cfm.py` writes the week index; the home page shows
  this week with its chapters and the lesson.
- **Reading settings** as one sheet (size, spacing, typeface, width, scene,
  dock), CSS variables on the body.
- **Library search on the phone.** The family server opens the engine
  database read-only (`SG_ENGINE_DB`) and answers `/search` from
  `chunks_fts` (358k passages); the Library search shows passages with
  snippets beneath the local results. Home Wi-Fi (or remote access) only,
  by design -- the phone never carries the index.
- **Real audio.** Listen on a talk, Teachings chapter or lesson plays the
  Church's recording (the API's `audio.mediaUrl`); scripture keeps the
  phone's voice.
- **Notebooks** are the study themes read as a journal, plus Notes and
  Highlights, with an export to `Library/Study Journal.md`.
- **A Home badge** for a new insight day or Come Follow Me week;
  keyboard/screen-reader roles on rows and covers; reduced motion honoured.

Not built, by decision: languages (payoff 0), Church-account sync (ours is
the family server), hymn lyrics/music (copyright), push notifications.

## 2026-09-06 -- Words of the Prophets

**The shelf is "Words of the Prophets", not "Joseph Smith Papers".** The
owner asked, more than once, for the prophets' actual words -- journals,
teachings, blessings that are legitimately public -- and the shelf named
after one project could not carry that. `20 Joseph Smith Papers` became
`20 Words of the Prophets`, with the JSP reference records one shelf inside.

**What fills it, and why each is legitimate** (corpus/prophets.py):
- *Teachings of Presidents of the Church*, all fifteen volumes, chapter by
  chapter through the Gospel Library API -- the same channel, budget and
  posture as Saints and the Gospel Topics essays (private index, private
  vault).
- Public-domain books by the prophets and their contemporaries from
  archive.org, Project Gutenberg texts where they exist (Discourses of
  Brigham Young, Gospel Doctrine, Mediation and Atonement, Leaves from My
  Journal, Pratt's autobiography, Life of Heber C. Kimball, Key to the
  Science of Theology, Jenson's encyclopedia, Richards's Compendium).
- The Church's own periodicals to 1929 from archive.org's "Utah and the
  Mormons" collection (2,765 Millennial Star issues, the Nauvoo Neighbor,
  The Seer, Zion's Watchman, the Evening and Morning Star and more),
  forty issues a night. The Times and Seasons and Messenger and Advocate
  importer belongs to another session's uncommitted branch and is left
  alone; this one skips anything already held.
- *Patriarchal Blessings (historical)*: gathered only from the public-domain
  sources above (people gone a century and more), never fetched from
  anywhere else; no living person's blessing belongs in the vault. Anything
  the owner has the right to keep goes in `sources/drop/prophets/`.

**The JSP transcripts stay on their site** (D13 stands): the terms forbid
copying the edited transcripts, and the public-domain sources above carry
most of the same words. Their site blocks AI agents by name in robots.txt;
Interpreter's does too, which is why the scholarship harvester (pending)
will use BYU ScholarsArchive's OAI-PMH feed instead.

## 2026-09-06 -- Findings, frameworks, and the cumulative page

**The library is called Findings, not Evidence.** "Evidence" carries a verdict
in the word -- evidence is *for* or *against* something -- and most of what the
folder holds is illumination that makes no such claim. `40 Evidence` became
`40 Findings`; the registry note "Evidence Assessments" became "Assessments";
the corpus MOCs are "<Corpus> Findings". The old titles stay as frontmatter
aliases so a `[[Evidence]]` link in anyone's personal notes still resolves --
the engine never rewrites personal notes. Internals keep their names
(`FOLDER_EVIDENCE`, node type `evidence`, `evidence_strength`) so nothing
else had to move; on the page the weight is shown as *discrimination*.
Migration: `vaultgen/migrate.py` (registry, graph paths, managed links, one
git transaction, idempotent).

**Frameworks are searched before anything is weighed (standard section 18).**
The owner's concern: a model that under-investigates is biased whichever way
it leans, and the reader should meet the framework they never considered.
Every contested assessment and every hard question now says what the text
itself requires versus what readers assumed, lists every serious model the
text permits *in both directions* with a labelled status and its support, and
shows what was considered and set aside. Reconciling-only and critical-only
lists are both rejected by the judge. Labelled possibility is the safeguard.

**One cumulative page per corpus (`agents/cumulative.py`).** Individually fair
assessments can mislead in aggregate either way: independent findings
dismissed one at a time as coincidence, or findings with one shared cause
counted many times. Software groups the registry by category; two assessors
decide independence by shared cause, write a synthesis that is a judgment and
never a sum, say what the whole picture does to each framework, and end with
what a believer and a skeptic can each hold. The page is required reading for
every hard-question dossier in its corpus. Redone when the registry has moved
by `cumulative.min_changed` (5) assessments.

**Hard questions and talks open as their own page** (plugin v0.65,
`reader/docView.ts`), not as the library sheet: the sheet is for a glance at a
topic mid-chapter; a question is the thing being read. Sections become
blocks, the page carries study themes as a whole (six themes added:
Testimony, Doctrine, History, Restoration, Scholarship, Truth).

## 2026-09-02 -- The nightly was starving; patient runs and yielding ticks

Every nightly since Aug 29 fired at 02:30 into a running 30-minute study
tick, waited its 90 seconds, and skipped ("engine lock held") -- so no
podcast ingestion, no conference freshen, no deterministic wave refresh, no
weekly gardener/discovery either. Fix (runners._locked): nightly and weekly
are PATIENT (wait up to automation.long_lock_wait_sec, default 45 min) and
raise a `state/yield.wanted` flag while waiting; the next study tick sees the
flag and steps aside instead of re-taking the lock. One tick a night buys the
whole nightly. Study ticks stay impatient otherwise. Also: Unshaken Saints is
a user-directed APPROVED podcast seed, and secondary.items_per_night is 12.

## 2026-09-02 -- Subject dossiers wait for the reading

People, places, gospel topics and hard questions get their deep pages from a
new AI pass (`dossier`, `scripturegraph/agents/dossier.py`) that is gated on
the whole canon having been read at least once (`passes.research` covers
every chapter). Rationale: a dossier written from a third of the canon is
wrong about the other two thirds and would have to be paid for twice; the
research findings ARE the raw material, so the pass is only as good as the
reading it can see. The gate is `read-once`, not "current at this corpus
version" -- corpus bumps (new talks, documents) re-open chapter research
gradually and must not re-close the gate. Dossiers are redone only when the
corpus grew AND the page is 90+ days old. Hard questions go first, then by
graph degree. The page keeps a hard line between judged prose (the model's)
and deterministic sections (mentions ledger, scriptural anchors, timeline).

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
