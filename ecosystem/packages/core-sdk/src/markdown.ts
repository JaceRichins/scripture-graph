/** Vault-format helpers shared by retrieval + the reader: SG managed-section
 * markers, verse-line parsing, wikilinks. Mirrors the Python engine's format
 * (single source of truth is the engine; these are read-only parsers). */

export interface ParsedNote { frontmatter: Record<string, unknown>; body: string }

export function parseFrontmatter(text: string): ParsedNote {
  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---\n", 4);
    if (end !== -1) {
      const fmText = text.slice(4, end);
      const body = text.slice(end + 5);
      const fm: Record<string, unknown> = {};
      for (const line of fmText.split("\n")) {
        const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
        if (m) {
          let v: unknown = m[2];
          if (v === "true") v = true;
          else if (v === "false") v = false;
          else if (typeof v === "string" && /^-?\d+$/.test(v)) v = Number(v);
          else if (typeof v === "string") v = v.replace(/^['"]|['"]$/g, "");
          fm[m[1]!] = v;
        }
      }
      return { frontmatter: fm, body };
    }
  }
  return { frontmatter: {}, body: text };
}

const MARKER_RE = /<!-- SG:BEGIN ([a-z0-9_-]+) -->\n?([\s\S]*?)\n?<!-- SG:END \1 -->/g;

export function sections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(MARKER_RE)) out[m[1]!] = (m[2] ?? "").trim();
  return out;
}

export function sectionIsEmpty(content: string | undefined): boolean {
  return !content || content.trim() === "" || content.trim() === "_Not yet developed._";
}

/** Canonical verse lines look like:  **18** text of the verse ^alma-36-18  */
export interface VerseLine { verse: number; text: string; verseId: string }

export function parseCanonicalVerses(body: string): VerseLine[] {
  const out: VerseLine[] = [];
  for (const line of body.split("\n")) {
    const m = /^\*\*(\d{1,3})\*\*\s+([\s\S]*?)\s+\^([a-z0-9]+-\d+-\d+)\s*$/.exec(line);
    if (m) out.push({ verse: Number(m[1]), text: m[2]!, verseId: m[3]! });
  }
  return out;
}

export function extractWikilinks(text: string): { target: string; anchor: string }[] {
  const out: { target: string; anchor: string }[] = [];
  for (const m of text.matchAll(/\[\[([^\[\]|#]+)(#[^\[\]|]*)?(?:\|[^\[\]]*)?\]\]/g)) {
    out.push({ target: m[1]!.trim(), anchor: (m[2] ?? "").trim() });
  }
  return out;
}

/** Context depth presets (§25): rough character budgets, no token math for users. */
export const DEPTH_BUDGET: Record<"focused" | "balanced" | "deep", number> = {
  focused: 12_000,
  balanced: 32_000,
  deep: 90_000,
};

export interface ContextItem { label: string; wikilink: string | null; text: string; priority: number }

/** Trim assembled context to the depth budget, keeping highest priority first. */
export function trimContext(items: ContextItem[], depth: keyof typeof DEPTH_BUDGET): ContextItem[] {
  const budget = DEPTH_BUDGET[depth];
  const sorted = [...items].sort((a, b) => a.priority - b.priority);
  const out: ContextItem[] = [];
  let used = 0;
  for (const it of sorted) {
    // 15% soft overflow so a boundary item isn't dropped; never for huge items
    if (out.length > 0 && used + it.text.length > budget * 1.15) continue;
    out.push(it);
    used += it.text.length;
  }
  return out;
}
