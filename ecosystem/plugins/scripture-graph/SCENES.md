# Reading scenes

A scene is an ambient backdrop behind the scriptures: layered gradients and
procedurally generated SVG, drifting slowly, with a scrim and an ink palette
that keep the text readable over it.

Two families:

- **Ambient scenes** — moods you can read anything under: Sunrise, Still
  Waters, The Mount, The Garden, The Fields, The Storm, The Temple, The City,
  The War Camp, The Prison, Desert Dusk, The Heavens, Candlelight.
- **Scripture scenes** — particular places in the text, keyed to the chapters
  where those things happen: Bountiful, Gethsemane, Golgotha, The Empty Tomb,
  The Sea Parted, The Grove, The Liahona, The Tree of Life, The Burning Bush,
  The Nativity, Sinai, The Waters of Mormon, The Barges, Jordan, The Fiery
  Furnace, The Damascus Road, New Jerusalem.

Set one from the ribbon (**Change reading scene**) or Settings → Reading.
`Auto` follows the clock; `📖 Match the chapter` picks the scene from the
chapter you have open.

## Nothing here is an image file

Every scene is CSS gradients plus inline SVG data URIs generated at runtime in
`src/study/sceneKit.ts` — a few hundred bytes per element, no downloads, and it
scales to any screen. That is a hard rule: no raster art, no bundled images.

## Adding one

Three things, and all three are required:

1. **`SCENES` in `src/study/scenes.ts`** — `{ id, name, emoji, hours, layers }`.
   `layers` is how many `.sgl-N` divs get created; `hours` is for the Auto
   picker and is normally empty for a scripture scene. Add the id to
   `SCRIPTURE_SCENES` if it belongs to a passage rather than a time of day.
2. **A case in `decorate()`** (optional) — generated art onto layers via
   `this.bg(el, n, …)`, and particles via `particles(el, cls, n, seed, style)`.
   Art helpers live in `sceneKit.ts`; add new ones there, not inline.
3. **CSS in `styles.css`** — `.sg-scene-<id> .sgl-N` for each layer, a
   `.sg-scene-<id> .sgl-scrim`, and a `body[data-sg-scene="<id>"]` ink palette
   (`--sg-ink`, `--sg-ink-strong`, `--sg-ink-accent`). Without the scrim and
   the ink the text is unreadable over the scene; there is no default that
   saves you.

Then key it in `src/study/presence.ts`: chapters in
`SCRIPTURE_SCENE_OVERRIDES` (checked before `SCENE_OVERRIDES`, which several of
those chapters already claim under the generic mood they sit inside), and a
`SCENE_KEYWORDS` entry for chapters nobody has curated. Keyword order matters:
the scorer keeps the *first* scene to reach the top score, so specific places
are listed before the generic moods they sit inside — Gethsemane is a garden,
Golgotha is a hill, the Red Sea is water.

## Rules the scenes obey

- **Aspect.** Art that fills a whole layer is generated with
  `preserveAspectRatio='none'` (the `svgUrl` default) and sized in percentages.
  Art anchored to its own element — the Liahona, the bush, the dove — preserves
  aspect and uses `background-size: contain`. Getting this backwards letterboxes
  the art inside a full-viewport layer and pushes it off-frame.
- **Motion is transform and opacity only**, and every animated element carries
  `sgl` or `sgp` so the `prefers-reduced-motion` rule switches it off.
- **Readability wins.** The scrim exists to be tuned until the text is
  comfortable; a scene that looks better and reads worse is wrong.
- **Silhouette and light, not illustration.** The reader is reading.
- **Mirroring.** Do not `scaleX(-1)` a full-width layer to flip its art:
  mirroring swings `background-position: right` over to the left. Generate a
  second variant with a different seed instead.
