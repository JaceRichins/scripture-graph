/** AI service (§24-§34): the USER'S OpenRouter wallet via PKCE, friendly
 * model tiers, task routing, and the hard budget brake. The key lives only
 * in device-local storage. */
import { Notice } from "obsidian";
import {
  authUrl, challengeS256, chat, exchangeCode, keyStatus, listModels, makeVerifier,
  pickModel, type AiTask, type ChatMessage, type KeyStatus, type ModelInfo,
} from "@scripture-graph/core-sdk";
import type { SGState } from "../state";

export const CALLBACK_URL = "obsidian://scripture-graph-auth";

export class AiService {
  private pendingVerifier: string | null = null;

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
