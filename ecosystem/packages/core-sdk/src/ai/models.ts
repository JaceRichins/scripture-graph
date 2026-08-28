/** Friendly model tiers + automatic task routing (§31-§32).
 * Users see five friendly choices; advanced users can pin any model id.
 * Routing rules are data, not code — configurable and update-safe. */
import type { ModelInfo } from "./openrouter";

export type Tier = "auto" | "fast" | "deep" | "best" | "cheapest" | "specific";

export type AiTask =
  | "define" | "verse" | "chapter" | "connections" | "history"
  | "language" | "evidence" | "challenge" | "brainstorm" | "compare"
  | "vault" | "lesson" | "talk";

/** task -> preferred tier under Automatic routing (§32) */
export const DEFAULT_ROUTING: Record<AiTask, Exclude<Tier, "auto" | "specific">> = {
  define: "fast",
  verse: "fast",
  chapter: "fast",
  connections: "fast",
  history: "deep",
  language: "deep",
  evidence: "deep",
  challenge: "deep",
  brainstorm: "fast",
  compare: "fast",
  vault: "deep",
  lesson: "best",
  talk: "best",
};

/** Curated per-tier candidates, best-first; we pick the first one the live
 * registry actually offers, so provider churn never breaks the plugin. */
export const TIER_CANDIDATES: Record<Exclude<Tier, "auto" | "specific" | "cheapest">, string[]> = {
  fast: [
    "anthropic/claude-haiku-4.5",
    "openai/gpt-5-mini",
    "google/gemini-2.5-flash",
    "openai/gpt-4.1-mini",
    "anthropic/claude-3.5-haiku",
  ],
  deep: [
    "anthropic/claude-sonnet-5",
    "openai/gpt-5",
    "google/gemini-2.5-pro",
    "anthropic/claude-sonnet-4.5",
    "openai/o4-mini",
  ],
  best: [
    "anthropic/claude-opus-5",
    "openai/gpt-5.2",
    "anthropic/claude-sonnet-5",
    "openai/gpt-5",
    "google/gemini-2.5-pro",
  ],
};

export interface ModelChoice { modelId: string; reason: string }

export function pickModel(
  registry: ModelInfo[],
  task: AiTask,
  prefs: { tier: Tier; specificModel?: string | null; routing?: Partial<Record<AiTask, Tier>> },
): ModelChoice {
  const ids = new Set(registry.map(m => m.id));
  const byId = new Map(registry.map(m => [m.id, m]));

  if (prefs.tier === "specific" && prefs.specificModel && ids.has(prefs.specificModel)) {
    return { modelId: prefs.specificModel, reason: "user-selected model" };
  }
  let tier: Tier = prefs.tier;
  if (tier === "auto") {
    tier = (prefs.routing?.[task] as Tier | undefined) ?? DEFAULT_ROUTING[task];
  }
  if (tier === "cheapest") {
    const paid = registry
      .filter(m => m.promptPrice + m.completionPrice > 0 && m.context_length >= 16000)
      .sort((a, b) => (a.promptPrice + a.completionPrice) - (b.promptPrice + b.completionPrice));
    if (paid[0]) return { modelId: paid[0].id, reason: "cheapest capable model" };
    tier = "fast";
  }
  const candidates = TIER_CANDIDATES[(tier === "auto" || tier === "specific" || tier === "cheapest" ? "fast" : tier)];
  for (const c of candidates) {
    if (ids.has(c)) return { modelId: c, reason: `${tier} tier` };
  }
  // last resort: any mid-priced model with decent context
  const fallback = registry
    .filter(m => m.context_length >= 32000)
    .sort((a, b) => (a.promptPrice + a.completionPrice) - (b.promptPrice + b.completionPrice));
  const mid = fallback[Math.floor(fallback.length / 3)] ?? fallback[0];
  if (mid) return { modelId: mid.id, reason: "registry fallback" };
  throw new Error("no models available from provider");
}

export function estimateCostUsd(m: ModelInfo, promptTokens: number, completionTokens: number): number {
  return (promptTokens * m.promptPrice + completionTokens * m.completionPrice) / 1_000_000;
}
