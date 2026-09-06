import { buildApp } from "../src/app";
import { openDb, migrate } from "../src/db";
import { createDevice, createUser } from "../src/auth";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env["SG_VAULT"] = "C:/Users/jacer/repos/SCRIPTURE GRAPH/Scripture Graph";
process.env["SG_OWNER_MIRROR"] = "0";
const dir = mkdtempSync(join(tmpdir(), "sg-e2e-"));
const db = openDb(join(dir, "social.sqlite3")); migrate(db);
const app = buildApp({ db });
const userId = createUser(db, "E2E Tester", "member");
const { token } = createDevice(db, userId, "e2e");
const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const t = (label: string, ms: number) => console.log(`${label}: ${ms} ms`);
(async () => {
  let t0 = Date.now();
  let r = await app.inject({ method: "GET", url: "/vault/version", headers: H });
  t("version (cold, hashes 125 MB)", Date.now() - t0); console.log(r.statusCode, r.body.slice(0, 120));
  t0 = Date.now(); r = await app.inject({ method: "GET", url: "/vault/version", headers: H }); t("version (warm)", Date.now() - t0);
  t0 = Date.now(); r = await app.inject({ method: "GET", url: "/vault/manifest", headers: H });
  const m = r.json(); t(`manifest ${m.count} files, ${(r.body.length/1e6).toFixed(1)} MB json`, Date.now() - t0);
  const plugin = m.files.filter((f: any) => f.p.startsWith(".obsidian/plugins/scripture-graph/")).map((f: any) => f.p);
  console.log("plugin files in manifest:", plugin);
  console.log("excluded ok:", !m.files.some((f: any) => f.p.startsWith("Library/") || f.p.startsWith(".scripture-engine")));
  const paths = m.files.slice(0, 120).map((f: any) => f.p);
  t0 = Date.now(); r = await app.inject({ method: "POST", url: "/vault/batch", headers: H, payload: { paths } });
  const b = r.json(); t(`batch of ${b.files.length} (${(r.body.length/1e6).toFixed(2)} MB)`, Date.now() - t0);
  const jpg = m.files.find((f: any) => f.p.endsWith(".jpg"));
  r = await app.inject({ method: "POST", url: "/vault/batch", headers: H, payload: { paths: [jpg.p] } });
  console.log("binary via b64:", !!r.json().files[0].b64, jpg.p);
  // personal: push, pull, conflict
  r = await app.inject({ method: "POST", url: "/vault/personal/push", headers: H, payload: { files: [
    { path: "Library/E2E note.md", content: "# hi\nv1", hash: "h1", base_hash: null, mtime: 1 }] } });
  console.log("push v1:", r.json().results[0].status);
  r = await app.inject({ method: "POST", url: "/vault/personal/push", headers: H, payload: { files: [
    { path: "Library/E2E note.md", content: "# hi\nv2", hash: "h2", base_hash: "h1", mtime: 2 }] } });
  console.log("push v2 (base h1):", r.json().results[0].status);
  r = await app.inject({ method: "POST", url: "/vault/personal/push", headers: H, payload: { files: [
    { path: "Library/E2E note.md", content: "# hi\nother", hash: "h3", base_hash: "h1", mtime: 3 }] } });
  const c = r.json().results[0]; console.log("push from stale base:", c.status, c.server?.hash);
  r = await app.inject({ method: "GET", url: "/vault/personal/manifest", headers: H });
  console.log("personal manifest:", r.json().files.length, r.json().files[0]);
  r = await app.inject({ method: "POST", url: "/vault/personal/push", headers: H, payload: { files: [
    { path: "AI Library/hack.md", content: "x", hash: "h", base_hash: null, mtime: 1 }] } });
  console.log("push outside Library/:", r.json().results[0].status);
  r = await app.inject({ method: "POST", url: "/vault/batch", headers: H, payload: { paths: ["../../etc/passwd", ".scripture-engine/config/config.yaml"] } });
  console.log("traversal/excluded batch:", r.json().files.map((f: any) => f.missing));
  await app.close(); db.close();
})();
