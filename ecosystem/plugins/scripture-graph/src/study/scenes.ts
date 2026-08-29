/** Ambient reading scenes v2 — full THEMES, not wallpapers.
 *
 * - The scene lives entirely BEHIND the text: no panel, no margin changes.
 *   Readability comes from each scene's built-in scrim layer + its own ink
 *   palette (body[data-sg-scene] CSS variables).
 * - Alive by design: birds cross the dawn, embers rise, stars shoot, motes
 *   drift — all transform/opacity animation, a handful of tiny elements,
 *   prefers-reduced-motion honored.
 */

export interface SceneDef {
  id: string;
  name: string;
  emoji: string;
  /** hour ranges (local) this scene suits, for Auto mode */
  hours: [number, number][];
  layers: number;
}

export const SCENES: SceneDef[] = [
  { id: "sunrise", name: "Sunrise", emoji: "🌅", hours: [[5, 10]], layers: 5 },
  { id: "waters", name: "Still Waters", emoji: "🌊", hours: [[10, 16]], layers: 6 },
  { id: "desert", name: "Desert Dusk", emoji: "🏜️", hours: [[16, 20]], layers: 6 },
  { id: "starlight", name: "The Heavens", emoji: "🌌", hours: [[20, 24], [0, 5]], layers: 5 },
  { id: "candle", name: "Candlelight", emoji: "🕯️", hours: [], layers: 4 },
];

const ROOT_CLS = "sg-scene";

/** deterministic LCG so every device renders the same artwork */
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

function seededStars(seed: number, n: number, w: number, h: number,
  rMin: number, rMax: number, color: string): string {
  const rnd = lcg(seed);
  let circles = "";
  for (let i = 0; i < n; i++) {
    const x = (rnd() * w).toFixed(1);
    const y = (rnd() * h).toFixed(1);
    const r = (rMin + rnd() * (rMax - rMin)).toFixed(2);
    const o = (0.4 + rnd() * 0.6).toFixed(2);
    circles += `<circle cx='${x}' cy='${y}' r='${r}' fill='${color}' opacity='${o}'/>`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${circles}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function dunes(color: string, amp: number, phase: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='200' preserveAspectRatio='none'>`
    + `<path d='M0 ${120 + phase} Q 150 ${120 - amp + phase} 300 ${125 + phase} `
    + `T 600 ${118 + phase} T 900 ${128 + phase} L 900 200 L 0 200 Z' fill='${color}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function bird(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='12'>`
    + `<path d='M1 9 Q 7 1 13 9 Q 19 1 25 9' stroke='${color}' stroke-width='1.6' `
    + `fill='none' stroke-linecap='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** spawn n drifting particles with deterministic spreads */
function particles(el: HTMLElement, cls: string, n: number, seed: number,
  style: (rnd: () => number, p: HTMLElement, i: number) => void): void {
  const rnd = lcg(seed);
  for (let i = 0; i < n; i++) {
    const p = el.createDiv({ cls: `sgp ${cls}` });
    style(rnd, p, i);
  }
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
    el.createDiv({ cls: "sgl sgl-scrim" });      // readability lives IN the scene
    this.decorate(scene.id, el);
    this.el = el;
    this.currentId = scene.id;
    document.body.addClass("sg-scene-on");
    document.body.dataset["sgScene"] = scene.id;  // per-scene ink palette hook
  }

  current(): string | null { return this.currentId; }

  private autoPick(): string {
    const h = new Date().getHours();
    for (const s of SCENES) {
      if (s.hours.some(([a, b]) => h >= a && h < b)) return s.id;
    }
    return "starlight";
  }

  /** generated artwork + living particles, per scene */
  private decorate(id: string, el: HTMLElement): void {
    if (id === "starlight") {
      const l2 = el.querySelector<HTMLElement>(".sgl-2");
      const l3 = el.querySelector<HTMLElement>(".sgl-3");
      if (l2) l2.style.backgroundImage = seededStars(7, 110, 1200, 900, 0.6, 1.4, "#ffffff");
      if (l3) l3.style.backgroundImage = seededStars(23, 70, 1100, 800, 0.9, 1.9, "#cdd6ff");
      // two shooting stars on long staggered cycles
      el.createDiv({ cls: "sgp sg-shoot sg-shoot-a" });
      el.createDiv({ cls: "sgp sg-shoot sg-shoot-b" });
    }
    if (id === "desert") {
      const back = el.querySelector<HTMLElement>(".sgl-2");
      const front = el.querySelector<HTMLElement>(".sgl-3");
      const stars = el.querySelector<HTMLElement>(".sgl-4");
      if (back) back.style.backgroundImage = dunes("#2a1c2e", 30, -12);
      if (front) front.style.backgroundImage = dunes("#140d18", 45, 18);
      if (stars) stars.style.backgroundImage = seededStars(41, 45, 1200, 500, 0.5, 1.2, "#ffe9c9");
      particles(el, "sg-sand", 5, 61, (rnd, p) => {
        p.style.top = `${55 + rnd() * 30}%`;
        p.style.animationDuration = `${18 + rnd() * 14}s`;
        p.style.animationDelay = `${-rnd() * 20}s`;
        p.style.opacity = `${0.05 + rnd() * 0.08}`;
      });
    }
    if (id === "sunrise") {
      // three birds crossing at different heights/speeds
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
  }
}
