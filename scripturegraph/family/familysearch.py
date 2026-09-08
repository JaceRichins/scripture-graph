"""FamilySearch, read with your own login.

FamilySearch does not hand API keys to families ("API access for individual
personal use will not be granted"), but its own website reads the tree and
the memories through the same service, authenticated by the session it gives
you when you sign in. So:

  1. `family login`  opens a real browser window on this machine. You sign
     in there like always (two-step code and all). The tool keeps ONLY the
     session id the site sets afterwards — never a password.
  2. `family pull`   walks your ancestors from your own record (up to 8
     generations per hop, chaining hops for deeper lines), reads each
     person's names, facts, sources and memories, and downloads every
     memory: photos, documents, stories, audio. One request a second,
     backing off on 429/503, resumable — everything is cached under
     .scripture-engine/cache/familysearch/ and only missing pieces are asked
     for again.
  3. `family build`  writes the Family shelf: one page per ancestor
     (living people skipped), media beside them, an index by generation.

Sessions expire after some hours; `pull` reopens the login window when it
finds the session dead. Nothing is ever written to FamilySearch.
"""
from __future__ import annotations

import html
import json
import mimetypes
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from scripturegraph.context import Ctx

SITE = "https://www.familysearch.org"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0"
FOLDER = "AI Library/12 Family"
MEDIA = f"{FOLDER}/_media"
PACE_S = 1.0


# ----------------------------------------------------------------- session

def _session_file(ctx: Ctx) -> Path:
    return ctx.state_dir / "familysearch-session.json"


def load_session(ctx: Ctx) -> str | None:
    try:
        d = json.loads(_session_file(ctx).read_text(encoding="utf-8"))
        return d.get("sid") or None
    except (OSError, ValueError):
        return None


def login(ctx: Ctx, wait_minutes: int = 60) -> str:
    """A visible browser at familysearch.org; returns the session id once the
    site has set it (i.e. once you have signed in). Only the id is kept."""
    from playwright.sync_api import sync_playwright
    profile = ctx.state_dir / "familysearch-profile"
    profile.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(str(profile), headless=False, viewport={"width": 1100, "height": 900},
                                                       args=["--disable-blink-features=AutomationControlled"])
        page = browser.pages[0] if browser.pages else browser.new_page()
        page.goto(f"{SITE}/auth/familysearch/login?returnUrl=%2Fen%2Ftree%2Fpedigree", wait_until="domcontentloaded")
        deadline = time.time() + wait_minutes * 60
        sid = None
        while time.time() < deadline:
            for c in browser.cookies():
                if c.get("name") == "fssessionid" and c.get("value"):
                    sid = c["value"]
            if sid and _probe(sid):
                break
            sid = None
            time.sleep(2)
        browser.close()
    if not sid:
        raise RuntimeError("no FamilySearch sign-in within the wait")
    _session_file(ctx).write_text(json.dumps({"sid": sid, "at": time.time()}), encoding="utf-8")
    return sid


def _probe(sid: str) -> bool:
    try:
        r = _raw(sid, "/platform/tree/current-person", accept="application/x-gedcomx-v1+json")
        return r is not None and r.status == 200
    except Exception:  # noqa: BLE001
        return False


# --------------------------------------------------------------------- http

class SessionDead(Exception):
    pass


def _raw(sid: str, path: str, accept: str = "application/x-gedcomx-v1+json", tries: int = 5):
    url = path if path.startswith("http") else f"{SITE}{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {sid}", "Cookie": f"fssessionid={sid}",
        "Accept": accept, "User-Agent": UA, "Referer": f"{SITE}/en/tree/",
    })
    delay = 3.0
    for attempt in range(tries):
        try:
            return urllib.request.urlopen(req, timeout=60)
        except urllib.error.HTTPError as e:
            if e.code in (401,):
                raise SessionDead(str(e.code))
            if e.code in (404, 410, 403, 204):
                return None
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                time.sleep(delay); delay = min(delay * 2, 60); continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < tries - 1:
                time.sleep(delay); delay = min(delay * 2, 60); continue
            raise
    return None


def get_json(sid: str, path: str, accept: str = "application/x-gedcomx-v1+json") -> dict | None:
    time.sleep(PACE_S)
    r = _raw(sid, path, accept)
    if r is None:
        return None
    data = r.read()
    if not data:
        return None
    try:
        return json.loads(data.decode("utf-8", errors="replace"))
    except ValueError:
        return None


def get_bytes(sid: str, url: str, accept: str = "*/*") -> tuple[bytes, str] | None:
    time.sleep(PACE_S)
    r = _raw(sid, url, accept)
    if r is None:
        return None
    return r.read(), (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()


# --------------------------------------------------------------------- walk

@dataclass
class Person:
    pid: str
    name: str
    gender: str
    living: bool
    facts: list[dict] = field(default_factory=list)
    ahnentafel: set[int] = field(default_factory=set)
    sources: list[dict] = field(default_factory=list)
    memories: list[dict] = field(default_factory=list)
    father: str | None = None
    mother: str | None = None


def _cache_dir(ctx: Ctx) -> Path:
    d = ctx.cache_dir / "familysearch"
    d.mkdir(parents=True, exist_ok=True)
    return d


def spouses_of(sid: str, pid: str) -> list[tuple[str, str]]:
    """(id, name) of each spouse — the other lines a family wants on the shelf"""
    d = get_json(sid, f"/platform/tree/persons/{pid}/spouses")
    out: list[tuple[str, str]] = []
    for p in (d or {}).get("persons", []) or []:
        if p.get("id") and p["id"] != pid:
            out.append((p["id"], ((p.get("display") or {}).get("name")) or p["id"]))
    return out


def _roots_file(ctx: Ctx) -> Path:
    return _cache_dir(ctx) / "roots.json"


def load_roots(ctx: Ctx) -> dict:
    try:
        return json.loads(_roots_file(ctx).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_root(ctx: Ctx, root: str, name: str, people: dict[str, "Person"]) -> None:
    """remember a line: which people hang from this root, at which numbers"""
    roots = load_roots(ctx)
    roots[root] = {"name": name, "numbers": {pid: sorted(pr.ahnentafel) for pid, pr in people.items()},
                   # names of everyone in the line, the living included: the tree
                   # needs them as nodes even though they get no page
                   "names": {pid: pr.name for pid, pr in people.items()},
                   "living": sorted(pid for pid, pr in people.items() if pr.living)}
    _roots_file(ctx).write_text(json.dumps(roots, ensure_ascii=False), encoding="utf-8")


def current_person(sid: str) -> str:
    r = _raw(sid, "/platform/tree/current-person")
    if r is None:
        raise RuntimeError("no current person")
    final = r.geturl()
    m = re.search(r"/persons/([A-Z0-9-]+)", final)
    if m:
        return m.group(1)
    body = json.loads(r.read().decode("utf-8", errors="replace"))
    return body["persons"][0]["id"]


def ancestry(sid: str, pid: str, generations: int = 8) -> list[dict]:
    d = get_json(sid, f"/platform/tree/ancestry?person={pid}&generations={min(8, max(1, generations))}")
    return (d or {}).get("persons", []) if d else []


def walk(ctx: Ctx, sid: str, root: str, generations: int, log) -> dict[str, Person]:
    """every ancestor within `generations` of root (chained 8-generation hops)"""
    people: dict[str, Person] = {}
    # ahnentafel numbering: root = 1, father of n = 2n, mother = 2n+1
    frontier: list[tuple[str, int, int]] = [(root, 1, 0)]      # pid, number, depth
    seen_hops: set[str] = set()
    while frontier:
        pid, number, depth = frontier.pop(0)
        if pid in seen_hops or depth >= generations:
            continue
        seen_hops.add(pid)
        hop = min(8, generations - depth)
        for p in ancestry(sid, pid, hop):
            disp = p.get("display", {}) or {}
            try:
                local = int(disp.get("ascendancyNumber", "0"))
            except ValueError:
                continue
            if local < 1:
                continue
            # local number relative to this hop's root → absolute
            absolute = number * (2 ** (local.bit_length() - 1)) + (local - (2 ** (local.bit_length() - 1)))
            gen = absolute.bit_length() - 1
            person = people.get(p["id"])
            if not person:
                person = Person(pid=p["id"], name=disp.get("name") or "Unknown", gender=disp.get("gender", ""),
                                living=bool(p.get("living")))
                people[p["id"]] = person
            person.ahnentafel.add(absolute)
            if gen >= depth + hop and gen < generations:
                frontier.append((p["id"], absolute, gen))
    # parents from the numbering
    by_number = {n: pr.pid for pr in people.values() for n in pr.ahnentafel}
    for pr in people.values():
        for n in pr.ahnentafel:
            pr.father = pr.father or by_number.get(2 * n)
            pr.mother = pr.mother or by_number.get(2 * n + 1)
    log.info("family.walk", people=len(people), living=sum(1 for p in people.values() if p.living))
    return people


def _ext_for(ctype: str, filename: str | None) -> str:
    if filename and "." in filename:
        return "." + filename.rsplit(".", 1)[1].lower()[:5]
    return mimetypes.guess_extension(ctype or "") or ".bin"


def pull(ctx: Ctx, sid: str, people: dict[str, Person], log, refresh: bool = False) -> dict:
    """details, sources and memories for everyone (not the living); cached per person"""
    cache = _cache_dir(ctx)
    media_root = ctx.vault / MEDIA
    stats = {"people": 0, "memories": 0, "downloaded": 0, "skipped_cached": 0}
    for pid, pr in people.items():
        if pr.living:
            continue
        f = cache / f"{pid}.json"
        if f.exists() and not refresh:
            d = json.loads(f.read_text(encoding="utf-8"))
            pr.facts, pr.sources, pr.memories = d.get("facts", []), d.get("sources", []), d.get("memories", [])
            pr.name = d.get("name") or pr.name
            stats["skipped_cached"] += 1
            continue
        detail = get_json(sid, f"/platform/tree/persons/{pid}")
        if detail:
            person = (detail.get("persons") or [{}])[0]
            names = person.get("names") or []
            if names:
                pref = next((n for n in names if n.get("preferred")), names[0])
                full = ((pref.get("nameForms") or [{}])[0]).get("fullText")
                if full:
                    pr.name = full
            pr.gender = (person.get("gender") or {}).get("type", pr.gender).split("/")[-1]
            pr.facts = [{"type": re.sub(r"^data:,", "", (fc.get("type") or "").split("/")[-1]).strip() or "Event",
                         "date": (fc.get("date") or {}).get("original"),
                         "place": (fc.get("place") or {}).get("original"),
                         "value": fc.get("value")} for fc in person.get("facts") or []]
        src = get_json(sid, f"/platform/tree/persons/{pid}/sources")
        pr.sources = []
        for sd in (src or {}).get("sourceDescriptions", []) or []:
            pr.sources.append({"title": ((sd.get("titles") or [{}])[0]).get("value", ""),
                               "about": sd.get("about", ""),
                               "citation": ((sd.get("citations") or [{}])[0]).get("value", ""),
                               "notes": [n.get("text", "") for n in sd.get("notes") or []]})
        pr.memories = []
        url = f"/platform/tree/persons/{pid}/memories?count=100"
        pdir = _originals_dir(ctx, pid)      # originals here; the vault gets phone-sized copies
        while url:
            page = get_json(sid, url)
            if not page:
                break
            for sd in page.get("sourceDescriptions", []) or []:
                links = sd.get("links") or {}
                mem = {"id": str(sd.get("id", "")), "title": ((sd.get("titles") or [{}])[0]).get("value", ""),
                       "description": ((sd.get("descriptions") or [{}])[0]).get("value", ""),
                       "kind": "", "file": None, "text": None}
                quals = [q.get("name", "") for a in sd.get("artifactMetadata") or [] for q in a.get("qualifiers") or []]
                fname = next((a.get("filename") for a in sd.get("artifactMetadata") or [] if a.get("filename")), None)
                mem["kind"] = "story" if any("Story" in q for q in quals) else "document" if any("Document" in q for q in quals) \
                    else "audio" if any("Audio" in q for q in quals) else "photo"
                stats["memories"] += 1
                pdir.mkdir(parents=True, exist_ok=True)
                # bytes: the image link for photos/documents, the artifact for the rest
                # the links point at the API host, which answers a website
                # session with 405; the same paths on the site itself do serve
                # the bytes — so every candidate is tried on both hosts
                hrefs: list[str] = []
                for rel in ("image", "memory-artifact", "artifact", "image-thumbnail"):
                    h = (links.get(rel) or {}).get("href")
                    if h and h not in hrefs:
                        hrefs.append(h)
                if sd.get("about") and sd["about"] not in hrefs:
                    hrefs.append(sd["about"])
                candidates: list[str] = []
                for h in hrefs:
                    for host in (SITE, None):
                        u = re.sub(r"^https?://[^/]+", host, h) if host else h
                        if u not in candidates:
                            candidates.append(u)
                if candidates:
                    existing = next(pdir.glob(f"{mem['id']}.*"), None)
                    if existing and not refresh:
                        mem["file"] = existing.name
                    else:
                        got = None
                        errs: list[str] = []
                        for u in candidates:
                            try:
                                got = get_bytes(sid, u, accept="*/*")
                            except SessionDead:
                                raise
                            except Exception as e:  # noqa: BLE001
                                errs.append(str(e)[:60]); got = None
                            if got and got[0]:
                                break
                            got = None
                        if not got:
                            log.warn("family.media_failed", pid=pid, mem=mem["id"], error=" | ".join(errs)[:160] or "empty")
                        if got:
                            data, ctype = got
                            if ctype.startswith("text/") or mem["kind"] == "story":
                                text = data.decode("utf-8", errors="replace")
                                if "html" in ctype:
                                    text = re.sub(r"<[^>]+>", " ", text)
                                mem["text"] = html.unescape(re.sub(r"\s+\n", "\n", text)).strip()
                                mem["kind"] = "story"
                                (pdir / f"{mem['id']}.txt").write_text(mem["text"], encoding="utf-8")
                                mem["file"] = f"{mem['id']}.txt"
                            else:
                                ext = _ext_for(ctype, fname)
                                orig = pdir / f"{mem['id']}{ext}"
                                orig.write_bytes(data)
                                mem["file"] = publish(ctx, pid, orig) or orig.name
                            stats["downloaded"] += 1
                if mem["kind"] == "story" and mem["file"] and mem["file"].endswith(".txt") and mem["text"] is None:
                    mem["text"] = (pdir / mem["file"]).read_text(encoding="utf-8", errors="replace")
                pr.memories.append(mem)
            nxt = ((page.get("links") or {}).get("next") or {}).get("href")
            url = nxt if nxt and nxt != url else None
        f.write_text(json.dumps({"pid": pid, "name": pr.name, "gender": pr.gender, "facts": pr.facts,
                                 "sources": pr.sources, "memories": pr.memories}, ensure_ascii=False, indent=1), encoding="utf-8")
        stats["people"] += 1
        log.info("family.person", pid=pid, name=pr.name, memories=len(pr.memories))
    return stats


# -------------------------------------------------------------------- media

MAX_EDGE = 1600
JPEG_Q = 82
ORIGINALS_KEEP = {".pdf", ".mp3", ".m4a", ".wav", ".txt"}


def _originals_dir(ctx: Ctx, pid: str) -> Path:
    d = _cache_dir(ctx) / "media" / pid
    d.mkdir(parents=True, exist_ok=True)
    return d


def publish(ctx: Ctx, pid: str, original: Path) -> str | None:
    """the vault's copy of one memory file: images shrunk to phone size as
    JPEG, documents and sound as they are. Returns the vault filename."""
    vdir = ctx.vault / MEDIA / pid
    vdir.mkdir(parents=True, exist_ok=True)
    ext = original.suffix.lower()
    if ext in ORIGINALS_KEEP:
        out = vdir / original.name
        if not out.exists() or out.stat().st_size != original.stat().st_size:
            out.write_bytes(original.read_bytes())
        return out.name
    try:
        from PIL import Image, ImageOps
        with Image.open(original) as im:
            im = ImageOps.exif_transpose(im)
            if im.mode not in ("RGB", "L"):
                im = im.convert("RGB")
            im.thumbnail((MAX_EDGE, MAX_EDGE))
            out = vdir / f"{original.stem}.jpg"
            im.save(out, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
            return out.name
    except Exception:  # noqa: BLE001 — not an image after all: keep it whole
        out = vdir / original.name
        if not out.exists():
            out.write_bytes(original.read_bytes())
        return out.name


def shrink_media(ctx: Ctx, log) -> int:
    """originals that landed in the vault (earlier runs) move to the cache
    and leave a phone-sized copy behind"""
    root = ctx.vault / MEDIA
    if not root.exists():
        return 0
    n = 0
    for pdir in root.iterdir():
        if not pdir.is_dir():
            continue
        odir = _originals_dir(ctx, pdir.name)
        for f in list(pdir.iterdir()):
            if not f.is_file() or f.suffix.lower() in ORIGINALS_KEEP:
                continue
            orig = odir / f.name
            if orig.exists():
                continue                  # already published from the cache
            orig.write_bytes(f.read_bytes())
            f.unlink()
            publish(ctx, pdir.name, orig)
            n += 1
    if n:
        log.info("family.media_shrunk", files=n)
    return n


# -------------------------------------------------------------------- pages

def _safe(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|#^\[\]]+', " ", name).strip() or "Unknown"


def _label(t: str) -> str:
    """'data:,Baptism' and 'http://gedcomx.org/Birth' both read as their last word"""
    return re.sub(r"^data:,", "", (t or "").split("/")[-1]).strip() or "Event"


def _fact(pr: Person, kind: str) -> str:
    for fc in pr.facts:
        if _label(fc["type"]) == kind:
            return " · ".join(x for x in [fc.get("date"), fc.get("place")] if x)
    return ""


def people_from_cache(ctx: Ctx) -> tuple[dict[str, Person], dict[str, dict]]:
    """every line pulled so far, from the cache: people (with facts, sources,
    memories) and the roots that own them"""
    roots = load_roots(ctx)
    people: dict[str, Person] = {}
    for root, info in roots.items():
        for pid, nums in info.get("numbers", {}).items():
            pr = people.get(pid)
            if not pr:
                f = _cache_dir(ctx) / f"{pid}.json"
                if not f.exists():
                    continue                      # not pulled yet (or living)
                d = json.loads(f.read_text(encoding="utf-8"))
                pr = Person(pid=pid, name=d.get("name") or pid, gender=d.get("gender", ""), living=False,
                            facts=d.get("facts", []), sources=d.get("sources", []), memories=d.get("memories", []))
                people[pid] = pr
            pr.ahnentafel.update(nums)
    # parents, within each line's numbering
    for root, info in roots.items():
        by_number = {n: pid for pid, nums in info.get("numbers", {}).items() for n in nums}
        for pid, nums in info.get("numbers", {}).items():
            pr = people.get(pid)
            if not pr:
                continue
            for n in nums:
                pr.father = pr.father or by_number.get(2 * n)
                pr.mother = pr.mother or by_number.get(2 * n + 1)
    return people, roots


def _gen_label(gen: int) -> str:
    return {1: "parents", 2: "grandparents", 3: "great-grandparents"}.get(gen, f"{gen - 2}\u00d7 great-grandparents")


def build(ctx: Ctx, log) -> int:
    """the shelf: one page per ancestor across every line pulled, an index by line"""
    from scripturegraph.vaultgen import md as mdkit
    from scripturegraph.vaultgen.generate import record_file
    from scripturegraph.util import now_iso
    people, roots = people_from_cache(ctx)
    shown = people
    title_of = {pid: f"{_safe(pr.name)} ({pid})" for pid, pr in shown.items()}
    children: dict[str, list[str]] = {}
    for pid, pr in shown.items():
        for parent in (pr.father, pr.mother):
            if parent and parent in shown and pid not in children.setdefault(parent, []):
                children[parent].append(pid)
    # which line(s) a person belongs to, and how far up
    lines_of: dict[str, list[tuple[str, int]]] = {}
    for root, info in roots.items():
        for pid, nums in info.get("numbers", {}).items():
            if pid in shown and nums:
                lines_of.setdefault(pid, []).append((info.get("name", root), min(n.bit_length() - 1 for n in nums)))
    mentions = _mentions(ctx, {pid: pr.name for pid, pr in shown.items()})
    n = 0
    for pid, pr in shown.items():
        birth, death = _fact(pr, "Birth"), _fact(pr, "Death")
        lines = [f"# {pr.name}", ""]
        meta = [x for x in [f"Born {birth}" if birth else "", f"Died {death}" if death else ""] if x]
        for who, gen in lines_of.get(pid, []):
            meta.append(f"{who}'s {_gen_label(gen)}" if gen else who)
        if meta:
            lines += [" \u00b7 ".join(meta), ""]
        rel = []
        if pr.father and pr.father in title_of:
            rel.append(f"Father: [[{title_of[pr.father]}|{shown[pr.father].name}]]")
        if pr.mother and pr.mother in title_of:
            rel.append(f"Mother: [[{title_of[pr.mother]}|{shown[pr.mother].name}]]")
        kids = [f"[[{title_of[c]}|{shown[c].name}]]" for c in children.get(pid, [])]
        if kids:
            rel.append("Children in this line: " + ", ".join(kids))
        if rel:
            lines += ["## Family", *[f"- {r}" for r in rel], ""]
        events = [fc for fc in pr.facts if fc.get("date") or fc.get("place")]
        if events:
            lines += ["## Life", *[f"- **{_label(fc['type'])}**: " + " \u00b7 ".join(x for x in [fc.get('date'), fc.get('place'), fc.get('value')] if x)
                                   for fc in events], ""]
        stories = [m for m in pr.memories if m["kind"] == "story"]
        media = [m for m in pr.memories if m["kind"] != "story" and m.get("file")]
        if stories:
            lines += ["## Stories", ""]
            for m in stories:
                lines += [f"### {m['title'] or 'Story'}", ""]
                if m.get("text"):
                    lines += [m["text"].strip(), ""]
                elif m.get("file"):
                    lines += [f"![[{MEDIA}/{pid}/{m['file']}]]", ""]
                else:
                    lines += [f"_Kept on FamilySearch: [open the story]({SITE}/memories/memory/{m['id']})_", ""]
        if media:
            lines += ["## Photos & documents", ""]
            vdir = ctx.vault / MEDIA / pid
            for m in media:
                cap = m["title"] or m["description"] or m["kind"]
                fname = m["file"]
                # an original that was shrunk carries a new extension in the vault
                if not (vdir / fname).exists() and (vdir / f"{Path(fname).stem}.jpg").exists():
                    fname = f"{Path(fname).stem}.jpg"
                lines += [f"![[{MEDIA}/{pid}/{fname}|{cap}]]", (f"_{m['description']}_" if m["description"] and m["title"] else ""), ""]
        if pr.sources:
            lines += ["## Sources", *[f"- [{s['title'] or 'Record'}]({s['about']})" if s.get("about") else f"- {s['title'] or 'Record'}"
                                      for s in pr.sources], ""]
        if mentions.get(pid):
            lines += ["## In the library", *[f"- [[{m}]]" for m in mentions[pid][:12]], ""]
        lines += ["", f"[FamilySearch record]({SITE}/tree/person/details/{pid})", ""]
        gen = min((g for _, g in lines_of.get(pid, [])), default=0)
        fm = {"ownership": "ai", "mutable": "engine", "content_type": "ancestor", "sg-id": f"fs:{pid}",
              "fs_id": pid, "generation": gen, "born": birth or None, "died": death or None,
              "updated_at": now_iso(), "cssclasses": ["sg-ai"]}
        fm = {k: v for k, v in fm.items() if v is not None}
        if record_file(ctx, f"{FOLDER}/{title_of[pid]}.md", "family", "generator", None, mdkit.build_note(fm, "\n".join(lines))):
            n += 1
    write_tree(ctx, shown, roots, title_of, log)
    # the shelf's index: each line, by generation
    lines = ["# Family", "", "Our ancestors, from FamilySearch \u2014 their lives, their records, and the stories and pictures the family has kept there.", ""]
    for root, info in roots.items():
        by_gen: dict[int, list[str]] = {}
        for pid, nums in info.get("numbers", {}).items():
            if pid in shown and nums:
                by_gen.setdefault(min(n.bit_length() - 1 for n in nums), []).append(pid)
        if not by_gen:
            continue
        lines += [f"## {info.get('name', root)}'s line", ""]
        for gen in sorted(by_gen):
            label = _gen_label(gen).capitalize() if gen else "Self"
            lines += [f"### {label}", *[f"- [[{title_of[p]}|{shown[p].name}]]" for p in sorted(by_gen[gen], key=lambda x: min(shown[x].ahnentafel))], ""]
    record_file(ctx, f"{FOLDER}/Family.md", "family", "generator", None,
                mdkit.build_note({"ownership": "ai", "mutable": "engine", "content_type": "index", "cssclasses": ["sg-ai"]}, "\n".join(lines)))
    try:
        ctx.db().commit()
    except Exception:  # noqa: BLE001
        pass
    log.info("family.built", pages=n, people=len(shown), lines=len(roots))
    return n


THUMB_EDGE = 220


def write_tree(ctx: Ctx, shown: dict[str, Person], roots: dict, title_of: dict[str, str], log) -> None:
    """Family Tree.md: one small JSON block the app draws the pedigree from —
    every person as a node (the living by name only), parents by id, years,
    the page title, and a thumbnail (its own small file) when there is a
    photo. Thumbnails are tiny, so a phone can show the tree without the
    photos themselves."""
    from scripturegraph.vaultgen import md as mdkit
    from scripturegraph.vaultgen.generate import record_file
    nodes: dict[str, dict] = {}
    # parents within each line's numbering, the living included
    for root, info in roots.items():
        numbers = info.get("numbers", {})
        names = info.get("names", {})
        living = set(info.get("living", []))
        by_number = {n: pid for pid, nums in numbers.items() for n in nums}
        for pid, nums in numbers.items():
            node = nodes.setdefault(pid, {"n": names.get(pid) or (shown[pid].name if pid in shown else pid)})
            if pid in living:
                node["living"] = True
            for n in nums:
                if by_number.get(2 * n) and "f" not in node:
                    node["f"] = by_number[2 * n]
                if by_number.get(2 * n + 1) and "m" not in node:
                    node["m"] = by_number[2 * n + 1]
    for pid, pr in shown.items():
        node = nodes.setdefault(pid, {"n": pr.name})
        node["n"] = pr.name
        b, d = _fact(pr, "Birth"), _fact(pr, "Death")
        yb = re.search(r"\d{4}", b or "")
        yd = re.search(r"\d{4}", d or "")
        if yb:
            node["b"] = yb.group(0)
        if yd:
            node["d"] = yd.group(0)
        node["page"] = title_of[pid]
        photo = next((m for m in pr.memories if m["kind"] == "photo" and m.get("file")), None)
        if photo:
            thumb = _thumbnail(ctx, pid, photo["file"])
            if thumb:
                node["t"] = thumb
    payload = {"roots": [{"pid": r, "name": info.get("name", r)} for r, info in roots.items()], "people": nodes}
    body = "\n".join(["# Family Tree", "", "The pedigree the app draws: every ancestor pulled so far, by line. "
                      "Open the Family shelf in the app to see it.", "",
                      "```json", json.dumps(payload, ensure_ascii=False, separators=(",", ":")), "```", ""])
    record_file(ctx, f"{FOLDER}/Family Tree.md", "family", "generator", None,
                mdkit.build_note({"ownership": "ai", "mutable": "engine", "content_type": "family-tree", "cssclasses": ["sg-ai"]}, body))
    log.info("family.tree", nodes=len(nodes))


def _thumbnail(ctx: Ctx, pid: str, vault_file: str) -> str | None:
    """_media/<pid>/thumb.jpg from the vault copy (or the original), ~10 KB"""
    vdir = ctx.vault / MEDIA / pid
    out = vdir / "thumb.jpg"
    if out.exists():
        return "thumb.jpg"
    src = vdir / vault_file
    if not src.exists():
        src = next((_originals_dir(ctx, pid) / vault_file).parent.glob(Path(vault_file).stem + ".*"), None)
        if not src or not src.exists():
            return None
    try:
        from PIL import Image, ImageOps
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((THUMB_EDGE, THUMB_EDGE))
            vdir.mkdir(parents=True, exist_ok=True)
            im.save(out, "JPEG", quality=78, optimize=True)
        return "thumb.jpg"
    except Exception:  # noqa: BLE001
        return None


def _mentions(ctx: Ctx, names: dict[str, str]) -> dict[str, list[str]]:
    """library pages (history, findings, periodicals…) that carry an ancestor's full name"""
    out: dict[str, list[str]] = {}
    lib = ctx.vault / "AI Library"
    skip = ("AI Library/00 System/", "AI Library/01 Scriptures/", f"{FOLDER}/")
    needles = {pid: nm for pid, nm in names.items() if len(nm.split()) >= 2}
    if not needles:
        return out
    for p in lib.rglob("*.md"):
        rel = p.relative_to(ctx.vault).as_posix()
        if rel.startswith(skip):
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for pid, nm in needles.items():
            if nm in text:
                out.setdefault(pid, []).append(p.stem)
    return out


# --------------------------------------------------------------------- entry

def run(ctx: Ctx, generations: int = 8, person: str | None = None, refresh: bool = False, log=None,
        spouse: bool = False) -> dict:
    """sign in if needed, walk each line, pull what is missing, build the shelf"""
    log = log or ctx.log
    sid = load_session(ctx)
    if not sid or not _probe(sid):
        log.info("family.login_needed")
        sid = login(ctx)
    for attempt in range(2):
        try:
            me = person or current_person(sid)
            roots: list[tuple[str, str]] = [(me, ((get_json(sid, f"/platform/tree/persons/{me}") or {}).get("persons") or [{}])[0]
                                             .get("display", {}).get("name") or me)]
            if spouse:
                roots += spouses_of(sid, me)
            stats = {"lines": 0, "people": 0, "downloaded": 0, "memories": 0, "skipped_cached": 0}
            for root, name in roots:
                people = walk(ctx, sid, root, generations, log)
                save_root(ctx, root, name, people)
                st = pull(ctx, sid, people, log, refresh=refresh)
                for k in ("people", "downloaded", "memories", "skipped_cached"):
                    stats[k] += st.get(k, 0)
                stats["lines"] += 1
            break
        except SessionDead:
            if attempt:
                raise
            log.info("family.session_expired")
            sid = login(ctx)
    stats["shrunk"] = shrink_media(ctx, log)
    stats["pages"] = build(ctx, log)
    return stats
