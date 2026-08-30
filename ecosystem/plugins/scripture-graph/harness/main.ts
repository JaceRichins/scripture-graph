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

// timeline: window.sgTimeline() mounts the view with a mini dataset
import { TimelineView } from "../src/study/timelineView";
import { TFile as ShimTFile } from "obsidian";
(window as unknown as { sgTimeline: () => void }).sgTimeline = () => {
  const data = {
    version: 1,
    book_years: { "1ne": -595 },
    events: [
      { id: "isaiah", t: "Isaiah's ministry in Jerusalem", y0: -740, y1: -690, lane: "ow", imp: 1, cat: ["prophets"], dating: "approximate", people: ["Isaiah"], places: ["Jerusalem"], chapters: ["Isaiah 6"], note: "the prophet Nephi quotes most" },
      { id: "daniel", t: "Daniel taken to Babylon", y0: -605, y1: -605, lane: "ow", imp: 2, cat: ["prophets"], dating: "historical", people: ["Daniel"], places: ["Babylon"], chapters: ["Daniel 1"], note: "first deportation" },
      { id: "lehi-departs", t: "Lehi's family leaves Jerusalem", y0: -600, y1: -600, lane: "nw", imp: 1, cat: ["journeys", "turning"], dating: "traditional", people: ["Lehi", "Nephi"], places: ["Jerusalem"], chapters: ["1 Nephi 2"], note: "while Jeremiah preaches, a family walks into the desert" },
      { id: "jerusalem-falls", t: "Babylon destroys Jerusalem", y0: -586, y1: -586, lane: "ow", imp: 1, cat: ["wars", "turning"], dating: "historical", places: ["Jerusalem"], chapters: ["2 Kings 25"], note: "exactly as Lehi and Jeremiah warned" },
      { id: "benjamin", t: "King Benjamin's address", y0: -124, y1: -124, lane: "nw", imp: 1, cat: ["rulers", "visions"], dating: "internal", people: ["King Benjamin"], places: ["Zarahemla"], chapters: ["Mosiah 2"], note: "a whole people takes Christ's name" },
      { id: "christ-birth", t: "The birth of Jesus Christ", y0: -4, y1: -4, lane: "ow", imp: 1, cat: ["turning"], dating: "traditional", people: ["Jesus Christ"], places: ["Bethlehem"], chapters: ["Luke 2"], note: "a star over Bethlehem" },
      { id: "night-no-dark", t: "The night without darkness", y0: -4, y1: -4, lane: "nw", imp: 1, cat: ["visions"], dating: "internal", chapters: ["3 Nephi 1"], note: "Samuel's sign fulfilled" },
      { id: "resurrection", t: "The Resurrection", y0: 30, y1: 30, lane: "ow", imp: 1, cat: ["turning"], dating: "traditional", people: ["Jesus Christ"], places: ["Jerusalem"], chapters: ["John 20"], note: "the first fruits of them that slept" },
      { id: "christ-bountiful", t: "The risen Christ visits Bountiful", y0: 34, y1: 34, lane: "nw", imp: 1, cat: ["visions", "turning"], dating: "internal", people: ["Jesus Christ"], chapters: ["3 Nephi 11"], note: "one by one they feel the prints" },
      { id: "first-vision", t: "The First Vision", y0: 1820, y1: 1820, lane: "rs", imp: 1, cat: ["visions", "turning"], dating: "historical", people: ["Joseph Smith Jr"], places: ["Sacred Grove"], chapters: ["Joseph Smith—History 1"], note: "a spring-morning prayer opens the dispensation" },
      { id: "small-plates-made", t: "Nephi makes the small plates", y0: -570, y1: -570, lane: "nw", imp: 2, cat: ["records"], dating: "internal", people: ["Nephi"], things: ["Gold Plates", "Small Plates of Nephi"], chapters: ["1 Nephi 9"], note: "for a wise purpose he did not yet know" },
      { id: "mormon-abridges", t: "Mormon abridges a thousand years onto gold plates", y0: 380, y1: 384, lane: "nw", imp: 1, cat: ["records"], dating: "internal", people: ["Mormon"], things: ["Gold Plates"], chapters: ["Words of Mormon 1"], note: "the wise purpose revealed" },
      { id: "cumorah", t: "The last battle at Cumorah", y0: 385, y1: 385, lane: "nw", imp: 1, cat: ["wars"], dating: "internal", people: ["Mormon", "Moroni (son of Mormon)"], things: ["Gold Plates"], chapters: ["Mormon 6"], note: "a record is buried to speak later" },
      { id: "plates-received", t: "Joseph receives the plates", y0: 1827, y1: 1827, lane: "rs", imp: 2, cat: ["records"], dating: "historical", people: ["Joseph Smith Jr"], places: ["Cumorah"], things: ["Gold Plates"], chapters: ["Joseph Smith—History 1"], note: "four years of schooling first" },
      { id: "bom-published", t: "The Book of Mormon published", y0: 1830, y1: 1830, lane: "rs", imp: 1, cat: ["records", "turning"], dating: "historical", people: ["Joseph Smith Jr"], things: ["Gold Plates"], chapters: ["D&C 20"], note: "the record speaks from the dust" },
    ],
  };
  const dataFile = Object.assign(new ShimTFile(), { path: "AI Library/90 Timeline/_data.md", basename: "_data" });
  const fakeState = {
    app: {
      vault: {
        getAbstractFileByPath: () => dataFile,
        cachedRead: async () => "```json\n" + JSON.stringify(data) + "\n```",
      },
      workspace: { openLinkText: (l: string) => log(`tl → ${l}`) },
    },
  } as never;
  const view = new TimelineView({} as never, fakeState);
  (window as unknown as { sgTlView: unknown }).sgTlView = view;
  void view.onOpen().then(() => {
    view.contentEl.style.cssText =
      "position:fixed;inset:0;z-index:60;background:#141318;overflow:hidden;";
    document.body.appendChild(view.contentEl);
  });
};

// verse peek: window.sgPeek() pops a referenced verse over everything
import { VersePeekModal } from "../src/study/versePeek";
(window as unknown as { sgPeek: () => void }).sgPeek = () => {
  const chapterMd = [
    "# 2 Kings 24", "",
    "**13** And he carried out thence all the treasures of the house of the LORD, and the treasures of the king's house. ^2kgs-24-13",
    "",
    "**14** And he carried away all Jerusalem, and all the princes, and all the mighty men of valour, even ten thousand captives, and all the craftsmen and smiths: none remained, save the poorest sort of the people of the land. ^2kgs-24-14",
    "",
    "**15** And he carried away Jehoiachin to Babylon, and the king's mother, and the king's wives. ^2kgs-24-15",
  ].join("\n");
  const fakeState = { app: { vault: { cachedRead: async () => chapterMd } } } as never;
  const target = {
    file: { basename: "2 Kings 24", path: "x" } as never,
    chapterTitle: "2 Kings 24",
    verseId: "2kgs-24-14",
  };
  new VersePeekModal(fakeState, target, () => log("peek → open chapter")).open();
};

// library sheet: window.sgLib() renders a fake Gospel Topic over the page
import { LibraryPreviewModal } from "../src/study/libraryPreview";
(window as unknown as { sgLib: () => void }).sgLib = () => {
  const fakeMd = [
    "# Abrahamic Covenant",
    "The covenant God made with Abraham — that through his seed all nations of the earth would be blessed — threads through every volume of scripture.",
    "## Scriptural foundation",
    "[[Genesis 12]] · [[Genesis 17]] · [[Abraham 2]] · [[Galatians 3]]",
    "## From General Conference",
    "Covenant belonging is not a minor doctrine; it is the doctrine.",
  ].join("\n\n");
  const fakeState = {
    app: {
      vault: { cachedRead: async () => fakeMd },
      metadataCache: { getFirstLinkpathDest: () => null },
      workspace: { openLinkText: () => log("sheet → navigate out") },
    },
  } as never;
  const fakeFile = { basename: "Abrahamic Covenant", path: "AI Library/02 Gospel Topics/Abrahamic Covenant.md" } as never;
  new LibraryPreviewModal(fakeState, fakeFile, null, () => log("sheet → open as page")).open();
};

// translations sheet: window.sgTrans() — KJV row real, others show fallback
import { TranslationsModal } from "../src/study/translations";
(window as unknown as { sgTrans: () => void }).sgTrans = () => {
  const fakeState = {
    app: {
      metadataCache: { getFirstLinkpathDest: () => null },
      vault: { cachedRead: async () => "" },
    },
  } as never;
  new TranslationsModal(fakeState, "john-3-16",
    "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.").open();
};

// connections sheet: window.sgConn() opens it with representative rows
import { ConnectionsModal } from "../src/social/connections";
(window as unknown as { sgConn: () => void }).sgConn = () => {
  const fakeState = {
    app: { vault: { getAbstractFileByPath: () => null } },
  } as never;
  ConnectionsModal.forVerse(fakeState, "1ne-1-4", [
    { path: "Library/mine.md", name: "My mission notes", emoji: "✍️", rank: 0 },
    { path: "AI Library/01 Scriptures/Cross References/x.md", name: "2 Kings 24:14", emoji: "📖", rank: 1,
      link: "2 Kings 24#^2kgs-24-14", note: "textual parallel — tap to read" },
    { path: "AI Library/01 Scriptures/Cross References/x.md", name: "Jeremiah 52:3", emoji: "📖", rank: 1,
      link: "Jeremiah 52#^jer-52-3", note: "textual parallel — tap to read" },
    { path: "AI Library/40 Evidence/E1.md", name: "Jerusalem's destruction — evidence dossier", emoji: "🔎", rank: 1 },
    { path: "AI Library/02 Gospel Topics/P.md", name: "Prophets", emoji: "🏷️", rank: 2 },
  ], () => log("nav → graph")).open();
};

// the navigator too: window.sgNav() opens it seeded at D&C 120
import { SGNavigatorModal } from "../src/study/navigator";
(window as unknown as { sgNav: (last?: { slug: string; title: string } | null) => void }).sgNav =
  (last = { slug: "dc-120", title: "D&C 120" }) =>
    new SGNavigatorModal({} as never, {
      openChapter: t => log(`nav → ${t}`),
      openNote: l => log(`nav → note ${l}`),
      lastChapter: () => last,
      recentChapters: () => [
        { slug: "dc-120", title: "D&C 120" },
        { slug: "alma-36", title: "Alma 36" },
        { slug: "gen-1", title: "Genesis 1" },
        { slug: "matt-5", title: "Matthew 5" },
      ],
      groupActivity: async () => [
        { group_name: "Family", chapter_slug: "alma-36", count: 3, others: 2 },
        { group_name: "Ward class", chapter_slug: "1ne-1", count: 5, others: 5 },
      ],
      listFolder: (path: string) => {
        if (path.endsWith("General Conference")) {
          return {
            folders: ["2024", "2025", "2026"].map(y => ({ name: y, path: `${path}/${y}` })),
            files: [{ name: "General Conference", path: `${path}/General Conference.md` }],
          };
        }
        if (/\/20\d\d$/.test(path)) {
          return { folders: [], files: [
            { name: "President Nelson — Think Celestial (October)", path: `${path}/t1.md` },
            { name: "Elder Holland — Lifted Up upon the Cross", path: `${path}/t2.md` },
          ] };
        }
        if (path.endsWith("Bible Dictionary")) {
          return { folders: [], files: "ABCDEFG".split("").map(l => ({ name: l, path: `${path}/${l}.md` })) };
        }
        return { folders: [], files: [{ name: "Sample page", path: `${path}/s.md` }] };
      },
      openPath: (p: string) => log(`nav → open ${p}`),
    }).open();

void redecorate();
log("harness ready — real StudyBar + AnnotationService + SyncEngine");
