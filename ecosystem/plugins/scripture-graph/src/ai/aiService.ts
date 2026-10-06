/** AI service (§24-§34): the USER'S OpenRouter wallet via PKCE, friendly
 * model tiers, task routing, and the hard budget brake. The key lives only
 * in device-local storage. */
import { Notice } from "obsidian";
import {
  ApiError, authUrl, challengeS256, chat, exchangeCode, keyStatus, listModels, makeVerifier,
  pickModel, usesTeam, type AiTask, type ChatMessage, type KeyStatus, type ModelInfo,
} from "@scripture-graph/core-sdk";
import type { SGState } from "../state";

export const CALLBACK_URL = "obsidian://scripture-graph-auth";

export class AiService {
  private pendingVerifier: string | null = null;
  statusError: string | null = null;

  constructor(private s: SGState) {}

  // ------------------------------------------------------------- connect
  async beginConnect(): Promise<string> {
    this.pendingVerifier = makeVerifier();
    const challenge = await challengeS256(this.pendingVerifier);
    const url = authUrl(CALLBACK_URL, challenge);
    window.open(url);
    return url;
  }

  /** called by the obsidian:// protocol handler OR manual code paste */
  async completeConnect(code: string): Promise<void> {
    if (!this.pendingVerifier) throw new Error("no pending AI connection — start again");
    const key = await exchangeCode(code.trim(), this.pendingVerifier);
    this.pendingVerifier = null;
    this.s.device.openrouterKey = key;
    await this.s.saveDevice();
    new Notice("AI connected ✓ (your own OpenRouter wallet)");
    this.s.notify();
  }

  async disconnect(): Promise<void> {
    this.s.device.openrouterKey = null;
    await this.s.saveDevice();
    this.s.notify();
  }

  // -------------------------------------------------------------- models
  async models(force = false): Promise<ModelInfo[]> {
    if (this.s.modelRegistry.length && !force) return this.s.modelRegistry;
    const cached = await this.s.store.get<{ at: number; models: ModelInfo[] }>("model_registry");
    if (cached && !force && Date.now() - cached.at < 24 * 3600_000) {
      this.s.modelRegistry = cached.models;
      return cached.models;
    }
    const models = await listModels();
    this.s.modelRegistry = models;
    await this.s.store.put("model_registry", { at: Date.now(), models });
    return models;
  }

  async wallet(): Promise<KeyStatus | null> {
    if (!this.s.device.openrouterKey) return null;
    try { return await keyStatus(this.s.device.openrouterKey); } catch { return null; }
  }

  // ------------------------------------------------------ ask (server)
  /** The family server answers: a ChatGPT session on the family's own
   * computer reads the library and replies, and may hand back actions to
   * carry out in the app. No key on this phone. The server keeps one
   * thread per person, so a conversation carries. */
  async askServer(question: string, anchor: { chapterTitle?: string | null; verseId?: string | null; page?: string | null } | null,
    opts: { mode?: 'chat' | 'research' | 'lesson' | 'study-plan'; reset?: boolean; state?: Record<string, unknown>; onProgress?: (text: string) => void } = {}):
    Promise<{ text: string; model: string; ms: number; threadId: string; actions: unknown[] }> {
    type Pending = { id: string; userId?: string | null; question: string; body: { mode?: 'chat' | 'research' | 'lesson' | 'study-plan'; [key: string]: unknown } };
    const requestUser = this.s.device.userId;
    // A team's job waits in its own slot, so a conversation can continue while it works.
    const background = usesTeam(opts.mode, question, !!opts.state?.["currentDocument"]);
    const key = background ? "pending_background_job" : "pending_ask_job";
    let pending = await this.s.store.get<Pending>(key);
    if (pending?.userId !== undefined && pending.userId !== requestUser) {
      await this.s.store.put(key, null); pending = null;
    }
    if (pending && pending.question !== question) throw new Error(background ? "Your research, lesson, or study plan is still being prepared. Please wait for it to finish." : "Your earlier question is still in progress. Please wait for it to finish.");
    if (!pending) {
      if (opts.mode && opts.mode !== 'chat') {
        const status = await this.s.api.askStatus();
        if (this.s.device.userId !== requestUser) throw new Error('Your account changed. Send the request from your account.');
        if (!status.modes?.includes(opts.mode)) throw new Error('This mode needs the updated family server. Please reconnect and try again.');
      }
      pending = { id: crypto.randomUUID(), userId: requestUser, question, body: { question, mode: opts.mode ?? 'chat', anchor, reset: opts.reset, state: { ...opts.state, usePersonalNotes: this.s.device.aiUsePersonalNotes } } };
      await this.s.store.put(key, pending);
    }
    let accepted = false;
    for (;;) {
      if (this.s.device.userId !== requestUser) throw new Error('Your account changed. Reopen the assistant for your account.');
      let job;
      try {
        job = accepted ? await this.s.api.askJob(pending.id) : await this.s.api.startAskJob(pending.id, pending.body);
        if (this.s.device.userId !== requestUser) throw new ApiError(409, 'Your account changed. Reopen the assistant.');
        accepted = true;
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408) {
          await this.s.store.put(key, null);
          throw error;
        }
        opts.onProgress?.("Reconnecting — your question is saved. Checking the same request…");
        await new Promise(resolve => window.setTimeout(resolve, 4000));
        continue;
      }
      if (job.status === "failed") {
        await this.s.store.put(key, null);
        throw new ApiError(502, job.result?.error ?? "The assistant could not finish this question.");
      }
      if (job.status === "finished") {
        const r = job.result;
        if (!r?.ok || typeof r.answer !== "string") {
          await this.s.store.put(key, null);
          throw new ApiError(502, "The completed answer was unreadable.");
        }
        await this.s.store.put(key, null);
        return { text: r.answer, model: r.model ?? "Family assistant", ms: r.ms ?? 0, threadId: r.threadId ?? "", actions: r.actions ?? [] };
      }
      opts.onProgress?.(job.status === "queued" ? "Waiting for the assistant — your question is queued…"
        : job.result?.progress ?? (pending.body.mode === 'research' ? 'Researching sources and checking the evidence. This may take a while; you can keep chatting…' : background ? 'Your team is preparing this. You can keep chatting…' : "The assistant is working on your answer…"));
      await new Promise(resolve => window.setTimeout(resolve, 2000));
    }
  }

  /** whether the server can answer right now (and the turns it remembers) */
  async serverStatus() {
    try {
      const st = await this.s.api.askStatus();
      this.statusError = st.available ? null : 'The server is reachable, but its AI service is unavailable.';
      return { available: st.available, modes: st.modes, research: st.research, studyPlan: st.studyPlan, lesson: st.lesson, turns: st.turns.map(t => ({ role: t.role, text: t.text })) };
    } catch (error) {
      this.statusError = error instanceof ApiError && error.status === 401 ? 'Your vault sign-in needs reconnecting.'
        : error instanceof ApiError ? `The AI connection check returned an error (HTTP ${error.status}).`
        : 'The AI connection check did not finish. Your phone may still be online.';
      return null;
    }
  }

  // ----------------------------------------------------------------- ask
  async ask(
    task: AiTask, messages: ChatMessage[],
    onDelta: (t: string) => void, signal?: AbortSignal,
  ): Promise<{ text: string; model: string; costUsd: number }> {
    const key = this.s.device.openrouterKey;
    if (!key) throw new Error("AI is not connected yet — Settings → Scripture Graph → Connect AI");
    const gate = await this.s.budget.mayStart();
    if (!gate.ok) {
      throw new Error(
        `Monthly AI cap reached ($${gate.s.spentUsd.toFixed(2)} of $${gate.s.capUsd.toFixed(2)}). ` +
        "Raise the cap in settings to continue.");
    }
    const registry = await this.models();
    const choice = pickModel(registry, task, {
      tier: this.s.device.aiTier,
      specificModel: this.s.device.aiSpecificModel,
    });
    const res = await chat(key, choice.modelId, messages, { onDelta, signal });
    await this.s.budget.addUsage(res.usage.costUsd);
    return { text: res.text, model: choice.modelId, costUsd: res.usage.costUsd };
  }
}
