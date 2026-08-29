/** One-time import from the v0.2 "scripture-graph-annotate" plugin.
 * Old format (plugin data.json): { highlights: { [verseId]: [{color, text,
 * created}] }, notes: { [verseId]: count } }. Notes already live as personal
 * Markdown (My Notes pages) — those stay where they are. Highlights are
 * imported as device-local annotations (they were per-device before; we do
 * not silently upload them — the user can re-share individually). */
import { Notice } from "obsidian";
import { nowIso, uuid, type Annotation } from "@scripture-graph/core-sdk";
import type { SGState } from "./state";

interface OldHighlight { color?: string; text?: string | null; created?: string }
interface OldData { highlights?: Record<string, OldHighlight[]>; notes?: Record<string, number> }

const OLD_DATA = ".obsidian/plugins/scripture-graph-annotate/data.json";
const FLAG = "migrated_v02_annotate";

export async function migrateFromAnnotate(s: SGState): Promise<void> {
  if (await s.store.get<boolean>(FLAG)) return;
  const adapter = s.app.vault.adapter;
  let raw: string;
  try {
    if (!(await adapter.exists(OLD_DATA))) {
      await s.store.put(FLAG, true);
      return;
    }
    raw = await adapter.read(OLD_DATA);
  } catch {
    return; // try again next launch
  }
  let old: OldData;
  try { old = JSON.parse(raw) as OldData; } catch { await s.store.put(FLAG, true); return; }

  let count = 0;
  for (const [verseId, list] of Object.entries(old.highlights ?? {})) {
    for (const h of list ?? []) {
      const a: Annotation = {
        annotation_id: uuid(),
        author_user_id: s.device.userId,
        anchor_type: "verse",
        anchor_id: verseId,
        annotation_type: "highlight",
        selected_text: null, start_offset: null, end_offset: null, text_hash: null,
        content: "", color: h.color ?? "yellow", style: null, theme: null,
        visibility: "local", group_id: null,
        created_at: h.created ?? nowIso(), updated_at: h.created ?? nowIso(),
        deleted_at: null, version: 1,
      };
      // old plugin stored no offsets — selected_text alone still renders via
      // the text-search fallback in applyMark/resolvePartialAnchor
      if (h.text) a.selected_text = h.text;
      await s.sync.save(a);
      count++;
    }
  }
  await s.store.put(FLAG, true);
  if (count) {
    new Notice(`Scripture Graph: imported ${count} highlight${count === 1 ? "" : "s"} ` +
      "from the old plugin (kept device-local — share any of them from the verse popover).");
  }
}
