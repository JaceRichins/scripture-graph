import { TFile } from "obsidian";
import { safeVaultLink } from '@scripture-graph/core-sdk';
import type { SGState } from "../state";
import type { AskHost } from "./actions";

const safeName = (name: string) => name.replace(/[<>:"/\\|?*#^\[\]]/g, "").trim().slice(0, 90).replace(/^\.+|\.+$/g, "") || "Lesson";
const personal = (kind: string, body: string) => `---\nownership: personal\nmutable: user\ncontent_type: ${kind}\n---\n\n${body.trim()}\n`;

/** One generated project, with first-level cited vault sources kept beside it. */
export async function saveLessonFiles(s: SGState, host: AskHost, documents: { title: string; markdown: string }[], kind: 'lesson' | 'study-plan' = 'lesson') {
  if (!documents.length || documents.some(doc => typeof doc.title !== "string" || typeof doc.markdown !== "string" || !doc.markdown.trim())) throw new Error("The assistant did not supply the document text.");
  const vault = s.app.vault;
  const parent = kind === 'study-plan' ? 'Library/Study Plans' : 'Library/Lessons';
  if (!vault.getAbstractFileByPath(parent)) await vault.createFolder(parent);
  const base = `${parent}/${safeName(documents[0]!.title)}`;
  let folder = base, suffix = 2;
  while (vault.getAbstractFileByPath(folder)) folder = `${base} (${suffix++})`;
  await vault.createFolder(folder);
  const resources = `${folder}/Resources`;
  await vault.createFolder(resources);
  const reserved = new Set<string>();
  const unique = (title: string, destination = resources) => {
    const name = safeName(title);
    let path = `${destination}/${name}.md`, n = 2;
    while (vault.getAbstractFileByPath(path) || reserved.has(path)) path = `${destination}/${name} (${n++}).md`;
    reserved.add(path);
    return path;
  };
  const created = documents.map((doc, order) => unique(doc.title, order === 0 ? folder : resources));
  const localPaths = new Map(documents.map((doc, order) => [doc.title, created[order]!]));
  const localTitles = new Set(documents.map(doc => doc.title));
  for (const [order, doc] of documents.entries()) {
    const path = created[order]!;
    const markdown = doc.markdown.replace(/\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
      (link, title: string, anchor: string | undefined, label: string | undefined) => localPaths.has(title) ? `[[${localPaths.get(title)}${anchor ?? ''}|${label ?? title}]]` : link);
    await vault.create(path, personal(kind, markdown).replace(`content_type: ${kind}\n`, `content_type: ${kind}\nlesson_order: ${order}\n`));
  }
  const references = new Set<string>();
  const external = new Set<string>();
  for (const doc of documents) {
    for (const match of doc.markdown.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) references.add(match[1]!.split("#")[0]!);
    for (const match of doc.markdown.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)) external.add(match[1]!);
  }
  const label = kind === 'study-plan' ? 'study plan' : 'lesson';
  const lines = ["# References", "", `[[${created[0]}|Back to the ${label}]]`, "", `Read these alongside your ${label}. Available vault sources are copied below; unavailable and external sources retain their links.`, ""];
  const copied = new Set<string>();
  for (const ref of references) {
    if (!ref || localTitles.has(ref)) continue;
    try {
      if (!safeVaultLink(ref)) throw new Error('Invalid reference');
      if (!(await host.ensure(ref))) throw new Error("not available on this device");
      const source = s.app.metadataCache.getFirstLinkpathDest(ref, "");
      if (!(source instanceof TFile)) throw new Error("not found");
      if (copied.has(source.path)) continue;
      const raw = await vault.cachedRead(source);
      const path = unique(`Reference - ${source.basename}`);
      await vault.create(path, personal("reference-copy", `# ${source.basename}\n\nOriginal: [[${source.path}|${source.basename}]]\n\n${raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")}`));
      copied.add(source.path);
      lines.push(`- [[${path}|${source.basename}]]`);
    } catch { lines.push(`- [[${ref}]] — could not copy this source; the original link is retained.`); }
  }
  for (const url of external) lines.push(`- [External source](${url})`);
  if (!references.size && !external.size) lines.push("No source links were supplied in the generated document.");
  await vault.create(unique("Reference index"), personal("references", lines.join("\n")));
  return { folder, documents: created, copied: copied.size };
}

/** A private research project: the report at the root, every other page in the folders its team chose. */
export async function saveResearchProject(s: SGState, project: { title: string; pages: { folder: string; title: string; markdown: string }[] }) {
  if (!project.pages.length || project.pages.some(page => typeof page.title !== 'string' || typeof page.markdown !== 'string' || !page.markdown.trim())) throw new Error('The assistant did not supply the research pages.');
  const vault = s.app.vault;
  const ensure = async (path: string) => {
    let current = '';
    for (const part of path.split('/')) {
      current = current ? `${current}/${part}` : part;
      if (!vault.getAbstractFileByPath(current)) await vault.createFolder(current);
    }
  };
  await ensure('Library/Research');
  const base = `Library/Research/${safeName(project.title)}`;
  let folder = base, suffix = 2;
  while (vault.getAbstractFileByPath(folder)) folder = `${base} (${suffix++})`;
  await vault.createFolder(folder);
  const reserved = new Set<string>();
  const paths = project.pages.map((page, order) => {
    const parts = order === 0 ? [] : page.folder.split('/').map(part => safeName(part)).filter(Boolean);
    const directory = [folder, ...(parts.length ? parts : ['Pages'])].join('/');
    const name = safeName(page.title);
    let path = `${directory}/${name}.md`, n = 2;
    while (reserved.has(path.toLowerCase())) path = `${directory}/${name} (${n++}).md`;
    reserved.add(path.toLowerCase());
    return path;
  });
  const byTitle = new Map(project.pages.map((page, order) => [page.title.toLowerCase(), paths[order]!]));
  const vaultSources = new Set<string>(), webSources = new Set<string>();
  for (const [order, page] of project.pages.entries()) {
    const path = paths[order]!;
    await ensure(path.slice(0, path.lastIndexOf('/')));
    const markdown = page.markdown.replace(/(?<!!)\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (link, title: string, anchor: string | undefined, label: string | undefined) => {
      const sibling = byTitle.get(title.trim().toLowerCase());
      if (sibling) return `[[${sibling}${anchor ?? ''}|${label ?? title}]]`;
      vaultSources.add(title.trim());
      return link;
    });
    for (const match of page.markdown.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)) webSources.add(match[1]!);
    await vault.create(path, personal(order === 0 ? 'research-report' : 'research-page', markdown).replace(/content_type: (research-\w+)\n/, `content_type: $1\nlesson_order: ${order}\n`));
  }
  const index = ['# Sources and links', '', `[[${paths[0]}|Back to the research report]]`, '',
    'Every source the research pages cite. Vault pages open from the library; web sources open in your browser.', '',
    '## Vault sources', ...(vaultSources.size ? [...vaultSources].sort().map(title => `- [[${title}]]`) : ['- None cited.']), '',
    '## Web sources', ...(webSources.size ? [...webSources].map(url => `- [${url.replace(/^https?:\/\//, '').slice(0, 90)}](${url})`) : ['- None cited.'])];
  await ensure(`${folder}/Sources`);
  await vault.create(`${folder}/Sources/Sources and links.md`, personal('references', index.join('\n')).replace('content_type: references\n', 'content_type: references\nlesson_order: 99\n'));
  return { folder, documents: paths };
}
