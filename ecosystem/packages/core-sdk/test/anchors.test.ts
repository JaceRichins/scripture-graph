import { describe, expect, it } from "vitest";
import {
  chapterIdFromTitle, chapterTitle, findScriptureRefs, makePartialAnchor,
  parseVerseId, resolvePartialAnchor, textHash, verseDisplay, BOOKS,
} from "../src/anchors";

describe("stable anchors", () => {
  it("registry mirrors the engine", () => {
    expect(BOOKS.length).toBe(88);
  });

  it("parses verse ids", () => {
    expect(parseVerseId("alma-36-18")).toEqual({ bookSlug: "alma", chapter: 36, verse: 18 });
    expect(parseVerseId("1ne-3-7")!.bookSlug).toBe("1ne");
    expect(parseVerseId("od-2-5")!.bookSlug).toBe("od");
    expect(parseVerseId("nope-1-1")).toBeNull();
    expect(parseVerseId("alma-36")).toBeNull();
  });

  it("titles round-trip", () => {
    expect(chapterTitle("dc", 76)).toBe("D&C 76");
    expect(chapterTitle("ps", 23)).toBe("Psalm 23");
    expect(verseDisplay("alma-36-18")).toBe("Alma 36:18");
    expect(chapterIdFromTitle("Alma 36")).toBe("alma-36");
    expect(chapterIdFromTitle("D&C 76")).toBe("dc-76");
    expect(chapterIdFromTitle("Official Declaration 2")).toBe("od-2");
  });

  it("finds scripture references in prose", () => {
    const refs = findScriptureRefs("Compare Alma 36:18-20 with 1 Ne. 3:7 and D&C 76.");
    expect(refs.map(r => `${r.bookSlug}-${r.chapter}`)).toEqual(["alma-36", "1ne-3", "dc-76"]);
    expect(refs[0]!.verses).toEqual([18, 19, 20]);
    expect(refs[1]!.verses).toEqual([7]);
    expect(refs[2]!.verses).toEqual([]);
  });

  it("partial anchors survive via offsets on immutable text", () => {
    const verse = "And it came to pass that I was harrowed up by the memory of my many sins.";
    const a = makePartialAnchor(verse, "harrowed up by the memory")!;
    expect(a.start_offset).toBe(31);
    expect(resolvePartialAnchor(verse, a)).toEqual({ start: 31, end: 31 + a.selected_text.length });
    // fallback search when hash mismatches (defensive)
    const shifted = "XX " + verse;
    const hit = resolvePartialAnchor(shifted, a)!;
    expect(shifted.slice(hit.start, hit.end)).toBe(a.selected_text);
  });

  it("textHash is stable", () => {
    expect(textHash("abc")).toBe(textHash("abc"));
    expect(textHash("abc")).not.toBe(textHash("abd"));
  });
});
