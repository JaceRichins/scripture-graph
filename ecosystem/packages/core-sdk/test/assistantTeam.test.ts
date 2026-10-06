import { describe, it, expect } from 'vitest';
import { approvedActions, personalDocumentPath, usesTeam, validPageTitle, validProjectFolder } from '../src/index';

describe('assistant teams and research projects', () => {
  it('limits research folders and page titles to plain names', () => {
    for (const ok of ['', 'Primary Sources', 'Primary Sources/Journals']) expect(validProjectFolder(ok)).toBe(true);
    for (const bad of ['A/B/C', '../Escape', 'A/', ' Lead', 'Trail.', 'x:y', '.hidden']) expect(validProjectFolder(bad)).toBe(false);
    expect(validPageTitle('Kirtland Temple — Visions (1836)')).toBe(true);
    for (const bad of ['a/b', 'a#b', '[x]', 'end.', '']) expect(validPageTitle(bad)).toBe(false);
  });

  it('approves a research project only with the report alone at the root and unique titles', () => {
    const page = (folder: string, title: string) => ({ folder, title, markdown: `# ${title}\n\nText [[Alma 36]].` });
    expect(approvedActions([{ do: 'research', title: 'Alma 36', pages: [page('', 'Report'), page('Evidence', 'Records')] }])).toHaveLength(1);
    expect(() => approvedActions([{ do: 'research', title: 'X', pages: [page('', 'Report'), page('', 'Loose')] }])).toThrow();
    expect(() => approvedActions([{ do: 'research', title: 'X', pages: [page('Evidence', 'Report')] }])).toThrow();
    expect(() => approvedActions([{ do: 'research', title: 'X', pages: [page('', 'Report'), page('Evidence', 'report')] }])).toThrow();
    expect(() => approvedActions([{ do: 'research', title: 'X', pages: [] }])).toThrow();
    expect(() => approvedActions([{ do: 'research', title: 'X', pages: [{ folder: '', title: 'Report', markdown: '<script>x</script>' }] }])).toThrow();
    expect(personalDocumentPath('Library/Research/Alma 36/Evidence/Records.md')).toBe(true);
    expect(approvedActions([{ do: 'edit_document', path: 'Library/Research/Alma 36/Alma 36.md', markdown: '# Alma 36' }])).toHaveLength(1);
  });

  it('uses a team for research and for creating lessons or study plans, never for chat', () => {
    expect(usesTeam('chat', 'Create a lesson', false)).toBe(false);
    expect(usesTeam('research', 'What is Kolob?', false)).toBe(true);
    expect(usesTeam('lesson', 'Prepare a youth lesson on repentance', false)).toBe(true);
    expect(usesTeam('lesson', 'Add a closing hymn', true)).toBe(false);
    expect(usesTeam('study-plan', 'Which book should I start with?', false)).toBe(false);
  });
});
