/** The premade theme library: named study themes with real visual identity —
 * gradient washes, an accent color, and an emoji badge. Themes apply to a
 * WHOLE VERSE, stack (a verse can carry several), and every layer shows:
 * one edge ribbon stripe per theme + layered gradient tints + emoji badges.
 *
 * User-created themes (settings.themes) render as a single-color wash and
 * mix with these seamlessly. */

export interface ThemeSpec {
  name: string;
  emoji: string;
  /** gradient endpoints (hex, no alpha — alpha applied at render) */
  c1: string;
  c2: string;
}

export const THEME_LIBRARY: ThemeSpec[] = [
  { name: "Jesus Christ", emoji: "✝️", c1: "#e8c547", c2: "#f5ead1" },
  { name: "Faith",        emoji: "🌱", c1: "#4cc38a", c2: "#a8e6c1" },
  { name: "Hope",         emoji: "🌅", c1: "#ff9f45", c2: "#ffd166" },
  { name: "Charity",      emoji: "❤️", c1: "#f76bb0", c2: "#ff9aa2" },
  { name: "Forgiveness",  emoji: "🕊️", c1: "#52a9ff", c2: "#a5d8ff" },
  { name: "Repentance",   emoji: "🔄", c1: "#ffb347", c2: "#f76bb0" },
  { name: "Sin",          emoji: "⚠️", c1: "#d64550", c2: "#8b2635" },
  { name: "Awe",          emoji: "🌌", c1: "#6c5ce7", c2: "#a29bfe" },
  { name: "Remember",     emoji: "🎗️", c1: "#e8c547", c2: "#d4a017" },
  { name: "Interesting",  emoji: "💡", c1: "#22d3ee", c2: "#a3e635" },
  { name: "Covenant",     emoji: "🤝", c1: "#3b6fd6", c2: "#e8c547" },
  { name: "Prayer",       emoji: "🙏", c1: "#b197fc", c2: "#74c0fc" },
  { name: "Promise",      emoji: "🌈", c1: "#63e6be", c2: "#ffd43b" },
  { name: "Prophecy",     emoji: "🔮", c1: "#9775fa", c2: "#4c3fb5" },
  { name: "Commandment",  emoji: "📜", c1: "#8d99ae", c2: "#5c677d" },
  { name: "Comfort",      emoji: "🕯️", c1: "#ffb997", c2: "#ffe0c2" },
  { name: "Joy",          emoji: "😊", c1: "#ffd43b", c2: "#ff9f45" },
  { name: "Wisdom",       emoji: "🦉", c1: "#20b2aa", c2: "#5f7a8a" },
  { name: "Family",       emoji: "🏡", c1: "#ff9aa2", c2: "#ffdac1" },
  { name: "Service",      emoji: "🫱", c1: "#38d9a9", c2: "#4dabf7" },
  { name: "Warning",      emoji: "🚨", c1: "#ff6b6b", c2: "#ffa94d" },
  { name: "Question",     emoji: "❓", c1: "#adb5bd", c2: "#74c0fc" },
];

const BY_NAME = new Map(THEME_LIBRARY.map(t => [t.name.toLowerCase(), t]));

/** Resolve a theme name to its visual spec — premade first, then a
 * user-defined theme (single-color), then a neutral fallback. */
export function themeSpec(name: string,
  custom: { name: string; color: string }[] = [],
  colorHex: Record<string, string> = {}): ThemeSpec {
  const hit = BY_NAME.get(name.toLowerCase());
  if (hit) return hit;
  const user = custom.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (user) {
    const hex = colorHex[user.color] ?? user.color ?? "#e8c547";
    return { name: user.name, emoji: "🏷️", c1: hex, c2: hex };
  }
  return { name, emoji: "🏷️", c1: "#8d99ae", c2: "#8d99ae" };
}

export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(141,153,174,${alpha})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** One translucent gradient wash per theme — CSS layers them naturally. */
export function themeWash(spec: ThemeSpec, layerAlpha: number): string {
  return `linear-gradient(120deg, ${hexToRgba(spec.c1, layerAlpha)}, `
    + `${hexToRgba(spec.c2, layerAlpha * 0.75)})`;
}

/** Stacked edge ribbons: one 4px stripe per theme, inset from the left. */
export function themeRibbons(specs: ThemeSpec[]): string {
  return specs.map((s, i) => `inset ${(i + 1) * 4}px 0 0 ${s.c1}`).join(", ");
}
