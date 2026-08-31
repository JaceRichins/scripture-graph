/** Which rendered sections are still placeholders.
 *
 * Engine-generated notes are built from a fixed template of `SG:BEGIN/END`
 * managed sections, and a section with nothing in it yet renders the engine's
 * placeholder (`_Not yet developed._`, see vaultgen/md.py). On a corpus where
 * research has only reached a fraction of the chapters, the overwhelming
 * majority of every guide is that placeholder, and the first thing a reader
 * meets is a wall of headings saying nothing.
 *
 * The rendered DOM has no markers left in it — Obsidian drops HTML comments —
 * so this works structurally instead: a heading owns every block until the
 * next heading of the same or higher rank, and a section is empty when every
 * block it owns is a placeholder. That makes a parent heading whose only
 * subsections are empty come out empty too, which is what a reader means by
 * "there's nothing here".
 *
 * Pure and DOM-free on purpose: the caller maps its elements to `Block`s, gets
 * a plan back, and applies it. That keeps the interesting half testable in an
 * environment with no DOM.
 */

/** The engine's placeholder for a section that has not been researched yet. */
export const PLACEHOLDER_TEXT = "Not yet developed.";

/** One top-level rendered block: a heading (`level` 1-6) or content (`null`). */
export interface Block {
  level: number | null;
  text: string;
}

export interface EmptySection {
  /** index of the heading block */
  heading: number;
  level: number;
  title: string;
  /** indices of every block this heading owns, subsections included */
  body: number[];
}

/** True for blank text and for the engine placeholder in any rendered form. */
export function isPlaceholder(text: string | undefined | null): boolean {
  if (!text) return true;
  // strip the markdown emphasis the placeholder carries in source form, plus
  // the non-breaking spaces Obsidian sometimes leaves behind
  const t = text.replace(/ /g, " ").replace(/[*_`]/g, "").trim();
  if (t === "") return true;
  return t.toLowerCase().replace(/\s+/g, " ") === PLACEHOLDER_TEXT.toLowerCase();
}

/** Every section whose entire body is placeholder, outermost first.
 *
 * Nested sections are reported as well as their empty parent, so a caller can
 * hide the parent and still find each child already accounted for. Callers
 * that only want the outermost should filter with `outermost()`.
 */
export function findEmptySections(blocks: Block[]): EmptySection[] {
  const out: EmptySection[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const level = blocks[i]!.level;
    if (level === null) continue;
    const body: number[] = [];
    let allEmpty = true;
    for (let j = i + 1; j < blocks.length; j++) {
      const b = blocks[j]!;
      if (b.level !== null && b.level <= level) break;   // next sibling/parent
      body.push(j);
      // a nested heading is structure, not content: only real text decides
      if (b.level === null && !isPlaceholder(b.text)) allEmpty = false;
    }
    // A heading with no body at all is a stub too, and reads the same way.
    if (allEmpty) {
      out.push({ heading: i, level, title: blocks[i]!.text.trim(), body });
    }
  }
  return out;
}

/** Drop sections already contained in an earlier (outer) empty section. */
export function outermost(found: EmptySection[]): EmptySection[] {
  const covered = new Set<number>();
  const out: EmptySection[] = [];
  for (const s of found) {
    if (covered.has(s.heading)) continue;
    out.push(s);
    for (const idx of s.body) covered.add(idx);
  }
  return out;
}

/** The whole decision in one call: which blocks to hide, and under which
 * heading to show the "not yet developed" affordance. */
export function planEmptySections(blocks: Block[]): EmptySection[] {
  return outermost(findEmptySections(blocks));
}
