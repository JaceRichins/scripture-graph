/** Interaction harness: the REAL StudyBar + AnnotationService + SyncEngine
 * running against fake Genesis verses, driven by real (emulated) touches. */
import { MemoryStore } from "../../../packages/core-sdk/src/localstore";
import { SyncEngine } from "../../../packages/core-sdk/src/syncengine";
import { AnnotationService, decorateVerse } from "../src/social/annotations";
import { StudyBar } from "../src/study/studyBar";
import { StudyService } from "../src/study/study";

const VERSES = [
  "In the beginning God created the heaven and the earth.",
  "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.",
  "And God said, Let there be light: and there was light.",
  "And God saw the light, that it was good: and God divided the light from the darkness.",
  "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.",
];

// ---- fake-but-honest SGState: real sync engine, real device fields --------
const store = new MemoryStore();
const sync = new SyncEngine(store);
const state = {
  app: {
    workspace: {
      getActiveFile: () => null,
      getLeavesOfType: () => [],
      openLinkText: () => { /* noop */ },
      getLeaf: () => ({
        setViewState: async (st: unknown) => {
          (window as unknown as { __graphOpened?: unknown }).__graphOpened = st;
        },
      }),
      revealLeaf: async () => { /* noop */ },
    },
    metadataCache: {
      getFirstLinkpathDest: (t: string) => t === "Genesis 1"
        ? { path: "AI Library/01 Scriptures/Canonical/01 Old Testament/01 Genesis/Genesis 1.md",
            basename: "Genesis 1" }
        : null,
      getFileCache: () => null,
    },
  },
  device: {
    userId: "harness-user",
    lastShareScope: { visibility: "private", groupId: null },
    lastColor: "yellow",
    lastStyle: "highlight",
    lastTheme: null,
    showScopes: { mine: true, groups: {}, public: false },
  },
  settings: { defaultVisibility: "private", themes: [
    { name: "Faith", color: "blue", style: "underline" },
  ] },
  applySettings(p: Record<string, unknown>) { Object.assign(this.settings, p); },
  groups: [{ group_id: "g1", name: "Richins Family", role: "member" }],
  signedIn: true,
  socialCache: new Map(),
  onChange: [] as (() => void)[],
  store,
  sync,
  budget: null,
  api: null,
  notify() { for (const f of this.onChange) f(); },
  async saveDevice() { /* device state is in-memory here */ },
  rerenderReading() { void redecorate(); this.notify(); },
} as never;

const ann = new AnnotationService(state);
// keep the harness offline: no timers hitting a server
(ann as unknown as { scheduleSync: (ms?: number) => void }).scheduleSync = () => { /* offline */ };
const study = new StudyService(state, ann);
const bar = new StudyBar(state, ann, study, (seed, anchor) => {
  log(`ASK AI opened — anchor=${anchor ?? "none"} seed="${seed}"`);
});

// ---- page ----------------------------------------------------------------
const root = document.getElementById("app")!;
const view = root.createDiv({ cls: "markdown-preview-view" });
view.createEl("h2", { text: "Genesis 1 (harness)" });
const paras: HTMLElement[] = [];
VERSES.forEach((text, i) => {
  const p = view.createEl("p", { attr: { "data-verse-id": `gen-1-${i + 1}` } });
  p.createEl("strong", { text: String(i + 1) });
  p.appendText(" " + text);
  paras.push(p);
});

const logEl = root.createDiv({ cls: "harness-log" });
function log(msg: string) {
  logEl.createDiv({ text: `▸ ${msg}` });
  logEl.scrollTop = logEl.scrollHeight;
}

async function redecorate() {
  for (let i = 0; i < paras.length; i++) {
    const vid = `gen-1-${i + 1}`;
    const mine = await ann.mine(vid);
    decorateVerse(state, ann, paras[i]!, vid, mine, ann.social(vid));
  }
  const all = await sync.allAnnotations();
  const pend = await sync.pendingCount();
  document.getElementById("stats")!.textContent =
    `annotations: ${all.length} · queued ops: ${pend}`;
}

// wire the REAL input layer (Platform.isMobile=true in the shim → pointer path)
bar.attach({
  registerDomEvent: (el: EventTarget, ev: string, cb: (e: Event) => void,
    opts?: AddEventListenerOptions) => el.addEventListener(ev, cb as EventListener, opts),
} as never);

// scenes drivable from tests: window.sgScene("sunrise" | ... | "none")
import { SceneManager } from "../src/study/scenes";
const sceneMgr = new SceneManager();
(window as unknown as { sgScene: (id: string) => void }).sgScene =
  (id: string) => sceneMgr.apply(id);

// the navigator too: window.sgNav() opens it seeded at D&C 120
import { SGNavigatorModal } from "../src/study/navigator";
(window as unknown as { sgNav: (last?: { slug: string; title: string } | null) => void }).sgNav =
  (last = { slug: "dc-120", title: "D&C 120" }) =>
    new SGNavigatorModal({} as never, {
      openChapter: t => log(`nav → ${t}`),
      openNote: l => log(`nav → note ${l}`),
      lastChapter: () => last,
    }).open();

void redecorate();
log("harness ready — real StudyBar + AnnotationService + SyncEngine");
