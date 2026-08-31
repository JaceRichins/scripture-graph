/** 🎨 The Navigator's own iconography — no generic logos.
 *
 * Hand-drawn 24×24 stroke icons in Obsidian's icon language (1.8 stroke,
 * round caps and joins) so they sit naturally beside the app's chrome, but
 * each carries its OWN hue: the tile behind it is backlit with that color.
 * The scroll glows amber, the key gold, the gem cyan; the timeline icon is
 * a little constellation, because that is literally what our timeline is. */

export type NavIconName =
  | "old-testament" | "new-testament" | "book-of-mormon" | "doctrine"
  | "pearl" | "timeline" | "library" | "hub" | "groups" | "search"
  | "continue" | "target" | "verse" | "page" | "chapter" | "folder"
  | "conference" | "dictionary" | "topics" | "person" | "place" | "event"
  | "doctrines" | "papers" | "history" | "evidence" | "question"
  | "scholarship" | "podcast";

interface IconDef { h: string; s: string }

const I: Record<NavIconName, IconDef> = {
  "old-testament": {                                     // a parchment scroll
    h: "#e7b95c",
    s: `<path d="M6 4.5h11a2.5 2.5 0 0 1 2.5 2.5v9.5"/>
        <path d="M6 4.5A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h11.5a2 2 0 0 0 2-2v-1"/>
        <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>`,
  },
  "new-testament": {                                     // a rounded cross
    h: "#b79cff",
    s: `<path d="M12 4.5v15M6.5 9.5h11"/>
        <path d="M12 4.5v15" opacity="0.35" stroke-width="4.4"/>`,
  },
  "book-of-mormon": {                                    // book + bookmark
    h: "#52c7a0",
    s: `<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h11a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-11A2.5 2.5 0 0 0 5 21z"/>
        <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19"/>
        <path d="M13.5 3v7l2-1.6 2 1.6V3"/>`,
  },
  doctrine: {                                            // a skeleton key
    h: "#f0c548",
    s: `<circle cx="8" cy="8" r="4"/>
        <path d="M10.8 10.8 19 19M15.5 15.5l3-3M17.5 17.5l2.4-2.4"/>`,
  },
  pearl: {                                               // a faceted gem
    h: "#6ad4e8",
    s: `<path d="M7 4h10l4 5-9 11L3 9z"/>
        <path d="M3 9h18M7 4l5 5 5-5M12 9v11"/>`,
  },
  timeline: {                                            // a constellation
    h: "#52a9ff",
    s: `<circle cx="6" cy="17" r="2"/>
        <circle cx="12" cy="7" r="2.4"/>
        <circle cx="18.5" cy="14.5" r="1.7"/>
        <path d="M7.3 15.3 10.6 9M14 8.4l3.2 4.6"/>`,
  },
  library: {                                             // leaning book spines
    h: "#f08fb0",
    s: `<path d="M4.5 4.5v15M9.5 4.5v15"/>
        <path d="m13.6 5.4 4.6 13.7"/>
        <path d="M4.5 8h5M13.9 9.3l4.4-1.4"/>`,
  },
  hub: {                                                 // home, lit window
    h: "#ffab70",
    s: `<path d="m4 11 8-6.5L20 11"/>
        <path d="M6 9.8V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.8"/>
        <path d="M10.3 20v-4.6a1.7 1.7 0 0 1 3.4 0V20"/>`,
  },
  groups: {                                              // two companions
    h: "#a78bfa",
    s: `<circle cx="9" cy="8.5" r="3"/>
        <path d="M3.5 19.5v-1a5.5 5.5 0 0 1 11 0v1"/>
        <circle cx="16.8" cy="9.5" r="2.3"/>
        <path d="M16 14.6a4.6 4.6 0 0 1 4.9 4.4v.5"/>`,
  },
  search: {                                              // the lens
    h: "#8fa3c8",
    s: `<circle cx="10.5" cy="10.5" r="6"/>
        <path d="m15.2 15.2 5 5"/>`,
  },
  continue: {                                            // play
    h: "#c9b8ff",
    s: `<path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7z"/>`,
  },
  target: {                                              // straight to it
    h: "#7cc4ff",
    s: `<circle cx="12" cy="12" r="7.5"/>
        <circle cx="12" cy="12" r="3.2"/>
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>`,
  },
  verse: {                                               // an open quote
    h: "#8fd8b8",
    s: `<path d="M5 7.5A3.5 3.5 0 0 1 8.5 4v0A6.5 6.5 0 0 0 5 9.8V16a2 2 0 0 0 2 2h2.5a2 2 0 0 0 2-2v-3.5a2 2 0 0 0-2-2H5z"/>
        <path d="M13.5 7.5A3.5 3.5 0 0 1 17 4v0a6.5 6.5 0 0 0-3.5 5.8V16a2 2 0 0 0 2 2H18a2 2 0 0 0 2-2v-3.5a2 2 0 0 0-2-2h-4.5z"/>`,
  },
  page: {                                                // a document
    h: "#9db4d8",
    s: `<path d="M7 3.5h7L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/>
        <path d="M13.5 3.5V8h4.6M8.5 12.5h7M8.5 16h5"/>`,
  },
  chapter: {                                             // an open book
    h: "#8ec7f0",
    s: `<path d="M12 6.5C10.5 5 8.2 4.3 5.5 4.3c-.8 0-1.5.06-2 .16V18c.5-.1 1.2-.16 2-.16 2.7 0 5 .7 6.5 2.16 1.5-1.46 3.8-2.16 6.5-2.16.8 0 1.5.06 2 .16V4.46c-.5-.1-1.2-.16-2-.16-2.7 0-5 .7-6.5 2.2z"/>
        <path d="M12 6.5V20"/>`,
  },
  folder: {                                              // a shelf drawer
    h: "#d9b36a",
    s: `<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>`,
  },
  conference: {                                          // the pulpit mic
    h: "#f4a6c0",
    s: `<rect x="9" y="3.5" width="6" height="11" rx="3"/>
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5M9 20.5h6"/>`,
  },
  dictionary: {                                          // book of words
    h: "#c9a3f5",
    s: `<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h11a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-11A2.5 2.5 0 0 0 5 21z"/>
        <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19"/>
        <path d="m9.8 12.5 2.2-5.5 2.2 5.5M10.5 10.8h3"/>`,
  },
  topics: {                                              // a tag
    h: "#79d2c3",
    s: `<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11l8.6 8.6a2 2 0 0 1 0 2.8l-4.2 4.2a2 2 0 0 1-2.8 0L4 11z"/>
        <circle cx="8.6" cy="8.6" r="1.4"/>`,
  },
  person: {                                              // one soul
    h: "#f0b884",
    s: `<circle cx="12" cy="8" r="3.6"/>
        <path d="M5 20v-.8a7 7 0 0 1 14 0v.8"/>`,
  },
  place: {                                               // a map pin
    h: "#8fd0f4",
    s: `<path d="M12 21s-6.5-5.7-6.5-10.3a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z"/>
        <circle cx="12" cy="10.5" r="2.3"/>`,
  },
  event: {                                               // a marked day
    h: "#f2c063",
    s: `<rect x="4" y="5.5" width="16" height="15" rx="2"/>
        <path d="M8 3.5v4M16 3.5v4M4 10.5h16M9.5 15.5l1.8 1.8 3.4-3.4"/>`,
  },
  doctrines: {                                           // engraved lines
    h: "#a4c8f0",
    s: `<path d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/>
        <path d="M9 8h6M9 11.5h6M9 15h3.5"/>`,
  },
  papers: {                                              // the archive box
    h: "#c8b090",
    s: `<rect x="3.5" y="4.5" width="17" height="5" rx="1"/>
        <path d="M5.5 9.5V18A1.5 1.5 0 0 0 7 19.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5M10 13h4"/>`,
  },
  history: {                                             // pillars
    h: "#d8c8a0",
    s: `<path d="m4 8 8-4.5L20 8M5 8.5h14"/>
        <path d="M6.5 11v6M12 11v6M17.5 11v6M4.5 19.5h15"/>`,
  },
  evidence: {                                            // examined + proven
    h: "#84d89c",
    s: `<circle cx="10.5" cy="10.5" r="6"/>
        <path d="m15.2 15.2 5 5M8.2 10.6l1.7 1.7 3-3"/>`,
  },
  question: {                                            // an honest question
    h: "#a8b8f8",
    s: `<circle cx="12" cy="12" r="8.5"/>
        <path d="M9.6 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2-2.4 3.6"/>
        <path d="M12.1 16.8h.01"/>`,
  },
  scholarship: {                                         // the cap
    h: "#b8d4f8",
    s: `<path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5z"/>
        <path d="M6.5 11.7V16c0 1.4 2.5 2.7 5.5 2.7s5.5-1.3 5.5-2.7v-4.3M21 10v5"/>`,
  },
  podcast: {                                             // voice in the air
    h: "#f0a8a0",
    s: `<circle cx="12" cy="11" r="2.6"/>
        <path d="M8.2 15.4a5.3 5.3 0 1 1 7.6 0M12 14v6.5"/>
        <path d="M5.6 17.5a9 9 0 1 1 12.8 0" opacity="0.55"/>`,
  },
};

/** the hue an icon carries — cover art tints itself with it */
export function iconHue(name: NavIconName): string {
  return (I[name] ?? I.page).h;
}

/** mount an icon tile: a backlit rounded square carrying its own hue */
export function navIcon(parent: HTMLElement, name: NavIconName): HTMLElement {
  const d = I[name] ?? I.page;
  const span = parent.createSpan({ cls: "sg-nav-ico" });
  span.style.setProperty("--ico", d.h);
  // our own static markup, not user content — innerHTML is safe here
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"`
    + ` stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`
    + ` aria-hidden="true">${d.s}</svg>`;
  return span;
}

/** stagger helper: row i fades in i beats later (capped so long lists snap) */
export function cascade(el: HTMLElement, i: number): void {
  el.style.animationDelay = `${Math.min(i * 26, 340)}ms`;
}
