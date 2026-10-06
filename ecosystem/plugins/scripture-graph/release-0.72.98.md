Fix incomplete family library downloads and stale Home cards.

The family reconnect page can now download every shared collection. Sync waits for existing downloads, resumes capped or interrupted batches, repairs missing files, and shows progress until completion. Large download indexes use device-local IndexedDB so the full library does not exhaust phone settings storage. Home refreshes as its content arrives.

The full shared library is approximately 4 GB. Keep Obsidian open on Wi-Fi; if an update reloads Obsidian, tap Download full library again. Personal notes remain scoped to each account.

Validation: production build/typecheck; sync recovery, shared cache migration and 20,000-entry capacity, setup completion, and updater checks passed.
