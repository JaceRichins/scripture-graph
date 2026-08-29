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
  { id: "waters", name: "Still Waters", emoji: "🌊", hours: [[10, 16]], layers: 7 },
  { id: "mount", name: "The Mount", emoji: "⛰️", hours: [], layers: 6 },
  { id: "garden", name: "The Garden", emoji: "🌿", hours: [], layers: 5 },
  { id: "fields", name: "The Fields", emoji: "🌾", hours: [], layers: 6 },
  { id: "storm", name: "The Storm", emoji: "⛈️", hours: [], layers: 7 },
  { id: "temple", name: "The Temple", emoji: "🏛️", hours: [], layers: 5 },
  { id: "city", name: "The City", emoji: "🏙️", hours: [[16, 20]], layers: 6 },
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

/** jagged mountain ridgeline via seeded random walk */
function ridge(seed: number, color: string, base: number, jag: number): string {
  const rnd = lcg(seed);
  let d = `M0 ${base}`;
  let y = base;
  for (let x = 0; x <= 900; x += 45) {
    y = Math.max(20, Math.min(190, y + (rnd() - 0.5) * 2 * jag));
    d += ` L${x} ${y.toFixed(0)}`;
  }
  d += " L900 200 L0 200 Z";
  return svgUrl(900, 200, `<path d='${d}' fill='${color}'/>`);
}

/** smooth rolling hills / dunes / swells */
function hills(color: string, amp: number, phase: number): string {
  return svgUrl(900, 200,
    `<path d='M0 ${120 + phase} Q 150 ${120 - amp + phase} 300 ${125 + phase} `
    + `T 600 ${118 + phase} T 900 ${128 + phase} L 900 200 L 0 200 Z' fill='${color}'/>`);
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

/** temple colonnade: pillars + entablature */
function colonnade(color: string): string {
  let c = `<rect x='0' y='0' width='900' height='26' fill='${color}'/>`
    + `<rect x='0' y='176' width='900' height='24' fill='${color}'/>`;
  for (let x = 30; x < 900; x += 96) {
    c += `<rect x='${x}' y='22' width='30' height='158' rx='4' fill='${color}'/>`
      + `<rect x='${x - 6}' y='22' width='42' height='10' fill='${color}'/>`
      + `<rect x='${x - 6}' y='170' width='42' height='10' fill='${color}'/>`;
  }
  return svgUrl(900, 200, c);
}

/** wheat fringe: curved stalks with heads along the bottom */
function wheat(seed: number, color: string, n: number): string {
  const rnd = lcg(seed);
  let c = "";
  for (let i = 0; i < n; i++) {
    const x = rnd() * 900;
    const h = 60 + rnd() * 90;
    const lean = (rnd() - 0.5) * 40;
    c += `<path d='M${x.toFixed(0)} 200 Q ${(x + lean / 2).toFixed(0)} ${(200 - h / 2).toFixed(0)} `
      + `${(x + lean).toFixed(0)} ${(200 - h).toFixed(0)}' stroke='${color}' stroke-width='2.4' fill='none'/>`
      + `<ellipse cx='${(x + lean).toFixed(0)}' cy='${(200 - h).toFixed(0)}' rx='3.4' ry='9' fill='${color}' `
      + `transform='rotate(${(lean / 2).toFixed(0)} ${(x + lean).toFixed(0)} ${(200 - h).toFixed(0)})'/>`;
  }
  return svgUrl(900, 200, c);
}

function bird(color: string): string {
  return svgUrl(26, 12,
    `<path d='M1 9 Q 7 1 13 9 Q 19 1 25 9' stroke='${color}' stroke-width='1.6' fill='none' stroke-linecap='round'/>`, true);
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
      this.bg(el, 2, seededStars(7, 110, 1200, 900, 0.6, 1.4, "#ffffff"));
      this.bg(el, 3, seededStars(23, 70, 1100, 800, 0.9, 1.9, "#cdd6ff"));
      el.createDiv({ cls: "sgp sg-shoot sg-shoot-a" });
      el.createDiv({ cls: "sgp sg-shoot sg-shoot-b" });
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
      this.bg(el, 7, hills("#04121c", 16, 55)); // far shore
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
      this.bg(el, 2, ridge(5, "#2c3350", 100, 34));   // far range
      this.bg(el, 3, ridge(29, "#1d2338", 130, 42));  // mid range
      this.bg(el, 4, ridge(53, "#10131f", 160, 48));  // near range
      particles(el, "sg-mist", 4, 71, (rnd, p) => {
        p.style.top = `${34 + rnd() * 38}%`;
        p.style.animationDuration = `${34 + rnd() * 30}s`;
        p.style.animationDelay = `${-rnd() * 40}s`;
        p.style.height = `${40 + rnd() * 60}px`;
        p.style.opacity = `${0.10 + rnd() * 0.14}`;
      });
    }
    if (id === "garden") {
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
    }
    if (id === "fields") {
      this.bg(el, 3, hills("#5a3d1e", 24, 30));
      this.bg(el, 4, wheat(37, "#6b4a20", 70));
      this.bg(el, 5, wheat(59, "#3d2a12", 55));
      particles(el, "sg-chaff", 5, 113, (rnd, p) => {
        p.style.left = `${rnd() * 95}%`;
        p.style.bottom = `${10 + rnd() * 35}%`;
        p.style.animationDuration = `${11 + rnd() * 9}s`;
        p.style.animationDelay = `${-rnd() * 14}s`;
      });
    }
    if (id === "storm") {
      this.bg(el, 5, hills("#0a1420", 55, 30));       // heaving swell
      this.bg(el, 6, hills("#050b13", 70, 60));       // near swell
      el.createDiv({ cls: "sgp sg-flash" });
      particles(el, "sg-cloudmass", 3, 127, (rnd, p) => {
        p.style.top = `${-6 + rnd() * 18}%`;
        p.style.left = `${-10 + rnd() * 80}%`;
        p.style.animationDuration = `${26 + rnd() * 22}s`;
        p.style.animationDelay = `${-rnd() * 30}s`;
      });
    }
    if (id === "temple") {
      this.bg(el, 3, colonnade("#120c08"));
      particles(el, "sg-incense", 5, 139, (rnd, p) => {
        p.style.left = `${20 + rnd() * 60}%`;
        p.style.animationDuration = `${16 + rnd() * 12}s`;
        p.style.animationDelay = `${-rnd() * 20}s`;
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
