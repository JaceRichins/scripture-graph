/** Offline-first sync engine (§12, §46).
 *
 * - every write lands in LocalStore immediately (status pending_sync)
 * - local-visibility annotations NEVER enter the queue
 * - the queue survives restarts (persisted in LocalStore)
 * - push is idempotent (client op_id is the server's idempotency key)
 * - ops flush in the ORDER THEY HAPPENED (queued_at), never uuid order
 * - the last version the server confirmed is tracked per annotation
 *   ("sv/" marker); every edit/delete pushes against THAT base version, so
 *   legitimate edits never lose to phantom conflicts
 * - real conflicts: the server's record wins the slot, but the losing local
 *   text is preserved as a new private "conflict copy" — user text is never
 *   lost. Deletions never spawn copies (the user wanted the thing gone).
 */
import type { ApiClient } from "./api";
import type { LocalStore } from "./localstore";
import type { Annotation, SyncOp } from "./schemas";

const Q = "syncq/";
const A = "ann/";
const SV = "sv/";          // annotation_id -> last server-confirmed version
const CURSOR = "sync_cursor";
const MAX_PUSH = 180;      // stay under the server's per-push cap

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export class SyncEngine {
  /** same-millisecond ops still sort in exact creation order */
  private opSeq = 0;

  constructor(private store: LocalStore) {}

  private stamp(): string {
    return `${nowIso()}~${(this.opSeq++).toString().padStart(6, "0")}`;
  }

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

  private async serverVersion(id: string): Promise<number | null> {
    return this.store.get<number>(SV + id);
  }

  private async setServerVersion(id: string, v: number): Promise<void> {
    await this.store.put(SV + id, v);
  }

  // --------------------------------------------------------- local writes
  /** Save locally and (unless visibility=local) enqueue for the backend. */
  async save(a: Annotation): Promise<void> {
    await this.store.put(A + a.annotation_id, a);
    if (a.visibility === "local") return; // §6: never uploaded
    const sv = await this.serverVersion(a.annotation_id);
    const op: SyncOp = {
      op_id: uuid(),
      kind: a.deleted_at ? "delete_annotation" : "upsert_annotation",
      annotation: a,
      // the base is what the SERVER last confirmed — 0 only for never-synced
      base_version: sv ?? (a.deleted_at ? a.version : 0),
      queued_at: this.stamp(),
    };
    await this.store.put(Q + op.op_id, op);
  }

  async softDelete(id: string): Promise<void> {
    const a = await this.getAnnotation(id);
    if (!a) return;
    const dead = { ...a, deleted_at: nowIso(), updated_at: nowIso() };
    await this.store.put(A + id, dead);
    if (a.visibility !== "local") {
      const sv = await this.serverVersion(id);
      const op: SyncOp = {
        op_id: uuid(), kind: "delete_annotation", annotation: dead,
        base_version: sv ?? a.version, queued_at: this.stamp(),
      };
      await this.store.put(Q + op.op_id, op);
    }
  }

  async pendingCount(): Promise<number> {
    return (await this.store.keys(Q)).length;
  }

  // ---------------------------------------------------------------- push
  async flush(api: ApiClient): Promise<{ applied: number; conflicts: number; failed: number }> {
    const keys = await this.store.keys(Q);
    const stats = { applied: 0, conflicts: 0, failed: 0 };
    if (!keys.length) return stats;
    const all: SyncOp[] = [];
    for (const k of keys) {
      const op = await this.store.get<SyncOp>(k);
      if (op) all.push(op);
    }
    // chronological — a delete must never race ahead of the create it deletes
    all.sort((x, y) => x.queued_at.localeCompare(y.queued_at)
      || x.op_id.localeCompare(y.op_id));
    const ops = all.slice(0, MAX_PUSH); // leftovers go on the next flush
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
          await this.setServerVersion(r.server_annotation.annotation_id,
            r.server_annotation.version);
        }
        await this.store.delete(Q + r.op_id);
        stats.applied++;
      } else if (r.status === "conflict") {
        // server version wins the record; preserve losing text (§46)
        if (r.server_annotation) {
          const local = op.annotation;
          await this.store.put(A + r.server_annotation.annotation_id, r.server_annotation);
          await this.setServerVersion(r.server_annotation.annotation_id,
            r.server_annotation.version);
          // deletions never spawn copies — retry the delete against the
          // server's version instead of resurrecting the mark
          if (op.kind === "delete_annotation") {
            await this.softDelete(r.server_annotation.annotation_id);
          } else if (local.content && local.content !== r.server_annotation.content) {
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
      // the server's version is the new base for future edits, always
      await this.setServerVersion(a.annotation_id, a.version);
      const local = await this.store.get<Annotation>(localKey);
      // don't clobber a newer queued local edit; flush() will reconcile it
      if (local && local.version >= a.version && !a.deleted_at) continue;
      await this.store.put(localKey, a);
    }
    await this.store.put(CURSOR, res.next_cursor);
    return res.annotations.length;
  }
}
