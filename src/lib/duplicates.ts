// Possible duplicates by a similar name (owner, Oct 2, 2026: "check for
// duplicates as well with like names"): nicknames, one-letter typos, accents,
// "Inc." / "LLC", "&" vs "and", and a company with or without its last words
// ("Baggett" and "Baggett Construction"). Pure, tested in duplicates.test.ts.

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const letters = (s: string) => fold(s).replace(/[^a-z0-9]/g, '');

/** Edit distance (a swap of two letters next to each other counts as one), stopping once it's over `max`. */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let pp: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    pp = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos a word this long may have and still look alike. */
const allowed = (s: string) => (s.length >= 8 ? 2 : s.length >= 4 ? 1 : 0);
const digits = (s: string) => s.replace(/\D/g, '');
// Numbers must agree ("Unit 12" isn't "Unit 13"); letters may be a typo or two apart.
const close = (a: string, b: string) => a === b || (digits(a) === digits(b) && distance(a, b, 2) <= Math.min(allowed(a), allowed(b)));

const NICKNAMES: string[][] = [
  ['robert', 'rob', 'bob', 'bobby', 'robbie'], ['william', 'will', 'bill', 'billy', 'willie', 'liam'], ['james', 'jim', 'jimmy', 'jamie'],
  ['michael', 'mike', 'mikey', 'mick'], ['christopher', 'chris', 'kit'], ['christina', 'christine', 'chris', 'tina'], ['matthew', 'matt'],
  ['thomas', 'tom', 'tommy'], ['daniel', 'dan', 'danny'], ['david', 'dave', 'davey'], ['joseph', 'joe', 'joey'], ['steven', 'stephen', 'steve'],
  ['richard', 'rick', 'ricky', 'rich', 'dick'], ['anthony', 'tony'], ['elizabeth', 'liz', 'beth', 'betsy', 'lizzie', 'eliza'],
  ['katherine', 'catherine', 'kathryn', 'kate', 'katie', 'kathy', 'cathy'], ['jennifer', 'jen', 'jenny'], ['samuel', 'sam', 'sammy'],
  ['samantha', 'sam'], ['alexander', 'alex', 'xander'], ['alexandra', 'alex', 'lexi'], ['benjamin', 'ben', 'benny'], ['nicholas', 'nick', 'nicky'],
  ['gregory', 'greg'], ['jeffrey', 'geoffrey', 'jeff'], ['andrew', 'andy', 'drew'], ['patrick', 'pat'], ['patricia', 'pat', 'patty', 'trish'],
  ['edward', 'ed', 'eddie', 'ted', 'ned'], ['ronald', 'ron', 'ronnie'], ['donald', 'don', 'donnie'], ['kenneth', 'ken', 'kenny'],
  ['lawrence', 'larry'], ['john', 'jon', 'johnny', 'jack'], ['jonathan', 'jon', 'john'], ['charles', 'charlie', 'chuck'],
  ['margaret', 'maggie', 'meg', 'peggy'], ['susan', 'sue', 'suzy'], ['deborah', 'debra', 'deb', 'debbie'], ['rebecca', 'becky', 'becca'],
  ['timothy', 'tim'], ['joshua', 'josh'], ['zachary', 'zach', 'zack'], ['jacob', 'jake'], ['douglas', 'doug'], ['gerald', 'jerry'],
  ['raymond', 'ray'], ['frederick', 'fred', 'freddie'], ['victoria', 'vicky', 'tori'], ['abigail', 'abby'], ['jessica', 'jess', 'jessie'],
  ['stephanie', 'steph'], ['nathaniel', 'nathan', 'nate'], ['peter', 'pete'], ['phillip', 'philip', 'phil'], ['bradley', 'brad'],
];
const nick = new Map<string, Set<string>>();
for (const group of NICKNAMES) for (const n of group) nick.set(n, new Set([...(nick.get(n) ?? []), ...group]));

/** Two first names that could be the same person: same, a typo apart, a nickname, or an initial. */
export function firstNamesMatch(a: string, b: string): boolean {
  const x = letters(a), y = letters(b);
  if (!x || !y) return true;
  if (close(x, y) || nick.get(x)?.has(y)) return true;
  return (x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y));
}

export type NamedPerson = { firstName: string; lastName: string };
/** Same person by name? Last names alike (a typo, accents, a hyphen) and first names alike. */
export function namesLookAlike(a: NamedPerson, b: NamedPerson): boolean {
  const la = letters(a.lastName), lb = letters(b.lastName);
  if (!la || !lb) return !la && !lb && close(letters(a.firstName), letters(b.firstName));
  const lastClose = close(la, lb) || (la.length >= 4 && lb.length >= 4 && (la.startsWith(lb) || lb.startsWith(la)));
  return lastClose && firstNamesMatch(a.firstName, b.firstName);
}

const SUFFIXES = new Set(['inc', 'incorporated', 'llc', 'pllc', 'llp', 'lp', 'ltd', 'co', 'corp', 'corporation', 'company', 'the', 'of', 'and']);
/** A company name's words, without punctuation and Inc. / LLC / The. */
export function companyWords(name: string): string[] {
  return fold(name).replace(/&/g, ' and ').replace(/['’.]/g, '').split(/[^a-z0-9]+/).filter((w) => w && !SUFFIXES.has(w));
}

/** Same company by name? The same words, a typo apart, or one name is the other plus more words. */
export function companiesLookAlike(a: string, b: string): boolean {
  const x = companyWords(a), y = companyWords(b);
  if (!x.length || !y.length) return false;
  const jx = x.join(''), jy = y.join('');
  if (jx === jy) return true;
  if (jx.length >= 5 && close(jx, jy)) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // "Baggett" and "Baggett Construction": the first words agree and the short name is distinctive enough.
  return short.join('').length >= 5 && short.every((w, i) => close(w, long[i]));
}

/** The ones on file a new name looks like (not the record itself). */
export function likePeople<T extends NamedPerson & { id: string }>(name: NamedPerson, on: T[], selfId?: string | null): T[] {
  return on.filter((p) => p.id !== selfId && namesLookAlike(name, p));
}
export function likeCompanies<T extends { id: string; name: string }>(name: string, on: T[], selfId?: string | null): T[] {
  return on.filter((c) => c.id !== selfId && companiesLookAlike(name, c.name));
}

/** Every pair on file that looks alike, for the Possible Duplicates page. */
export function pairs<T extends { id: string }>(rows: T[], alike: (a: T, b: T) => boolean): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) if (alike(rows[i], rows[j])) out.push([rows[i], rows[j]]);
  return out;
}
