/** Finding the video behind a page.
 *
 * A talk note carries the Church's url and the speaker, never a YouTube id.
 * The Church posts every conference talk on its own channel, so the video is
 * one search away: read YouTube's results page for "<title> <speaker>
 * general conference <month> <year>", the way a browser would (no API key),
 * and take the Church's own upload when one is on the page, else the first.
 * Found ids are remembered on the device so a talk is looked up once. */
import { App, TFile, requestUrl } from "obsidian";

const LINK_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/;
const VID_RE = /"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"([\s\S]{0,4000}?)"ownerText":\{"runs":\[\{"text":"([^"]+)"/g;
const CACHE_KEY = "sg-yt-found";
const OFFICIAL = /church of jesus christ|general conference|latter-day saints/i;

function fm(app: App, file: TFile): Record<string, unknown> {
  return (app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
}

/** the page's own video: a `youtube:` field, or a YouTube link in the text */
export async function youtubeIdOf(app: App, file: TFile): Promise<string | null> {
  const f = fm(app, file);
  const own = String(f["youtube"] ?? "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(own)) return own;
  const fromField = LINK_RE.exec(own)?.[1];
  if (fromField) return fromField;
  try { return LINK_RE.exec(await app.vault.cachedRead(file))?.[1] ?? null; } catch { return null; }
}

/** a conference talk (or anything the engine filed as a talk) */
export function isTalk(app: App, file: TFile): boolean {
  const f = fm(app, file);
  return f["content_type"] === "talk" || typeof f["speaker"] === "string"
    || /\/General Conference\//.test(file.path);
}

/** the title without its filing parenthetical */
export function pageTitle(file: TFile): string {
  return file.basename.replace(/\s+\([^()]*\)$/, "");
}

function cache(): Record<string, string> {
  try { return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>; } catch { return {}; }
}

/** the video of a talk, searched for and remembered; null when YouTube
 * has nothing that looks right or the network is away */
export async function findTalkVideo(app: App, file: TFile): Promise<string | null> {
  const had = cache()[file.path];
  if (had) return had;
  const f = fm(app, file);
  const bits = [pageTitle(file), String(f["speaker"] ?? ""), "general conference",
    String(f["month"] ?? ""), String(f["year"] ?? "")].filter(Boolean);
  const q = bits.join(" ");
  const url = "https://www.youtube.com/results?" + new URLSearchParams({ search_query: q, sp: "EgIQAQ%3D%3D" }).toString();
  let html = "";
  try {
    const res = await requestUrl({
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1; SOCS=CAI",
      },
    });
    html = res.text;
  } catch { return null; }
  const hits: { id: string; owner: string }[] = [];
  for (const m of html.matchAll(VID_RE)) { hits.push({ id: m[1]!, owner: m[3]! }); if (hits.length >= 8) break; }
  if (!hits.length) return null;
  const pick = hits.find(h => OFFICIAL.test(h.owner)) ?? hits[0]!;
  try {
    const c = cache(); c[file.path] = pick.id;
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* no room to remember: fine */ }
  return pick.id;
}
