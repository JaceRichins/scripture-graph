/** Local AI spending ledger + hard monthly cap (§30).
 * The provider wallet is ground truth for money; this ledger is the
 * plugin-side safety brake that stops INITIATING requests past the cap. */
import type { LocalStore } from "../localstore";

const KEY = "ai_budget";

export interface BudgetState {
  monthKey: string;       // "2026-08"
  spentUsd: number;
  capUsd: number;         // 0 = no cap
  requests: number;
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export class Budget {
  constructor(private store: LocalStore) {}

  async state(): Promise<BudgetState> {
    const s = await this.store.get<BudgetState>(KEY);
    const mk = monthKey();
    if (!s || s.monthKey !== mk) {
      const fresh: BudgetState = { monthKey: mk, spentUsd: 0, capUsd: s?.capUsd ?? 10, requests: 0 };
      await this.store.put(KEY, fresh);
      return fresh;
    }
    return s;
  }

  async setCap(capUsd: number): Promise<void> {
    const s = await this.state();
    await this.store.put(KEY, { ...s, capUsd: Math.max(0, capUsd) });
  }

  async addUsage(costUsd: number): Promise<BudgetState> {
    const s = await this.state();
    const next = { ...s, spentUsd: s.spentUsd + Math.max(0, costUsd), requests: s.requests + 1 };
    await this.store.put(KEY, next);
    return next;
  }

  /** true when a NEW request may start (§30: cap stops initiation). */
  async mayStart(): Promise<{ ok: boolean; s: BudgetState }> {
    const s = await this.state();
    return { ok: s.capUsd <= 0 || s.spentUsd < s.capUsd, s };
  }
}
