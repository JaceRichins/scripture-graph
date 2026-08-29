import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../harness-dist", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json" };

createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  const file = path === "/" ? "index.html" : path.slice(1);
  const full = normalize(join(ROOT, file));
  if (!full.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(full);
    res.writeHead(200, { "content-type": TYPES[extname(full)] ?? "text/plain",
      "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(8123, "127.0.0.1", () => console.log("harness on http://127.0.0.1:8123"));
