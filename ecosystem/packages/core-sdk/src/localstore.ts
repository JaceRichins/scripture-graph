/** LocalStore abstraction (§45): all device-local persistence goes through
 * this interface. Implementations must be mobile-safe.
 *
 * PRIVACY LOAD-BEARING FACT: browser localStorage in Obsidian is PER DEVICE
 * and never synchronized with the vault — unlike plugin data.json, which
 * Obsidian Sync replicates to every vault user. Personal annotations and AI
 * credentials therefore live HERE, never in data.json, never in vault files.
 */

export interface LocalStore {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** list all keys under a prefix */
  keys(prefix: string): Promise<string[]>;
}

export class MemoryStore implements LocalStore {
  private m = new Map<string, string>();
  async get<T>(key: string): Promise<T | null> {
    const v = this.m.get(key);
    return v === undefined ? null : (JSON.parse(v) as T);
  }
  async put<T>(key: string, value: T): Promise<void> {
    this.m.set(key, JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    this.m.delete(key);
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.m.keys()].filter(k => k.startsWith(prefix));
  }
}

/** localStorage-backed store, namespaced (e.g. per vault + per feature). */
export class WebStorage implements LocalStore {
  constructor(private ns: string, private storage: Storage) {}
  private k(key: string) { return `${this.ns}:${key}`; }
  async get<T>(key: string): Promise<T | null> {
    try {
      const v = this.storage.getItem(this.k(key));
      return v === null ? null : (JSON.parse(v) as T);
    } catch { return null; }
  }
  async put<T>(key: string, value: T): Promise<void> {
    this.storage.setItem(this.k(key), JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    this.storage.removeItem(this.k(key));
  }
  async keys(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const full = this.k(prefix);
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (k && k.startsWith(full)) out.push(k.slice(this.ns.length + 1));
    }
    return out;
  }
}
