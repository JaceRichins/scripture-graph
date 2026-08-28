/** Context assembly (§25-26): curated retrieval from the local vault — never
 * "send every backlink". Priorities: target text → study guide → related
 * notes → topical matches → (opt-in) personal annotations. */
import { TFile } from "obsidian";
import {
  chapterTitle as chapterTitleOf, extractWikilinks, findScriptureRefs,
  parseCanonicalVerses, parseFrontmatter, sectionIsEmpty, sections, trimContext,
  verseDisplay, type Annotation, type ContextItem,
} from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, LIBRARY_PREFIX, SGState } from "../state";

async function read(s: SGState, file: TFile): Promise<string> {
  return s.app.vault.cachedRead(file);
}

function fileByTitle(s: SGState, title: string): TFile | null {
  return s.app.metadataCache.getFirstLinkpathDest(title, "") ?? null;
}

async function chapterContext(s: SGState, chapterTitle: string, verseId: string | null,
  items: ContextItem[]): Promise<void> {
  const canonical = fileByTitle(s, chapterTitle);
  if (canonical && canonical.path.startsWith(CANONICAL_PREFIX)) {
    const { body } = parseFrontmatter(await read(s, canonical));
    const verses = parseCanonicalVerses(body);
    if (verseId) {
      const target = verses.find(v => v.verseId === verseId);
      const near = verses.filter(v => target && Math.abs(v.verse - target.verse) <= 3);
      if (target) {
        items.push({
          label: `Verse ${verseDisplay(verseId)}`, wikilink: chapterTitle,
          text: `${verseDisplay(verseId)}: ${target.text}`, priority: 0,
        });
        items.push({
          label: "Nearby verses", wikilink: chapterTitle,
          text: near.map(v => `${v.verse}. ${v.text}`).join("\n"), priority: 1,
        });
      }
    }
    items.push({
      label: `${chapterTitle} (full text)`, wikilink: chapterTitle,
      text: verses.map(v => `${v.verse}. ${v.text}`).join("\n"),
      priority: verseId ? 4 : 1,
    });
  }
  const guide = fileByTitle(s, `${chapterTitle} - Study Guide`);
  if (guide) {
    const { body } = parseFrontmatter(await read(s, guide));
    const secs = sections(body);
    const keep = ["overview", "structure", "doctrines", "related-scriptures", "topics",
      "language", "literary", "evidence", "conference", "history"];
    const text = keep
      .filter(k => !sectionIsEmpty(secs[k]))
      .map(k => `### ${k}\n${secs[k]}`).join("\n\n");
    if (text) {
      items.push({
        label: `${chapterTitle} Study Guide`, wikilink: `${chapterTitle} - Study Guide`,
        text, priority: 2,
      });
      // follow strongest related links (study guide is curated already)
      const links = extractWikilinks(secs["related-scriptures"] ?? "")
        .concat(extractWikilinks(secs["evidence"] ?? ""));
      const seen = new Set<string>();
      let n = 0;
      for (const l of links) {
        if (seen.has(l.target) || l.target === chapterTitle) continue;
        seen.add(l.target);
        if (++n > 6) break;
        const f = fileByTitle(s, l.target);
        if (!f || !f.path.startsWith(LIBRARY_PREFIX)) continue;
        const { body: rb } = parseFrontmatter(await read(s, f));
        const rSecs = sections(rb);
        const summary = rSecs["summary"] ?? rSecs["overview"] ?? rb.slice(0, 1500);
        items.push({
          label: l.target, wikilink: l.target,
          text: summary.slice(0, 2500), priority: 5,
        });
      }
    }
  }
}

async function personalContext(s: SGState, anchorPrefix: string, items: ContextItem[],
  annotations: Annotation[]): Promise<void> {
  const rel = annotations.filter(a =>
    a.anchor_id.startsWith(anchorPrefix) && a.content && !a.deleted_at);
  if (!rel.length) return;
  items.push({
    label: "My private notes (user-permitted)", wikilink: null,
    text: rel.map(a => `- [${verseDisplay(a.anchor_id) ?? a.anchor_id}] ${a.content}`).join("\n"),
    priority: 3,
  });
}

/** Lightweight vault-wide lexical retrieval for Ask-Vault (§26, §50). */
async function vaultSearch(s: SGState, question: string, items: ContextItem[]): Promise<void> {
  const refs = findScriptureRefs(question);
  for (const r of refs.slice(0, 3)) {
    const title = chapterTitleOf(r.bookSlug, r.chapter);
    if (title) await chapterContext(s, title, null, items);
  }
  const terms = question.toLowerCase().split(/[^a-z0-9']+/).filter(w => w.length > 3);
  if (!terms.length) return;
  const files = s.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(LIBRARY_PREFIX));
  // pass 1: title/alias hits (cheap, uses metadata cache only)
  const scored: { f: TFile; score: number }[] = [];
  for (const f of files) {
    const name = f.basename.toLowerCase();
    let score = 0;
    for (const t of terms) if (name.includes(t)) score += 3;
    const cache = s.app.metadataCache.getFileCache(f);
    const aliases = (cache?.frontmatter?.["aliases"] as string[] | undefined) ?? [];
    for (const a of aliases) for (const t of terms) {
      if (String(a).toLowerCase().includes(t)) score += 2;
    }
    if (score > 0) scored.push({ f, score });
  }
  scored.sort((a, b) => b.score - a.score);
  for (const { f } of scored.slice(0, 8)) {
    const { body } = parseFrontmatter(await read(s, f));
    const secs = sections(body);
    const text = Object.values(secs).filter(v => !sectionIsEmpty(v)).join("\n\n")
      || body.slice(0, 2000);
    items.push({ label: f.basename, wikilink: f.basename, text: text.slice(0, 3000), priority: 4 });
  }
}

export interface AssembledContext { items: ContextItem[]; systemPrompt: string }

export async function assembleContext(
  s: SGState, question: string,
  anchor: { chapterTitle: string | null; verseId: string | null } | null,
  personal: Annotation[],
): Promise<AssembledContext> {
  const items: ContextItem[] = [];
  if (anchor?.chapterTitle) {
    await chapterContext(s, anchor.chapterTitle, anchor.verseId, items);
  } else {
    await vaultSearch(s, question, items);
  }
  if (s.device.aiUsePersonalNotes && anchor?.chapterTitle) {
    const slug = anchor.verseId ? anchor.verseId.split("-").slice(0, 2).join("-") : null;
    if (slug) await personalContext(s, slug, items, personal);
  }
  const trimmed = trimContext(items, s.device.aiDepth);
  const systemPrompt =
    "You are Scripture Graph's study assistant. Answer FROM THE PROVIDED CONTEXT " +
    "first; say plainly when the context is insufficient rather than improvising. " +
    "Distinguish observation from interpretation from evidentiary significance. " +
    "Cite sources as Obsidian wikilinks exactly as given in the context labels, " +
    "e.g. [[Alma 36]] or [[Chiasmus in Alma 36]] — never invent note titles. " +
    "Be honest about evidence strength; never manufacture certainty.";
  return { items: trimmed, systemPrompt };
}

export function contextToMessages(ctx: AssembledContext, question: string) {
  const contextBlock = ctx.items
    .map(i => `--- ${i.label}${i.wikilink ? ` [[${i.wikilink}]]` : ""} ---\n${i.text}`)
    .join("\n\n");
  return [
    { role: "system" as const, content: ctx.systemPrompt },
    { role: "user" as const, content: `CONTEXT:\n\n${contextBlock}\n\nQUESTION: ${question}` },
  ];
}
