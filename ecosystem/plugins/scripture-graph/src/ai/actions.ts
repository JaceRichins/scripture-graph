/** What the assistant can DO in the app, not just say.
 *
 * The family server's assistant answers in words and, when asked to act,
 * adds a list of actions: open a page, highlight a verse, leave a note,
 * connect two passages, change a reading setting, write a lesson plan.
 * This is the hand that carries them out, through the same code the
 * reader's own taps use — so a highlight the assistant makes is the
 * reader's highlight, synced and removable like any other. Nothing here
 * can reach outside the vault or the reader's own settings. */
import { Notice, TFile } from "obsidian";
import { backgroundVisibility } from '../study/backgroundVisibility';
import { CANONICAL_PREFIX, SGState } from "../state";
import type { AnnotationService } from "../social/annotations";
import { saveLessonFiles, saveResearchProject } from "./lessonFiles";
import { editDocument, renameDocument } from "./documentEdit";
import { approvedActionsKeepingSettings } from '@scripture-graph/core-sdk';

export type Ref = { chapter: string; verse?: string | null };

export type AssistantAction =
  | { do: "open"; page: string; verse?: string | null }
  | { do: "highlight"; chapter: string; verse: string; color?: string | null; style?: string | null; theme?: string | null; selected?: string | null }
  | { do: "note"; chapter: string; verse: string; text: string }
  | { do: "connect"; from: Ref; to: Ref; why?: string | null }
  | { do: "setting"; key: "scene" | "fontScale" | "font" | "swipeNav" | "backgroundVisibility" | ReadingKey; value: string | number | boolean | null }
  | { do: "lesson"; title: string; markdown: string }
  | { do: "edit_document"; path: string; markdown: string }
  | { do: "rename_document"; path: string; title: string }
  | { do: "research"; title: string; pages: { folder: string; title: string; markdown: string }[] };

/** the Aa sheet's settings, as the assistant names them (core-sdk READING_SETTINGS) */
type ReadingKey = "readingSize" | "lineSpacing" | "typeface" | "readingTheme" | "pageWidth" | "focusMode" | "marginNotes";
const READING_FIELD: Record<ReadingKey, string> = {
  readingSize: "scale", lineSpacing: "spacing", typeface: "font", readingTheme: "theme",
  pageWidth: "width", focusMode: "focus", marginNotes: "marginNotes",
};

export interface AskHost {
  openMyWork?: () => void;
  openNote: (link: string) => void | Promise<void>;
  openChapter: (title: string) => void | Promise<void>;
  /** make sure a page is on this device (lazy shelves), true when it is */
  ensure: (link: string) => Promise<boolean>;
  /** Resolve freshly fetched pages before Obsidian's metadata cache catches up. */
  pathFor?: (link: string) => string | null;
  /** apply a scene by id; null = whatever the settings say */
  scene: (id: string | null) => void;
  /** re-apply the reading font and size from device settings */
  readingPrefs: () => void;
  /** change Aa reading settings (saveReading); absent in hosts that cannot */
  setReading?: (patch: Record<string, unknown>) => unknown;
  /** the Aa settings as the assistant should see them; undefined = not offered */
  readingState?: () => Record<string, unknown> | undefined;
}

const COLORS = new Set(["yellow", "green", "blue", "pink", "orange", "purple", "red", "teal"]);
const STYLES = new Set(["highlight", "underline", "bold", "italic"]);

/** Resolve real canonical content even before a lazy download reaches the link cache. */
async function canonicalRaw(s: SGState, host: AskHost, chapter: string): Promise<string> {
  if (chapter.includes('#') || !(await host.ensure(chapter))) throw new Error('Chapter is unavailable.');
  const name = chapter.replace(/\.md$/, '');
  const matches = (p: string) => p.startsWith(CANONICAL_PREFIX) && (name.includes('/') ? p === `${name}.md` : p.endsWith(`/${name}.md`));
  const adapter = s.app.vault.adapter;
  const paths = new Set(s.app.vault.getFiles().filter(f => matches(f.path)).map(f => f.path));
  const linked = s.app.metadataCache.getFirstLinkpathDest(chapter, '');
  if (linked instanceof TFile && matches(linked.path)) paths.add(linked.path);
  if (!paths.size) {
    const pending = [CANONICAL_PREFIX.replace(/\/$/, '')], visited = new Set<string>();
    while (pending.length) {
      const folder = pending.pop()!;
      if (visited.has(folder) || !(await adapter.exists(folder))) continue;
      visited.add(folder);
      const listing = await adapter.list(folder);
      for (const p of listing.files) if (matches(p)) paths.add(p);
      for (const p of listing.folders) if (p.startsWith(CANONICAL_PREFIX) && !p.split('/').some(part => part.startsWith('.'))) pending.push(p);
    }
  }
  const existing: string[] = [];
  for (const p of paths) if (await adapter.exists(p)) existing.push(p);
  if (existing.length !== 1) throw new Error('Could not identify one canonical chapter.');
  return adapter.read(existing[0]!);
}

/** the verse's words, from the chapter file: the line that ends in ^id */
export async function verseText(s: SGState, host: AskHost, chapter: string, verse: string): Promise<string | null> {
  const raw = await canonicalRaw(s, host, chapter);
  const re = new RegExp(`^(.*)\\s\\^${verse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
  const m = re.exec(raw);
  if (!m) return null;
  return m[1]!.replace(/^\s*(?:\*\*)?\d+(?:\*\*)?[.\s]*/, "").replace(/==|\*\*/g, "").trim();
}

async function checkedRef(s: SGState, host: AskHost, ref: Ref): Promise<string | null> {
  if (!ref.verse) { if (!(await host.ensure(ref.chapter))) throw new Error('Page is unavailable.'); return null; }
  const text = await verseText(s, host, ref.chapter, ref.verse);
  if (!text) throw new Error('That verse was not found in the canonical chapter.');
  return text;
}

/** what the app looks like right now, so the assistant can act on it sensibly */
export function snapshot(s: SGState, host?: AskHost): Record<string, unknown> {
  const active = s.app.workspace.getActiveFile();
  const d = s.device as { readFont?: string | null; readScale?: number };
  return {
    page: active ? active.basename : null,
    scene: s.device.scene,
    backgroundVisibility: backgroundVisibility(s.device.backgroundVisibility),
    themes: (s.settings.themes ?? []).map(t => t.name),
    colors: [...COLORS],
    fontScale: d.readScale ?? 1,
    font: d.readFont ?? null,
    swipeNav: s.device.swipeNav,
    // Advertised only when this app can apply them and the reader allows it;
    // the server offers the reading actions only when it sees this.
    ...(host?.setReading && host.readingState?.() ? { reading: host.readingState() } : {}),
  };
}

/** carry the actions out, one after another; the lines say what happened */
export async function perform(s: SGState, ann: AnnotationService, host: AskHost, actions: AssistantAction[], onDocuments?: (paths: string[]) => void, documentContext?: { path: string; base: string }, documentKind: 'lesson' | 'study-plan' = 'lesson', openDocuments = true): Promise<string[]> {
  const done: string[] = [];
  let lessonsSaved = false;
  // A setting the policy refuses is dropped on its own and reported; anything
  // else outside the policy still rejects the whole list, as it always has.
  const checked = approvedActionsKeepingSettings(actions);
  actions = checked.actions as AssistantAction[];
  if (checked.dropped) done.push(`Couldn't change ${checked.dropped === 1 ? "a setting" : `${checked.dropped} settings`}: not an allowed value.`);
  const visibility = 'private' as const, groupId = null;
  for (const a of actions.slice(0, 12)) {
    try {
      switch (a.do) {
        case "open": {
          if (a.verse && a.page.includes('#')) throw new Error('Supply the page and verse separately.');
          const embedded = a.page.match(/#\^([a-z0-9-]+)$/);
          if (a.verse || embedded) await checkedRef(s, host, { chapter: a.page.split('#')[0]!, verse: a.verse ?? embedded![1] });
          else if (!(await host.ensure(a.page))) throw new Error('Page is unavailable.');
          if (a.verse) await host.openNote(`${a.page}#^${a.verse}`);
          else if (/^(?:[1-4] )?[A-Z][A-Za-z&. ]+ \d+$/.test(a.page)) await host.openChapter(a.page);
          else await host.openNote(a.page);
          done.push(`Opened ${a.page}${a.verse ? `:${a.verse.split("-").pop()}` : ""}`);
          break;
        }
        case "highlight": {
          const text = await checkedRef(s, host, a);
          const theme = a.theme ? (s.settings.themes ?? []).find(t => t.name.toLowerCase() === a.theme!.toLowerCase()) : null;
          const color = theme ? theme.color : (a.color && COLORS.has(a.color) ? a.color : s.device.lastColor);
          const style = theme ? "theme" : (a.style && STYLES.has(a.style) ? a.style : s.device.lastStyle);
          const selected = a.selected && text && text.includes(a.selected) ? a.selected : null;
          await ann.addHighlight(a.verse, color, text, selected, visibility, groupId, style, theme ? theme.name : null);
          done.push(`${theme ? `Marked “${theme.name}”` : "Highlighted"} ${a.chapter}:${a.verse.split("-").pop()}`);
          break;
        }
        case "note": {
          const text = await checkedRef(s, host, a);
          await ann.addNote(a.verse, a.text, text, visibility, groupId);
          done.push(`Left a note on ${a.chapter}:${a.verse.split("-").pop()}`);
          break;
        }
        case "connect": {
          const link = (r: Ref) => r.verse ? `${r.chapter}#^${r.verse}` : r.chapter;
          const fromId = a.from.verse ?? a.from.chapter, toId = a.to.verse ?? a.to.chapter;
          const quoted = await checkedRef(s, host, a.from);
          const targetQuoted = await checkedRef(s, host, a.to);
          const tail = a.why ? ` — ${a.why}` : "";
          await ann.addNote(fromId, `Connect: [[${link(a.to)}]]${tail}`, quoted, visibility, groupId);
          await ann.addNote(toId, `Connect: [[${link(a.from)}]]${tail}`, targetQuoted, visibility, groupId);
          done.push(`⇄ Connected ${a.from.chapter}${a.from.verse ? ":" + a.from.verse.split("-").pop() : ""} with ${a.to.chapter}${a.to.verse ? ":" + a.to.verse.split("-").pop() : ""}`);
          break;
        }
        case "setting": {
          if (a.key === 'backgroundVisibility') {
            const previous = s.device.backgroundVisibility;
            s.device.backgroundVisibility = backgroundVisibility(a.value);
            try { await s.saveDevice(); }
            catch (error) { s.device.backgroundVisibility = previous; throw error; }
            host.readingPrefs();
            done.push(`Background photo visibility: ${s.device.backgroundVisibility}%`);
            break;
          }
          if (a.key in READING_FIELD) {
            if (!host.setReading) throw new Error("this version of the app can't change that yet");
            const field = READING_FIELD[a.key as ReadingKey];
            const saved = host.setReading({ [field]: a.value }) as Record<string, unknown> | undefined;
            const v = saved?.[field] ?? a.value;
            const label: Record<ReadingKey, string> = {
              readingSize: `Reading text size: ${Math.round(Number(v) * 100)}%`, lineSpacing: `Line spacing: ${v}`,
              typeface: `Typeface: ${v}`, readingTheme: `Reading page: ${v}`, pageWidth: `Page width: ${v}`,
              focusMode: `Focus reading: ${v ? "on" : "off"}`, marginNotes: `Notes beside verses: ${v ? "shown" : "hidden"}`,
            };
            done.push(label[a.key as ReadingKey]);
            break;   // saveReading has already saved and applied it
          }
          const d = s.device as { readFont?: string | null; readScale?: number };
          if (a.key === "scene") { s.device.scene = String(a.value ?? "none"); host.scene(s.device.scene === "none" ? null : s.device.scene === "auto" || s.device.scene === "match" ? null : s.device.scene); done.push(`Scene: ${s.device.scene}`); }
          else if (a.key === "fontScale") { const n = Number(a.value); if (!Number.isFinite(n)) throw new Error("bad size"); d.readScale = Math.min(1.8, Math.max(0.7, n)); host.readingPrefs(); done.push(`Text size: ${Math.round(d.readScale * 100)}%`); }
          else if (a.key === "font") { d.readFont = a.value ? String(a.value) : null; host.readingPrefs(); done.push(`Font: ${d.readFont ?? "default"}`); }
          else if (a.key === "swipeNav") { s.device.swipeNav = !!a.value; done.push(`Swipe to turn chapters: ${s.device.swipeNav ? "on" : "off"}`); }
          await s.saveDevice();
          break;
        }
        case "lesson": {
          if (lessonsSaved) break;
          lessonsSaved = true;
          const docs = actions.slice(0, 12).filter((action): action is Extract<AssistantAction, { do: "lesson" }> => action.do === "lesson");
          const saved = await saveLessonFiles(s, host, docs, documentKind);
          onDocuments?.(saved.documents);
          if (openDocuments) await host.openNote(saved.documents[0]!);
          done.push(`Created ${saved.documents.length} document(s) and ${saved.copied} reference copies in ${saved.folder}`);
          break;
        }
        case "research": {
          const saved = await saveResearchProject(s, a);
          onDocuments?.(saved.documents);
          if (openDocuments) await host.openNote(saved.documents[0]!);
          done.push(`Saved a private research project of ${a.pages.length} pages in ${saved.folder}`);
          break;
        }
        case "edit_document": {
          await editDocument(s, documentContext, a.path, a.markdown);
          done.push('Saved changes to this document.');
          break;
        }
        case "rename_document": {
          await renameDocument(s, documentContext, a.path, a.title);
          done.push(`Renamed to “${a.title}”.`);
          break;
        }
      }
    } catch (e) {
      done.push(`Couldn't ${a.do}: ${(e as Error).message}`);
    }
  }
  if (done.length) new Notice(done[done.length - 1]!);
  return done;
}
