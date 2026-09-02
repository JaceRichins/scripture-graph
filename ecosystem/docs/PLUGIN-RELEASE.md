# Releasing the plugin

How a code change reaches Jace's laptop, his phone, and the family's
devices. Follow every step — each one exists because skipping it has
already cost a debugging session.

Paths below are relative to the repo root, `C:\Users\jacer\repos\SCRIPTURE GRAPH`.

## STOP — check these three things first

Releasing copies files into a folder that **Obsidian Sync replicates to
every device immediately**. Deploying from the wrong place does not fail
loudly; it silently ships old code to Jace's phone and the whole family,
and leaves no trace in git. Run this before anything else:

```bash
cd "C:/Users/jacer/repos/SCRIPTURE GRAPH"          # the MAIN checkout, never a worktree
git rev-parse --show-toplevel                       # must print exactly that path
git rev-parse --abbrev-ref HEAD                     # must print: master
git status --short --branch | head -1               # master must not be BEHIND origin/main
grep '"version"' ecosystem/plugins/scripture-graph/manifest.json
curl -s http://192.168.1.59:8930/plugin/manifest.json | grep version
```

Three rules, all of which must hold:

1. **Main checkout only.** `git worktree list` will show other checkouts
   (feature branches) that have their *own* copy of `Scripture Graph/`.
   Building or copying from one of those hits the wrong vault and the
   wrong code. Release only from the main repo folder.
2. **On `master`, and not behind `origin/main`.** A stale branch is old
   code wearing a new number.
3. **The new version must be HIGHER than the live server's.** Bump from
   what is *shipped* (the `curl` above), never from whatever the local
   manifest happens to say. A tree that is behind will show a lower
   number — bumping that ships a **downgrade to every device**, and
   because the update notice only fires on *newer* versions, nobody is
   told. This is the single most damaging mistake available here.

Also confirm the workspace link exists, or the build is quietly stale.
npm workspaces **hoist** the link to the workspace ROOT — it does not
live inside the plugin's own `node_modules`, so check here:

```bash
ls -l ecosystem/node_modules/@scripture-graph      # expect: core-sdk -> ../../packages/core-sdk
```

If `core-sdk` is missing there, run `npm install` from `ecosystem/`
before building. (An empty
`ecosystem/plugins/scripture-graph/node_modules/@scripture-graph` is
NORMAL and not a problem — nothing is hoisted into the package itself.)

> A note on `git push origin master:main`: that refspec pushes the ref
> named `master`, **not** whatever branch you have checked out. From a
> feature branch it silently pushes nothing new. Land your branch on
> `master` first; then this command means what it says.

## The pipeline

```bash
cd "ecosystem/plugins/scripture-graph"

# 1. BUMP THE VERSION — not optional, see "Why the bump matters"
#    edit manifest.json: "version": "0.60.0" -> "0.61.0"

# 2. verify, then build
npm run typecheck                 # must be clean
npm run build                     # esbuild -> dist/main.js

# 3. deploy to BOTH targets (they serve different devices)
cp dist/main.js manifest.json styles.css \
   "../../../Scripture Graph/.obsidian/plugins/scripture-graph/"
cp dist/main.js manifest.json styles.css \
   "../../server/plugin-release/"

# 4. prove the live channel is actually serving it
curl -s http://192.168.1.59:8930/plugin/manifest.json | grep version

# 5. commit and push
cd "../../.." && git add <the files you changed> && git commit && git push origin master:main
```

## The two update channels — they are NOT equivalent

| | Vault folder | LAN release folder |
|---|---|---|
| Path | `Scripture Graph/.obsidian/plugins/scripture-graph/` | `ecosystem/server/plugin-release/` |
| Carried by | **Obsidian Sync** | the family server on `:8930` |
| Reach | **Anywhere in the world** | **Home Wi-Fi only** |
| How a device picks it up | plugin sees the new manifest on disk and offers a tap-to-reload notice (v0.60.0+) | Settings -> Scripture Graph -> check for updates, or the 6-hour auto-check |

Copy to **both**. The vault copy is the one that reaches Jace when he is
away from the house; the LAN copy is the one that updates instantly at home.

## Why the bump matters

Obsidian caches `manifest.json` at load. The plugin's own update logic —
the load toast, the LAN self-updater, and the synced-update notice — all
compare versions. Ship new code under the same version number and every
device stays silent and looks "stuck on the old version" even though the
files changed. **A build without a bump is an invisible build.**

## Rules that are easy to get wrong

- **Graph preset queries must never use content words.** A query without a
  `path:` / `file:` / `tag:` prefix makes Obsidian read every file in the
  vault (10,000+) before drawing one node — minutes on a phone *and* on a
  laptop. This applies to **color group queries too**; they ride the same
  search pipeline. `assertScanFree()` in `graphPresets.ts` logs
  `gpreset.SLOW-QUERY` to the debug log if one slips through — check the
  log after touching presets.
- **Writing `graph.json` alone does nothing.** Obsidian reads that file
  only at app start. To change a live graph, set
  `app.internalPlugins.getPluginById("graph").instance.options` *before*
  opening the view, then call `engine.setOptions(...)` **followed by**
  `engine.requestUpdateSearch.run()` — `setOptions` stores the query but
  does not apply it.
- **`leaf.setViewState()` to the view type already showing is a silent
  no-op.** Re-filter the live engine instead of re-opening the view.
- **Plugin navigation must call `recordHistory(leaf)` before any
  `setViewState`** (`src/study/leafNav.ts`). Obsidian only records tab
  history for *file* opens, so without it the back arrow goes dead.
  House rule: only Obsidian's `+` button may create a tab.

## Verify before calling it done

```bash
curl -s http://192.168.1.59:8930/health                          # {"ok":true,...}
curl -s http://192.168.1.59:8930/plugin/manifest.json | grep version
grep -c "<something new in this build>" \
  "Scripture Graph/.obsidian/plugins/scripture-graph/main.js"    # vault copy is current
```

## Troubleshooting

**The server does not answer.** The scheduled task
`ScriptureGraph Backend` is **logon-triggered only**. It has died silently
before (exit `0xC000013A` = console closed) and stayed down for a day,
during which no device received anything. Restart with:

```powershell
Start-ScheduledTask -TaskName "ScriptureGraph Backend"
```

Health-check it as part of every release.

**`git commit` says "nothing to commit".** The Python orchestrator runs
`git add -A` in its own checkpoint commits and may have already swept your
files in. Confirm with `git log --oneline -3` and
`git show HEAD:<path> | grep <your change>`, then just push.

**A device still shows the old version.** In order: did you bump the
version; did you copy to *both* targets; is the server up; on the phone,
did the tap-to-reload notice get dismissed (run the command
"Finish updating (after sync)").
