import { buildApp } from "./app";
import { openDb } from "./db";

const DB_PATH = process.env["SG_DB"] ?? "data/scripturegraph-social.sqlite3";
const PORT = Number(process.env["SG_PORT"] ?? 8930);
const HOST = process.env["SG_HOST"] ?? "127.0.0.1";

const db = openDb(DB_PATH);
const app = buildApp({ db });

app.listen({ port: PORT, host: HOST }).then(() => {
  // eslint-disable-next-line no-console
  console.log(`[scripture-graph server] listening on http://${HOST}:${PORT} (db: ${DB_PATH})`);
}).catch(err => {
  // eslint-disable-next-line no-console
  console.error("server failed to start:", err);
  process.exit(1);
});
