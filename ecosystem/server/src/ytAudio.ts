/** /yt/audio?v=<id> — the sound of a YouTube video as a plain audio stream.
 *
 * A YouTube player embedded in the app stops the moment the phone locks
 * (iOS suspends video in a web view). A plain audio stream does not. So
 * for music the app asks THIS endpoint instead of framing the player:
 * yt-dlp finds the best audio-only rendition (AAC, which iPhones play),
 * and the server streams it through, honoring Range requests so seeking
 * and resuming work. The direct googlevideo URL is bound to the server's
 * own address, which is why the bytes pass through here rather than being
 * handed to the phone. Resolved URLs are remembered for a few hours. */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import type { FastifyReply, FastifyRequest } from "fastify";

const FORMAT = "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio";
const TTL_MS = 4 * 60 * 60 * 1000;
const cache = new Map<string, { url: string; at: number }>();
const inflight = new Map<string, Promise<string>>();

/** yt-dlp: the CLI when installed, else Python's module (pip install yt-dlp) */
function runner(): { cmd: string; pre: string[] } {
  const env = process.env["SG_YTDLP"];
  if (env) return { cmd: env, pre: [] };
  const py = [
    "C:\\Users\\jacer\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
    "python", "python3",
  ].find(p => !p.includes("\\") || existsSync(p));
  return { cmd: py ?? "python", pre: ["-m", "yt_dlp"] };
}

function resolve(id: string): Promise<string> {
  const had = cache.get(id);
  if (had && Date.now() - had.at < TTL_MS) return Promise.resolve(had.url);
  const going = inflight.get(id);
  if (going) return going;
  const p = new Promise<string>((ok, fail) => {
    const { cmd, pre } = runner();
    execFile(cmd, [...pre, "-f", FORMAT, "-g", "--no-playlist", "--no-warnings", "--quiet",
      `https://www.youtube.com/watch?v=${id}`],
      { timeout: 45_000, windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
        const url = String(stdout).split(/\r?\n/).map(s => s.trim()).find(s => s.startsWith("http"));
        if (err || !url) { fail(new Error(String(stderr || err?.message || "no stream").slice(0, 300))); return; }
        cache.set(id, { url, at: Date.now() });
        ok(url);
      });
  }).finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

/** resolve now, stream later: the app asks for the NEXT track while this
 * one plays, so the handoff at the end is instant */
export async function ytAudioReady(req: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const id = String((req.query as { v?: unknown })?.v ?? "");
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return reply.code(400).send({ error: "v: a YouTube id" });
  try { await resolve(id); return { ok: true }; }
  catch (e) { return reply.code(502).send({ ok: false, error: (e as Error).message }); }
}

export async function ytAudio(req: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const id = String((req.query as { v?: unknown })?.v ?? "");
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return reply.code(400).send({ error: "v: a YouTube id" });
  let url: string;
  try { url = await resolve(id); }
  catch (e) { return reply.code(502).send({ error: `no audio stream: ${(e as Error).message}` }); }
  const range = req.headers["range"];
  const headers: Record<string, string> = { "user-agent": "Mozilla/5.0" };
  if (typeof range === "string") headers["range"] = range;
  let up: Response;
  try { up = await fetch(url, { headers }); }
  catch (e) { return reply.code(502).send({ error: `upstream: ${(e as Error).message}` }); }
  if (up.status === 403 || up.status === 410) {
    // the remembered URL went stale: forget it and let the next try resolve afresh
    cache.delete(id);
    return reply.code(502).send({ error: "stream expired — try again" });
  }
  reply.code(up.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = up.headers.get(h);
    if (v) reply.header(h, v);
  }
  if (!up.headers.get("accept-ranges")) reply.header("accept-ranges", "bytes");
  reply.header("cache-control", "private, max-age=0");
  if (!up.body) return reply.send();
  return reply.send(Readable.fromWeb(up.body as import("node:stream/web").ReadableStream));
}
