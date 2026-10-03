// What moves price here (owner, Oct 3, 2026: "Tell me everything that factors in
// to a buyer's decision and how it is weighted. Definitely not equal"). Measured
// from county sales, not guessed: one regression of log(price) on size, age,
// lot, kind of home, ZIP and month, and from it each factor's share of why
// prices differ and what each is worth. Pure, tested in price-drivers.test.ts.

export type Sale = { price: number; sf: number; age: number | null; acres: number | null; use: 'single_family' | 'townhouse'; zip: string; month: number };

/** Age bands at sale; 11–30 years old is the base the others are compared with. */
export const ageBands = [
  { key: 'new', label: 'New (0–1 years)', max: 1 },
  { key: 'a2_10', label: '2–10 years', max: 10 },
  { key: 'a11_30', label: '11–30 years', max: 30 },
  { key: 'a31_60', label: '31–60 years', max: 60 },
  { key: 'a61', label: '61 years and older', max: Infinity },
] as const;
export type AgeBand = (typeof ageBands)[number]['key'];
export const ageBand = (age: number): AgeBand => ageBands.find((b) => age <= b.max)!.key;
/** Durham's records don't give the year built: those sales count, with the age marked unknown. */
const bandOf = (age: number | null): AgeBand | 'unknown' => (age === null ? 'unknown' : ageBand(age));

export const factorGroups = [
  { key: 'location', label: 'Location (ZIP)' },
  { key: 'size', label: 'Size (heated sq ft)' },
  { key: 'age', label: 'Age and new construction' },
  { key: 'lot', label: 'Lot size' },
  { key: 'kind', label: 'House or townhouse' },
  { key: 'time', label: 'When it sold' },
] as const;
export type FactorKey = (typeof factorGroups)[number]['key'];

/** Sales that look like an ordinary sale of a finished home (no $10 transfers, no multi-parcel deals, no teardowns). */
export function usable(s: { price: number; sf: number | null; age: number | null; acres: number | null }) {
  if (!(s.price >= 50_000) || !s.sf || s.sf < 500 || s.sf > 10_000 || (s.age !== null && (s.age < 0 || s.age > 200))) return false;
  const psf = s.price / s.sf;
  return psf >= 50 && psf <= 1500 && (s.acres === null || (s.acres > 0 && s.acres < 50));
}

/** Least squares with a whisker of ridge, so a ZIP with one sale can't blow it up. Solves (X'X + λI)b = X'y. */
export function ols(X: number[][], y: number[], ridge = 1e-6): number[] | null {
  const k = X[0]?.length ?? 0;
  if (!k || X.length <= k) return null;
  const A = Array.from({ length: k }, () => new Array<number>(k + 1).fill(0));
  for (let r = 0; r < X.length; r++) {
    const x = X[r];
    for (let i = 0; i < k; i++) {
      if (x[i] === 0) continue;
      for (let j = i; j < k; j++) A[i][j] += x[i] * x[j];
      A[i][k] += x[i] * y[r];
    }
  }
  for (let i = 0; i < k; i++) { for (let j = 0; j < i; j++) A[i][j] = A[j][i]; A[i][i] += ridge * X.length * (i === 0 ? 0 : 1); }
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      if (f) for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => row[k] / A[i][i]);
}

const variance = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length; };
const medianOf = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const LOT_FLOOR = 0.02;

export type Drivers = {
  n: number; r2: number;
  shares: { key: FactorKey; label: string; share: number }[]; // each factor's share of why prices differ, adds to 100
  medianPrice: number; medianSf: number;
  per100Sf: number; // dollars for 100 more sq ft at the median house
  sfElasticity: number;
  agePremium: { key: AgeBand; label: string; pct: number }[]; // against 11–30 years old, same size and place
  lotDoubling: number | null; // % for twice the lot (houses only)
  townhouse: number | null; // % against a house the same size and place
  yearTrend: number; // % a year, same house
  zips: { zip: string; n: number; premium: number; medianPrice: number; per100Sf: number }[]; // location premium against the middle ZIP
};

/**
 * The model. ZIPs with fewer than `minZip` sales share one "other" place. Shares
 * are each group's part of the spread in predicted log price (the variance of
 * that group's contribution, normalised), so they add to 100.
 */
export function priceDrivers(sales: Sale[], opts: { minZip?: number } = {}): Drivers | null {
  const minZip = opts.minZip ?? 30;
  const rows = sales.filter((s) => s.price > 0 && s.sf > 0);
  if (rows.length < 60) return null;
  const count = new Map<string, number>();
  for (const s of rows) count.set(s.zip, (count.get(s.zip) ?? 0) + 1);
  const zips = [...count.entries()].filter(([, n]) => n >= minZip).sort((a, b) => b[1] - a[1]).map(([z]) => z);
  const base = zips[0]; // the busiest ZIP is the base; premiums are re-centred on the middle ZIP below
  const zipCols = zips.slice(1);
  const hasTh = rows.some((s) => s.use === 'townhouse') && rows.some((s) => s.use === 'single_family');
  const ageCols: (AgeBand | 'unknown')[] = [...ageBands.filter((b) => b.key !== 'a11_30' && rows.some((s) => bandOf(s.age) === b.key)).map((b) => b.key), ...(rows.some((s) => s.age === null) ? ['unknown' as const] : [])];
  const lotOk = rows.filter((s) => s.use === 'single_family' && s.acres !== null).length >= 30;
  const months = rows.map((s) => s.month), m0 = Math.min(...months);
  // Columns: intercept | log sf | ages | log lot (houses) | townhouse | ZIPs | month
  const groups: FactorKey[] = ['size', ...ageCols.map(() => 'age' as const), ...(lotOk ? ['lot' as const] : []), ...(hasTh ? ['kind' as const] : []), ...zipCols.map(() => 'location' as const), 'time'];
  const X: number[][] = [], y: number[] = [];
  for (const s of rows) {
    const band = bandOf(s.age);
    const lot = lotOk && s.use === 'single_family' && s.acres !== null ? Math.log(Math.max(s.acres, LOT_FLOOR)) : 0;
    X.push([1, Math.log(s.sf), ...ageCols.map((k) => (band === k ? 1 : 0)), ...(lotOk ? [lot] : []), ...(hasTh ? [s.use === 'townhouse' ? 1 : 0] : []),
      ...zipCols.map((z) => (s.zip === z ? 1 : 0)), s.month - m0]);
    y.push(Math.log(s.price));
  }
  const b = ols(X, y);
  if (!b) return null;
  // Fit and each group's contribution.
  const contrib = new Map<FactorKey, number[]>(factorGroups.map((g) => [g.key, []]));
  let ssr = 0;
  const ym = y.reduce((a, c) => a + c, 0) / y.length;
  let sst = 0;
  X.forEach((x, r) => {
    const per = new Map<FactorKey, number>();
    let fit = b[0];
    for (let j = 1; j < x.length; j++) { const v = x[j] * b[j]; fit += v; const g = groups[j - 1]; per.set(g, (per.get(g) ?? 0) + v); }
    for (const g of factorGroups) contrib.get(g.key)!.push(per.get(g.key) ?? 0);
    ssr += (y[r] - fit) ** 2; sst += (y[r] - ym) ** 2;
  });
  const vars = factorGroups.map((g) => ({ ...g, v: variance(contrib.get(g.key)!) }));
  const total = vars.reduce((a, g) => a + g.v, 0) || 1;
  const shares = vars.map((g) => ({ key: g.key, label: g.label, share: Math.round((g.v / total) * 1000) / 10 })).sort((a, z) => z.share - a.share);
  const col = (i: number) => b[i + 1];
  const eSf = col(0);
  const ageAt = (k: AgeBand) => { const i = ageCols.indexOf(k); return i < 0 ? null : col(1 + i); };
  const after = 1 + ageCols.length;
  const lotB = lotOk ? col(after) : null;
  const thB = hasTh ? col(after + (lotOk ? 1 : 0)) : null;
  const zStart = after + (lotOk ? 1 : 0) + (hasTh ? 1 : 0);
  const zipB = new Map<string, number>([[base, 0], ...zipCols.map((z, i) => [z, col(zStart + i)] as [string, number])]);
  const mid = medianOf([...zipB.values()]);
  const monthB = col(zStart + zipCols.length);
  const pct = (v: number) => Math.round((Math.exp(v) - 1) * 1000) / 10;
  const medianPrice = medianOf(rows.map((s) => s.price)), medianSf = Math.round(medianOf(rows.map((s) => s.sf)));
  const per100 = (p: number, sf: number) => Math.round((p * eSf * 100) / sf / 100) * 100;
  return {
    n: rows.length, r2: Math.round((1 - ssr / sst) * 1000) / 10, shares, medianPrice, medianSf,
    per100Sf: per100(medianPrice, medianSf), sfElasticity: Math.round(eSf * 1000) / 1000,
    agePremium: ageBands.filter((a) => a.key !== 'a11_30').flatMap((a) => { const v = ageAt(a.key); return v === null ? [] : [{ key: a.key, label: a.label, pct: pct(v) }]; }),
    lotDoubling: lotB === null ? null : Math.round((2 ** lotB - 1) * 1000) / 10,
    townhouse: thB === null ? null : pct(thB),
    yearTrend: pct(monthB * 12),
    zips: [...zipB.entries()].map(([zip, v]) => {
      const mine = rows.filter((s) => s.zip === zip);
      const mp = medianOf(mine.map((s) => s.price)), ms = medianOf(mine.map((s) => s.sf));
      return { zip, n: mine.length, premium: pct(v - mid), medianPrice: mp, per100Sf: per100(mp, ms) };
    }).sort((a, z) => z.premium - a.premium),
  };
}

/** One plain sentence per finding. */
export function driverSentences(d: Drivers): string[] {
  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
  const top = d.shares.filter((s) => s.share >= 1);
  const out = [`Of why sale prices here differ, ${top.map((s) => `${s.label.replace(/ \(.*\)/, '').toLowerCase()} explains ${Math.round(s.share)}%`).join(', ')}.`];
  out.push(`Each extra 100 sq ft adds about ${money(d.per100Sf)} on a typical ${money(d.medianPrice)}, ${d.medianSf.toLocaleString('en-US')} sq ft home.`);
  const nw = d.agePremium.find((a) => a.key === 'new');
  if (nw) out.push(`A new home sells for ${Math.abs(nw.pct)}% ${nw.pct >= 0 ? 'more' : 'less'} than an 11–30-year-old one of the same size in the same ZIP.`);
  if (d.lotDoubling !== null) out.push(`Twice the lot adds about ${d.lotDoubling}% to a house’s price.`);
  if (d.townhouse !== null) out.push(`A townhouse sells for ${Math.abs(d.townhouse)}% ${d.townhouse < 0 ? 'less' : 'more'} than a house of the same size in the same ZIP.`);
  out.push(`The same house is selling for ${Math.abs(d.yearTrend)}% ${d.yearTrend >= 0 ? 'more' : 'less'} a year than it did (over these two years).`);
  return out;
}

/** How much less house a buyer can afford when the 30-year rate goes up a point, at the same payment. */
export function buyingPowerPerPoint(rate: number) {
  const loan = (r: number) => { const m = r / 100 / 12, n = 360; return (1 - (1 + m) ** -n) / m; };
  return Math.round((1 - loan(rate + 1) / loan(rate)) * 1000) / 10;
}
