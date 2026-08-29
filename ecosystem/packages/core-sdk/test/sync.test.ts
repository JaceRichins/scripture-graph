import { describe, expect, it } from "vitest";
import type { Annotation, SyncOp, SyncPushResult } from "../src/schemas";
import { MemoryStore } from "../src/localstore";
import { SyncEngine, nowIso, uuid } from "../src/syncengine";

function ann(partial: Partial<Annotation> = {}): Annotation {
  return {
    annotation_id: uuid(),
    author_user_id: null,
    anchor_type: "verse",
    anchor_id: "alma-36-18",
    annotation_type: "highlight",
    selected_text: null, start_offset: null, end_offset: null, text_hash: null,
    content: "", color: "yellow",
    visibility: "private", group_id: null,
    created_at: nowIso(), updated_at: nowIso(), deleted_at: null,
    version: 1,
    ...partial,
  };
}

class FakeApi {
  pushes: SyncOp[][] = [];
  respond: (op: SyncOp) => SyncPushResult = op => ({
    op_id: op.op_id, status: "applied",
    server_annotation: { ...op.annotation, version: op.base_version + 1, author_user_id: "u-1".padEnd(36, "0") as string },
  });
  fail = false;
  async syncPush(ops: SyncOp[]) {
    if (this.fail) throw new Error("offline");
    this.pushes.push(ops);
    return { results: ops.map(o => this.respond(o)) };
  }
  async syncPull(_c: string | null) {
    return { annotations: [], next_cursor: "c1" };
  }
}

describe("sync engine (§12, §46)", () => {
  it("local-visibility annotations NEVER enqueue (§6)", async () => {
    const s = new SyncEngine(new MemoryStore());
    await s.save(ann({ visibility: "local", content: "device only" }));
    expect(await s.pendingCount()).toBe(0);
  });

  it("private/group writes queue and survive until flushed", async () => {
    const store = new MemoryStore();
    const s = new SyncEngine(store);
    await s.save(ann({ visibility: "private" }));
    await s.save(ann({ visibility: "group", group_id: uuid() }));
    expect(await s.pendingCount()).toBe(2);
    const api = new FakeApi();
    const r = await s.flush(api as never);
    expect(r.applied).toBe(2);
    expect(await s.pendingCount()).toBe(0);
    // server-echoed versions replace local copies
    const all = await s.allAnnotations();
    expect(all.every(a => a.version === 1 && a.author_user_id !== null)).toBe(true);
  });

  it("offline flush keeps the queue intact for retry", async () => {
    const s = new SyncEngine(new MemoryStore());
    await s.save(ann());
    const api = new FakeApi();
    api.fail = true;
    const r = await s.flush(api as never);
    expect(r.failed).toBe(1);
    expect(await s.pendingCount()).toBe(1);
    api.fail = false;
    expect((await s.flush(api as never)).applied).toBe(1);
  });

  it("conflict preserves losing text as a private conflict copy (§46)", async () => {
    const s = new SyncEngine(new MemoryStore());
    const a = ann({ annotation_type: "note", content: "my local wording", version: 3 });
    await s.save(a);
    const api = new FakeApi();
    api.respond = op => ({
      op_id: op.op_id, status: "conflict",
      server_annotation: { ...op.annotation, content: "server wording", version: 5 },
    });
    const r = await s.flush(api as never);
    expect(r.conflicts).toBe(1);
    const all = await s.allAnnotations();
    const winner = all.find(x => x.annotation_id === a.annotation_id)!;
    expect(winner.content).toBe("server wording");
    const copy = all.find(x => x.content.includes("my local wording"))!;
    expect(copy.visibility).toBe("private");
    expect(copy.annotation_id).not.toBe(a.annotation_id);
  });

  it("soft delete queues a tombstone op", async () => {
    const s = new SyncEngine(new MemoryStore());
    const a = ann();
    await s.save(a);
    const api = new FakeApi();
    await s.flush(api as never);
    await s.softDelete(a.annotation_id);
    expect(await s.pendingCount()).toBe(1);
    const r = await s.flush(api as never);
    expect(r.applied).toBe(1);
    expect((await s.allAnnotations()).find(x => x.annotation_id === a.annotation_id)).toBeUndefined();
  });

  // ---- regressions from live phone testing 2026-08-28 ---------------------

  it("editing an already-synced annotation pushes the SERVER's version as base " +
     "(phantom-conflict bug: edits were silently undone)", async () => {
    const s = new SyncEngine(new MemoryStore());
    const a = ann({ visibility: "private" });
    const api = new FakeApi();
    await s.save(a);
    await s.flush(api as never);          // server confirms version 1
    const edited = { ...(await s.getAnnotation(a.annotation_id))!, visibility: "group" as const,
      group_id: uuid(), updated_at: nowIso() };
    await s.save(edited);
    const r = await s.flush(api as never);
    expect(r.conflicts).toBe(0);
    expect(r.applied).toBe(1);
    const pushedOp = api.pushes[1]![0]!;
    expect(pushedOp.base_version).toBe(1); // not 0 — the server-confirmed base
  });

  it("a version pulled from the server becomes the base for the next edit", async () => {
    const store = new MemoryStore();
    const s = new SyncEngine(store);
    const a = ann({ version: 5, author_user_id: "u".padEnd(36, "0") });
    const api = new FakeApi();
    api.syncPull = async () => ({ annotations: [a], next_cursor: "c2" });
    await s.pull(api as never);
    const edited = { ...(await s.getAnnotation(a.annotation_id))!, color: "blue" };
    await s.save(edited);
    const r = await s.flush(api as never);
    expect(r.applied).toBe(1);
    expect(api.pushes[0]![0]!.base_version).toBe(5);
  });

  it("ops flush in the order they happened, even in the same millisecond " +
     "(uuid-order bug: deletes could race ahead of their create)", async () => {
    const s = new SyncEngine(new MemoryStore());
    const a = ann();
    await s.save(a);          // create
    await s.softDelete(a.annotation_id); // then delete — same ms is fine
    const api = new FakeApi();
    await s.flush(api as never);
    const kinds = api.pushes[0]!.map(o => o.kind);
    expect(kinds).toEqual(["upsert_annotation", "delete_annotation"]);
  });

  it("a conflicted DELETE retries the delete instead of resurrecting the mark, " +
     "and never spawns a conflict copy", async () => {
    const s = new SyncEngine(new MemoryStore());
    const a = ann({ annotation_type: "note", content: "kill me" });
    const api = new FakeApi();
    await s.save(a);
    await s.flush(api as never);          // synced at v1
    await s.softDelete(a.annotation_id);
    api.respond = op => ({
      op_id: op.op_id, status: "conflict",
      server_annotation: { ...op.annotation, deleted_at: null, content: "kill me",
        version: 4 },
    });
    const r = await s.flush(api as never);
    expect(r.conflicts).toBe(1);
    // no junk copy…
    expect((await s.allAnnotations()).filter(x => x.content.includes("Conflict copy"))).toHaveLength(0);
    // …and the delete was re-queued against the server's version
    expect(await s.pendingCount()).toBe(1);
    const requeued = (await (s as never as { store: MemoryStore }).store.keys("syncq/"));
    expect(requeued).toHaveLength(1);
    api.respond = op => ({
      op_id: op.op_id, status: "applied",
      server_annotation: { ...op.annotation, version: 5 },
    });
    await s.flush(api as never);
    expect((await s.allAnnotations()).find(x => x.annotation_id === a.annotation_id)).toBeUndefined();
  });
});
