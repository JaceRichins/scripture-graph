import { BOOKS } from "../anchors";

/** Only explicit, single-reference navigation belongs on this local path.
 * Questions and compound instructions still go to the assistant. */
export function navigationRequest(question: string): { page: string; verse?: string } | null {
  const command = /^(?:please\s+)?(?:take me to|go to|open|show me|navigate to)\s+(.+?)(?:\s+please)?[.!?]*$/i.exec(question.trim());
  if (!command) return null;
  const ref = /^(.+?)\s*(\d{1,3})(?:\s*:\s*(\d{1,3}))?$/.exec(command[1]!.trim());
  if (!ref) return null;
  const normalize = (s: string) => s.toLowerCase().replace(/[\s.]/g, "");
  const book = BOOKS.find(b => [b.name, b.prefix, ...b.aliases].some(a => normalize(a) === normalize(ref[1]!)));
  const chapter = Number(ref[2]);
  const verse = ref[3] === undefined ? undefined : Number(ref[3]);
  if (!book || chapter < 1 || chapter > book.chapters || (verse !== undefined && verse < 1)) return null;
  return { page: `${book.prefix} ${chapter}`, ...(verse === undefined ? {} : { verse: `${book.slug}-${chapter}-${verse}` }) };
}
