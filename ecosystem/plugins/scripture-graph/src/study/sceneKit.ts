/** Procedural art kit for the reading scenes.
 *
 * Everything a scene draws is generated here as an inline SVG data URI — a few
 * hundred bytes each, no image files, nothing to download, and it scales to any
 * screen. Shared with scenes.ts, which composes these into layered worlds.
 *
 * House rules for anything added here:
 *  - silhouettes and light, never illustration — the text is what is being read
 *  - one colour argument per element, so a scene sets its own palette
 *  - seeded randomness only (`lcg`), so a scene looks the same every time
 */

/** Deterministic pseudo-random: same seed, same world, every render. */
export function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

export const svgUrl = (w: number, h: number, inner: string, preserve = false): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'`
    + `${preserve ? "" : " preserveAspectRatio='none'"}>${inner}</svg>`)}")`;

export function seededStars(seed: number, n: number, w: number, h: number,
  rMin: number, rMax: number, color: string): string {
  const rnd = lcg(seed);
  let c = "";
  for (let i = 0; i < n; i++) {
    c += `<circle cx='${(rnd() * w).toFixed(1)}' cy='${(rnd() * h).toFixed(1)}' `
      + `r='${(rMin + rnd() * (rMax - rMin)).toFixed(2)}' fill='${color}' `
      + `opacity='${(0.4 + rnd() * 0.6).toFixed(2)}'/>`;
  }
  return svgUrl(w, h, c, true);
}

// ─── Golgotha ──────────────────────────────────────────────────────────────

/** Three crosses on the skull-hill crest. The centre one stands taller and
 *  alone; the two thieves flank it, smaller and set back. */
export function crosses(color: string, crest: string): string {
  const one = (x: number, h: number, w: number, arm: number, y: number): string =>
    `<rect x='${(x - w / 2).toFixed(1)}' y='${(y - h).toFixed(0)}' width='${w}' `
    + `height='${h.toFixed(0)}' fill='${color}'/>`
    + `<rect x='${(x - arm / 2).toFixed(1)}' y='${(y - h * 0.76).toFixed(0)}' `
    + `width='${arm.toFixed(0)}' height='${(w * 0.85).toFixed(1)}' fill='${color}'/>`;
  const brow = "M0 176 Q 150 168 300 158 Q 450 150 600 159 Q 750 168 900 178 L900 200 L0 200 Z";
  return svgUrl(900, 200,
    `<path d='${brow}' fill='${color}'/>`
    + `<path d='M0 176 Q 150 168 300 158 Q 450 150 600 159 Q 750 168 900 178' `
    + `stroke='${crest}' stroke-width='1.6' fill='none' opacity='0.4'/>`
    + one(300, 84, 6, 40, 162)
    + one(600, 84, 6, 40, 163)
    + one(450, 132, 9, 58, 156));
}

// ─── the empty tomb ────────────────────────────────────────────────────────

/** A rock face with the tomb mouth open and the stone rolled clear of it.
 *  The light comes from *inside*, which is the whole point of the scene. */
export function tombMouth(rock: string, glow: string): string {
  return svgUrl(900, 400,
    `<defs><radialGradient id='tg' cx='0.5' cy='0.62' r='0.62'>`
    + `<stop offset='0%' stop-color='${glow}' stop-opacity='0.98'/>`
    + `<stop offset='45%' stop-color='${glow}' stop-opacity='0.5'/>`
    + `<stop offset='100%' stop-color='${glow}' stop-opacity='0'/>`
    + `</radialGradient></defs>`
    // the hillside the tomb is cut into
    + `<path d='M0 400 L0 190 Q 120 96 300 74 Q 520 48 700 104 Q 830 146 900 208 L900 400 Z' `
    + `fill='${rock}'/>`
    // the opening, and the light standing in it
    + `<ellipse cx='430' cy='320' rx='150' ry='120' fill='url(#tg)'/>`
    + `<path d='M352 400 L352 292 Q 430 206 508 292 L508 400 Z' fill='${glow}' opacity='0.92'/>`
    + `<path d='M368 400 L368 296 Q 430 224 492 296 L492 400 Z' fill='#ffffff' opacity='0.5'/>`
    // the stone, rolled away and standing on edge
    + `<circle cx='700' cy='330' r='74' fill='${rock}'/>`
    + `<circle cx='700' cy='330' r='74' fill='none' stroke='${glow}' stroke-width='2' opacity='0.3'/>`
    + `<path d='M636 366 Q 700 344 764 366' stroke='${glow}' stroke-width='2' `
    + `fill='none' opacity='0.22'/>`);
}

// ─── the parting of the sea ────────────────────────────────────────────────

/** One standing wall of water, streaked vertically and crested with foam.
 *  A scene uses two, mirrored, with the dry path between them. */
export function waterWall(seed: number, body: string, crest: string): string {
  const rnd = lcg(seed);
  let c = `<path d='M0 600 L0 120 Q 60 44 150 26 Q 260 6 340 62 L340 600 Z' fill='${body}'/>`;
  for (let i = 0; i < 26; i++) {
    const x = 12 + rnd() * 320;
    const top = 40 + rnd() * 150;
    c += `<path d='M${x.toFixed(0)} ${top.toFixed(0)} C ${(x + 14).toFixed(0)} `
      + `${(top + 160).toFixed(0)} ${(x - 12).toFixed(0)} ${(top + 300).toFixed(0)} `
      + `${x.toFixed(0)} 600' stroke='${crest}' stroke-width='${(0.8 + rnd() * 2).toFixed(1)}' `
      + `fill='none' opacity='${(0.06 + rnd() * 0.16).toFixed(2)}'/>`;
  }
  c += `<path d='M0 120 Q 60 44 150 26 Q 260 6 340 62' stroke='${crest}' `
    + `stroke-width='3' fill='none' opacity='0.5'/>`;
  for (let i = 0; i < 9; i++) {
    c += `<ellipse cx='${(20 + rnd() * 310).toFixed(0)}' cy='${(20 + rnd() * 70).toFixed(0)}' `
      + `rx='${(16 + rnd() * 26).toFixed(0)}' ry='${(6 + rnd() * 10).toFixed(0)}' `
      + `fill='${crest}' opacity='${(0.1 + rnd() * 0.18).toFixed(2)}'/>`;
  }
  return svgUrl(340, 600, c);
}

// ─── the Liahona ───────────────────────────────────────────────────────────

/** The brass ball: a banded sphere with two spindles, one pointing the way. */
export function liahona(shell: string, band: string, needle: string): string {
  return svgUrl(300, 300,
    `<defs><radialGradient id='lg' cx='0.36' cy='0.32' r='0.78'>`
    + `<stop offset='0%' stop-color='${band}' stop-opacity='1'/>`
    + `<stop offset='100%' stop-color='${shell}' stop-opacity='1'/>`
    + `</radialGradient></defs>`
    + `<circle cx='150' cy='150' r='96' fill='url(#lg)'/>`
    + `<ellipse cx='150' cy='150' rx='96' ry='30' fill='none' stroke='${band}' `
    + `stroke-width='2.4' opacity='0.55'/>`
    + `<ellipse cx='150' cy='150' rx='34' ry='96' fill='none' stroke='${band}' `
    + `stroke-width='2.4' opacity='0.4'/>`
    + `<circle cx='150' cy='150' r='96' fill='none' stroke='${band}' stroke-width='3' opacity='0.8'/>`
    // the two spindles
    + `<path d='M150 150 L216 108 L206 122 L150 150 Z' fill='${needle}'/>`
    + `<path d='M150 150 L96 178 L104 166 L150 150 Z' fill='${needle}' opacity='0.7'/>`
    + `<circle cx='150' cy='150' r='7' fill='${needle}'/>`, true);
}

// ─── the tree of life ──────────────────────────────────────────────────────

/** The tree whose fruit is white above all whiteness, with the rod of iron
 *  running toward it along the bank. */
export function whiteTree(seed: number, trunk: string, crown: string, fruit: string): string {
  const rnd = lcg(seed);
  // A broad, low canopy on a stout trunk with real boughs. An earlier version
  // stacked big circles on a thin stem and read as a mushroom cloud, which is
  // not an association this page should ever make.
  let c = `<path d='M418 400 Q 432 300 440 236 L462 236 Q 470 300 484 400 Z' fill='${trunk}'/>`;
  const bough = (x2: number, y2: number, w: number): string =>
    `<path d='M451 250 Q ${((451 + x2) / 2).toFixed(0)} ${(y2 + 26).toFixed(0)} `
    + `${x2} ${y2}' stroke='${trunk}' stroke-width='${w}' fill='none' stroke-linecap='round'/>`;
  c += bough(330, 178, 11) + bough(572, 176, 11)
    + bough(392, 150, 8) + bough(512, 148, 8);
  // canopy: many small crowns along a wide, shallow arc
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = 268 + t * 366 + (rnd() - 0.5) * 26;
    const arc = Math.sin(t * Math.PI);
    const y = 208 - arc * 74 + (rnd() - 0.5) * 22;
    c += `<circle cx='${x.toFixed(0)}' cy='${y.toFixed(0)}' `
      + `r='${(30 + arc * 26 + rnd() * 12).toFixed(0)}' fill='${crown}' opacity='0.92'/>`;
  }
  for (let i = 0; i < 26; i++) {          // fruit, white above all whiteness
    const t = rnd();
    const arc = Math.sin(t * Math.PI);
    c += `<circle cx='${(276 + t * 350 + (rnd() - 0.5) * 30).toFixed(0)}' `
      + `cy='${(212 - arc * 62 + (rnd() - 0.5) * 46).toFixed(0)}' `
      + `r='${(2.6 + rnd() * 2.4).toFixed(1)}' fill='${fruit}' `
      + `opacity='${(0.55 + rnd() * 0.45).toFixed(2)}'/>`;
  }
  return svgUrl(900, 400, c, true);
}

/** The rod of iron: a rail running away from the reader toward the tree. */
export function ironRod(color: string, glint: string): string {
  let c = `<path d='M0 190 Q 300 150 900 118' stroke='${color}' stroke-width='7' `
    + `fill='none' stroke-linecap='round'/>`
    + `<path d='M0 186 Q 300 146 900 115' stroke='${glint}' stroke-width='1.6' `
    + `fill='none' opacity='0.45'/>`;
  for (let x = 40; x < 900; x += 118) {
    const y = 190 - (x / 900) * 72;
    c += `<rect x='${x}' y='${y.toFixed(0)}' width='6' height='${(200 - y).toFixed(0)}' fill='${color}'/>`;
  }
  return svgUrl(900, 200, c);
}

// ─── the burning bush ──────────────────────────────────────────────────────

/** A low bush wrapped in flame that does not consume it, on bare rock. */
export function burningBush(seed: number, bush: string, flame: string, core: string): string {
  const rnd = lcg(seed);
  let c = `<defs><radialGradient id='bg' cx='0.5' cy='0.62' r='0.55'>`
    + `<stop offset='0%' stop-color='${core}' stop-opacity='0.85'/>`
    + `<stop offset='100%' stop-color='${flame}' stop-opacity='0'/>`
    + `</radialGradient></defs>`
    + `<ellipse cx='200' cy='250' rx='170' ry='130' fill='url(#bg)'/>`;
  // Order matters and an earlier version had it backwards: the dark branches
  // sat on top of the glow and read as blobs. Fire first, twigs inside it.
  for (let i = 0; i < 16; i++) {                       // tongues of fire
    const x = 96 + rnd() * 208;
    const h = 70 + rnd() * 130;
    const lean = (rnd() - 0.5) * 30;
    c += `<path d='M${x.toFixed(0)} 306 Q ${(x - 20 + rnd() * 26).toFixed(0)} `
      + `${(306 - h * 0.5).toFixed(0)} ${(x + lean).toFixed(0)} ${(306 - h).toFixed(0)} `
      + `Q ${(x + 22 - rnd() * 26).toFixed(0)} ${(306 - h * 0.42).toFixed(0)} `
      + `${(x + 16).toFixed(0)} 306 Z' fill='${i % 3 === 0 ? core : flame}' `
      + `opacity='${(0.5 + rnd() * 0.5).toFixed(2)}'/>`;
  }
  for (let i = 0; i < 13; i++) {                       // the bush, unconsumed
    const x = 118 + rnd() * 164;
    const h = 44 + rnd() * 78;
    c += `<path d='M${x.toFixed(0)} 308 Q ${(x + (rnd() - 0.5) * 22).toFixed(0)} `
      + `${(308 - h * 0.6).toFixed(0)} ${(x + (rnd() - 0.5) * 46).toFixed(0)} `
      + `${(308 - h).toFixed(0)}' stroke='${bush}' stroke-width='${(2 + rnd() * 3).toFixed(1)}' `
      + `fill='none' opacity='0.85'/>`;
  }
  c += `<ellipse cx='200' cy='312' rx='128' ry='16' fill='${bush}' opacity='0.7'/>`;
  return svgUrl(400, 340, c, true);
}

// ─── the nativity ──────────────────────────────────────────────────────────

/** A stable: post-and-beam frame, sloped roof, and the manger alight inside. */
export function stable(frame: string, glow: string): string {
  return svgUrl(900, 300,
    `<defs><radialGradient id='mg' cx='0.5' cy='0.74' r='0.5'>`
    + `<stop offset='0%' stop-color='${glow}' stop-opacity='0.9'/>`
    + `<stop offset='100%' stop-color='${glow}' stop-opacity='0'/>`
    + `</radialGradient></defs>`
    + `<ellipse cx='450' cy='230' rx='190' ry='120' fill='url(#mg)'/>`
    + `<path d='M250 118 L450 40 L650 118 L650 132 L450 56 L250 132 Z' fill='${frame}'/>`
    + `<rect x='256' y='126' width='16' height='174' fill='${frame}'/>`
    + `<rect x='628' y='126' width='16' height='174' fill='${frame}'/>`
    + `<rect x='250' y='126' width='400' height='9' fill='${frame}'/>`
    + `<rect x='250' y='288' width='400' height='12' fill='${frame}'/>`
    // the manger: a trough on crossed legs, filled with light
    + `<path d='M398 262 L502 262 L488 296 L412 296 Z' fill='${frame}'/>`
    + `<path d='M406 262 L494 262 L486 274 L414 274 Z' fill='${glow}' opacity='0.95'/>`
    + `<path d='M394 296 L420 254 M506 296 L480 254' stroke='${frame}' stroke-width='7'/>`, true);
}

// ─── Sinai ─────────────────────────────────────────────────────────────────

/** A single steep peak with its head in cloud and fire — not a range. */
export function smokingMount(seed: number, rock: string, edge: string): string {
  const rnd = lcg(seed);
  let d = "M0 200 L120 176";
  let y = 176;
  for (let x = 150; x <= 440; x += 42) {
    y -= 14 + rnd() * 16;
    d += ` L${x} ${y.toFixed(0)}`;
  }
  const peak = y - 8;
  d += ` L470 ${peak.toFixed(0)}`;
  let y2 = peak;
  for (let x = 500; x <= 900; x += 50) {
    y2 += 12 + rnd() * 17;
    d += ` L${x} ${Math.min(y2, 196).toFixed(0)}`;
  }
  return svgUrl(900, 200,
    `<path d='${d} L900 200 Z' fill='${rock}'/>`
    + `<path d='${d}' stroke='${edge}' stroke-width='2' fill='none' opacity='0.42'/>`);
}

// ─── the waters of Mormon ──────────────────────────────────────────────────

/** A fountain of pure water in a thicket: still pool, reeds, close trees. */
export function thicketPool(seed: number, tree: string, water: string, sheen: string): string {
  const rnd = lcg(seed);
  let c = `<ellipse cx='450' cy='330' rx='330' ry='62' fill='${water}'/>`;
  for (let i = 0; i < 7; i++) {
    c += `<ellipse cx='450' cy='${(306 + i * 9).toFixed(0)}' rx='${(300 - i * 34).toFixed(0)}' `
      + `ry='${(46 - i * 5).toFixed(0)}' fill='none' stroke='${sheen}' stroke-width='1.4' `
      + `opacity='${(0.30 - i * 0.035).toFixed(2)}'/>`;
  }
  for (let i = 0; i < 16; i++) {                       // trees crowding the bank
    const x = rnd() * 900;
    const h = 130 + rnd() * 140;
    c += `<path d='M${x.toFixed(0)} 300 L${(x - 4).toFixed(0)} ${(300 - h).toFixed(0)} `
      + `L${(x + 4).toFixed(0)} ${(300 - h).toFixed(0)} Z' fill='${tree}'/>`;
    for (let j = 0; j < 4; j++) {
      c += `<ellipse cx='${(x + (rnd() - 0.5) * 54).toFixed(0)}' `
        + `cy='${(300 - h + rnd() * 70).toFixed(0)}' rx='${(26 + rnd() * 34).toFixed(0)}' `
        + `ry='${(16 + rnd() * 24).toFixed(0)}' fill='${tree}'/>`;
    }
  }
  return svgUrl(900, 400, c);
}

// ─── the barges ────────────────────────────────────────────────────────────

/** Inside a barge: curved hull ribs, and the sixteen stones alight in a row. */
export function bargeHull(hull: string, stone: string): string {
  let c = `<path d='M0 0 L900 0 L900 60 Q 450 130 0 60 Z' fill='${hull}'/>`
    + `<path d='M0 400 L900 400 L900 330 Q 450 262 0 330 Z' fill='${hull}'/>`;
  for (let i = 0; i < 7; i++) {                        // ribs down both sides
    const x = 40 + i * 140;
    c += `<path d='M${x} 62 Q ${(x + 22)} 200 ${x} 336' stroke='${hull}' `
      + `stroke-width='9' fill='none' opacity='0.75'/>`;
  }
  c += `<defs><radialGradient id='sg16' cx='0.5' cy='0.5' r='0.5'>`
    + `<stop offset='0%' stop-color='${stone}' stop-opacity='1'/>`
    + `<stop offset='100%' stop-color='${stone}' stop-opacity='0'/>`
    + `</radialGradient></defs>`;
  for (let i = 0; i < 8; i++) {                        // eight here, eight in the other barge
    const x = 96 + i * 101;
    c += `<circle cx='${x}' cy='168' r='34' fill='url(#sg16)' opacity='0.5'/>`
      + `<circle cx='${x}' cy='168' r='8' fill='${stone}'/>`;
  }
  return svgUrl(900, 400, c);
}

// ─── Jordan ────────────────────────────────────────────────────────────────

export function dove(color: string): string {
  return svgUrl(60, 44,
    `<path d='M30 40 Q 16 34 12 20 Q 22 26 30 22 Q 38 26 48 20 Q 44 34 30 40 Z' fill='${color}'/>`
    + `<circle cx='30' cy='16' r='6' fill='${color}'/>`
    + `<path d='M30 22 Q 8 10 2 2 Q 22 6 30 16 Q 38 6 58 2 Q 52 10 30 22 Z' `
    + `fill='${color}' opacity='0.85'/>`, true);
}

// ─── the fiery furnace ─────────────────────────────────────────────────────

/** The furnace mouth, heated seven times hotter — and four figures walking. */
export function furnace(brick: string, fire: string, core: string): string {
  let c = `<defs><radialGradient id='fg' cx='0.5' cy='0.66' r='0.56'>`
    + `<stop offset='0%' stop-color='${core}' stop-opacity='1'/>`
    + `<stop offset='55%' stop-color='${fire}' stop-opacity='0.72'/>`
    + `<stop offset='100%' stop-color='${fire}' stop-opacity='0'/>`
    + `</radialGradient></defs>`
    + `<rect x='0' y='0' width='600' height='400' fill='${brick}'/>`
    + `<path d='M150 400 L150 200 Q 300 92 450 200 L450 400 Z' fill='url(#fg)'/>`;
  for (let i = 0; i < 4; i++) {                        // the four in the fire
    const x = 228 + i * 48;
    c += `<ellipse cx='${x}' cy='${300 - (i === 3 ? 14 : 0)}' rx='11' ry='38' `
      + `fill='${core}' opacity='${i === 3 ? 0.95 : 0.55}'/>`
      + `<circle cx='${x}' cy='${252 - (i === 3 ? 14 : 0)}' r='9' fill='${core}' `
      + `opacity='${i === 3 ? 0.95 : 0.55}'/>`;
  }
  return svgUrl(600, 400, c);
}

// ─── the city out of heaven ────────────────────────────────────────────────

/** New Jerusalem descending: a walled city of light, hung above the horizon. */
export function descendingCity(seed: number, wall: string, glow: string): string {
  const rnd = lcg(seed);
  let c = `<defs><radialGradient id='cg' cx='0.5' cy='0.55' r='0.55'>`
    + `<stop offset='0%' stop-color='${glow}' stop-opacity='0.55'/>`
    + `<stop offset='100%' stop-color='${glow}' stop-opacity='0'/>`
    + `</radialGradient></defs>`
    + `<ellipse cx='450' cy='220' rx='400' ry='190' fill='url(#cg)'/>`
    + `<rect x='190' y='250' width='520' height='34' fill='${wall}'/>`;
  for (let i = 0; i < 13; i++) {                       // twelve gates and a gap
    c += `<rect x='${(198 + i * 40).toFixed(0)}' y='236' width='18' height='18' fill='${wall}'/>`;
  }
  let x = 210;
  while (x < 690) {                                    // towers inside the wall
    const w = 24 + rnd() * 46;
    const h = 46 + rnd() * 96;
    c += `<rect x='${x.toFixed(0)}' y='${(250 - h).toFixed(0)}' width='${w.toFixed(0)}' `
      + `height='${h.toFixed(0)}' fill='${wall}'/>`;
    if (rnd() > 0.55) {
      c += `<path d='M${x.toFixed(0)} ${(250 - h).toFixed(0)} L${(x + w / 2).toFixed(0)} `
        + `${(250 - h - 26).toFixed(0)} L${(x + w).toFixed(0)} ${(250 - h).toFixed(0)} Z' fill='${wall}'/>`;
    }
    x += w + 8 + rnd() * 22;
  }
  c += `<path d='M190 284 L710 284 L640 320 L260 320 Z' fill='${wall}' opacity='0.65'/>`;
  return svgUrl(900, 400, c, true);
}
