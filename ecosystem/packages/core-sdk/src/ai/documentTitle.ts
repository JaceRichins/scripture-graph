/** User-facing titles are independent of stable document paths and sharing IDs. */
export function validDocumentTitle(title: string): boolean {
  return title === title.trim() && title.length > 0 && title.length <= 150 && !/[\x00-\x1f\x7f<>\[\]#*_`\\]/.test(title);
}

export function savedDocumentTitle(markdown: string, fallback: string): string {
  const front = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const value = front?.match(/^sg_title: (.+)$/m)?.[1];
  try { const title: unknown = JSON.parse(value ?? 'null'); return typeof title === 'string' && validDocumentTitle(title) ? title : fallback; }
  catch { return fallback; }
}

/** Change only the display title and leading heading; retain lesson text, links and ownership. */
export function renameDocumentMarkdown(markdown: string, title: string): string {
  if (!validDocumentTitle(title)) throw new Error('Use a plain title between 1 and 150 characters.');
  const newline = markdown.includes('\r\n') ? '\r\n' : '\n';
  const front = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const fields = (front?.[1] ?? '').split(/\r?\n/).filter(line => !/^sg_title:/.test(line));
  if (!fields[0]) fields.shift();
  fields.push(`sg_title: ${JSON.stringify(title)}`);
  const body = markdown.slice(front?.[0].length ?? 0);
  const revised = /^\s*# [^\r\n]+/.test(body)
    ? body.replace(/^(\s*)# [^\r\n]+/, (_all, space: string) => `${space}# ${title}`)
    : `# ${title}${newline}${newline}${body}`;
  return `---${newline}${fields.join(newline)}${newline}---${newline}${revised}`;
}
