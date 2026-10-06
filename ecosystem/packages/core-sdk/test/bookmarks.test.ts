import { describe, expect, it } from "vitest";
import { bookmarkContent, parseBookmark, placeLabel } from "../src/bookmarks";

describe("bookmark records", () => {
  it("round-trips the page, title, synced place and time, with a readable first line", () => {
    const record = { path: "Library/1 Nephi 15 - My Notes.md", title: "1 Nephi 15",
      place: { top: 1840, left: 0, anchor: { tag: "p", text: "24 And I said unto them that it was the word of God", offset: 12 } }, at: "2026-09-18T13:16:11.570Z" };
    const content = bookmarkContent(record);
    expect(content.split("\n")[0]).toBe("Bookmark: [[1 Nephi 15]]");
    expect(parseBookmark(content)).toEqual({ title: "1 Nephi 15", record });
  });

  it("carries the verse the reader was on to their other devices", () => {
    const record = { path: "Library/Scriptures/Alma 36.md", title: "Alma 36",
      place: { top: 4876, left: 0, anchor: { tag: "p", text: "24 And it came to pass", offset: -12 }, mark: { id: "alma-36-24", offset: -12 } }, at: "2026-09-25T13:16:11.570Z" };
    expect(parseBookmark(bookmarkContent(record)).record).toEqual(record);
    // a place from an older app has no verse, and still resumes by offset
    const older = parseBookmark(bookmarkContent({ ...record, place: { top: 4876, left: 0 } })).record;
    expect(older!.place).toEqual({ top: 4876, left: 0 });
    // nonsense in the verse field is dropped, never carried into the reader
    const bad = parseBookmark(`Bookmark: [[Alma 36]]\nsg-bookmark ${JSON.stringify({ v: 1, path: "a.md", title: "Alma 36", place: { top: 10, left: 0, mark: { id: 7 } }, at: null })}`);
    expect(bad.record!.place).toEqual({ top: 10, left: 0 });
  });

  it("reads bookmarks written before records existed, and survives damaged records", () => {
    expect(parseBookmark("Bookmark: [[02 Hear Him]]")).toEqual({ title: "02 Hear Him", record: null });
    expect(parseBookmark("Bookmark: [[Alma 36]]\nsg-bookmark {broken")).toEqual({ title: "Alma 36", record: null });
    expect(parseBookmark(bookmarkContent({ path: "a.md", title: "A [x] | y", place: null, at: null })).title).toBe("A [x] | y");
    expect(bookmarkContent({ path: "a.md", title: "A [x] | y", place: null, at: null }).split("\n")[0]).toBe("Bookmark: [[A x y]]");
  });

  it("describes the place in words", () => {
    expect(placeLabel(null)).toBeNull();
    expect(placeLabel({ top: 0, left: 0 })).toBe("The top of the page");
    expect(placeLabel({ top: 900, left: 0, anchor: { tag: "p", text: "24 And I said unto them that it was the word of God; and whoso would hearken", offset: 0 } }))
      .toBe("Verse 24 · “And I said unto them that it was the word of God; and whoso would…”");
    expect(placeLabel({ top: 400, left: 0, anchor: { tag: "h2", text: "Remembering Jesus Christ", offset: 0 } })).toBe("“Remembering Jesus Christ”");
    expect(placeLabel({ top: 900, left: 0, mark: { id: "alma-36-24", offset: 0 } })).toBe("Verse 24");
    expect(placeLabel({ top: 900, left: 0, mark: { id: "doc:Library/Notes.md", offset: 0 } })).toBeNull();
  });
});
