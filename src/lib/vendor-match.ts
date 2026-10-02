// Linking a bill's vendor name to a company or person on file (Oct 2, 2026:
// 146 of 203 imported bills had no link because "Baggett Brothers Contracting
// LLC" isn't exactly "Baggett Brothers"). Pure, tested in vendor-match.test.ts.

const SUFFIX = new Set(['llc', 'inc', 'incorporated', 'co', 'company', 'corp', 'corporation', 'ltd', 'pllc', 'lp', 'llp', 'pc', 'the']);

/** Words of a name, lowercase, punctuation and company endings removed ("Lowe's, Inc." → ["lowes"]). */
export function nameWords(name: string): string[] {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((w) => w && !SUFFIX.has(w));
}

export type Candidate = { id: string; name: string };
export type Match = { id: string; name: string; how: 'same name' | 'starts with' };

/**
 * The company a vendor name means: the same words, or the vendor's words start
 * with all of the company's ("Baggett Brothers Contracting" → Baggett Brothers;
 * "Duke Energy Deposit" → Duke Energy). The longest such company wins; two of
 * the same length, or a company name under 4 letters, is no match (a person decides).
 */
export function matchCompany(vendor: string, companies: Candidate[]): Match | null {
  const v = nameWords(vendor);
  if (!v.length) return null;
  let best: { c: Candidate; n: number; same: boolean }[] = [];
  for (const c of companies) {
    const w = nameWords(c.name);
    if (!w.length || w.join('').length < 4 || w.length > v.length) continue;
    if (!w.every((x, i) => v[i] === x)) continue;
    const n = w.length, same = n === v.length;
    if (!best.length || n > best[0].n) best = [{ c, n, same }];
    else if (n === best[0].n && best[0].c.id !== c.id) best.push({ c, n, same });
  }
  if (best.length !== 1) return null;
  return { id: best[0].c.id, name: best[0].c.name, how: best[0].same ? 'same name' : 'starts with' };
}

/** A person by the same first and last name (only when exactly one person has it). */
export function matchPerson(vendor: string, people: { id: string; firstName: string; lastName: string }[]): Match | null {
  const v = nameWords(vendor).join(' ');
  const hits = people.filter((p) => nameWords(`${p.firstName} ${p.lastName}`).join(' ') === v);
  return hits.length === 1 ? { id: hits[0].id, name: `${hits[0].firstName} ${hits[0].lastName}`, how: 'same name' } : null;
}
