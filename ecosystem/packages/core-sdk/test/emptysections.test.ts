import { describe, expect, it } from "vitest";
import {
  type Block, PLACEHOLDER_TEXT, findEmptySections, isPlaceholder, outermost,
  planEmptySections,
} from "../src/emptysections";
import { sectionIsEmpty } from "../src/markdown";

const h = (level: number, text: string): Block => ({ level, text });
const p = (text: string): Block => ({ level: null, text });
const empty = (): Block => ({ level: null, text: PLACEHOLDER_TEXT });

describe("placeholder detection", () => {
  it("matches the engine placeholder however it renders", () => {
    expect(isPlaceholder("Not yet developed.")).toBe(true);
    expect(isPlaceholder("_Not yet developed._")).toBe(true);   // source form
    expect(isPlaceholder("  not yet developed.  ")).toBe(true);
    expect(isPlaceholder("Not yet developed.")).toBe(true); // nbsp
    expect(isPlaceholder("")).toBe(true);
    expect(isPlaceholder(undefined)).toBe(true);
  });

  it("does not swallow real content that merely mentions it", () => {
    expect(isPlaceholder("This doctrine is not yet developed. See Alma 32.")).toBe(false);
    expect(isPlaceholder("Nephi obtains the plates.")).toBe(false);
  });

  it("agrees with the marker-level check the engine and reader already use", () => {
    // same rule, one on section source, one on rendered text
    expect(sectionIsEmpty("_Not yet developed._")).toBe(true);
    expect(isPlaceholder("_Not yet developed._")).toBe(true);
    expect(sectionIsEmpty("real prose")).toBe(false);
    expect(isPlaceholder("real prose")).toBe(false);
  });
});

describe("finding empty sections", () => {
  it("keeps a section that has any real content", () => {
    const blocks = [h(2, "Overview"), p("Nephi returns to Jerusalem."), empty()];
    expect(planEmptySections(blocks)).toEqual([]);
  });

  it("collapses a section that is only the placeholder", () => {
    const blocks = [h(2, "Overview"), p("real"), h(2, "Language & Text"), empty()];
    const plan = planEmptySections(blocks);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.title).toBe("Language & Text");
    expect(plan[0]!.heading).toBe(2);
    expect(plan[0]!.body).toEqual([3]);
  });

  it("treats a heading with no body at all as empty", () => {
    const plan = planEmptySections([h(2, "Overview"), p("real"), h(2, "Evidence")]);
    expect(plan.map(s => s.title)).toEqual(["Evidence"]);
  });

  it("stops at the next heading of the same rank", () => {
    const blocks = [h(2, "A"), empty(), h(2, "B"), p("real")];
    expect(planEmptySections(blocks).map(s => s.title)).toEqual(["A"]);
  });

  it("stops at a heading of higher rank", () => {
    const blocks = [h(3, "Sub"), empty(), h(2, "Parent"), p("real")];
    expect(planEmptySections(blocks).map(s => s.title)).toEqual(["Sub"]);
  });

  it("a parent whose subsections are all empty is empty too", () => {
    const blocks = [
      h(2, "Doctrines"), h(3, "One"), empty(), h(3, "Two"), empty(),
      h(2, "Overview"), p("real"),
    ];
    const found = findEmptySections(blocks);
    expect(found.map(s => s.title)).toEqual(["Doctrines", "One", "Two"]);
    // …and only the parent is acted on
    expect(outermost(found).map(s => s.title)).toEqual(["Doctrines"]);
  });

  it("a parent with one real subsection stays open", () => {
    const blocks = [
      h(2, "Doctrines"), h(3, "One"), empty(), h(3, "Two"), p("real"),
    ];
    expect(planEmptySections(blocks).map(s => s.title)).toEqual(["One"]);
  });

  it("handles the real shape of a study guide barely researched yet", () => {
    const names = ["Overview", "Structure & Setting", "People", "Places",
                   "Related Scriptures", "Gospel Topics", "Hymns",
                   "Doctrines & Principles", "General Conference",
                   "Church History", "Language & Text", "Literary Features",
                   "Evidence & Easter Eggs", "Questions Worth Studying",
                   "Further Study"];
    const blocks: Block[] = [];
    for (const n of names) {
      blocks.push(h(2, n));
      blocks.push(n === "Overview" || n === "Related Scriptures"
        ? p("real content") : empty());
    }
    const plan = planEmptySections(blocks);
    expect(plan).toHaveLength(names.length - 2);
    expect(plan.map(s => s.title)).not.toContain("Overview");
    expect(plan.map(s => s.title)).not.toContain("Related Scriptures");
  });

  it("does nothing to a note with no headings", () => {
    expect(planEmptySections([p("just prose"), p("more")])).toEqual([]);
  });

  it("is stable on an empty document", () => {
    expect(planEmptySections([])).toEqual([]);
  });
});
