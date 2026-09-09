"""Family stories — indexed, graded, summarized for the ear, and narrated.

The FamilySearch pull leaves hundreds of "stories" beside the ancestors:
life sketches worth an evening, Find-a-Grave dumps nobody wants read aloud,
and a few book-length histories. This module turns them into a shelf the
app can serve one at a time:

  collect   every story with text, deduplicated (the same sketch is often
            attached to a husband, a wife and three children), cleaned,
            book-length ones split into chapters at paragraph breaks
  grade     Claude (the engine's own provider, on the family's plan) reads
            each story once and answers with a grade 1-5, its kind, themes,
            a hook, a 3-5 minute telling written to be listened to, a
            children's telling, and one "why it matters" line that ties it to
            scripture or Church history. Cached by content hash — a story is
            graded once, ever.
  index     Family Stories.md: one JSON block ranked by grade, plus a
            readable list; and a page per story under 12 Family/Stories/
            with the full text, the tellings, the people, and the audio
  narrate   Kokoro on the GPU reads the telling and the full story to MP3
            (chapters for the long ones), filed beside the family's photos

Nothing here needs FamilySearch: it works from the cache the pull leaves.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from scripturegraph.context import Ctx
from scripturegraph.family.familysearch import FOLDER, MEDIA, _cache_dir, _safe

STORIES = f"{FOLDER}/Stories"
CHAPTER_WORDS = 1400
MIN_WORDS = 60

THEMES = ["faith", "conversion", "mission", "pioneer", "crossing the plains", "temple", "priesthood", "war", "loss",
          "healing", "miracle", "courage", "family", "childhood", "marriage", "work", "immigration", "persecution",
          "service", "humor", "christmas", "death", "prayer", "scripture"]


@dataclass
class Story:
    sid: str                       # content hash
    title: str
    text: str
    words: int
    people: list[tuple[str, str]] = field(default_factory=list)   # (pid, name)
    chapters: list[str] = field(default_factory=list)


# ------------------------------------------------------------------ collect

def _clean(text: str) -> str:
    t = text.replace("\r", "")
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def _looks_binary(text: str) -> bool:
    head = text[:200]
    return "ftypisom" in head or head.lstrip().startswith("%PDF") or head.count("�") > 5


def _chapters(text: str) -> list[str]:
    """book-length text into chapters of ~CHAPTER_WORDS at paragraph breaks"""
    if len(text.split()) <= CHAPTER_WORDS * 1.5:
        return [text]
    out: list[str] = []
    cur: list[str] = []
    n = 0
    for para in text.split("\n\n"):
        w = len(para.split())
        if n + w > CHAPTER_WORDS and cur:
            out.append("\n\n".join(cur)); cur = []; n = 0
        cur.append(para); n += w
    if cur:
        out.append("\n\n".join(cur))
    return out


def collect(ctx: Ctx) -> list[Story]:
    by_hash: dict[str, Story] = {}
    for f in sorted(_cache_dir(ctx).glob("*.json")):
        if f.name == "roots.json":
            continue
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for m in d.get("memories", []):
            if m.get("kind") != "story" or not m.get("text") or _looks_binary(m["text"]):
                continue
            text = _clean(m["text"])
            words = len(text.split())
            if words < MIN_WORDS:
                continue
            # the same text attached to several relatives is one story
            sid = hashlib.sha256(re.sub(r"\W+", "", text.lower())[:6000].encode()).hexdigest()[:12]
            st = by_hash.get(sid)
            if not st:
                st = Story(sid=sid, title=re.sub(r"\s+", " ", (m.get("title") or "A family story")).strip() or "A family story",
                           text=text, words=words, chapters=_chapters(text))
                by_hash[sid] = st
            if all(p != d["pid"] for p, _ in st.people):
                st.people.append((d["pid"], d.get("name") or d["pid"]))
    return list(by_hash.values())


# -------------------------------------------------------------------- grade

GRADE_PROMPT = """You are helping a family listen to the stories of their ancestors. Read the story below and answer in JSON only (no prose, no code fence) with these keys:

- "grade": 1-5. 5 = a vivid, personal narrative worth an evening; 4 = a good life sketch with real moments; 3 = informative but flat; 2 = mostly dates, names and places; 1 = a record dump (census, Find a Grave, a table) with no story in it.
- "kind": one of "narrative", "sketch", "letter", "journal", "record", "other".
- "themes": up to 5 from this list: {themes}.
- "hook": one sentence, under 25 words, that makes someone want to hear it. Name the person.
- "telling": the story retold for LISTENING, 450-650 words, third person, warm and plain, in the order it happened, keeping the concrete moments and the person's own words where the source has them. Begin with who the person is (use the name; the app adds the relationship). No headings, no lists, no bracketed notes. If the story is only a record (grade 1-2), make the telling 80-120 words that say what the record tells us.
- "kids": the same story for children of about eight, 120-180 words, one clear moment, simple words, ending with one question a family could talk about.
- "why": one sentence, under 30 words, tying the story to a scripture or a moment in Church history when there is an honest tie; otherwise an empty string.
- "scripture": a single scripture reference for "why" in the form "Book Chapter:Verse" (e.g. "Alma 37:37", "D&C 136:2") when there is one; otherwise an empty string.

Person(s) this story is attached to: {people}
Title: {title}

STORY:
{text}
"""


def _grade_dir(ctx: Ctx) -> Path:
    d = _cache_dir(ctx) / "stories"
    d.mkdir(parents=True, exist_ok=True)
    return d


def grade(ctx: Ctx, stories: list[Story], log, limit: int | None = None, provider_name: str | None = None) -> dict:
    """Claude reads each ungraded story once; answers are cached by story id"""
    from scripturegraph.agents.providers import available_providers, get_provider
    gdir = _grade_dir(ctx)
    todo = [s for s in stories if not (gdir / f"{s.sid}.json").exists()]
    if limit:
        todo = todo[:limit]
    stats = {"graded": 0, "cached": len(stories) - len(todo), "failed": 0, "cost_usd": 0.0}
    if not todo:
        return stats
    provider = get_provider(ctx, provider_name) if provider_name else (available_providers(ctx) or [None])[0]
    if provider is None:
        log.warn("stories.no_provider")
        stats["failed"] = len(todo)
        return stats
    ws = ctx.state_dir / "family-stories-ws"
    ws.mkdir(parents=True, exist_ok=True)
    for st in todo:
        # the first chapter carries the grading for a long history; the telling covers the whole life
        text = st.text if st.words <= 6000 else " ".join(st.text.split()[:6000]) + "\n\n[…the history continues; grade and retell from what you have…]"
        prompt = GRADE_PROMPT.format(themes=", ".join(THEMES), people="; ".join(n for _, n in st.people), title=st.title, text=text)
        try:
            r = provider.run(prompt, role="librarian", timeout=240, workspace=ws, context={"job_id": f"story:{st.sid}"})
        except Exception as e:  # noqa: BLE001
            log.warn("stories.grade_failed", sid=st.sid, error=str(e)[:160]); stats["failed"] += 1; continue
        if not r.ok:
            log.warn("stories.grade_failed", sid=st.sid, error=(r.error or "")[:160]); stats["failed"] += 1; continue
        stats["cost_usd"] += r.cost_usd or 0.0
        m = re.search(r"\{[\s\S]*\}", r.text or "")
        try:
            obj = json.loads(m.group(0)) if m else None
        except ValueError:
            obj = None
        if not obj or "grade" not in obj:
            log.warn("stories.grade_unparsed", sid=st.sid, head=(r.text or "")[:80]); stats["failed"] += 1; continue
        obj["grade"] = max(1, min(5, int(obj.get("grade", 3))))
        obj["themes"] = [t for t in (obj.get("themes") or []) if isinstance(t, str)][:5]
        (gdir / f"{st.sid}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
        stats["graded"] += 1
        log.info("stories.graded", sid=st.sid, grade=obj["grade"], title=st.title[:50])
    return stats


def graded(ctx: Ctx, st: Story) -> dict | None:
    f = _grade_dir(ctx) / f"{st.sid}.json"
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


# -------------------------------------------------------------------- index

def _era(ctx: Ctx, pid: str) -> str | None:
    try:
        d = json.loads((_cache_dir(ctx) / f"{pid}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    for fc in d.get("facts", []):
        if str(fc.get("type", "")).split("/")[-1].replace("data:,", "") == "Birth":
            m = re.search(r"\d{4}", fc.get("date") or "")
            if m:
                return m.group(0)
    return None


def story_title(st: Story) -> str:
    flat = re.sub(r"\s+", " ", st.title).strip(" .-_")
    return f"{_safe(flat)[:70].strip()} ({st.sid})"


def write_index(ctx: Ctx, stories: list[Story], log) -> dict:
    from scripturegraph.vaultgen import md as mdkit
    from scripturegraph.vaultgen.generate import record_file
    from scripturegraph.util import now_iso
    from scripturegraph.family.familysearch import load_roots
    roots = load_roots(ctx)
    names = {pid: nm for info in roots.values() for pid, nm in info.get("names", {}).items()}
    rows = []
    pages = 0
    for st in stories:
        g = graded(ctx, st)
        grade_v = g["grade"] if g else 0
        people = [{"pid": p, "n": n, "b": _era(ctx, p)} for p, n in st.people]
        audio = {}
        for tag in ("telling", "kids", "full"):
            f = ctx.vault / MEDIA / "stories" / f"{st.sid}-{tag}.mp3"
            if f.exists():
                audio[tag] = f"{MEDIA}/stories/{f.name}"
        chap = [f"{MEDIA}/stories/{st.sid}-full-{i + 1}.mp3" for i in range(len(st.chapters))
                if (ctx.vault / MEDIA / "stories" / f"{st.sid}-full-{i + 1}.mp3").exists()]
        row = {"id": st.sid, "title": st.title, "words": st.words, "chapters": len(st.chapters), "people": people,
               "grade": grade_v, "kind": (g or {}).get("kind", ""), "themes": (g or {}).get("themes", []),
               "hook": (g or {}).get("hook", ""), "why": (g or {}).get("why", ""), "scripture": (g or {}).get("scripture", ""),
               "page": story_title(st), "audio": audio, "audioChapters": chap, "minutes": max(1, round(st.words / 150))}
        rows.append(row)
        # the story's own page
        lines = [f"# {st.title}", ""]
        who = ", ".join(f"[[{_safe(n)} ({p})|{n}]]" for p, n in st.people if p in names or True)
        lines += [f"_A story of {who}._", ""]
        if g:
            if g.get("hook"):
                lines += [f"> {g['hook']}", ""]
            if audio.get("telling") or audio.get("full") or chap:
                lines += ["## Listen", ""]
                if audio.get("telling"):
                    lines += [f"**The telling (5 min)** — ![[{audio['telling']}]]", ""]
                if audio.get("kids"):
                    lines += [f"**For children** — ![[{audio['kids']}]]", ""]
                if audio.get("full"):
                    lines += [f"**The whole story** — ![[{audio['full']}]]", ""]
                for i, c in enumerate(chap):
                    lines += [f"**Chapter {i + 1}** — ![[{c}]]", ""]
            if g.get("telling"):
                lines += ["## The telling", "", g["telling"].strip(), ""]
            if g.get("why"):
                ref = g.get("scripture") or ""
                lines += ["## Why it matters", "", g["why"].strip() + (f" — [[{ref.split(':')[0]}#^|{ref}]]" if ref else ""), ""]
            if g.get("kids"):
                lines += ["## For children", "", g["kids"].strip(), ""]
        lines += ["## The story as it was written", ""]
        if len(st.chapters) > 1:
            for i, c in enumerate(st.chapters):
                lines += [f"### Chapter {i + 1}", "", c.strip(), ""]
        else:
            lines += [st.text.strip(), ""]
        fm = {"ownership": "ai", "mutable": "engine", "content_type": "family-story", "sg-id": f"story:{st.sid}",
              "grade": grade_v, "words": st.words, "people": [p for p, _ in st.people], "updated_at": now_iso(), "cssclasses": ["sg-ai"]}
        if record_file(ctx, f"{STORIES}/{story_title(st)}.md", "family", "generator", None, mdkit.build_note(fm, "\n".join(lines))):
            pages += 1
    rows.sort(key=lambda r: (-r["grade"], -r["words"]))
    payload = {"count": len(rows), "graded": sum(1 for r in rows if r["grade"]), "stories": rows, "updated_at": now_iso()}
    lines = ["# Family Stories", "", "Every written story the family has kept on FamilySearch, the best ones first. "
             "The app reads this to choose a story a day.", ""]
    for r in rows:
        stars = "★" * r["grade"] + "☆" * (5 - r["grade"]) if r["grade"] else "not graded yet"
        lines.append(f"- {stars} [[{r['page']}|{r['title']}]] — {', '.join(p['n'] for p in r['people'])} · {r['minutes']} min")
    lines += ["", "```json", json.dumps(payload, ensure_ascii=False, separators=(",", ":")), "```", ""]
    record_file(ctx, f"{FOLDER}/Family Stories.md", "family", "generator", None,
                mdkit.build_note({"ownership": "ai", "mutable": "engine", "content_type": "family-stories", "cssclasses": ["sg-ai"]}, "\n".join(lines)))
    try:
        ctx.db().commit()
    except Exception:  # noqa: BLE001
        pass
    log.info("stories.indexed", stories=len(rows), graded=payload["graded"], pages=pages)
    return {"stories": len(rows), "graded": payload["graded"], "pages": pages}


# ------------------------------------------------------------------- narrate

def narrate(ctx: Ctx, stories: list[Story], log, voice: str = "af_heart", limit: int | None = None,
            min_grade: int = 3, full: bool = True) -> dict:
    """Kokoro reads the telling (and the whole story, in chapters) to MP3.
    Best stories first; a track already on disk is never re-read."""
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline
    out_dir = ctx.vault / MEDIA / "stories"
    out_dir.mkdir(parents=True, exist_ok=True)
    ranked = sorted([s for s in stories if (graded(ctx, s) or {}).get("grade", 0) >= min_grade],
                    key=lambda s: -(graded(ctx, s) or {}).get("grade", 0))
    if limit:
        ranked = ranked[:limit]
    pipe = KPipeline(lang_code="a")
    stats = {"tracks": 0, "skipped": 0, "seconds": 0.0}

    def render(text: str, path: Path) -> None:
        if path.exists():
            stats["skipped"] += 1
            return
        chunks: list[np.ndarray] = []
        for _gs, _ps, audio in pipe(text, voice=voice, speed=1.0, split_pattern=r"\n+"):
            chunks.append(np.asarray(audio, dtype=np.float32))
            chunks.append(np.zeros(int(24000 * 0.35), dtype=np.float32))     # a breath between paragraphs
        if not chunks:
            return
        wave = np.concatenate(chunks)
        tmp = path.with_suffix(".wav")
        sf.write(tmp, wave, 24000)
        _to_mp3(tmp, path)
        stats["tracks"] += 1
        stats["seconds"] += len(wave) / 24000

    for st in ranked:
        g = graded(ctx, st) or {}
        if g.get("telling"):
            render(g["telling"], out_dir / f"{st.sid}-telling.mp3")
        if g.get("kids"):
            render(g["kids"], out_dir / f"{st.sid}-kids.mp3")
        if full and g.get("grade", 0) >= 4:
            if len(st.chapters) > 1:
                for i, c in enumerate(st.chapters):
                    render(c, out_dir / f"{st.sid}-full-{i + 1}.mp3")
            else:
                render(st.text, out_dir / f"{st.sid}-full.mp3")
        log.info("stories.narrated", sid=st.sid, title=st.title[:50])
    return stats


def _to_mp3(wav: Path, mp3: Path) -> None:
    """ffmpeg (the static build pip carries) turns the WAV into a small MP3"""
    import subprocess
    ff = None
    try:
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001
        ff = "ffmpeg"
    subprocess.run([ff, "-v", "error", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", str(mp3)],
                   check=True, timeout=600)
    wav.unlink(missing_ok=True)


# --------------------------------------------------------------------- entry

def run(ctx: Ctx, log=None, grade_limit: int | None = None, narrate_limit: int | None = None, do_narrate: bool = True,
        voice: str = "af_heart") -> dict:
    log = log or ctx.log
    stories = collect(ctx)
    log.info("stories.collected", stories=len(stories), words=sum(s.words for s in stories))
    out: dict = {"collected": len(stories)}
    out["grade"] = grade(ctx, stories, log, limit=grade_limit)
    if do_narrate:
        try:
            out["narrate"] = narrate(ctx, stories, log, voice=voice, limit=narrate_limit)
        except Exception as e:  # noqa: BLE001
            log.warn("stories.narrate_failed", error=str(e)[:200])
            out["narrate"] = {"error": str(e)[:200]}
    out["index"] = write_index(ctx, stories, log)
    return out
