/** Presence: put the reader in the room with the author.
 *
 * - voiceFor(): who is speaking, from where, in what moment of their life —
 *   shown as a strip above verse 1. Honest by design: traditional or
 *   uncertain attributions say so.
 * - matchScene(): scan the chapter's own words and pick the ambient scene
 *   that fits (Psalm 23 → still waters, the Exodus → desert).
 */

export interface Voice {
  author: string;      // vault page name to link when it exists
  display?: string;    // shown name when different
  place: string;
  era: string;
  line: string;        // one evocative, honest sentence fragment
}

export const VOICES: Record<string, Voice> = {
  gen: { author: "Moses", place: "the wilderness of Sinai", era: "recounting the beginning", line: "the record of creation, the fall, and the covenant family" },
  ex: { author: "Moses", place: "the wilderness", era: "after the deliverance from Egypt", line: "written by the man who stood before Pharaoh and the burning bush" },
  lev: { author: "Moses", place: "the foot of Sinai", era: "the first year of the Exodus", line: "the law given while the tabernacle was new" },
  num: { author: "Moses", place: "the wilderness", era: "forty years of wandering", line: "a people counted, tested, and led" },
  deut: { author: "Moses", place: "the plains of Moab", era: "his final days", line: "an old prophet's last sermons, in sight of a land he will not enter" },
  josh: { author: "Joshua", place: "Canaan", era: "the conquest and settlement", line: "the soldier who served Moses now leads" },
  judg: { author: "Samuel", display: "the chronicler (trad. Samuel)", place: "Israel", era: "the turbulent generations before the kings", line: "when every man did what was right in his own eyes" },
  ruth: { author: "Samuel", display: "the chronicler", place: "Bethlehem", era: "the days of the judges", line: "a quiet story of loyalty inside a violent age" },
  "1sam": { author: "Samuel", place: "Israel", era: "the birth of the monarchy", line: "prophet, kingmaker, and mourner of kings" },
  "2sam": { author: "Samuel", display: "the court chronicler", place: "Jerusalem", era: "David's reign", line: "the glory and the wreckage of a king after God's own heart" },
  "1kgs": { author: "Jeremiah", display: "the chronicler (trad. Jeremiah)", place: "Jerusalem", era: "from Solomon to the divided kingdom", line: "how wisdom rose and the kingdom tore" },
  "2kgs": { author: "Jeremiah", display: "the chronicler", place: "Jerusalem", era: "the fall of two kingdoms", line: "prophets crying to kings who would not hear" },
  "1chr": { author: "Ezra", display: "the chronicler (trad. Ezra)", place: "Jerusalem, rebuilt", era: "after the exile", line: "a returned people retelling their story to remember who they are" },
  "2chr": { author: "Ezra", display: "the chronicler", place: "Jerusalem, rebuilt", era: "after the exile", line: "the temple's story, told by those who lost it and came home" },
  ezra: { author: "Ezra", place: "Jerusalem", era: "the return from Babylon", line: "a scribe rebuilding a people around the word" },
  neh: { author: "Nehemiah", place: "Jerusalem's broken walls", era: "~445 BC", line: "a cupbearer who left a palace to rebuild a ruin" },
  esth: { author: "Mordecai", display: "the chronicler", place: "Susa, Persia", era: "the exile", line: "courage in a court where God is never named and always present" },
  job: { author: "Job", display: "unknown poet", place: "the land of Uz", era: "the age of the patriarchs", line: "the oldest questions, asked from the ash heap" },
  ps: { author: "David", display: "David and the temple poets", place: "wilderness caves and the sanctuary", era: "across centuries", line: "prayers that were sung — grief, awe, and trust set to music" },
  prov: { author: "Solomon", place: "the court of Jerusalem", era: "the golden age", line: "a father's wisdom pressed into sayings" },
  eccl: { author: "Solomon", display: "the Preacher", place: "Jerusalem", era: "the end of a full life", line: "everything tried, everything weighed" },
  song: { author: "Solomon", place: "Jerusalem", era: "the golden age", line: "love poetry the ages kept" },
  isa: { author: "Isaiah", place: "Jerusalem", era: "~740–690 BC, under four kings", line: "the prophet of the temple vision, walking with kings and seeing the Messiah" },
  jer: { author: "Jeremiah", place: "Jerusalem under siege", era: "the last years before Babylon", line: "the weeping prophet, hated for telling the truth" },
  lam: { author: "Jeremiah", place: "the ruins of Jerusalem", era: "586 BC", line: "funeral poetry for a city he loved and warned" },
  ezek: { author: "Ezekiel", place: "by the river Chebar, Babylon", era: "the exile", line: "a priest with no temple, seeing visions instead" },
  dan: { author: "Daniel", place: "the courts of Babylon and Persia", era: "the exile", line: "faithful in a foreign palace, from youth to old age" },
  hosea: { author: "Hosea", place: "the northern kingdom", era: "its final decades", line: "a broken marriage lived as prophecy" },
  joel: { author: "Joel", place: "Judah", era: "after the locusts", line: "disaster read as a summons to return" },
  amos: { author: "Amos", place: "Bethel", era: "~760 BC", line: "a shepherd from the south thundering at northern comfort" },
  obad: { author: "Obadiah", place: "Judah", era: "after Jerusalem's fall", line: "the shortest book: a brother's betrayal answered" },
  jonah: { author: "Jonah", place: "Nineveh, unwillingly", era: "~780 BC", line: "the prophet who ran, and the mercy that wouldn't" },
  micah: { author: "Micah", place: "the villages of Judah", era: "Isaiah's generation", line: "what does the Lord require of thee?" },
  nahum: { author: "Nahum", place: "Judah", era: "before Nineveh fell", line: "the end of the empire that terrorized his world" },
  hab: { author: "Habakkuk", place: "the watchtower", era: "before Babylon came", line: "arguing with God, and choosing trust" },
  zeph: { author: "Zephaniah", place: "Jerusalem", era: "Josiah's reforms", line: "a royal descendant announcing the day of the Lord" },
  hag: { author: "Haggai", place: "Jerusalem", era: "520 BC", line: "urging a discouraged people to build again" },
  zech: { author: "Zechariah", place: "Jerusalem", era: "the temple rebuilding", line: "visions in the night for a small, struggling remnant" },
  mal: { author: "Malachi", place: "Jerusalem", era: "the Old Testament's last word", line: "the last prophet before four hundred years of silence" },
  matt: { author: "Matthew", place: "written for Israel", era: "~AD 60s", line: "the tax collector Jesus called from the receipt table" },
  mark: { author: "Mark", place: "Rome", era: "~AD 60s", line: "Peter's memories, written fast and urgent" },
  luke: { author: "Luke", place: "compiled from eyewitnesses", era: "~AD 60s", line: "a physician's careful investigation, for one honest reader" },
  john: { author: "John", place: "Ephesus", era: "old age, ~AD 90s", line: "the disciple Jesus loved, distilling a lifetime" },
  acts: { author: "Luke", place: "on the roads of the empire", era: "~AD 62", line: "volume two: the church catches fire and spreads" },
  rom: { author: "Paul", place: "Corinth", era: "~AD 57", line: "his fullest gospel, sent ahead to a city he'd never seen" },
  "1cor": { author: "Paul", place: "Ephesus", era: "~AD 55", line: "a founder writing to his fractured, gifted church" },
  "2cor": { author: "Paul", place: "Macedonia", era: "~AD 56", line: "his most personal letter — strength out of weakness" },
  gal: { author: "Paul", place: "on the road", era: "~AD 49", line: "written hot, in his own large letters" },
  eph: { author: "Paul", place: "a Roman prison", era: "~AD 62", line: "chained, and writing about the church as the body of Christ" },
  philip: { author: "Paul", place: "a Roman prison", era: "~AD 62", line: "joy, from a man in chains" },
  col: { author: "Paul", place: "a Roman prison", era: "~AD 62", line: "to a church he never met, about the supremacy of Christ" },
  "1thes": { author: "Paul", place: "Corinth", era: "~AD 51 — likely his earliest letter", line: "to brand-new believers he was torn from too soon" },
  "2thes": { author: "Paul", place: "Corinth", era: "~AD 51", line: "steadying a church shaken about the Lord's return" },
  "1tim": { author: "Paul", place: "Macedonia", era: "~AD 64", line: "a father in the faith coaching his young successor" },
  "2tim": { author: "Paul", place: "a Roman dungeon", era: "~AD 66, awaiting execution", line: "his last surviving words: I have kept the faith" },
  titus: { author: "Paul", place: "en route", era: "~AD 64", line: "order for the rough young churches of Crete" },
  philem: { author: "Paul", place: "a Roman prison", era: "~AD 62", line: "one page that quietly dismantles slavery with love" },
  heb: { author: "Paul", display: "unknown (trad. Paul)", place: "outside the land", era: "before AD 70", line: "to wavering Jewish believers: Christ is greater" },
  james: { author: "James", place: "Jerusalem", era: "~AD 45", line: "the Lord's brother, blunt as a proverb" },
  "1pet": { author: "Peter", place: "Rome ('Babylon')", era: "~AD 64, as persecution began", line: "the fisherman steadying scattered exiles" },
  "2pet": { author: "Peter", place: "Rome", era: "shortly before his death", line: "a shepherd's farewell warnings" },
  "1jn": { author: "John", place: "Ephesus", era: "old age", line: "little children, love one another" },
  "2jn": { author: "John", place: "Ephesus", era: "old age", line: "a postcard: truth and love, walk in them" },
  "3jn": { author: "John", place: "Ephesus", era: "old age", line: "the smallest book — hospitality and truth" },
  jude: { author: "Jude", place: "Judea", era: "~AD 65", line: "the Lord's brother, contending for the faith" },
  rev: { author: "John", place: "exiled on Patmos", era: "~AD 95", line: "a prisoner's window opened onto the end of the story" },
  "1ne": { author: "Nephi", place: "the wilderness, the sea, a new land", era: "~600–570 BC", line: "a young man engraving his family's escape from Jerusalem" },
  "2ne": { author: "Nephi", place: "the land of Nephi", era: "his later years", line: "an aging founder writing for his people — and for us" },
  jacob: { author: "Jacob", place: "the temple in the land of Nephi", era: "the second generation", line: "born in the wilderness, anxious for his people's souls" },
  enos: { author: "Enos", place: "the forests, hunting", era: "the third generation", line: "one man's all-day wrestle before God" },
  jarom: { author: "Jarom", place: "the land of Nephi", era: "keeping the record", line: "a small entry in the small plates" },
  omni: { author: "Omni", display: "Omni and four record-keepers", place: "the land of Nephi to Zarahemla", era: "generations passing the plates", line: "five voices bridging two worlds" },
  wofm: { author: "Mormon", place: "amid the final wars", era: "~AD 385", line: "the editor steps forward to explain the records" },
  mosiah: { author: "Mormon", place: "abridging in the last days of his people", era: "events ~130–91 BC", line: "kings, prophets, and a people in bondage delivered" },
  alma: { author: "Mormon", place: "abridging the great records", era: "events ~91–52 BC", line: "the longest book: missions, wars, and the wrestle for souls" },
  hel: { author: "Mormon", place: "abridging as his nation dies", era: "events ~52–1 BC", line: "pride cycles quickening toward the sign" },
  "3ne": { author: "Mormon", place: "abridging the most sacred record", era: "events ~AD 1–35", line: "darkness, then the risen Christ among them" },
  "4ne": { author: "Mormon", place: "abridging two golden centuries", era: "events ~AD 36–321", line: "what a whole people at peace looks like — and how it ends" },
  morm: { author: "Mormon", place: "the last battlefields", era: "~AD 385", line: "a general who never stopped loving the people he buried" },
  ether: { author: "Moroni", place: "alone, wandering", era: "after his people's fall", line: "abridging an older fallen nation while his own lies in ruins" },
  moro: { author: "Moroni", place: "alone, hunted", era: "~AD 400–421", line: "the last Nephite, sealing the record for you" },
  dc: { author: "Joseph Smith", place: "Kirtland, Missouri, Nauvoo — as given", era: "1823–1847", line: "revelations received in the moment, place by place" },
  od: { author: "Joseph Smith", display: "the Presidents of the Church", place: "Salt Lake City", era: "1890 and 1978", line: "official declarations to the whole church" },
  moses: { author: "Moses", display: "revealed to Joseph Smith", place: "given June–Dec 1830", era: "restoring Moses' vision", line: "what Moses saw, restored" },
  abr: { author: "Abraham", display: "translated by Joseph Smith", place: "from Egyptian papyri, 1835–42", era: "Abraham in Egypt", line: "the father of the faithful, in his own record" },
  jsm: { author: "Joseph Smith", place: "Kirtland, 1831", era: "revising Matthew 24", line: "the Olivet discourse, clarified" },
  jsh: { author: "Joseph Smith", place: "Nauvoo, 1838", era: "telling his own story", line: "a young man's grove, in his own words" },
  aoff: { author: "Joseph Smith", place: "Nauvoo, 1842", era: "the Wentworth letter", line: "thirteen sentences of what we believe" },
};

/** famous single-chapter moments that deserve their own line */
export const CHAPTER_VOICES: Record<string, Partial<Voice>> = {
  "alma-36": { line: "an old father giving his conversion to his son Helaman — shaped as one great chiasm" },
  "alma-37": { line: "entrusting the records to Helaman: by small and simple things" },
  "alma-38": { line: "to Shiblon, the steady son" },
  "alma-39": { line: "to Corianton, the wandering son — hard love" },
  "2ne-4": { line: "Nephi's psalm: grief and grace in the same breath" },
  "3ne-11": { line: "the moment: a voice from heaven, and He descends" },
  "ps-23": { line: "the shepherd psalm, from a man who kept sheep" },
  "ps-51": { line: "David after Nathan's finger pointed at him" },
  "isa-53": { line: "the suffering servant, seen seven centuries early" },
  "john-17": { line: "overhearing the Son pray to the Father" },
  "luke-15": { line: "three lost things, one seeking heart" },
  "matt-5": { line: "on the mountainside — the kingdom's constitution" },
  "gen-22": { line: "the hardest walk a father ever took" },
  "ex-3": { line: "a shepherd, a bush that burns, a name revealed" },
  "1ne-3": { line: "I will go and do — a young man's resolve" },
  "jsh-1": { line: "a fourteen-year-old walks into a grove" },
  "dc-121": { line: "from the pit of Liberty Jail: O God, where art thou?" },
  "dc-76": { line: "the vision of the three glories, seen with Sidney Rigdon" },
  "morm-6": { line: "a father watching his whole world fall at Cumorah" },
  "moro-10": { line: "the last page: a promise, and a farewell until the bar of God" },
};

export function voiceFor(slug: string): { v: Voice; chapterLine: string | null } | null {
  const dash = slug.lastIndexOf("-");
  const book = dash > 0 ? slug.slice(0, dash) : slug;
  const v = VOICES[book];
  if (!v) return null;
  const over = CHAPTER_VOICES[slug];
  return { v: { ...v, ...over }, chapterLine: over?.line ?? null };
}

// ------------------------------------------------------- scene matching

const SCENE_KEYWORDS: [string, RegExp][] = [
  ["storm", /\b(storm|tempest|whirlwind|thunder|lightning|billows?|tossed|waves)/gi],
  ["mount", /\b(mount(ain)?s?|sinai|horeb|hill of|high place|transfigur|summit)/gi],
  ["temple", /\b(temple|tabernacle|altar|sanctuary|holy place|priest|offering|veil)/gi],
  ["garden", /\b(garden|tree of|vineyard|olive|branch(es)?|fruit|eden|gethsemane|vine)/gi],
  ["fields", /\b(fields?|harvest|wheat|reap|sow(er|ed|eth)?|barley|glean|sickle|tares)/gi],
  ["city", /\b(city|jerusalem|walls?|gates?|streets?|zion|babylon|towers?)/gi],
  ["waters", /\b(waters?|sea|river|rain|fountain|deep|ship|flood|fish|baptiz)/gi],
  ["desert", /\b(wilderness|desert|sand|camel|thirst|dry|waste|journey)/gi],
  ["starlight", /\b(stars?|heavens?|night|moon|firmament|host of|sky|glory)/gi],
  ["sunrise", /\b(morning|dawn|sunris|light|day ?spring|east|arise|awake)/gi],
  ["candle", /\b(candle|lamp|oil|watch|evening|supper|upper room|vigil)/gi],
];

/** curated worlds for books/chapters where the right scene is known —
 * keyword scoring is only the fallback */
export const SCENE_OVERRIDES: Record<string, string> = {
  // chapters — landmark moments land in their own world
  "ps-23": "waters", "gen-1": "starlight", "gen-2": "garden", "gen-3": "garden",
  "ex-3": "desert", "ex-14": "waters", "ex-19": "mount", "ex-20": "mount",
  "matt-2": "starlight", "matt-5": "mount", "matt-6": "mount", "matt-7": "mount",
  "matt-8": "storm", "matt-13": "fields", "matt-26": "garden", "matt-27": "city",
  "mark-4": "storm", "john-13": "candle", "john-15": "garden", "john-17": "candle",
  "luke-2": "starlight", "luke-8": "storm", "luke-15": "fields", "luke-22": "garden",
  "acts-27": "storm", "1kgs-19": "mount", "1kgs-8": "temple", "2chr-6": "temple",
  "isa-6": "temple", "ps-122": "city", "ps-127": "city", "ps-84": "temple",
  "neh-2": "city", "neh-4": "city", "jonah-1": "storm", "jonah-2": "waters",
  "3ne-1": "starlight", "3ne-12": "temple", "3ne-13": "temple", "3ne-14": "temple",
  "1ne-18": "storm", "ether-2": "mount", "ether-3": "mount", "ether-6": "storm",
  "hel-14": "city", "hel-16": "city", "alma-32": "fields", "alma-36": "sunrise",
  "mosiah-2": "temple", "dc-121": "candle", "jsh-1": "sunrise",
  // whole books
  "2tim": "candle", "eph": "candle", "philip": "candle", "col": "candle",
  "philem": "candle", "rev": "starlight", "abr": "starlight",
  "ex": "desert", "num": "desert", "deut": "desert",
  "ruth": "fields", "song": "garden", "lam": "city", "neh": "city",
  "hag": "temple", "lev": "temple",
};

/** pick the ambient scene: curated override first, else the chapter's words */
export function matchScene(chapterText: string, slug?: string): string {
  if (slug) {
    if (SCENE_OVERRIDES[slug]) return SCENE_OVERRIDES[slug]!;
    const dash = slug.lastIndexOf("-");
    const book = dash > 0 ? slug.slice(0, dash) : slug;
    if (SCENE_OVERRIDES[book]) return SCENE_OVERRIDES[book]!;
  }
  let best = "sunrise";
  let bestScore = 0;
  for (const [scene, re] of SCENE_KEYWORDS) {
    const score = (chapterText.match(re) ?? []).length;
    if (score > bestScore) {
      bestScore = score;
      best = scene;
    }
  }
  return best;
}
