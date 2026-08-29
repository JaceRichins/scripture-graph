/** Ambient reading scenes — living backdrops that take the reading somewhere:
 * a slow dawn, still water, the night sky. All CSS/SVG generated locally
 * (nothing to download), animated only with transform/opacity so phones stay
 * cool, and honoring prefers-reduced-motion. The text itself always sits on
 * a translucent vellum panel for contrast. */

export interface SceneDef {
  id: string;
  name: string;
  emoji: string;
  /** hour ranges (local) this scene suits, for Auto mode */
  hours: [number, number][];
  layers: number;
}

export const SCENES: SceneDef[] = [
  { id: "sunrise", name: "Sunrise", emoji: "🌅", hours: [[5, 10]], layers: 4 },
  { id: "waters", name: "Still Waters", emoji: "🌊", hours: [[10, 16]], layers: 5 },
  { id: "desert", name: "Desert Dusk", emoji: "🏜️", hours: [[16, 20]], layers: 4 },
  { id: "starlight", name: "The Heavens", emoji: "🌌", hours: [[20, 24], [0, 5]], layers: 4 },
  { id: "candle", name: "Candlelight", emoji: "🕯️", hours: [], layers: 3 },
];

const ROOT_CLS = "sg-scene";

function seededStars(seed: number, n: number, w: number, h: number,
  rMin: number, rMax: number, color: string): string {
  // deterministic LCG so every device renders the same sky
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
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

export class SceneManager {
  private el: HTMLElement | null = null;
  private currentId: string | null = null;

  /** mount / switch / unmount ("none" removes) */
  apply(id: string | null): void {
    const target = id === "auto" ? this.autoPick() : id;
    if (!target || target === "none") {
      this.el?.remove();
      this.el = null;
      this.currentId = null;
      document.body.removeClass("sg-scene-on");
      return;
    }
    if (this.currentId === target && this.el) return;
    this.el?.remove();
    const scene = SCENES.find(s => s.id === target) ?? SCENES[0]!;
    const el = document.body.createDiv({ cls: `${ROOT_CLS} ${ROOT_CLS}-${scene.id}` });
    document.body.insertBefore(el, document.body.firstChild);
    for (let i = 1; i <= scene.layers; i++) el.createDiv({ cls: `sgl sgl-${i}` });
    this.decorate(scene.id, el);
    this.el = el;
    this.currentId = scene.id;
    document.body.addClass("sg-scene-on");
  }

  current(): string | null { return this.currentId; }

  private autoPick(): string {
    const h = new Date().getHours();
    for (const s of SCENES) {
      if (s.hours.some(([a, b]) => h >= a && h < b)) return s.id;
    }
    return "starlight";
  }

  /** scene-specific generated artwork (stars, dunes) as inline SVG layers */
  private decorate(id: string, el: HTMLElement): void {
    if (id === "starlight") {
      const l1 = el.querySelector<HTMLElement>(".sgl-2");
      const l2 = el.querySelector<HTMLElement>(".sgl-3");
      if (l1) l1.style.backgroundImage = seededStars(7, 90, 1200, 900, 0.6, 1.4, "#ffffff");
      if (l2) l2.style.backgroundImage = seededStars(23, 60, 1100, 800, 0.9, 1.9, "#cdd6ff");
    }
    if (id === "desert") {
      const back = el.querySelector<HTMLElement>(".sgl-2");
      const front = el.querySelector<HTMLElement>(".sgl-3");
      if (back) back.style.backgroundImage = dunes("#2a1c2e", 30, -12);
      if (front) front.style.backgroundImage = dunes("#140d18", 45, 18);
    }
  }
}
