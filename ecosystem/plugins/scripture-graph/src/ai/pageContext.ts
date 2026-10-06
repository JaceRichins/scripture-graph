/** Resolve the document represented by a project folder without choosing a reference. */
export function projectDocument(folder: string, paths: string[]): string | null {
  if (!/^Library\/(Lessons|Study Plans|Research|AI Notes)\//.test(folder)) return null;
  const files = paths.filter(path => path.slice(0, path.lastIndexOf('/')) === folder && /\.md$/i.test(path));
  const exact = `${folder}/${folder.split('/').pop()}.md`;
  if (files.includes(exact)) return exact;
  const candidates = files.filter(path => !/^(Reference\b|Preparation\b)/i.test(path.split('/').pop()!) && !/preparation guide\.md$/i.test(path));
  return candidates.length === 1 ? candidates[0]! : null;
}
