import type { LocalStore } from "@scripture-graph/core-sdk";

/** The full shared manifest and index exceed localStorage's phone quota.
 * Only these rebuildable caches move to IndexedDB; login and personal data
 * stay in the existing per-device store. Nothing is written into the vault. */
export function sharedCache(legacy: LocalStore, vaultId: string): Pick<LocalStore, "get" | "put"> {
  if (typeof indexedDB === "undefined") return legacy;
  let opened: Promise<IDBDatabase> | null = null;
  const database = () => opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`scripture-graph-shared:${vaultId}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("cache");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opened = null; reject(request.error); };
    request.onblocked = () => reject(new Error("Close other Obsidian windows and retry the library download."));
  });
  const read = async <T>(key: string): Promise<T | null> => {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("cache", "readonly");
      const request = tx.objectStore("cache").get(key);
      tx.oncomplete = () => resolve((request.result as T | undefined) ?? null);
      tx.onabort = () => reject(tx.error ?? new Error("Could not read the library download index."));
    });
  };
  const put = async <T>(key: string, value: T): Promise<void> => {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("cache", "readwrite");
      tx.objectStore("cache").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Could not save library progress. Check available storage."));
    });
    // Free the old quota only after the replacement transaction commits.
    await legacy.delete(key);
  };
  return {
    async get<T>(key: string): Promise<T | null> {
      const value = await read<T>(key);
      if (value !== null) return value;
      const old = await legacy.get<T>(key);
      if (old !== null) await put(key, old);
      return old;
    },
    put,
  };
}
