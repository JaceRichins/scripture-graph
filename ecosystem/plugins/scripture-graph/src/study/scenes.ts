/** Ambient reading scenes v3 — eleven living worlds with real depth.
 *
 * Art is generated locally (seeded SVG silhouettes: ridgelines, city walls,
 * temple colonnades, wheat, waves) and layered with parallax drift, light,
 * weather, and particles — transform/opacity motion only, reduced-motion
 * honored, readability guaranteed by per-scene scrim + ink palette. */

export interface SceneDef {
  id: string;
  name: string;
  emoji: string;
  hours: [number, number][];
  layers: number;
}

export const SCENES: SceneDef[] = [
  { id: "sunrise", name: "Sunrise", emoji: "🌅", hours: [[5, 10]], layers: 6 },
  { id: "waters", name: "Still Waters", emoji: "🌊", hours: [[10, 16]], layers: 8 },
  { id: "mount", name: "The Mount", emoji: "⛰️", hours: [], layers: 6 },
  { id: "garden", name: "The Garden", emoji: "🌿", hours: [], layers: 5 },
  { id: "fields", name: "The Fields", emoji: "🌾", hours: [], layers: 6 },
  { id: "storm", name: "The Storm", emoji: "⛈️", hours: [], layers: 7 },
  { id: "temple", name: "The Temple", emoji: "🏛️", hours: [], layers: 5 },
  { id: "city", name: "The City", emoji: "🏙️", hours: [[16, 20]], layers: 6 },
  { id: "warcamp", name: "The War Camp", emoji: "⚔️", hours: [], layers: 5 },
  { id: "prison", name: "The Prison", emoji: "⛓️", hours: [], layers: 5 },
  { id: "desert", name: "Desert Dusk", emoji: "🏜️", hours: [], layers: 6 },
  { id: "starlight", name: "The Heavens", emoji: "🌌", hours: [[20, 24], [0, 5]], layers: 5 },
  { id: "candle", name: "Candlelight", emoji: "🕯️", hours: [], layers: 4 },
];

const ROOT_CLS = "sg-scene";

function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

const svgUrl = (w: number, h: number, inner: string, preserve = false): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'`
    + `${preserve ? "" : " preserveAspectRatio='none'"}>${inner}</svg>`)}")`;

function seededStars(seed: number, n: number, w: number, h: number,
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

/** jagged mountain ridgeline via seeded random walk; crest = lit edge stroke */
function ridge(seed: number, color: string, base: number, jag: number, crest?: string): string {
  const rnd = lcg(seed);
  let d = `M0 ${base}`;
  let y = base;
  for (let x = 0; x <= 900; x += 45) {
    y = Math.max(20, Math.min(190, y + (rnd() - 0.5) * 2 * jag));
    d += ` L${x} ${y.toFixed(0)}`;
  }
  const open = d;
  d += " L900 200 L0 200 Z";
  let c = `<path d='${d}' fill='${color}'/>`;
  if (crest) c += `<path d='${open}' stroke='${crest}' stroke-width='2.2' fill='none' opacity='0.55'/>`;
  return svgUrl(900, 200, c);
}

/** smooth rolling hills / dunes / swells; crest = foam/light along the top edge */
function hills(color: string, amp: number, phase: number, crest?: string): string {
  const top = `M0 ${120 + phase} Q 150 ${120 - amp + phase} 300 ${125 + phase} `
    + `T 600 ${118 + phase} T 900 ${128 + phase}`;
  let c = `<path d='${top} L 900 200 L 0 200 Z' fill='${color}'/>`;
  if (crest) c += `<path d='${top}' stroke='${crest}' stroke-width='2.6' fill='none' opacity='0.5'/>`;
  return svgUrl(900, 200, c);
}

/** cattail reeds rising from the bank — clustered left, a few on the right */
function reeds(seed: number, color: string): string {
  const rnd = lcg(seed);
  let c = "";
  const stem = (x: number, h: number, lean: number, head: boolean): string => {
    const hx = (x + lean).toFixed(0), hy = (200 - h).toFixed(0);
    let s = `<path d='M${x.toFixed(0)} 202 Q ${(x + lean * 0.35).toFixed(0)} ${(200 - h * 0.6).toFixed(0)} `
      + `${hx} ${hy}' stroke='${color}' stroke-width='3' fill='none'/>`;
    if (head) {
      s += `<rect x='${(x + lean - 4).toFixed(0)}' y='${hy}' width='8' height='26' rx='4' fill='${color}' `
        + `transform='rotate(${(lean * 0.8).toFixed(0)} ${hx} ${hy})'/>`;
    }
    return s;
  };
  for (let i = 0; i < 14; i++) {
    c += stem(10 + rnd() * 250, 90 + rnd() * 85, (rnd() - 0.5) * 44, rnd() > 0.35);
  }
  for (let i = 0; i < 5; i++) {
    c += stem(760 + rnd() * 130, 70 + rnd() * 70, (rnd() - 0.5) * 40, rnd() > 0.45);
  }
  return svgUrl(900, 200, c);
}

/** rolling cloud bank hanging from the top edge */
function clouds(seed: number, color: string): string {
  const rnd = lcg(seed);
  let c = `<rect x='0' y='0' width='900' height='30' fill='${color}'/>`;
  for (let i = 0; i < 13; i++) {
    const x = i * 72 + rnd() * 36;
    const depth = 24 + rnd() * 74;
    for (let j = 0; j < 5; j++) {
      c += `<ellipse cx='${(x + (rnd() - 0.5) * 90).toFixed(0)}' cy='${(rnd() * depth).toFixed(0)}' `
        + `rx='${(42 + rnd() * 52).toFixed(0)}' ry='${(18 + rnd() * 20).toFixed(0)}' fill='${color}'/>`;
    }
  }
  return svgUrl(900, 200, c);
}

/** forked lightning bolt, walked downward from the cloud base */
function bolt(seed: number, color: string): string {
  const rnd = lcg(seed);
  const walk = (x0: number, y0: number, yEnd: number, drift: number): string => {
    let d = `M${x0.toFixed(0)} ${y0.toFixed(0)}`;
    let x = x0;
    for (let y = y0; y < yEnd; y += 34 + rnd() * 22) {
      x += (rnd() - 0.5) * drift;
      d += ` L${x.toFixed(0)} ${Math.min(y, yEnd).toFixed(0)}`;
    }
    return d;
  };
  return svgUrl(300, 420,
    `<path d='${walk(150, 0, 340, 74)}' stroke='${color}' stroke-width='3.4' fill='none' `
    + `stroke-linecap='round' stroke-linejoin='round'/>`
    + `<path d='${walk(150 + (rnd() - 0.5) * 30, 120, 265, 88)}' stroke='${color}' stroke-width='1.8' `
    + `fill='none' stroke-linecap='round' stroke-linejoin='round' opacity='0.8'/>`, true);
}

/** the Milky Way: a dense diagonal star lane with nebula tints and dust */
function galaxy(seed: number): string {
  const rnd = lcg(seed);
  let c = "";
  const px = (t: number): number => t * 1600;
  const py = (t: number): number => 640 - t * 380;
  for (let i = 0; i < 4; i++) {
    const t = 0.12 + i * 0.24;
    const hue = ["#b78cff", "#7fd4d4", "#ff9ad5", "#9fb4ff"][i]!;
    c += `<ellipse cx='${px(t).toFixed(0)}' cy='${py(t).toFixed(0)}' rx='${(220 + rnd() * 140).toFixed(0)}' `
      + `ry='${(80 + rnd() * 60).toFixed(0)}' fill='${hue}' opacity='0.055' `
      + `transform='rotate(-13 ${px(t).toFixed(0)} ${py(t).toFixed(0)})'/>`;
  }
  for (let i = 0; i < 3; i++) {
    const t = 0.2 + i * 0.28;
    c += `<ellipse cx='${px(t).toFixed(0)}' cy='${(py(t) + 14).toFixed(0)}' rx='${(200 + rnd() * 120).toFixed(0)}' `
      + `ry='${(26 + rnd() * 22).toFixed(0)}' fill='#070919' opacity='0.4' `
      + `transform='rotate(-13 ${px(t).toFixed(0)} ${py(t).toFixed(0)})'/>`;
  }
  for (let i = 0; i < 560; i++) {
    const t = rnd();
    const spread = (rnd() + rnd() - 1) * 130;
    const shade = rnd();
    const fill = shade > 0.85 ? "#ffd9c4" : shade > 0.5 ? "#cdd6ff" : "#ffffff";
    c += `<circle cx='${(px(t) + (rnd() - 0.5) * 40).toFixed(0)}' cy='${(py(t) + spread).toFixed(0)}' `
      + `r='${(0.5 + rnd() * 1.1).toFixed(2)}' fill='${fill}' opacity='${(0.25 + rnd() * 0.7).toFixed(2)}'/>`;
  }
  return svgUrl(1600, 900, c, true);
}

/** ancient city skyline: walls, towers, domes */
function skyline(seed: number, color: string): string {
  const rnd = lcg(seed);
  let c = `<rect x='0' y='150' width='900' height='50' fill='${color}'/>`;
  let x = 0;
  while (x < 900) {
    const w = 30 + rnd() * 70;
    const h = 30 + rnd() * 75;
    c += `<rect x='${x.toFixed(0)}' y='${(150 - h).toFixed(0)}' width='${w.toFixed(0)}' height='${(h + 50).toFixed(0)}' fill='${color}'/>`;
    if (rnd() > 0.65) { // dome
      c += `<ellipse cx='${(x + w / 2).toFixed(0)}' cy='${(150 - h).toFixed(0)}' rx='${(w / 2.4).toFixed(0)}' ry='${(w / 3.2).toFixed(0)}' fill='${color}'/>`;
    }
    x += w + 8 + rnd() * 30;
  }
  return svgUrl(900, 200, c);
}

/** temple facade: pediment + entablature + columns on stepped base, grounded at
 *  bottom; a warm-lit doorway glows at the center of the portico */
function facade(color: string, door?: string): string {
  let c = `<rect x='120' y='188' width='660' height='12' fill='${color}'/>`
    + `<rect x='145' y='178' width='610' height='10' fill='${color}'/>`
    + `<rect x='160' y='76' width='580' height='18' fill='${color}'/>`
    + `<path d='M148 74 L752 74 L450 16 Z' fill='${color}'/>`;
  for (let x = 185; x <= 665; x += 80) {
    c += `<rect x='${x}' y='100' width='22' height='78' rx='3' fill='${color}'/>`
      + `<rect x='${x - 5}' y='94' width='32' height='8' fill='${color}'/>`;
  }
  if (door) {
    c = `<defs><radialGradient id='dg' cx='0.5' cy='0.7' r='0.5'>`
      + `<stop offset='0%' stop-color='${door}' stop-opacity='0.55'/>`
      + `<stop offset='100%' stop-color='${door}' stop-opacity='0'/>`
      + `</radialGradient></defs>` + c
      + `<ellipse cx='450' cy='152' rx='96' ry='64' fill='url(#dg)'/>`
      + `<path d='M426 178 L426 140 Q450 118 474 140 L474 178 Z' fill='${door}' opacity='0.9'/>`;
  }
  return svgUrl(900, 200, c);
}

/** wheat fringe: nodding stalks with plump grain heads + awns along the bottom */
function wheat(seed: number, color: string, n: number): string {
  const rnd = lcg(seed);
  let c = "";
  for (let i = 0; i < n; i++) {
    const x = rnd() * 900;
    const h = 82 + rnd() * 70;
    const lean = (rnd() - 0.5) * 56;
    const hx = (x + lean).toFixed(0), hy = (200 - h).toFixed(0);
    const tilt = (lean * 1.1).toFixed(0);
    c += `<path d='M${x.toFixed(0)} 202 Q ${(x + lean * 0.3).toFixed(0)} ${(200 - h * 0.55).toFixed(0)} `
      + `${hx} ${hy}' stroke='${color}' stroke-width='2.8' fill='none'/>`
      + `<ellipse cx='${hx}' cy='${hy}' rx='4.6' ry='13' fill='${color}' transform='rotate(${tilt} ${hx} ${hy})'/>`;
    for (let a = -1; a <= 1; a++) {
      c += `<path d='M${hx} ${(200 - h - 6).toFixed(0)} l ${(a * 6 + lean * 0.2).toFixed(0)} -13' `
        + `stroke='${color}' stroke-width='1.1' fill='none' transform='rotate(${tilt} ${hx} ${hy})'/>`;
    }
  }
  return svgUrl(900, 200, c);
}

/** leafy canopy fringe hanging from the top edge */
function canopy(seed: number, color: string): string {
  const rnd = lcg(seed);
  let c = `<rect x='0' y='0' width='900' height='24' fill='${color}'/>`;
  for (let i = 0; i < 15; i++) {
    const x = i * 62 + rnd() * 30;
    const depth = 26 + rnd() * 92;
    for (let j = 0; j < 6; j++) {
      c += `<ellipse cx='${(x + (rnd() - 0.5) * 74).toFixed(0)}' cy='${(rnd() * depth).toFixed(0)}' `
        + `rx='${(22 + rnd() * 28).toFixed(0)}' ry='${(15 + rnd() * 19).toFixed(0)}' fill='${color}'/>`;
    }
  }
  for (let b = 0; b < 3; b++) {
    const bx = 90 + rnd() * 700;
    const sway = (rnd() * 60 - 30).toFixed(0);
    c += `<path d='M${bx.toFixed(0)} 0 q ${(rnd() * 36 - 18).toFixed(0)} 80 ${sway} 148' `
      + `stroke='${color}' stroke-width='4.5' fill='none'/>`
      + `<ellipse cx='${(bx + Number(sway)).toFixed(0)}' cy='150' rx='16' ry='11' fill='${color}'/>`;
  }
  return svgUrl(900, 200, c);
}

function bird(color: string): string {
  return svgUrl(26, 12,
    `<path d='M1 9 Q 7 1 13 9 Q 19 1 25 9' stroke='${color}' stroke-width='1.6' fill='none' stroke-linecap='round'/>`, true);
}

/** a camp of tents along the bottom edge, a spear-pole here and there */
function tents(seed: number, color: string): string {
  const rnd = lcg(seed);
  let c = `<rect x='0' y='186' width='900' height='14' fill='${color}'/>`;
  let x = -20;
  let i = 0;
  while (x < 900) {
    const w = 64 + rnd() * 58;
    const h = 42 + rnd() * 34;
    c += `<path d='M${x.toFixed(0)} 188 L${(x + w / 2).toFixed(0)} ${(188 - h).toFixed(0)} `
      + `L${(x + w).toFixed(0)} 188 Z' fill='${color}'/>`;
    if (i % 3 === 2) {   // a standard planted between tents
      const px = x + w + 6 + rnd() * 8;
      const ph = 92 + rnd() * 30;
      c += `<rect x='${px.toFixed(0)}' y='${(188 - ph).toFixed(0)}' width='3.4' height='${ph.toFixed(0)}' fill='${color}'/>`
        + `<path d='M${(px + 3).toFixed(0)} ${(188 - ph).toFixed(0)} l 26 7 l -26 8 Z' fill='${color}'/>`;
    }
    x += w + 14 + rnd() * 26;
    i += 1;
  }
  return svgUrl(900, 200, c);
}

/** the standard itself: a tall pole, a pennant lifted in the evening wind */
function banner(pole: string, cloth: string): string {
  return svgUrl(300, 420,
    `<rect x='146' y='36' width='7' height='384' rx='3' fill='${pole}'/>`
    + `<circle cx='149' cy='32' r='7' fill='${pole}'/>`
    + `<path d='M154 44 Q 220 30 290 52 Q 252 74 214 78 Q 254 92 284 112 `
    + `Q 214 118 154 104 Z' fill='${cloth}'/>`, true);
}

/** rough stone coursework — mortar lines with hand-laid jitter */
function stones(seed: number, color: string): string {
  const rnd = lcg(seed);
  let c = "";
  for (let y = 0; y <= 600; y += 52) {
    const jy = y + (rnd() - 0.5) * 5;
    c += `<path d='M0 ${jy.toFixed(0)} L900 ${(jy + (rnd() - 0.5) * 7).toFixed(0)}' `
      + `stroke='${color}' stroke-width='2' fill='none' opacity='0.55'/>`;
    const off = rnd() * 90;
    for (let x = off; x < 900; x += 105 + rnd() * 60) {
      c += `<path d='M${x.toFixed(0)} ${jy.toFixed(0)} L${(x + (rnd() - 0.5) * 6).toFixed(0)} `
        + `${(jy + 52).toFixed(0)}' stroke='${color}' stroke-width='2' fill='none' opacity='0.4'/>`;
    }
  }
  return svgUrl(900, 600, c);
}

/** one high barred window, light behind it */
function cellWindow(bar: string, glow: string): string {
  return svgUrl(200, 250,
    `<defs><radialGradient id='wg' cx='0.5' cy='0.45' r='0.75'>`
    + `<stop offset='0%' stop-color='${glow}' stop-opacity='0.95'/>`
    + `<stop offset='60%' stop-color='${glow}' stop-opacity='0.35'/>`
    + `<stop offset='100%' stop-color='${glow}' stop-opacity='0'/>`
    + `</radialGradient></defs>`
    + `<path d='M40 250 L40 96 Q 100 30 160 96 L160 250 Z' fill='url(#wg)'/>`
    + `<rect x='62' y='64' width='9' height='186' fill='${bar}'/>`
    + `<rect x='96' y='46' width='9' height='204' fill='${bar}'/>`
    + `<rect x='130' y='64' width='9' height='186' fill='${bar}'/>`
    + `<rect x='30' y='240' width='140' height='10' fill='${bar}'/>`, true);
}

function particles(el: HTMLElement, cls: string, n: number, seed: number,
  style: (rnd: () => number, p: HTMLElement, i: number) => void): void {
  const rnd = lcg(seed);
  for (let i = 0; i < n; i++) style(rnd, el.createDiv({ cls: `sgp ${cls}` }), i);
}

export class SceneManager {
  private el: HTMLElement | null = null;
  private currentId: string | null = null;

  apply(id: string | null): void {
    const target = id === "auto" ? this.autoPick() : id;
    if (!target || target === "none") {
      this.el?.remove();
      this.el = null;
      this.currentId = null;
      document.body.removeClass("sg-scene-on");
      delete document.body.dataset["sgScene"];
      return;
    }
    if (this.currentId === target && this.el) return;
    this.el?.remove();
    const scene = SCENES.find(s => s.id === target) ?? SCENES[0]!;
    const el = document.body.createDiv({ cls: `${ROOT_CLS} ${ROOT_CLS}-${scene.id}` });
    document.body.insertBefore(el, document.body.firstChild);
    for (let i = 1; i <= scene.layers; i++) el.createDiv({ cls: `sgl sgl-${i}` });
    el.createDiv({ cls: "sgl sgl-scrim" });
    this.decorate(scene.id, el);
    this.el = el;
    this.currentId = scene.id;
    document.body.addClass("sg-scene-on");
    document.body.dataset["sgScene"] = scene.id;
  }

  current(): string | null { return this.currentId; }

  private autoPick(): string {
    const h = new Date().getHours();
    for (const s of SCENES) {
      if (s.hours.some(([a, b]) => h >= a && h < b)) return s.id;
    }
    return "starlight";
  }

  private bg(el: HTMLElement, layer: number, image: string): void {
    const l = el.querySelector<HTMLElement>(`.sgl-${layer}`);
    if (l) l.style.backgroundImage = image;
  }

  private decorate(id: string, el: HTMLElement): void {
    if (id === "starlight") {
      this.bg(el, 2, seededStars(7, 150, 1200, 900, 0.6, 1.4, "#ffffff"));
      this.bg(el, 3, seededStars(23, 95, 1100, 800, 0.9, 2.0, "#cdd6ff"));
      this.bg(el, 4, galaxy(67));
      el.createDiv({ cls: "sgp sg-shoot sg-shoot-a" });
      el.createDiv({ cls: "sgp sg-shoot sg-shoot-b" });
    }
    if (id === "warcamp") {
      this.bg(el, 2, ridge(83, "#120e1a", 120, 30));      // far dark range
      this.bg(el, 4, tents(91, "#0c0912"));                // the camp
      this.bg(el, 5, banner("#0a0810", "#8a2f2a"));        // the standard
      particles(el, "sg-ember", 9, 157, (rnd, p) => {
        const fire = [21, 52, 79][Math.floor(rnd() * 3)]!;
        p.style.left = `${fire + (rnd() - 0.5) * 7}%`;
        p.style.bottom = "9%";
        p.style.animationDuration = `${6 + rnd() * 6}s`;
        p.style.animationDelay = `${-rnd() * 10}s`;
        p.style.width = p.style.height = `${1.5 + rnd() * 2.5}px`;
      });
      particles(el, "sg-incense", 3, 163, (rnd, p) => {   // watchfire smoke
        p.style.left = `${[20, 51, 78][Math.floor(rnd() * 3)]! + (rnd() - 0.5) * 4}%`;
        p.style.bottom = "12%";
        p.style.animationDuration = `${15 + rnd() * 10}s`;
        p.style.animationDelay = `${-rnd() * 18}s`;
      });
    }
    if (id === "prison") {
      this.bg(el, 2, stones(43, "#25242c"));               // coursework
      this.bg(el, 4, cellWindow("#08070b", "#ffe3ac"));    // the one window
      particles(el, "sg-mote", 6, 173, (rnd, p) => {
        // motes drift inside the shaft: window (74%,8%) → floor (36%,86%)
        const t = rnd();
        p.style.left = `${74 - 38 * t + (rnd() - 0.5) * 6}%`;
        p.style.top = `${8 + 78 * t + (rnd() - 0.5) * 5}%`;
        p.style.bottom = "auto";
        p.style.animationDuration = `${10 + rnd() * 8}s, ${5 + rnd() * 4}s`;
        p.style.animationDelay = `${-rnd() * 12}s, ${-rnd() * 5}s`;
      });
    }
    if (id === "desert") {
      this.bg(el, 2, hills("#2a1c2e", 30, -12));
      this.bg(el, 3, hills("#140d18", 45, 18));
      this.bg(el, 4, seededStars(41, 45, 1200, 500, 0.5, 1.2, "#ffe9c9"));
      particles(el, "sg-sand", 5, 61, (rnd, p) => {
        p.style.top = `${55 + rnd() * 30}%`;
        p.style.animationDuration = `${18 + rnd() * 14}s`;
        p.style.animationDelay = `${-rnd() * 20}s`;
        p.style.opacity = `${0.05 + rnd() * 0.08}`;
      });
    }
    if (id === "sunrise") {
      // distant ridgeline gives the dawn a horizon to rise over
      this.bg(el, 5, ridge(17, "#241a33", 120, 26));
      const rnd = lcg(11);
      for (let i = 0; i < 3; i++) {
        const b = el.createDiv({ cls: "sgp sg-bird" });
        b.style.backgroundImage = bird("#2c2136");
        b.style.top = `${12 + rnd() * 22}%`;
        b.style.animationDuration = `${34 + rnd() * 22}s`;
        b.style.animationDelay = `${-rnd() * 40}s`;
        b.style.transform = `scale(${0.7 + rnd() * 0.7})`;
      }
    }
    if (id === "waters") {
      // ripples live inside a clip so they can never wash up into the sky
      const clip = el.createDiv({ cls: "sg-water-clip" });
      el.insertBefore(clip, el.querySelector(".sgl-5"));
      for (const n of [2, 3, 4]) {
        const ring = el.querySelector(`.sgl-${n}`);
        if (ring) clip.appendChild(ring);
      }
      this.bg(el, 7, hills("#04121c", 16, 55)); // far shore
      this.bg(el, 8, reeds(73, "#031017")); // cattails on the near bank
      particles(el, "sg-mote", 7, 91, (rnd, p) => {
        p.style.left = `${8 + rnd() * 84}%`;
        p.style.bottom = `${8 + rnd() * 40}%`;
        p.style.animationDuration = `${9 + rnd() * 8}s, ${5 + rnd() * 4}s`;
        p.style.animationDelay = `${-rnd() * 12}s, ${-rnd() * 5}s`;
      });
    }
    if (id === "candle") {
      particles(el, "sg-ember", 8, 133, (rnd, p) => {
        p.style.left = `${38 + rnd() * 24}%`;
        p.style.animationDuration = `${7 + rnd() * 7}s`;
        p.style.animationDelay = `${-rnd() * 12}s`;
        p.style.width = p.style.height = `${2 + rnd() * 3}px`;
      });
    }
    if (id === "mount") {
      this.bg(el, 2, ridge(5, "#2c3350", 100, 34, "#8fa3d6"));   // far range, dawn-lit crest
      this.bg(el, 3, ridge(29, "#1d2338", 130, 42, "#5a6a97"));  // mid range
      this.bg(el, 4, ridge(53, "#10131f", 160, 48));             // near range, dark
      const b = el.createDiv({ cls: "sgp sg-bird" });            // one eagle, very high
      b.style.backgroundImage = bird("#0e1220");
      b.style.top = "9%";
      b.style.animationDuration = "58s";
      b.style.animationDelay = "-20s";
      b.style.transform = "scale(0.8)";
      particles(el, "sg-mist", 4, 71, (rnd, p) => {
        p.style.top = `${34 + rnd() * 38}%`;
        p.style.animationDuration = `${34 + rnd() * 30}s`;
        p.style.animationDelay = `${-rnd() * 40}s`;
        p.style.height = `${40 + rnd() * 60}px`;
        p.style.opacity = `${0.10 + rnd() * 0.14}`;
      });
    }
    if (id === "garden") {
      this.bg(el, 3, canopy(11, "#0e2f1a"));
      this.bg(el, 4, canopy(41, "#081f10"));
      this.bg(el, 5, hills("#0a2413", 30, 45));
      particles(el, "sg-dapple", 5, 83, (rnd, p) => {
        p.style.left = `${rnd() * 90}%`;
        p.style.top = `${rnd() * 70}%`;
        p.style.width = p.style.height = `${90 + rnd() * 160}px`;
        p.style.animationDuration = `${12 + rnd() * 14}s`;
        p.style.animationDelay = `${-rnd() * 18}s`;
      });
      particles(el, "sg-firefly", 6, 97, (rnd, p) => {
        p.style.left = `${5 + rnd() * 90}%`;
        p.style.top = `${30 + rnd() * 60}%`;
        p.style.animationDuration = `${7 + rnd() * 8}s, ${3 + rnd() * 3}s`;
        p.style.animationDelay = `${-rnd() * 10}s, ${-rnd() * 3}s`;
      });
      particles(el, "sg-petal", 5, 103, (rnd, p) => {   // blossom petals drifting down
        p.style.left = `${rnd() * 94}%`;
        p.style.animationDuration = `${14 + rnd() * 10}s, ${4 + rnd() * 3}s`;
        p.style.animationDelay = `${-rnd() * 20}s, ${-rnd() * 4}s`;
        p.style.transform = `scale(${0.7 + rnd() * 0.6})`;
      });
      particles(el, "sg-blossom", 7, 109, (rnd, p) => { // blossoms up in the canopy
        p.style.left = `${rnd() * 96}%`;
        p.style.top = `${1 + rnd() * 12}%`;
        p.style.animationDuration = `${5 + rnd() * 6}s`;
        p.style.animationDelay = `${-rnd() * 8}s`;
      });
    }
    if (id === "fields") {
      this.bg(el, 3, hills("#6d4a1f", 24, 30));
      this.bg(el, 4, wheat(37, "#8a6226", 70));
      this.bg(el, 5, wheat(59, "#553b14", 55));
      particles(el, "sg-chaff", 5, 113, (rnd, p) => {
        p.style.left = `${rnd() * 95}%`;
        p.style.bottom = `${6 + rnd() * 26}%`;
        p.style.animationDuration = `${11 + rnd() * 9}s`;
        p.style.animationDelay = `${-rnd() * 14}s`;
      });
    }
    if (id === "storm") {
      this.bg(el, 5, hills("#0a1420", 55, 30, "#7d99b8"));  // heaving swell, foam crest
      this.bg(el, 6, hills("#050b13", 70, 60, "#5c7896"));  // near swell
      this.bg(el, 7, clouds(31, "#0b1019"));                // rolling cloud bank
      const lit = el.createDiv({ cls: "sgp sg-cloudlit" }); // clouds ignite with the flash
      lit.style.backgroundImage = clouds(31, "#93aed0");
      const bt = el.createDiv({ cls: "sgp sg-bolt" });      // the strike itself
      bt.style.backgroundImage = bolt(101, "#eaf2ff");
      el.createDiv({ cls: "sgp sg-flash" });
      particles(el, "sg-cloudmass", 3, 127, (rnd, p) => {
        p.style.top = `${-6 + rnd() * 18}%`;
        p.style.left = `${-10 + rnd() * 80}%`;
        p.style.animationDuration = `${26 + rnd() * 22}s`;
        p.style.animationDelay = `${-rnd() * 30}s`;
      });
    }
    if (id === "temple") {
      this.bg(el, 2, seededStars(83, 60, 1200, 420, 0.5, 1.3, "#ffe9c9"));
      this.bg(el, 4, facade("#1c1207", "#ffc879"));
      this.bg(el, 5, hills("#0d0805", 16, 80));
      particles(el, "sg-incense", 5, 139, (rnd, p) => {
        p.style.left = `${22 + rnd() * 56}%`;
        p.style.animationDuration = `${16 + rnd() * 12}s`;
        p.style.animationDelay = `${-rnd() * 20}s`;
      });
      particles(el, "sg-ember sg-spark", 6, 149, (rnd, p) => {
        p.style.left = `${44 + rnd() * 12}%`;
        p.style.animationDuration = `${6 + rnd() * 6}s`;
        p.style.animationDelay = `${-rnd() * 10}s`;
        p.style.width = p.style.height = `${1.5 + rnd() * 2.5}px`;
      });
    }
    if (id === "city") {
      this.bg(el, 3, skyline(19, "#191223"));
      this.bg(el, 4, skyline(47, "#0d0a15"));
      particles(el, "sg-window", 9, 151, (rnd, p) => {
        p.style.left = `${3 + rnd() * 92}%`;
        p.style.bottom = `${6 + rnd() * 16}%`;
        p.style.animationDuration = `${3 + rnd() * 5}s`;
        p.style.animationDelay = `${-rnd() * 6}s`;
      });
    }
  }
}
