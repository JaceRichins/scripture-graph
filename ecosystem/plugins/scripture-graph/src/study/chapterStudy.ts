/** Tapping a chapter always leads somewhere.
 *
 * The Library grid, the Continue cards and a swipe page-turn all open the
 * reader's own editable page, "<Chapter> - My Notes". Those pages are
 * generated into the OWNER's personal tree; a family member's personal tree
 * starts empty, so every one of those taps used to dead-end on "No My Notes
 * page exists for this chapter yet" — with no way to get the chapter.
 *
 * So: fetch the chapter if this device doesn't hold it, make the member's own
 * study page the first time they open it, and when neither is possible, say
 * why and offer the one action that fixes it. */

export const PERSONAL_SCRIPTURES = "Library/Scriptures";
export const CANONICAL_SCRIPTURES = "AI Library/01 Scriptures/Canonical";

/** the member's page for a chapter, beside the canonical one it mirrors:
 * …/Canonical/03 Book of Mormon/09 Alma/Alma 36.md
 * → Library/Scriptures/03 Book of Mormon/09 Alma/Alma 36 - My Notes.md */
export function chapterStudyPath(title: string, canonicalPath?: string | null): string {
  const inside = canonicalPath?.startsWith(`${CANONICAL_SCRIPTURES}/`)
    ? canonicalPath.slice(CANONICAL_SCRIPTURES.length + 1).split("/").slice(0, -1).join("/") : "";
  return [PERSONAL_SCRIPTURES, inside, `${title} - My Notes.md`].filter(Boolean).join("/");
}

/** the same shape the generator writes, minus what only it can know */
export function chapterStudyTemplate(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `---\nownership: personal\nmutable: user\ncontent_type: personal-notes\nslug: ${slug}\ncssclasses:\n- sg-personal\n---\n\n`
    + `# ${title} — My Study\n\n`
    + `> [!tip]- Views & navigation\n> [[${title}|📜 Scripture only]] · [[${title} - Study Guide|📖 Study guide]] · [[Study Hub|🏠 Study Hub]]\n\n`
    + `![[${title}]]\n\n## ✍️ My Notes\n`;
}

export interface ChapterStudyHost {
  /** the member's existing study page for this chapter, if any */
  companion(title: string): string | null;
  /** the canonical chapter on this device, if any */
  canonical(title: string): string | null;
  /** download the chapter from the family server */
  ensureLocal(title: string): Promise<boolean>;
  create(path: string, body: string): Promise<void>;
  open(link: string): Promise<void>;
  signedIn(): boolean;
  /** no account on this device yet: the only thing that fixes it */
  connect(message: string): void;
  notify(message: string): void;
}

export type ChapterStudyResult = "opened" | "created" | "connect" | "unavailable";

/** open a chapter's study page, making or fetching whatever is missing */
export async function openChapterStudy(host: ChapterStudyHost, title: string): Promise<ChapterStudyResult> {
  const existing = host.companion(title);
  if (existing) { await host.open(existing); return "opened"; }

  if (!host.canonical(title)) await host.ensureLocal(title);
  const canonical = host.canonical(title);
  if (!canonical) {
    if (!host.signedIn()) {
      host.connect(`Connect to the family library to read ${title}. It takes one invite code.`);
      return "connect";
    }
    host.notify(`${title} hasn't downloaded yet. Check the family server connection and try again.`);
    return "unavailable";
  }

  const path = chapterStudyPath(title, canonical);
  try {
    await host.create(path, chapterStudyTemplate(title));
  } catch {
    // Someone else's copy arrived mid-tap, or the folder is read-only: the
    // chapter itself is here, so read it rather than refusing the tap.
    if (!host.companion(title)) { await host.open(title); return "opened"; }
  }
  await host.open(host.companion(title) ?? title);
  return "created";
}
