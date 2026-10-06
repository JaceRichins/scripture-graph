/** Bounded, deterministic title matching, shared by phone and server. */
export function searchNormalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '')
    .replace(/['’ʼ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const FILLER = new Set('a an the of to in on for and with about please find show me'.split(' '));
export function searchTerms(text: string): string[] {
  const words = searchNormalize(text.slice(0, 240)).split(' ').filter(Boolean);
  const meaningful = words.filter(w => !FILLER.has(w));
  return [...new Set(meaningful.length ? meaningful : words)].slice(0, 8);
}

/** Optimal string alignment includes adjacent transpositions (Smih t / Smith). */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [], prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(row[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j]!, prev2[j - 2]! + 1);
      }
    }
    prev2 = prev; prev = row;
  }
  return prev[b.length]!;
}

export interface TitleMatch { score: number; terms: string[]; corrected: boolean }

export function matchSearchTitle(title: string, query: string): TitleMatch | null {
  const norm = searchNormalize(title);
  const qnorm = searchNormalize(query);
  if (!norm || !qnorm) return null;
  const phrase = (` ${norm} `).includes(` ${qnorm} `);
  if (/^".*"$/.test(query.trim())) {
    return phrase ? { score: 600 - norm.length / 1000, terms: searchTerms(query), corrected: false } : null;
  }
  const words = norm.split(' ');
  const terms = searchTerms(query);
  const used = new Set<number>();
  const matched: string[] = [];
  let cost = 0, corrected = false, prior = -1, disorder = 0;
  for (let qi = 0; qi < terms.length; qi++) {
    const term = terms[qi]!;
    let best = -1, bestCost = Infinity;
    for (let wi = 0; wi < words.length; wi++) {
      if (used.has(wi)) continue;
      const word = words[wi]!;
      let c = Infinity;
      if (word === term) c = 0;
      else if (qi === terms.length - 1 && term.length >= 3 && term.length >= word.length / 2 && word.startsWith(term)) c = 0.3;
      else if (term.length >= 4 && word.length >= 4 && !/\d/.test(term + word)) {
        const max = term.length >= 7 ? 2 : 1;
        const d = distance(term, word, max);
        if (d <= max) c = d;
      }
      if (c < bestCost) { best = wi; bestCost = c; }
    }
    // Every meaningful query word must match. "king nonsense" isn't "king".
    if (best < 0) return null;
    used.add(best); matched.push(words[best]!); cost += bestCost;
    if (bestCost >= 1) corrected = true;
    if (best < prior) disorder++;
    prior = best;
  }
  const tier = phrase ? 600 : cost === 0 ? 500 : corrected ? 300 : 400;
  return { score: tier - cost * 20 - disorder * 2 - (words.length - terms.length) - norm.length / 1000,
    terms: matched, corrected };
}
