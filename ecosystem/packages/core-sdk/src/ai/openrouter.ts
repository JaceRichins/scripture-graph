/** OpenRouter integration (§28-§33): the USER'S OWN wallet, never a master key.
 *
 * Flow: PKCE (S256). We open https://openrouter.ai/auth with a callback the
 * plugin registered (obsidian://scripture-graph-auth) plus a code challenge;
 * OpenRouter redirects back with a one-time code; we exchange code+verifier
 * for a user-scoped API key. That key is stored ONLY in device-local storage.
 */

export const OPENROUTER_BASE = "https://openrouter.ai";

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makeVerifier(): string {
  const bytes = new Uint8Array(48);
  globalThis.crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function challengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return b64url(new Uint8Array(digest));
}

export function authUrl(callbackUrl: string, challenge: string): string {
  const cb = encodeURIComponent(callbackUrl);
  return `${OPENROUTER_BASE}/auth?callback_url=${cb}&code_challenge=${challenge}&code_challenge_method=S256`;
}

export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/auth/keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  if (!res.ok) throw new Error(`OpenRouter key exchange failed (${res.status})`);
  const data = (await res.json()) as { key?: string };
  if (!data.key) throw new Error("OpenRouter returned no key");
  return data.key;
}

export interface ModelInfo {
  id: string;
  name: string;
  context_length: number;
  promptPrice: number;     // USD per 1M input tokens
  completionPrice: number; // USD per 1M output tokens
}

export async function listModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/models`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`model list failed (${res.status})`);
  const data = (await res.json()) as { data: Array<{
    id: string; name?: string; context_length?: number;
    pricing?: { prompt?: string; completion?: string };
  }> };
  return data.data.map(m => ({
    id: m.id,
    name: m.name ?? m.id,
    context_length: m.context_length ?? 8192,
    promptPrice: Number(m.pricing?.prompt ?? 0) * 1_000_000,
    completionPrice: Number(m.pricing?.completion ?? 0) * 1_000_000,
  }));
}

export interface KeyStatus { usageUsd: number; limitUsd: number | null }

export async function keyStatus(apiKey: string): Promise<KeyStatus> {
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/auth/key`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`key status failed (${res.status})`);
  const data = (await res.json()) as { data?: { usage?: number; limit?: number | null } };
  return { usageUsd: data.data?.usage ?? 0, limitUsd: data.data?.limit ?? null };
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface ChatUsage { prompt_tokens: number; completion_tokens: number; costUsd: number }

export async function chat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { onDelta?: (text: string) => void; signal?: AbortSignal; maxTokens?: number } = {},
): Promise<{ text: string; usage: ChatUsage }> {
  const stream = !!opts.onDelta;
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/chat/completions`, {
    method: "POST",
    signal: opts.signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://scripturegraph.local",
      "X-Title": "Scripture Graph",
    },
    body: JSON.stringify({
      model, messages, stream,
      max_tokens: opts.maxTokens,
      usage: { include: true },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  let text = "";
  let usage: ChatUsage = { prompt_tokens: 0, completion_tokens: 0, costUsd: 0 };
  if (stream && res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
          };
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) { text += delta; opts.onDelta!(delta); }
          if (j.usage) {
            usage = {
              prompt_tokens: j.usage.prompt_tokens ?? 0,
              completion_tokens: j.usage.completion_tokens ?? 0,
              costUsd: j.usage.cost ?? 0,
            };
          }
        } catch { /* partial line */ }
      }
    }
  } else {
    const j = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };
    text = j.choices?.[0]?.message?.content ?? "";
    usage = {
      prompt_tokens: j.usage?.prompt_tokens ?? 0,
      completion_tokens: j.usage?.completion_tokens ?? 0,
      costUsd: j.usage?.cost ?? 0,
    };
  }
  return { text, usage };
}
