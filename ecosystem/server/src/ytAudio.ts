/** /yt/audio?v=<id> — the sound of a YouTube video as a plain audio file.
 *
 * A YouTube player embedded in the app stops the moment the phone locks
 * (iOS suspends video in a web view). A plain audio stream does not. So
 * for music the app asks THIS endpoint instead of framing the player.
 *
 * YouTube's audio-only rendition is a fragmented DASH file (dozens of
 * moof/mdat pieces behind a sidx index). iPhones play it, but misjudge its
 * length — a 4½-minute song shows as nine, and the last half is silence
 * before the next song starts. So the server downloads it once with yt-dlp,
 * remuxes it with ffmpeg into an ordinary MP4 (no re-encode, header up
 * front, correct duration), keeps the file, and serves it with byte ranges
 * so seeking and resuming work. /yt/audio/ready?v= does the preparing
 * without streaming, which the app calls for the NEXT song while this one
 * plays. The cache is capped; the oldest files go first. */
import { execFile } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";

const FORMAT = "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio";
const CACHE_DIR = process.env["SG_YTCACHE"] ?? join(process.cwd(), "data", "ytcache");
const CACHE_CAP = Number(process.env["SG_YTCACHE_MB"] ?? 2048) * 1024 * 1024;
const inflight = new Map<string, Promise<string>>();

const PY = ["C:\\Users\\jacer\\AppData\\Local\\Programs\\Python\\Python312\\python.exe", "python", "python3"]
  .find(p => !p.includes("\\") || existsSync(p)) ?? "python";

/** yt-dlp: the CLI when installed, else Python's module (pip install yt-dlp) */
function ytdlp(): { cmd: string; pre: string[] } {
  const env = process.env["SG_YTDLP"];
  return env ? { cmd: env, pre: [] } : { cmd: PY, pre: ["-m", "yt_dlp"] };
}

let ffmpegPath: string | null | undefined;
/** ffmpeg: SG_FFMPEG, one on PATH, or the static build pip's imageio-ffmpeg carries */
async function ffmpeg(): Promise<string | null> {
  if (ffmpegPath !== undefined) return ffmpegPath;
  const env = process.env["SG_FFMPEG"];
  if (env) return (ffmpegPath = env);
  const fromPip = await new Promise<string | null>(ok => {
    execFile(PY, ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { timeout: 20_000, windowsHide: true },
      (err, out) => ok(err ? null : String(out).trim() || null));
  });
  if (fromPip && existsSync(fromPip)) return (ffmpegPath = fromPip);
  const onPath = await new Promise<boolean>(ok => execFile("ffmpeg", ["-version"], { timeout: 10_000, windowsHide: true }, err => ok(!err)));
  return (ffmpegPath = onPath ? "ffmpeg" : null);
}

function run(cmd: string, args: string[], timeout: number): Promise<void> {
  return new Promise((ok, fail) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 1 << 22 }, (err, _out, stderr) => {
      if (err) fail(new Error(String(stderr || err.message).split(/\r?\n/).filter(Boolean).slice(-3).join(" | ").slice(0, 400)));
      else ok();
    });
  });
}

function cachedPath(id: string): string { return join(CACHE_DIR, `${id}.m4a`); }

/** the finished file for a video: from the cache, or made now */
export function prepare(id: string): Promise<string> {
  const file = cachedPath(id);
  if (existsSync(file)) return Promise.resolve(file);
  const going = inflight.get(id);
  if (going) return going;
  const p = (async () => {
    mkdirSync(CACHE_DIR, { recursive: true });
    const raw = join(CACHE_DIR, `${id}.dash`);
    const tmp = join(CACHE_DIR, `${id}.tmp.m4a`);
    for (const f of [raw, tmp]) if (existsSync(f)) unlinkSync(f);
    const y = ytdlp();
    await run(y.cmd, [...y.pre, "-f", FORMAT, "--no-playlist", "--no-warnings", "-q", "-o", raw,
      `https://www.youtube.com/watch?v=${id}`], 120_000);
    const ff = await ffmpeg();
    if (!ff) { renameSync(raw, file); return file; }      // no ffmpeg: the DASH file, better than nothing
    try {
      await run(ff, ["-v", "error", "-y", "-i", raw, "-vn", "-c:a", "copy", "-movflags", "+faststart", "-f", "mp4", tmp], 120_000);
    } catch {
      // not AAC (an opus fallback): encode it, once
      await run(ff, ["-v", "error", "-y", "-i", raw, "-vn", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-f", "mp4", tmp], 300_000);
    }
    unlinkSync(raw);
    renameSync(tmp, file);
    trim();
    return file;
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

/** keep the cache under its cap: oldest files out first */
function trim(): void {
  try {
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith(".m4a") && !f.endsWith(".tmp.m4a"))
      .map(f => { const p = join(CACHE_DIR, f); const st = statSync(p); return { p, size: st.size, at: st.mtimeMs }; })
      .sort((a, b) => a.at - b.at);
    let total = files.reduce((n, f) => n + f.size, 0);
    for (const f of files) { if (total <= CACHE_CAP) break; try { unlinkSync(f.p); total -= f.size; } catch { /* busy */ } }
  } catch { /* nothing to trim */ }
}

function idOf(req: FastifyRequest): string | null {
  const id = String((req.query as { v?: unknown })?.v ?? "");
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** resolve now, stream later: the app asks for the NEXT track while this one plays */
export async function ytAudioReady(req: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const id = idOf(req);
  if (!id) return reply.code(400).send({ error: "v: a YouTube id" });
  try { await prepare(id); return { ok: true }; }
  catch (e) { return reply.code(502).send({ ok: false, error: (e as Error).message }); }
}

export async function ytAudio(req: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const id = idOf(req);
  if (!id) return reply.code(400).send({ error: "v: a YouTube id" });
  let file: string;
  try { file = await prepare(id); }
  catch (e) { return reply.code(502).send({ error: `no audio: ${(e as Error).message}` }); }
  const size = statSync(file).size;
  reply.header("content-type", "audio/mp4");
  reply.header("accept-ranges", "bytes");
  reply.header("cache-control", "private, max-age=86400");
  const range = req.headers["range"];
  const m = typeof range === "string" ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    if (start >= size) { reply.code(416).header("content-range", `bytes */${size}`); return reply.send(); }
    end = Math.min(end, size - 1); start = Math.max(0, start);
    reply.code(206);
    reply.header("content-range", `bytes ${start}-${end}/${size}`);
    reply.header("content-length", String(end - start + 1));
    return reply.send(createReadStream(file, { start, end }));
  }
  reply.header("content-length", String(size));
  return reply.send(createReadStream(file));
}
