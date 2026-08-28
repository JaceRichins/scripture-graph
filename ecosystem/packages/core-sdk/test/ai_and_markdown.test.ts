import { describe, expect, it } from "vitest";
import { Budget } from "../src/ai/budget";
import { DEFAULT_ROUTING, pickModel } from "../src/ai/models";
import type { ModelInfo } from "../src/ai/openrouter";
import { MemoryStore } from "../src/localstore";
import { parseCanonicalVerses, parseFrontmatter, sections, trimContext } from "../src/markdown";

const registry: ModelInfo[] = [
  { id: "anthropic/claude-haiku-4.5", name: "Haiku", context_length: 200000, promptPrice: 1, completionPrice: 5 },
  { id: "anthropic/claude-sonnet-5", name: "Sonnet", context_length: 200000, promptPrice: 3, completionPrice: 15 },
  { id: "tiny/cheapo", name: "Cheapo", context_length: 32000, promptPrice: 0.05, completionPrice: 0.1 },
];

describe("model routing (§31-32)", () => {
  it("auto routes by task", () => {
    expect(DEFAULT_ROUTING.verse).toBe("fast");
    expect(pickModel(registry, "verse", { tier: "auto" }).modelId).toBe("anthropic/claude-haiku-4.5");
    expect(pickModel(registry, "evidence", { tier: "auto" }).modelId).toBe("anthropic/claude-sonnet-5");
  });
  it("cheapest picks by price", () => {
    expect(pickModel(registry, "verse", { tier: "cheapest" }).modelId).toBe("tiny/cheapo");
  });
  it("specific respects user pin, falls back safely", () => {
    expect(pickModel(registry, "verse", { tier: "specific", specificModel: "anthropic/claude-sonnet-5" }).modelId)
      .toBe("anthropic/claude-sonnet-5");
    const c = pickModel(registry, "verse", { tier: "specific", specificModel: "gone/model" });
    expect(registry.some(m => m.id === c.modelId)).toBe(true);
  });
});

describe("budget cap (§30)", () => {
  it("stops initiating past the cap and resets monthly", async () => {
    const b = new Budget(new MemoryStore());
    await b.setCap(1.0);
    expect((await b.mayStart()).ok).toBe(true);
    await b.addUsage(0.6);
    expect((await b.mayStart()).ok).toBe(true);
    await b.addUsage(0.5);
    const { ok, s } = await b.mayStart();
    expect(ok).toBe(false);
    expect(s.spentUsd).toBeCloseTo(1.1);
  });
});

describe("vault markdown parsing", () => {
  it("frontmatter + sections + canonical verses", () => {
    const note = `---\nownership: canonical\nmutable: false\nslug: alma-36\n---\n\n# Alma 36\n\n**1** My son, give ear to my words. ^alma-36-1\n\n**18** Jesus, thou Son of God. ^alma-36-18\n\n<!-- SG:BEGIN overview -->\nAn overview.\n<!-- SG:END overview -->\n`;
    const { frontmatter, body } = parseFrontmatter(note);
    expect(frontmatter["slug"]).toBe("alma-36");
    expect(frontmatter["mutable"]).toBe(false);
    const verses = parseCanonicalVerses(body);
    expect(verses.length).toBe(2);
    expect(verses[1]).toEqual({ verse: 18, text: "Jesus, thou Son of God.", verseId: "alma-36-18" });
    expect(sections(body)["overview"]).toBe("An overview.");
  });

  it("context trimming honors priority + budget", () => {
    const items = [
      { label: "verse", wikilink: null, text: "x".repeat(4000), priority: 0 },
      { label: "guide", wikilink: null, text: "y".repeat(9000), priority: 1 },
      { label: "huge", wikilink: null, text: "z".repeat(50000), priority: 2 },
    ];
    const out = trimContext(items, "focused");
    expect(out.map(i => i.label)).toEqual(["verse", "guide"]);
  });
});
