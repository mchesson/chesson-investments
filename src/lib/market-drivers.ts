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

export type MarketMonth = { region: string; period: string; homesSold: number; newListings: number; price: number; rate: number | null };

export const marketFactors = [
  { key: 'season', label: 'Time of year' },
  { key: 'rate', label: 'Mortgage rate' },
  { key: 'listings', label: 'New listings (supply)' },
  { key: 'price', label: 'Price level' },
  { key: 'trend', label: 'Long-run trend (jobs, moves, everything else over time)' },
] as const;
export type MarketFactor = (typeof marketFactors)[number]['key'];

type Row = { fe: number[]; g: Record<MarketFactor, number[]>; y: number };

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
  ratePerPoint: number; mayVsJan: number; peakMonth: string; lowMonth: string; listingsPer10: number; trendPerYear: number;
};

const monthName = (m: number) => new Date(Date.UTC(2026, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
const pct = (v: number) => Math.round((Math.exp(v) - 1) * 1000) / 10;

/**
 * The model: log(homes sold) = county + month of year + last month's 30-year
 * rate (closings follow contracts by a month or two) + log(new listings) +
 * the county's price against its own average + years since the start.
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
  const rows: Row[] = [];
  regions.forEach((reg, ri) => {
    const rs = byRegion.get(reg)!;
    const ok = rs.filter((r) => r.price > 0);
    if (!ok.length) return;
    const meanP = ok.reduce((a, r) => a + Math.log(r.price), 0) / ok.length;
    rs.forEach((r, i) => {
      const prev = rs[i - 1];
      if (!prev || prev.rate === null || !(r.homesSold > 0) || !(r.newListings > 0) || !(r.price > 0)) return;
      const m = Number(r.period.slice(5, 7)), t = (Number(r.period.slice(0, 4)) - y0) * 12 + m;
      rows.push({
        fe: [1, ...regions.slice(1).map((_, k) => (ri === k + 1 ? 1 : 0))], y: Math.log(r.homesSold),
        g: { season: Array.from({ length: 11 }, (_, k) => (m === k + 2 ? 1 : 0)), rate: [prev.rate], listings: [Math.log(r.newListings)], price: [Math.log(r.price) - meanP], trend: [t / 12] },
      });
    });
  });
  if (rows.length < 36) return null;
  const keys = marketFactors.map((f) => f.key);
  const { total, shares } = shapleyR2(rows, keys);
  if (!Number.isFinite(total)) return null;
  const X = rows.map((r) => [...r.fe, ...keys.flatMap((g) => r.g[g])]);
  const b = ols(X, rows.map((r) => r.y), 0);
  if (!b) return null;
  const at = regions.length; // first season column
  const season = b.slice(at, at + 11); // February … December against January
  const byMonth = [0, ...season];
  const peak = byMonth.indexOf(Math.max(...byMonth)), low = byMonth.indexOf(Math.min(...byMonth));
  const ratePerPoint = pct(b[at + 11]), listingsPer10 = Math.round((1.1 ** b[at + 12] - 1) * 1000) / 10, trendPerYear = pct(b[at + 14]);
  const mayVsJan = pct(byMonth[4]);
  const share = (k: MarketFactor) => Math.round(shares[k] * 1000) / 10;
  const face: Record<MarketFactor, string> = {
    season: `${monthName(peak + 1)} sells ${pct(byMonth[peak] - byMonth[low])}% more homes than ${monthName(low + 1)}`,
    rate: `Each 1-point rise in the 30-year rate: ${Math.abs(ratePerPoint)}% ${ratePerPoint < 0 ? 'fewer' : 'more'} sales a month or two later`,
    listings: `10% more new listings: ${Math.abs(listingsPer10)}% ${listingsPer10 >= 0 ? 'more' : 'fewer'} sales that month`,
    price: `Moves with demand (prices rise when more buyers are out); not a cause on its own here`,
    trend: `With the others held the same, ${Math.abs(trendPerYear)}% ${trendPerYear < 0 ? 'fewer' : 'more'} sales a year`,
  };
  const periods = rows.length ? months.map((m) => m.period).sort() : [];
  return {
    months: rows.length, regions: regions.length, from: periods[0], to: periods[periods.length - 1],
    explained: Math.round(total * 1000) / 10,
    factors: marketFactors.map((f) => ({ key: f.key, label: f.label, share: share(f.key), face: face[f.key] })).sort((a, z) => z.share - a.share),
    ratePerPoint, mayVsJan, peakMonth: monthName(peak + 1), lowMonth: monthName(low + 1), listingsPer10, trendPerYear,
  };
}
