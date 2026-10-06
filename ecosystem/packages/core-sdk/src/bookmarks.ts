/** A bookmark keeps one page and, as the reader goes, the place they left off.
 * The record rides in the annotation's content, so it syncs with the bookmark. */
/** `mark` is the verse (or study block) the reader was on. It is the durable
 * part: text can be re-wrapped and the page re-laid-out, and the verse is still
 * the verse. `top` and `anchor` remain for places saved before it existed. */
export interface BookmarkPlace { top: number; left: number; anchor?: { tag: string; text: string; offset: number }; mark?: { id: string; offset: number } }
export interface BookmarkRecord { path: string; title: string; place: BookmarkPlace | null; at: string | null }

const MARKER = "sg-bookmark ";

export function bookmarkContent(record: BookmarkRecord): string {
  // The first line stays readable (and names the page for older app versions).
  const title = record.title.replace(/[[\]|\r\n]/g, " ").replace(/\s+/g, " ").trim() || "Bookmark";
  return `Bookmark: [[${title}]]\n${MARKER}${JSON.stringify({ v: 1, ...record })}`;
}

function place(value: unknown): BookmarkPlace | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (typeof p["top"] !== "number" || !Number.isFinite(p["top"]) || typeof p["left"] !== "number" || !Number.isFinite(p["left"])) return null;
  const a = p["anchor"] as Record<string, unknown> | undefined;
  const anchor = a && typeof a["tag"] === "string" && typeof a["text"] === "string" && typeof a["offset"] === "number" && Number.isFinite(a["offset"])
    ? { tag: a["tag"], text: a["text"].slice(0, 200), offset: a["offset"] } : undefined;
  const m = p["mark"] as Record<string, unknown> | undefined;
  const mark = m && typeof m["id"] === "string" && m["id"].trim() && typeof m["offset"] === "number" && Number.isFinite(m["offset"])
    ? { id: m["id"].trim().slice(0, 120), offset: m["offset"] } : undefined;
  return { top: Math.max(0, p["top"]), left: p["left"], ...(anchor ? { anchor } : {}), ...(mark ? { mark } : {}) };
}

/** Bookmarks written before records existed still name their page on the first line. */
export function parseBookmark(content: string): { title: string | null; record: BookmarkRecord | null } {
  const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(content);
  let record: BookmarkRecord | null = null;
  const line = content.split("\n").find(l => l.startsWith(MARKER));
  if (line) {
    try {
      const v = JSON.parse(line.slice(MARKER.length)) as Record<string, unknown>;
      if (v["v"] === 1 && typeof v["path"] === "string" && typeof v["title"] === "string") {
        record = { path: v["path"], title: v["title"], place: place(v["place"]), at: typeof v["at"] === "string" ? v["at"] : null };
      }
    } catch { /* hand-edited or truncated: the first line still names the page */ }
  }
  return { title: record?.title ?? (link ? (link[2] ?? link[1]!).trim() : null), record };
}

/** Where the reader left off, in words: "Verse 24 · “…”", "“…”", or "The top of the page". */
export function placeLabel(p: BookmarkPlace | null): string | null {
  if (!p) return null;
  if (p.top < 1) return "The top of the page";
  const text = p.anchor?.text.replace(/\s+/g, " ").trim();
  // A verse with no remembered wording (a place synced from an older app) still names itself.
  if (!text) { const n = /-(\d{1,3})$/.exec(p.mark?.id ?? ""); return n ? `Verse ${n[1]}` : null; }
  const verse = /^(\d{1,3})[.\s]\s*(\S.*)$/.exec(text);
  const words = verse ? verse[2]! : text;
  const snippet = words.length > 70 ? `${words.slice(0, 70).replace(/\s+\S*$/, "")}…` : words;
  return verse ? `Verse ${verse[1]} · “${snippet}”` : `“${snippet}”`;
}
