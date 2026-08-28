/** Offline-first sync engine (§12, §46).
 *
 * - every write lands in LocalStore immediately (status pending_sync)
 * - local-visibility annotations NEVER enter the queue
 * - the queue survives restarts (persisted in LocalStore)
 * - push is idempotent (client op_id is the server's idempotency key)
 * - conflicts: the server's record wins the slot, but the losing local text
 *   is preserved as a new private "conflict copy" — user text is never lost
 */
import type { ApiClient } from "./api";
import type { LocalStore } from "./localstore";
import type { Annotation, SyncOp } from "./schemas";

const Q = "syncq/";
const A = "ann/";
const CURSOR = "sync_cursor";

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export class SyncEngine {
  constructor(private store: LocalStore) {}

  // ---------------------------------------------------------- local reads
  async getAnnotation(id: string): Promise<Annotation | null> {
    return this.store.get<Annotation>(A + id);
  }

  async allAnnotations(): Promise<Annotation[]> {
    const keys = await this.store.keys(A);
    const out: Annotation[] = [];
    for (const k of keys) {
      const a = await this.store.get<Annotation>(k);
      if (a && !a.deleted_at) out.push(a);
    }
    return out;
  }

  async annotationsForAnchor(anchorId: string): Promise<Annotation[]> {
    return (await this.allAnnotations()).filter(a => a.anchor_id === anchorId);
  }

  // --------------------------------------------------------- local writes
  /** Save locally and (unless visibility=local) enqueue for the backend. */
  async save(a: Annotation): Promise<void> {
    await this.store.put(A + a.annotation_id, a);
    if (a.visibility === "local") return; // §6: never uploaded
    const op: SyncOp = {
      op_id: uuid(),
      kind: a.deleted_at ? "delete_annotation" : "upsert_annotation",
      annotation: a,
      base_version: a.version > 1 || a.deleted_at ? a.version : 0,
      queued_at: nowIso(),
    };
    await this.store.put(Q + op.op_id, op);
  }

  async softDelete(id: string): Promise<void> {
    const a = await this.getAnnotation(id);
    if (!a) return;
    const dead = { ...a, deleted_at: nowIso(), updated_at: nowIso() };
    await this.store.put(A + id, dead);
    if (a.visibility !== "local") {
      const op: SyncOp = {
        op_id: uuid(), kind: "delete_annotation", annotation: dead,
        base_version: a.version, queued_at: nowIso(),
      };
      await this.store.put(Q + op.op_id, op);
    }
  }

  async pendingCount(): Promise<number> {
    return (await this.store.keys(Q)).length;
  }

  // ---------------------------------------------------------------- push
  async flush(api: ApiClient): Promise<{ applied: number; conflicts: number; failed: number }> {
    const keys = (await this.store.keys(Q)).sort();
    const stats = { applied: 0, conflicts: 0, failed: 0 };
    if (!keys.length) return stats;
    const ops: SyncOp[] = [];
    for (const k of keys) {
      const op = await this.store.get<SyncOp>(k);
      if (op) ops.push(op);
    }
    let results;
    try {
      results = (await api.syncPush(ops)).results;
    } catch {
      stats.failed = ops.length; // stay queued; retry later (§46)
      return stats;
    }
    for (const r of results) {
      const op = ops.find(o => o.op_id === r.op_id);
      if (!op) continue;
      if (r.status === "applied" || r.status === "duplicate") {
        if (r.server_annotation) {
          await this.store.put(A + r.server_annotation.annotation_id, r.server_annotation);
        }
        await this.store.delete(Q + r.op_id);
        stats.applied++;
      } else if (r.status === "conflict") {
        // server version wins the record; preserve losing text (§46)
        if (r.server_annotation) {
          const local = op.annotation;
          await this.store.put(A + r.server_annotation.annotation_id, r.server_annotation);
          if (local.content && local.content !== r.server_annotation.content) {
            const copy: Annotation = {
              ...local,
              annotation_id: uuid(),
              annotation_type: "note",
              visibility: "private",
              content: `⚠ Conflict copy (kept so nothing is lost):\n\n${local.content}`,
              version: 1,
              created_at: nowIso(),
              updated_at: nowIso(),
              deleted_at: null,
            };
            await this.save(copy);
          }
        }
        await this.store.delete(Q + r.op_id);
        stats.conflicts++;
      } else {
        // rejected (validation/permission): drop the op but KEEP local copy
        await this.store.delete(Q + r.op_id);
        stats.failed++;
      }
    }
    return stats;
  }

  // ---------------------------------------------------------------- pull
  async pull(api: ApiClient): Promise<number> {
    const cursor = await this.store.get<string>(CURSOR);
    const res = await api.syncPull(cursor);
    for (const a of res.annotations) {
      const localKey = A + a.annotation_id;
      const local = await this.store.get<Annotation>(localKey);
      // don't clobber a newer queued local edit; flush() will reconcile it
      if (local && local.version >= a.version && !a.deleted_at) continue;
      if (a.deleted_at) await this.store.put(localKey, a);
      else await this.store.put(localKey, a);
    }
    await this.store.put(CURSOR, res.next_cursor);
    return res.annotations.length;
  }
}
