/** Floating layers (connections sheet, library sheet, verse peek) can stack.
 * When REAL navigation happens — "Open chapter", the back pill, anything that
 * changes the file — every floating layer must fold away, or the reader lands
 * on the new page with stale sheets hovering over it. */

interface Closeable { close(): void }

const open = new Set<Closeable>();

export function registerSheet(m: Closeable): void { open.add(m); }
export function unregisterSheet(m: Closeable): void { open.delete(m); }

export function closeAllSheets(): void {
  for (const m of Array.from(open)) {
    open.delete(m);
    try { m.close(); } catch { /* already closing */ }
  }
}
