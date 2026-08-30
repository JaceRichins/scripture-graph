/** The tag-feel engine: every user-created theme deserves its own face.
 *
 * Given a tag name, derive an emoji + gradient that matches the word's FEEL —
 * "pride" struts in peacock violet, "meekness" rests in wool white. Purely
 * derived at render time from the name (no schema change, no migration):
 * every family device computes the identical look, and existing tags get
 * their identity retroactively for free.
 *
 * Resolution: lexicon (stems + synonyms) → deterministic hash into a
 * hue-spread fallback pool. A uniqueness walk guarantees no emoji is ever
 * shared with a premade theme or another custom tag. */

export interface FeelLook {
  emoji: string;
  c1: string;
  c2: string;
}

interface FeelEntry {
  /** candidate badges, best first — the walk tries them in order */
  e: string[];
  c1: string;
  c2: string;
}

/** Curated gospel-study concepts: hand-tuned badges + mood gradients,
 * in the visual language of THEME_LIBRARY. */
const LEXICON: Record<string, FeelEntry> = {
  // inner weather — virtues and their shadows
  "pride":        { e: ["🦚", "👑", "🪞"], c1: "#7b2d8b", c2: "#c0392b" }, // haughty, hot
  "meekness":     { e: ["🐑", "🕊️", "🌾"], c1: "#efe9dc", c2: "#9cc3e4" }, // wool & dove
  "humility":     { e: ["🙇", "🌿", "🛐"], c1: "#8f9779", c2: "#d9e4d0" },
  "obedience":    { e: ["🧭", "📏", "✅"], c1: "#4a6fa5", c2: "#9db8d9" },
  "patience":     { e: ["🐢", "⏳", "🌾"], c1: "#c2a24b", c2: "#e8dcc0" },
  "gratitude":    { e: ["🌻", "🙌"],       c1: "#f2b134", c2: "#ffe08a" },
  "courage":      { e: ["🦁", "🛡️", "🔥"], c1: "#d64a2e", c2: "#f5a623" },
  "fear":         { e: ["😨", "🌑", "🫣"], c1: "#4a5568", c2: "#1f2733" },
  "anger":        { e: ["🌋", "💢", "⚡"], c1: "#b91c1c", c2: "#7f1d1d" },
  "peace":        { e: ["🕊️", "🌊", "🍃"], c1: "#7fb8a4", c2: "#cfe8e0" },
  "mercy":        { e: ["🤲", "💧", "🫂"], c1: "#5eb0b7", c2: "#cdeeea" },
  "justice":      { e: ["⚖️", "🏛️"],       c1: "#37474f", c2: "#78909c" },
  "grace":        { e: ["🦢", "✨", "🌷"], c1: "#d9b8d9", c2: "#f3e6f3" },
  "temptation":   { e: ["🍎", "🐍", "🪤"], c1: "#6b8e23", c2: "#c0392b" },
  "kindness":     { e: ["🤗", "🍯", "🌼"], c1: "#f4a261", c2: "#ffe5b4" },
  "honesty":      { e: ["💎", "🪞", "⚖️"], c1: "#6fc2d0", c2: "#e8f9fb" },
  "integrity":    { e: ["🧱", "🌲", "🗿"], c1: "#6b4f3a", c2: "#a3b18a" },
  "virtue":       { e: ["🤍", "🌷", "🛡️"], c1: "#dba8bc", c2: "#f9f1f4" },
  "love":         { e: ["💗", "🌹", "💞"], c1: "#e75480", c2: "#ffc0cb" },
  "trust":        { e: ["🪢", "🤲", "⛰️"], c1: "#468faf", c2: "#bde0fe" },
  "doubt":        { e: ["❔", "🌁", "🌫️"], c1: "#7d8597", c2: "#c2c7d0" },
  "unity":        { e: ["🧩", "⭕", "🪢"], c1: "#386fa4", c2: "#59a96a" },
  "contention":   { e: ["🗯️", "⚡", "🌩️"], c1: "#9d0208", c2: "#370617" },
  // doctrine & ordinances
  "testimony":    { e: ["🔥", "🕯️"],       c1: "#ff7043", c2: "#ffd54f" }, // burning bosom
  "sacrifice":    { e: ["🐏", "🩸", "⛰️"], c1: "#8b1e2d", c2: "#5d4a4a" },
  "atonement":    { e: ["🫒", "🍷", "🩸"], c1: "#5a6e3a", c2: "#6d1f3e" }, // olive press, wine-dark
  "deliverance":  { e: ["🦅", "🌊", "🗝️"], c1: "#1f6f8b", c2: "#ffd166" },
  "endurance":    { e: ["🏔️", "🥾"],       c1: "#5c6b73", c2: "#9db4c0" },
  "zion":         { e: ["🌄", "🏙️", "⛰️"], c1: "#f0c75e", c2: "#7ea8be" },
  "temple":       { e: ["🏛️", "✨", "🕊️"], c1: "#f5f0e1", c2: "#d4af37" },
  "priesthood":   { e: ["🗝️", "📯", "🙌"], c1: "#1e3a5f", c2: "#d4a017" },
  "fasting":      { e: ["🥣", "⏳", "🌅"], c1: "#c9b79c", c2: "#f7ecd9" },
  "sabbath":      { e: ["🌤️", "⛪", "🕯️"], c1: "#a3c4f3", c2: "#e6f0fa" },
  "resurrection": { e: ["🦋", "🌅", "🌷"], c1: "#ff8c42", c2: "#ffe29a" },
  "salvation":    { e: ["🛟", "⚓", "🌅"], c1: "#e63946", c2: "#f1faee" },
  "agency":       { e: ["🔀", "🚪", "🧭"], c1: "#2a9d8f", c2: "#9b5de5" },
  "revelation":   { e: ["🌠", "⚡", "🔦"], c1: "#1d2d50", c2: "#f2c14e" },
  "angels":       { e: ["👼", "🎺", "✨"], c1: "#f2e3b6", c2: "#fdfaf0" },
  "miracles":     { e: ["🌟", "💫", "✨"], c1: "#8e7cc3", c2: "#ffd966" },
  "healing":      { e: ["🌿", "🩹", "🫂"], c1: "#57a773", c2: "#c8e6c9" },
  "baptism":      { e: ["💧", "🌊", "🕊️"], c1: "#4ea8de", c2: "#d0efff" },
  "spirit":       { e: ["💨", "🔥", "🕊️"], c1: "#89c2d9", c2: "#fdf0d5" }, // still, small
  "eternal life": { e: ["♾️", "🌳", "🌠"], c1: "#4a2c82", c2: "#f2c94c" },
  "scripture":    { e: ["📖", "📜", "🖋️"], c1: "#a67c52", c2: "#e8d8b8" },
  "prophet":      { e: ["🗼", "📢"],       c1: "#22344a", c2: "#e0b84c" }, // watchman on the tower
  "faith":        { e: ["🌱", "🪴", "⛰️"], c1: "#4cc38a", c2: "#a8e6c1" }, // for "faithfulness"
  "hope":         { e: ["🌅", "⚓", "🌈"], c1: "#ff9f45", c2: "#ffd166" },
  "prayer":       { e: ["🙏", "🛐", "🕯️"], c1: "#b197fc", c2: "#74c0fc" },
  // the story of the covenant people
  "missionary work": { e: ["🌍", "📣", "🚲"], c1: "#2f6690", c2: "#81c3d7" },
  "gathering":    { e: ["🧺", "🪺", "👐"], c1: "#a9714b", c2: "#ecd9c6" },
  "apostasy":     { e: ["🌫️", "🥀", "⛓️"], c1: "#6e6a6f", c2: "#3b3740" },
  "restoration":  { e: ["🌳", "🌤️", "🛠️"], c1: "#3f7d20", c2: "#ffe8a1" }, // grove morning
  "liberty":      { e: ["🚩", "🗽", "🦅"], c1: "#c1121f", c2: "#669bbc" }, // title of liberty
  "exodus":       { e: ["🏜️", "👣", "🐫"], c1: "#d9a066", c2: "#7b5e7b" }, // sand → dusk
  "promised land": { e: ["🏞️", "🍇", "🌄"], c1: "#2d6a4f", c2: "#f4d35e" },
  "remnant":      { e: ["🧵", "🪡"],       c1: "#997b66", c2: "#d5bda2" },
  "adoption":     { e: ["🫂", "💞", "🪺"], c1: "#c86b85", c2: "#f7e1d7" },
  "second coming": { e: ["🎺", "☁️", "🌇"], c1: "#f9a825", c2: "#b0bec5" },
  "judgment":     { e: ["⚖️", "📖", "🔔"], c1: "#424874", c2: "#c9b458" },
  "creation":     { e: ["🌎", "🐋", "✨"], c1: "#0b7a75", c2: "#7bdff2" },
  "war":          { e: ["⚔️", "🛡️", "🏹"], c1: "#7f1d1d", c2: "#4b5563" },
  // the imagery of the word
  "light":        { e: ["🔆", "🌞", "🕯️"], c1: "#ffd93d", c2: "#fffde7" },
  "darkness":     { e: ["🌑", "🦇", "🌚"], c1: "#1a1a2e", c2: "#3d3d5c" },
  "knowledge":    { e: ["📚", "🧠", "🔍"], c1: "#303f9f", c2: "#4dd0e1" },
  "shepherd":     { e: ["🐑", "🌄", "🦯"], c1: "#4f772d", c2: "#b5d99c" },
  "living water": { e: ["⛲", "💧", "🌊"], c1: "#0096c7", c2: "#caf0f8" },
  "bread of life": { e: ["🍞", "🥖", "🌾"], c1: "#c07830", c2: "#f5deb3" },
  "rock":         { e: ["🪨", "⛰️", "🗻"], c1: "#57606f", c2: "#a4b0be" },
  "refuge":       { e: ["🏰", "☂️", "🛖"], c1: "#2c4a6e", c2: "#a9c2de" },
  "harvest":      { e: ["🌾", "🍇", "🚜"], c1: "#d69e2e", c2: "#f6e05e" },
  // the shape of a life
  "work":         { e: ["🐝", "🛠️", "💪"], c1: "#cc8500", c2: "#ffe0a3" }, // deseret
  "rest":         { e: ["🛌", "🌙", "🪷"], c1: "#7c6fb0", c2: "#cbc3e3" },
  "music":        { e: ["🎵", "🎶", "🎻"], c1: "#7d5ba6", c2: "#4ecdc4" },
  "children":     { e: ["🧒", "🎈", "🪁"], c1: "#4fc3f7", c2: "#ffe082" },
  "marriage":     { e: ["💍", "🫶", "🕊️"], c1: "#d4af37", c2: "#f7cad0" },
  "death":        { e: ["🥀", "⚰️", "🍂"], c1: "#4e4562", c2: "#8a8395" },
  "mourning":     { e: ["😢", "🖤", "🌧️"], c1: "#556577", c2: "#aab6c4" },
  "hope in christ": { e: ["⚓", "🌄", "✝️"], c1: "#16425b", c2: "#ffb703" }, // anchor of the soul
  "adversity":    { e: ["🌪️", "⛈️", "🧗"], c1: "#3e5c76", c2: "#748cab" },
  "riches":       { e: ["💰", "🪙", "🏺"], c1: "#c9a227", c2: "#14532d" },
  "poverty":      { e: ["🧎", "👐", "🪫"], c1: "#7f7053", c2: "#b8ad9e" },
};

/** near-words → their lexicon home (checked before and after stemming) */
const SYNONYMS: Record<string, string> = {
  "humble": "humility", "humbled": "humility",
  "meek": "meekness", "gentle": "meekness",
  "vanity": "pride", "vain": "pride", "arrogance": "pride", "arrogant": "pride",
  "haughty": "pride", "boastful": "pride",
  "scared": "fear", "afraid": "fear", "dread": "fear",
  "obedient": "obedience", "obey": "obedience",
  "thank": "gratitude", "grateful": "gratitude",
  "brave": "courage", "bravery": "courage", "valiant": "courage", "strength": "courage",
  "wrath": "anger", "fury": "anger",
  "calm": "peace",
  "compassion": "mercy",
  "endure": "endurance", "perseverance": "endurance",
  "tempt": "temptation",
  "redeemer": "atonement", "redemption": "atonement", "sacrament": "atonement",
  "savior": "salvation", "saved": "salvation", "save": "salvation",
  "passover": "deliverance",
  "grief": "mourning", "sorrow": "mourning", "sad": "mourning",
  "learn": "knowledge", "intelligence": "knowledge", "truth": "knowledge",
  "melchizedek": "priesthood", "aaronic": "priesthood",
  "ordinance": "temple",
  "sealing": "marriage",
  "eternity": "eternal life", "eternal": "eternal life",
  "millennium": "second coming",
  "tribulation": "adversity", "trial": "adversity", "affliction": "adversity",
  "suffering": "adversity",
  "babylon": "apostasy", "idol": "apostasy", "idolatry": "apostasy",
  "wander": "exodus", "wilderness": "exodus", "desert": "exodus",
  "israel": "gathering",
  "missionary": "missionary work", "mission": "missionary work",
  "preach": "missionary work",
  "water": "living water",
  "bread": "bread of life",
  "holy ghost": "spirit", "holy spirit": "spirit", "comforter": "spirit",
  "pray": "prayer",
  "sing": "music", "hymn": "music",
  "miracle": "miracles", "angel": "angels", "child": "children", "rich": "riches",
};

/** Fallback pool for unknown words: ~40 badges spread around the hue wheel,
 * adjacent entries deliberately dissimilar. Hash lands here; walks step here. */
const POOL: FeelEntry[] = [
  { e: ["🧿"], c1: "#1f6feb", c2: "#8ab4ff" },
  { e: ["🍊"], c1: "#e8590c", c2: "#ffc078" },
  { e: ["🌵"], c1: "#2b8a3e", c2: "#8ce99a" },
  { e: ["🐚"], c1: "#e64980", c2: "#ffc9d8" },
  { e: ["🪻"], c1: "#6741d9", c2: "#b197fc" },
  { e: ["🧊"], c1: "#15aabf", c2: "#99e9f2" },
  { e: ["🌶️"], c1: "#c92a2a", c2: "#ff8787" },
  { e: ["🥝"], c1: "#66a80f", c2: "#c0eb75" },
  { e: ["🐳"], c1: "#1864ab", c2: "#74c0fc" },
  { e: ["🪅"], c1: "#d6336c", c2: "#faa2c1" },
  { e: ["🍁"], c1: "#d9480f", c2: "#ff922b" },
  { e: ["🦜"], c1: "#0b7285", c2: "#63e6be" },
  { e: ["🫐"], c1: "#364fc7", c2: "#91a7ff" },
  { e: ["🏮"], c1: "#f08c00", c2: "#ffe066" },
  { e: ["🪐"], c1: "#5f3dc4", c2: "#d0bfff" },
  { e: ["🦎"], c1: "#087f5b", c2: "#96f2d7" },
  { e: ["🌸"], c1: "#f06595", c2: "#ffdeeb" },
  { e: ["⛵"], c1: "#1971c2", c2: "#a5d8ff" },
  { e: ["🍑"], c1: "#f76707", c2: "#ffd8a8" },
  { e: ["🎋"], c1: "#2f9e44", c2: "#b2f2bb" },
  { e: ["🌂"], c1: "#9c36b5", c2: "#eebefa" },
  { e: ["🐠"], c1: "#0c8599", c2: "#66d9e8" },
  { e: ["🍒"], c1: "#a61e4d", c2: "#ff8fab" },
  { e: ["🌽"], c1: "#e67700", c2: "#ffec99" },
  { e: ["🐙"], c1: "#4263eb", c2: "#bac8ff" },
  { e: ["🍀"], c1: "#37b24d", c2: "#d3f9d8" },
  { e: ["🎭"], c1: "#845ef7", c2: "#e5dbff" },
  { e: ["🪶"], c1: "#748ffc", c2: "#dbe4ff" },
  { e: ["🎇"], c1: "#f59f00", c2: "#fff3bf" },
  { e: ["🥥"], c1: "#7f5539", c2: "#ddb892" },
  { e: ["🐬"], c1: "#1098ad", c2: "#c5f6fa" },
  { e: ["🌺"], c1: "#e03131", c2: "#ffc9c9" },
  { e: ["🌴"], c1: "#099268", c2: "#a9f1cf" },
  { e: ["🎷"], c1: "#ca8a04", c2: "#fde68a" },
  { e: ["🐞"], c1: "#c0392b", c2: "#f5b7b1" },
  { e: ["🪄"], c1: "#7048e8", c2: "#c5b3f5" },
  { e: ["🍋"], c1: "#fab005", c2: "#fff9db" },
  { e: ["🐇"], c1: "#868e96", c2: "#f1f3f5" },
  { e: ["🌇"], c1: "#e8632c", c2: "#fcc419" },
  { e: ["🦭"], c1: "#4c6ef5", c2: "#bac8ff" },
];

/** U+0300–U+036F combining marks — NFKD leaves them behind accented letters */
const COMBINING = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

/** fold away case, punctuation, diacritics — "Hope in Christ!" → "hope in christ" */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(COMBINING, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/ +/g, " ").trim();
}

/** light stemmer: peel s/es/ed/ing/ness/ful/ly while ≥3 chars remain —
 * "prideful" → "pride", "meekness" → "meek", "riches" → "rich" */
const SUFFIXES = ["ness", "ful", "ing", "ed", "es", "ly", "s"];
function stem(word: string): string {
  let w = word;
  for (let again = true; again;) {
    again = false;
    for (const sfx of SUFFIXES) {
      if (!w.endsWith(sfx) || w.length - sfx.length < 3) continue;
      if (sfx === "s" && w.endsWith("ss")) continue;            // meekness ≠ meeknes
      if (sfx === "es" && !/(?:s|x|z|ch|sh)es$/.test(w)) continue; // miracles → miracle, riches → rich
      w = w.slice(0, -sfx.length);
      again = true;
      break;
    }
  }
  return w;
}

/** name/stem/synonym → entry; first registration wins (deterministic) */
const FEEL_INDEX = new Map<string, FeelEntry>();
{
  const put = (k: string, e: FeelEntry) => { if (k && !FEEL_INDEX.has(k)) FEEL_INDEX.set(k, e); };
  for (const [k, e] of Object.entries(LEXICON)) { put(k, e); put(stem(k), e); }
  for (const [w, k] of Object.entries(SYNONYMS)) {
    const e = LEXICON[k];
    if (e) { put(normalize(w), e); put(stem(normalize(w)), e); }
  }
}

function lookup(norm: string): FeelEntry | null {
  const hit = FEEL_INDEX.get(norm) ?? FEEL_INDEX.get(stem(norm));
  if (hit) return hit;
  if (norm.includes(" ")) {                       // "the pride of my heart" → pride
    for (const tok of norm.split(" ")) {
      const t = FEEL_INDEX.get(tok) ?? FEEL_INDEX.get(stem(tok));
      if (t) return t;
    }
  }
  return null;
}

/** FNV-1a — a stable little hash so unknown words keep their look forever */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** compare badges without the U+FE0F variation selector — 🕊 and 🕊️ are the same dove */
const VS16 = String.fromCharCode(0xfe0f);
const bare = (e: string): string => e.split(VS16).join("");

/** The engine. Deterministic: same name + same taken-set → same look.
 * `taken` = emojis already claimed (premades + other customs); the walk
 * tries the entry's candidates, then steps through the pool from the
 * name's hash slot until a free badge appears. */
export function feelSpec(name: string, taken: ReadonlySet<string>): FeelLook {
  const used = new Set<string>();
  for (const e of taken) used.add(bare(e));
  const norm = normalize(name);
  const entry = lookup(norm);
  const h = fnv1a(norm);
  const slot = POOL[h % POOL.length]!;
  const mood = entry ?? slot;                      // gradient never walks — only the badge
  const candidates = entry ? entry.e : slot.e;
  for (const c of candidates) {
    if (!used.has(bare(c))) return { emoji: c, c1: mood.c1, c2: mood.c2 };
  }
  for (let i = 0; i < POOL.length; i++) {
    const c = POOL[(h + i) % POOL.length]!.e[0]!;
    if (!used.has(bare(c))) return { emoji: c, c1: mood.c1, c2: mood.c2 };
  }
  // the impossible day every badge is claimed — degrade, still deterministic
  return { emoji: candidates[0] ?? "🏷️", c1: mood.c1, c2: mood.c2 };
}
