// Reading the market from county sales (owner, Oct 2, 2026: "right now under
// 400k is selling and over 1.5 is selling ... others are stagnant"). Pure,
// tested in market-stats.test.ts. Time on market isn't in county records; until
// a listings feed is connected, "selling" means how many sold per month now
// against the year before.

export const priceBands = [
  { key: 'u400', label: 'Under $400k', min: 0, max: 400_000 },
  { key: '400_700', label: '$400k–700k', min: 400_000, max: 700_000 },
  { key: '700_1m', label: '$700k–1M', min: 700_000, max: 1_000_000 },
  { key: '1m_15m', label: '$1M–1.5M', min: 1_000_000, max: 1_500_000 },
  { key: '15m', label: '$1.5M and Up', min: 1_500_000, max: Infinity },
] as const;
export type BandKey = (typeof priceBands)[number]['key'];
export const isBand = (v: string | null | undefined): v is BandKey => priceBands.some((b) => b.key === v);
export const bandOf = (price: number): BandKey => priceBands.find((b) => price >= b.min && price < b.max)!.key;

export const soldWithin = [
  { key: '6', label: 'Last 6 Months' }, { key: '12', label: 'Last 12 Months' }, { key: '24', label: 'Last 2 Years' }, { key: '36', label: 'Last 3 Years' },
] as const;

export function median(xs: number[]): number | null {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Change from before to now, as a % (null when there's nothing to compare). */
export const pctChange = (now: number | null, before: number | null) =>
  now === null || before === null || before === 0 ? null : Math.round(((now - before) / before) * 1000) / 10;

export type Pace = 'faster' | 'steady' | 'slower' | 'thin';
/**
 * Selling faster or slower: sales per month in the latest 6 months (ending 30
 * days ago, as the counties catch up on recording) against the same 6 months a
 * year earlier. Fewer than 6 sales in all is too thin to say.
 */
export function pace(recent: number, prior: number): { pace: Pace; perMonthNow: number; perMonthBefore: number; change: number | null } {
  const perMonthNow = Math.round((recent / 6) * 10) / 10, perMonthBefore = Math.round((prior / 6) * 10) / 10;
  const change = pctChange(perMonthNow, perMonthBefore);
  if (recent + prior < 6) return { pace: 'thin', perMonthNow, perMonthBefore, change };
  const p: Pace = change === null ? 'faster' : change >= 10 ? 'faster' : change <= -10 ? 'slower' : 'steady';
  return { pace: p, perMonthNow, perMonthBefore, change };
}
export const paceLabel: Record<Pace, string> = { faster: 'Selling Faster', steady: 'Steady', slower: 'Slowing', thin: 'Too Few Sales to Say' };

/** One plain sentence for the trend across price bands, e.g. under $400k and $1.5M+ selling, the middle slowing. */
export function bandSentence(rows: { band: BandKey; pace: Pace }[]): string {
  const name = (k: BandKey) => priceBands.find((b) => b.key === k)!.label.replace(' and Up', '+');
  const fast = rows.filter((r) => r.pace === 'faster').map((r) => name(r.band));
  const slow = rows.filter((r) => r.pace === 'slower').map((r) => name(r.band));
  const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  if (!fast.length && !slow.length) return 'Every price band is selling at about the same pace as last year.';
  return [fast.length ? `${list(fast)} ${fast.length === 1 ? 'is' : 'are'} selling faster than last year` : null,
    slow.length ? `${list(slow)} ${slow.length === 1 ? 'is' : 'are'} slowing` : null].filter(Boolean).join('; ') + '.';
}

/** The color of a dot or a heat point by $/sf, against the area's spread (low aqua → high energy → red). */
export function psfColor(psf: number | null, lo: number, hi: number): string {
  if (!psf || hi <= lo) return '#898989';
  const t = Math.max(0, Math.min(1, (psf - lo) / (hi - lo)));
  const stops = [[0, 186, 180], [13, 113, 186], [192, 217, 97], [179, 38, 30]];
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const f = t * (stops.length - 1) - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Neighborhood names that don't name a place ("Residential", a builder, a plat note): left out of the tables. */
export function isPlaceName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.trim();
  if (n.length < 3 || n.length > 45) return false;
  return !/^(residential|commercial|condo|townhomes?|sub|subdivision|no subdivision|none|misc|unknown)$/i.test(n)
    && !/\b(homes|llc|inc|builders?|mixed|parcel|ag ehc|tract|lots?)\b/i.test(n);
}
