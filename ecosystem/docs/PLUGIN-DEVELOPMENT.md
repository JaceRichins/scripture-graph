# Plugin development

## Layout

```
packages/core-sdk/src
  schemas.ts     zod schemas (Annotation, SyncOp, …) — the contract everywhere
  anchors.ts     verse/chapter ids, partial-text anchors, scripture-ref regex
  localstore.ts  LocalStore interface + WebStorage (localStorage) impl
  syncengine.ts  offline queue, flush/pull, conflict copies
  api.ts         typed ApiClient over an injectable FetchLike
  ai/openrouter.ts  PKCE, models, key status, SSE chat
  ai/models.ts   tiers, task routing, price-aware fallback
  ai/budget.ts   monthly ledger + cap gate
  markdown.ts    frontmatter/sections/verse parsing, context depth budgets

plugins/scripture-graph/src
  main.ts        SGPlugin: wiring, commands, views, protocol handler, export
  state.ts       SGState: shared settings (data.json) vs device state (localStorage)
  settings.ts    the settings tab (account, sharing, AI, data, owner admin)
  social/        annotations service, reading-view integration, onboarding
  ai/            aiService (connect/ask), context assembly, Ask pane
  reader/        the lens-based chapter reader view
  study/         bookmarks, trails, flashcards
  migrate.ts     one-time import from the old annotate plugin
```

**Rule of thumb:** anything that could be reused outside Obsidian (schemas,
sync, anchors, AI plumbing) lives in the SDK with tests; the plugin is UI +
Obsidian API glue.

## Build & iterate

```bash
cd ecosystem
npm install
npm run -w @scripture-graph/plugin typecheck
npm run -w @scripture-graph/plugin build     # esbuild → dist/main.js (~230 KB)
```

Install = copy `manifest.json`, `dist/main.js`, `styles.css` into
`<vault>/.obsidian/plugins/scripture-graph/`, then toggle the plugin (or
Ctrl+P → "Reload app without saving").

## Conventions that matter

- **Never** store secrets or per-user data via `this.saveData()` — that's
  `data.json` and Obsidian Sync replicates it to the whole family. Device
  data goes through `SGState.store` (localStorage `sg:{appId}`).
- Mobile-safe only: no Node/Electron imports; HTTP via `requestUrl`
  (`state.ts` adapts it to the SDK's `FetchLike`).
- Canonical rendering is decorate-only: post-processors and the reader add
  `<mark>`/badges to the DOM; vault files are never edited to show marks.
- New API calls: add a typed method to `ApiClient` (SDK), never raw fetch in
  the plugin.
- Anchors: use `sg-id` frontmatter for node pages, verse block ids for
  scripture. Never anchor to line numbers.

## Adding a fifth product area

Create `src/<area>/`, give it a service class taking `SGState` (plus
`AnnotationService` if it stores user data — prefer annotations over new
storage), register commands/views in `main.ts`, and put any shareable logic
in the SDK with a vitest file.
