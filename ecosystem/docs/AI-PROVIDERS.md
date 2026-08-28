# AI providers

## The wallet rule

**Every user pays from their own wallet.** There is no master API key, no
shared credential, no developer-funded pool. "Connect AI" runs OpenRouter's
OAuth PKCE flow (S256):

1. Plugin generates a code verifier + challenge, opens
   `https://openrouter.ai/auth?callback_url=obsidian://scripture-graph-auth&code_challenge=…`.
2. User approves in the browser (creates/uses their own OpenRouter account
   and credit — ~$10 goes a long way).
3. Obsidian catches the `obsidian://scripture-graph-auth?code=…` redirect;
   the plugin exchanges code+verifier for a **user-scoped key**.
4. The key is stored in the device store only. Manual code paste exists as a
   fallback if the redirect doesn't return.

Disconnect = delete the key locally. Nothing else to clean up.

## Friendly tiers (no model jargon required)

| Tier | Meaning |
|---|---|
| AUTO (default) | routes per task — see below |
| Fast & cheap | quick answers |
| Deep research | long-context reading |
| Highest quality | best available |
| Cheapest | absolute minimum spend |
| Specific model… | advanced: any OpenRouter model id |

Task routing (AUTO): quick verse Q&A → fast; connections/evidence/challenge →
deep; vault-wide synthesis → best. Candidate lists live in
`core-sdk/src/ai/models.ts`; the live model registry is fetched and cached
24 h, with price-aware fallback if a candidate is unavailable.

## Budget brake

A monthly cap (default $10, editable) is enforced **before** each request:
past the cap, requests refuse to start with a clear message. Spend is
accumulated from OpenRouter's streamed usage accounting (`usage.cost`), and
the settings tab shows month-to-date + the wallet's own totals. The cap is a
safety brake, not billing — billing is the user's OpenRouter account.

## Context (\"Ask AI\")

Curated, not dumped: current verse ± neighbors → study-guide sections →
followed related/evidence wikilinks → (opt-in) your notes → title/alias
search results. Depth presets Focused/Balanced/Deep set the context budget
internally — the UI never talks about tokens. The system prompt requires
answers grounded in the provided context with **exact `[[wikilink]]`
citations** (clickable in the answer), and forbids invented titles.

## Conversations & outputs

- Conversations are personal (in-memory + your device); nothing is shared
  unless you save and share it.
- "Save as note" writes to `Library/AI Notes/` — your personal folder — with
  `content_type: ai-conversation` frontmatter (§52: AI output becomes a
  personal draft, never engine/system content).

## Engine vs. plugin

The Python research engine keeps its own provider config (Claude Code /
Codex CLIs) and pays for autonomous vault maintenance; phones never run it.
The plugin's AI is interactive-only and user-funded. The two never share
credentials.
