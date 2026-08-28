# Mobile (iPhone) notes

Phones are first-class users of the plugin and never run the research engine.

## What makes it work

- `manifest.json` has `isDesktopOnly: false`; the bundle contains no Node or
  Electron APIs (esbuild `platform: browser`; the only integration points are
  the Obsidian API and `localStorage`).
- All HTTP goes through Obsidian's `requestUrl` — native layer, so **no CORS
  preflight and no iOS cleartext/mixed-content blocks** for
  `http://<LAN-IP>:8930`. Raw `fetch` is not used for API calls.
- The OpenRouter connect flow uses the system browser +
  `obsidian://scripture-graph-auth` redirect, which iOS routes back into
  Obsidian. Manual code paste is the fallback.
- Sync is offline-first (see SYNC.md): airplane-mode edits queue in the
  device store and flush when the server is reachable again.

## Phone setup (each phone)

1. Install Obsidian, sign into Obsidian Sync, connect the shared vault
   (Settings → Sync). Wait for the initial sync.
2. Settings → Community plugins → make sure **Scripture Graph** is enabled.
3. The welcome dialog asks for your name + invite code (see USER-SETUP.md).
   On a second device of the SAME account, use a device-link code instead
   (Settings → Scripture Graph → "Link another device" on the first device).
4. Optional: Connect AI (your own wallet) in settings.

## Phone UX specifics

- Selection menu (highlight colors × sharing, note, Ask AI) works from
  long-press selection; commands are exposed for the mobile toolbar:
  *Highlight selection (quick)*, *Add note on selection*, *Bookmark*,
  *Ask AI*, *Review flashcards*.
- The reader view's lens bar scrolls horizontally; sections are collapsible.
- The AI Library opens in reading view (`forceLibraryPreview`) so nobody can
  fat-finger an edit into engine pages; canonical files are additionally
  restored by the engine if anything ever slips.

## Reachability

The phone must reach the server URL in Settings → Scripture Graph. On home
Wi-Fi that's `http://192.168.1.59:8930` (this PC). Away from home, sync
simply waits (queued) until you're back, or move the backend to a hosted URL
later — see DEPLOYMENT.md.
