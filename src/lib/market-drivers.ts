// What moves the whole market (owner, Oct 4, 2026: "There are a ton of things
// that cause house buying to change habits but not all are equal, so we need to
// evaluate each at face value but also percentage-wise of the overall market").
// Measured from Redfin's monthly numbers for each county since 2019 and the
// 30-year rate: how many homes sell each month, explained by the season, the
// rate, new listings, prices and the long-run trend. Each factor gets its face
// value (what one unit of it does to sales) and its share of the market's
// swings (Shapley / LMG: every combination of factors tried, each factor given
// its average added explanation, so overlapping factors split fairly). Pure,
// tested in market-drivers.test.ts.
import { ols } from './price-drivers';

export type MarketMonth = { region: string; period: string; homesSold: number; newListings: number; price: number; rate: number | null; extras?: Extras };

export const marketFactors = [
  { key: 'season', label: 'Time of year' },
  { key: 'rate', label: 'Mortgage rate' },
  { key: 'listings', label: 'New listings (supply)' },
  { key: 'price', label: 'Price level' },
  { key: 'jobs', label: 'Local jobs' },
  { key: 'unemployment', label: 'Local unemployment' },
  { key: 'migration', label: 'People moving in' },
  { key: 'confidence', label: 'Buyer confidence' },
  { key: 'stocks', label: 'Stock market' },
  { key: 'inflation', label: 'Inflation' },
  { key: 'trend', label: 'Long-run trend (everything else that changes slowly)' },
] as const;
export type MarketFactor = (typeof marketFactors)[number]['key'];
/** The economy, joined to each county-month by the data reader; any can be missing. */
export type Extras = { jobs?: number | null; unemployment?: number | null; migration?: number | null; confidence?: number | null; stocks?: number | null; inflation?: number | null };
const extraKeys = ['jobs', 'unemployment', 'migration', 'confidence', 'stocks', 'inflation'] as const;

type Row = { fe: number[]; g: Partial<Record<MarketFactor, number[]>>; y: number };

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));

/** Each group's Shapley share of the R² beyond the fixed columns (the counties). Adds to the total R². */
export function shapleyR2<G extends string>(rows: { fe: number[]; g: Record<G, number[]>; y: number }[], groups: readonly G[]) {
  const y = rows.map((r) => r.y);
  const ssr = (sub: G[]) => {
    const X = rows.map((r) => [...r.fe, ...sub.flatMap((g) => r.g[g])]);
    const b = ols(X, y); // a whisker of ridge: two identical columns still solve
    if (!b) return NaN;
    return y.reduce((a, c, i) => a + (c - X[i].reduce((s, v, j) => s + v * b[j], 0)) ** 2, 0);
  };
  const base = ssr([]);
  const memo = new Map<string, number>();
  const R = (s: G[]) => { const k = [...s].sort().join(','); if (!memo.has(k)) memo.set(k, 1 - ssr(s) / base); return memo.get(k)!; };
  const n = groups.length;
  const shares = {} as Record<G, number>;
  for (const g of groups) {
    const others = groups.filter((x) => x !== g);
    let v = 0;
    for (let mask = 0; mask < 1 << others.length; mask++) {
      const S = others.filter((_, i) => mask & (1 << i));
      v += ((fact(S.length) * fact(n - S.length - 1)) / fact(n)) * (R([...S, g]) - R(S));
    }
    shares[g] = v;
  }
  return { total: R([...groups]), shares };
}

export type MarketDrivers = {
  months: number; regions: number; from: string; to: string;
  explained: number; // % of the month-to-month swings (within each county) the factors explain
  factors: { key: MarketFactor; label: string; share: number; face: string }[]; // share = % of all swings
  missing: MarketFactor[]; // left out: not enough data loaded
  ratePerPoint: number; peakMonth: string; lowMonth: string;
};

const monthName = (m: number) => new Date(Date.UTC(2026, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
const pct = (v: number) => Math.round((Math.exp(v) - 1) * 1000) / 10;
const moreFewer = (p: number, what = 'sales') => `${Math.abs(p)}% ${p < 0 ? 'fewer' : 'more'} ${what}`;

/**
 * The model: log(homes sold) = county + month of year + last month's 30-year
 * rate (closings follow contracts by a month or two) + log(new listings) +
 * the county's price against its own average + the economy (log local jobs,
 * the unemployment rate, net migration per 1,000 residents, last month's
 * consumer confidence, last month's log stock market, inflation over the
 * year) + years since the start. An economic factor is used when at least
 * 80% of the months have it; months missing a used one are left out.
 */
export function marketDrivers(months: MarketMonth[]): MarketDrivers | null {
  const byRegion = new Map<string, MarketMonth[]>();
  for (const m of [...months].sort((a, b) => a.period.localeCompare(b.period))) {
    if (!byRegion.has(m.region)) byRegion.set(m.region, []);
    byRegion.get(m.region)!.push(m);
  }
  const regions = [...byRegion.keys()];
  const first = months.reduce((a, m) => (m.period < a ? m.period : a), '9999');
  const y0 = Number(first.slice(0, 4));
  type Cand = { ri: number; r: MarketMonth; prev: MarketMonth; meanP: number };
  const cands: Cand[] = [];
  regions.forEach((reg, ri) => {
    const rs = byRegion.get(reg)!;
    const ok = rs.filter((r) => r.price > 0);
    if (!ok.length) return;
    const meanP = ok.reduce((a, r) => a + Math.log(r.price), 0) / ok.length;
    rs.forEach((r, i) => {
      const prev = rs[i - 1];
      if (!prev || prev.rate === null || !(r.homesSold > 0) || !(r.newListings > 0) || !(r.price > 0)) return;
      cands.push({ ri, r, prev, meanP });
    });
  });
  // Lagged for confidence and stocks (buyers act on last month's mood and wealth).
  const extraOf = (c: Cand, k: (typeof extraKeys)[number]) => {
    const src = k === 'confidence' || k === 'stocks' ? c.prev.extras : c.r.extras;
    const v = src?.[k];
    return v === null || v === undefined || !Number.isFinite(v) || (k === 'jobs' || k === 'stocks' ? v <= 0 : false) ? null : v;
  };
  const used = extraKeys.filter((k) => cands.length && cands.filter((c) => extraOf(c, k) !== null).length >= 0.8 * cands.length);
  const missing = extraKeys.filter((k) => !used.includes(k)) as MarketFactor[];
  const rows: Row[] = [];
  for (const c of cands) {
    const vals = used.map((k) => extraOf(c, k));
    if (vals.some((v) => v === null)) continue;
    const m = Number(c.r.period.slice(5, 7)), t = (Number(c.r.period.slice(0, 4)) - y0) * 12 + m;
    const g: Row['g'] = { season: Array.from({ length: 11 }, (_, k) => (m === k + 2 ? 1 : 0)), rate: [c.prev.rate!], listings: [Math.log(c.r.newListings)], price: [Math.log(c.r.price) - c.meanP], trend: [t / 12] };
    used.forEach((k, i) => { const v = vals[i]!; g[k] = [k === 'jobs' || k === 'stocks' ? Math.log(v) : v]; });
    rows.push({ fe: [1, ...regions.slice(1).map((_, k) => (c.ri === k + 1 ? 1 : 0))], y: Math.log(c.r.homesSold), g });
  }
  if (rows.length < 36) return null;
  const keys = marketFactors.map((f) => f.key).filter((k) => !missing.includes(k));
  const { total, shares } = shapleyR2(rows as { fe: number[]; g: Record<MarketFactor, number[]>; y: number }[], keys);
  if (!Number.isFinite(total)) return null;
  const X = rows.map((r) => [...r.fe, ...keys.flatMap((g) => r.g[g]!)]);
  const b = ols(X, rows.map((r) => r.y));
  if (!b) return null;
  const col: Partial<Record<MarketFactor, number>> = {};
  let at = regions.length;
  for (const k of keys) { col[k] = at; at += k === 'season' ? 11 : 1; }
  const coef = (k: MarketFactor) => b[col[k]!];
  const byMonth = [0, ...b.slice(col.season!, col.season! + 11)];
  const peak = byMonth.indexOf(Math.max(...byMonth)), low = byMonth.indexOf(Math.min(...byMonth));
  const ratePerPoint = pct(coef('rate'));
  const face: Record<MarketFactor, () => string> = {
    season: () => `${monthName(peak + 1)} sells ${pct(byMonth[peak] - byMonth[low])}% more homes than ${monthName(low + 1)}`,
    rate: () => `Each 1-point rise in the 30-year rate: ${moreFewer(ratePerPoint)} a month or two later`,
    listings: () => `10% more new listings: ${moreFewer(Math.round((1.1 ** coef('listings') - 1) * 1000) / 10)} that month`,
    price: () => 'Moves with demand (prices rise when more buyers are out); not a cause on its own here',
    jobs: () => `1% more local jobs: ${moreFewer(Math.round((1.01 ** coef('jobs') - 1) * 1000) / 10)}`,
    unemployment: () => `1 point more local unemployment: ${moreFewer(pct(coef('unemployment')))}`,
    migration: () => `5 more people moving in per 1,000 residents a year: ${moreFewer(pct(5 * coef('migration')))}`,
    confidence: () => `10 points more consumer confidence: ${moreFewer(pct(10 * coef('confidence')))} the next month`,
    stocks: () => `Stocks 10% higher: ${moreFewer(Math.round((1.1 ** coef('stocks') - 1) * 1000) / 10)} the next month`,
    inflation: () => `1 point more inflation: ${moreFewer(pct(coef('inflation')))}`,
    trend: () => `With everything else held the same: ${moreFewer(pct(coef('trend')))} a year`,
  };
  const periods = months.map((m) => m.period).sort();
  return {
    months: rows.length, regions: regions.length, from: periods[0], to: periods[periods.length - 1],
    explained: Math.round(total * 1000) / 10,
    factors: keys.map((k) => ({ key: k, label: marketFactors.find((f) => f.key === k)!.label, share: Math.round(shares[k] * 1000) / 10, face: face[k]() })).sort((a, z) => z.share - a.share),
    missing, ratePerPoint, peakMonth: monthName(peak + 1), lowMonth: monthName(low + 1),
  };
}
