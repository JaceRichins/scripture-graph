import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, type FetchLike } from "../src/api";

afterEach(() => vi.useRealTimers());

describe("Ask transport", () => {
  it("waits for a slow answer without replaying the question", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<FetchLike>(async (_url, init) => {
      if (init.method === "GET") return { status: 200, json: async () => ({ available: true }) };
      await new Promise(resolve => setTimeout(resolve, 65_000));
      return { status: 200, json: async () => ({ answer: "Read Alma 36", actions: [] }) };
    });
    const api = new ApiClient("http://home", fetch);
    api.setCandidates(["https://remote"]);
    const answer = api.ask({ question: "Explain Alma 36" });
    await vi.advanceTimersByTimeAsync(65_000);
    expect((await answer).answer).toBe("Read Alma 36");
    expect(fetch.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("finds a reachable address before submitting the question", async () => {
    const fetch = vi.fn<FetchLike>(async url => {
      if (url.startsWith("http://home")) throw new Error("offline");
      return { status: 200, json: async () => ({ available: true, answer: "Answer" }) };
    });
    const api = new ApiClient("http://home", fetch);
    api.setCandidates(["https://remote"]);
    await api.ask({ question: "Explain faith" });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "http://home/ask/status", "https://remote/ask/status", "https://remote/ask",
    ]);
  });

  it("does not resubmit a POST after the connection drops", async () => {
    const fetch = vi.fn<FetchLike>(async (_url, init) => {
      if (init.method === "POST") throw new Error("connection dropped");
      return { status: 200, json: async () => ({ available: true }) };
    });
    const api = new ApiClient("http://home", fetch);
    api.setCandidates(["https://remote"]);
    await expect(api.ask({ question: "Make a lesson" })).rejects.toThrow("connection dropped");
    expect(fetch.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
  });
});
