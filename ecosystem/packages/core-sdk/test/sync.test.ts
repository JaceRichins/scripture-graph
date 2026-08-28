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
});
