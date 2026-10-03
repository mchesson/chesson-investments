// The buy box, worked out from the market (owner, Oct 2, 2026: "the buy box is
// not static ... street but street to determine buy zones ... and buy prices").
// For each neighborhood or street: what a finished house sells for there, worked
// back to the most we can pay for the lot, against what lots and teardowns
// actually sell for there. Pure, tested in buy-box.test.ts.
import { bandOf, type BandKey } from './market-stats';

export type BuyBoxSettings = {
  houseSf: number; // the house we'd build
  buildPerSf: number; // construction cost per heated sf
  softPct: number; // demolition, survey, design, permits, holding, closing: % of build
  sellingPct: number; // agent and seller closing costs: % of the sale
  profitPct: number; // our target profit: % of the sale
  financingPct: number; // financing per $ of land
  nearMiles: number; // "near a downtown"
  minSales: number; // finished sales needed to trust a zone
  minAbsorb: number; // sales at our price band in 12 months the zone needs
  minLot: number; // below this, a new house there doesn't leave enough for a lot
  monthsToSell: number; // buying the lot to selling the house: how far ahead the trend is carried
  downsidePct: number; // the Low case: finished prices this much lower when we sell
  upsidePct: number; // the High case: this much higher
  maxDom: number; // days on market (the zone's ZIP, Redfin): slower than this and a buy zone is only a watch
};
// Starting numbers from the owner's Plainview math (Sept 10, 2025): 2,600 sf at
// $190/sf; holding, demolition, survey and closing about 18% of the build;
// realtor and closing about 6%; profit about $150k on $1.1M (13.5%).
export const defaultBuyBox: BuyBoxSettings = { houseSf: 2600, buildPerSf: 190, softPct: 18, sellingPct: 6, profitPct: 13.5, financingPct: 8, nearMiles: 6, minSales: 5, minAbsorb: 3, minLot: 75000, monthsToSell: 15, downsidePct: 10, upsidePct: 5, maxDom: 60 };

export const buyBoxFields: { key: keyof BuyBoxSettings; label: string; hint: string; min: number; max: number }[] = [
  { key: 'houseSf', label: 'House We’d Build (heated sf)', hint: 'The size used for every zone', min: 600, max: 10000 },
  { key: 'buildPerSf', label: 'Build Cost per sf ($)', hint: 'Construction only', min: 50, max: 1000 },
  { key: 'softPct', label: 'Soft and Holding Costs (% of build)', hint: 'Demolition, survey, design, permits, holding, closing', min: 0, max: 60 },
  { key: 'sellingPct', label: 'Selling Costs (% of sale)', hint: 'Agents and closing', min: 0, max: 15 },
  { key: 'profitPct', label: 'Target Profit (% of sale)', hint: 'What we need to make', min: 0, max: 50 },
  { key: 'financingPct', label: 'Financing on the Land (%)', hint: 'Interest and points per $ of land', min: 0, max: 30 },
  { key: 'nearMiles', label: 'Near a Downtown (miles)', hint: 'Raleigh or Durham', min: 1, max: 50 },
  { key: 'minSales', label: 'Finished Sales to Trust a Zone', hint: 'In the last 2 years', min: 1, max: 50 },
  { key: 'minAbsorb', label: 'Sales at Our Price a Zone Needs', hint: 'In the last 12 months, in the same price band', min: 0, max: 50 },
  { key: 'minLot', label: 'Smallest Lot Budget Worth a Look ($)', hint: 'Below this a new house there doesn’t pay', min: 0, max: 2000000 },
  { key: 'monthsToSell', label: 'Months From Buying the Lot to Selling', hint: 'How far ahead each zone’s price trend is carried', min: 1, max: 48 },
  { key: 'downsidePct', label: 'Low Case: Prices Fall (%)', hint: 'Does the zone still work if finished prices drop this much?', min: 0, max: 50 },
  { key: 'upsidePct', label: 'High Case: Prices Rise (%)', hint: 'The better case', min: 0, max: 50 },
  { key: 'maxDom', label: 'Slowest Days on Market for a Buy Zone', hint: 'The zone’s ZIP (Redfin); slower zones are only a watch', min: 5, max: 365 },
];

export function readBuyBox(v: unknown): BuyBoxSettings {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out = { ...defaultBuyBox };
  for (const f of buyBoxFields) {
    const n = Number(o[f.key]);
    if (Number.isFinite(n) && n >= f.min && n <= f.max) out[f.key] = n;
  }
  return out;
}

/** The finished value, our costs and the most we can pay for the lot. */
export function maxLotPrice(finishedPsf: number, s: BuyBoxSettings) {
  const value = finishedPsf * s.houseSf;
  const build = s.buildPerSf * s.houseSf;
  const soft = build * (s.softPct / 100);
  const selling = value * (s.sellingPct / 100);
  const profit = value * (s.profitPct / 100);
  const maxLot = (value - selling - build - soft - profit) / (1 + s.financingPct / 100);
  return { value: Math.round(value), build: Math.round(build), soft: Math.round(soft), selling: Math.round(selling), profit: Math.round(profit), maxLot: Math.round(maxLot) };
}

export const downtowns = [
  { name: 'Downtown Raleigh', lat: 35.7796, lng: -78.6382 },
  { name: 'Downtown Durham', lat: 35.994, lng: -78.8986 },
] as const;
/** Straight-line miles between two points. */
export function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
export function nearestDowntown(p: { lat: number; lng: number }) {
  return downtowns.map((d) => ({ name: d.name, miles: Math.round(miles(p, d) * 10) / 10 })).sort((a, b) => a.miles - b.miles)[0];
}

export type Verdict = 'buy' | 'watch' | 'pass' | 'thin';
export const verdictLabel: Record<Verdict, string> = { buy: 'Buy Zone', watch: 'Watch', pass: 'Too Expensive', thin: 'Not Enough Sales' };

export type ZoneStats = {
  name: string; city: string | null; county: string; lat: number; lng: number;
  finished: number; finishedPsf: number | null; entryCount: number; entryPrice: number | null;
  bandCounts: Partial<Record<BandKey, number>>; entryFrom?: string;
  /** Median finished $/sf in the last 12 months and the 12 before (the zone's trend). */
  psfRecent?: number | null; psfPrior?: number | null;
  /** The zone's main ZIP and Redfin's median days on market there (3 months). */
  zip?: string | null; dom?: number | null;
};

/** The zone's yearly $/sf change, from its own finished sales (null with too little to compare); capped at ±15%. */
export function zoneTrend(z: { psfRecent?: number | null; psfPrior?: number | null }): number | null {
  if (!z.psfRecent || !z.psfPrior) return null;
  const t = ((z.psfRecent - z.psfPrior) / z.psfPrior) * 100;
  return Math.round(Math.max(-15, Math.min(15, t)) * 10) / 10;
}
/**
 * Looking ahead to when we'd sell: the Mid case carries the zone's own price
 * trend forward over the months to sell; Low and High move today's prices down
 * or up by the settings. Each gives the most we could pay for the lot, and
 * "holds up" says whether the Low case still covers what lots sell for there.
 */
export function outlook(finishedPsf: number, z: { psfRecent?: number | null; psfPrior?: number | null; entryPrice: number | null; entryCount: number }, s: BuyBoxSettings) {
  const trend = zoneTrend(z);
  const mid = finishedPsf * (1 + ((trend ?? 0) / 100) * (s.monthsToSell / 12));
  const lot = (psf: number) => maxLotPrice(psf, s).maxLot;
  const low = lot(Math.min(mid, finishedPsf) * (1 - s.downsidePct / 100)), high = lot(Math.max(mid, finishedPsf) * (1 + s.upsidePct / 100));
  const holdsUp = z.entryPrice === null || z.entryCount < 2 ? null : low >= z.entryPrice;
  return { trend, low, mid: lot(mid), high, holdsUp };
}
/**
 * One zone's verdict: Buy when the most we can pay covers what lots and
 * teardowns sell for there and the zone absorbs houses at our price; Watch when
 * it's within 15%; Too Expensive otherwise; Not Enough Sales to say.
 */
export function judgeZone(z: ZoneStats, s: BuyBoxSettings) {
  const near = nearestDowntown(z);
  if (!z.finishedPsf || z.finished < s.minSales) return { ...z, near, verdict: 'thin' as Verdict, money: null, band: null, absorb: 0, margin: null, marginPct: null, outlook: null, reasons: [`only ${z.finished} finished-house sales in 2 years (needs ${s.minSales})`] };
  const money = maxLotPrice(z.finishedPsf, s);
  const band = bandOf(money.value);
  const absorb = z.bandCounts[band] ?? 0;
  const margin = z.entryPrice === null ? null : money.maxLot - z.entryPrice;
  const marginPct = z.entryPrice ? Math.round((margin! / z.entryPrice) * 100) : null;
  const reasons: string[] = [];
  let verdict: Verdict;
  const price = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
  const comparable = z.entryPrice !== null && z.entryCount >= 2;
  if (money.maxLot < Math.max(1, s.minLot)) { verdict = 'pass'; reasons.push(money.maxLot <= 0 ? 'a new house there wouldn’t cover the build and our profit' : `a new house there leaves only ${fmt(money.maxLot)} for the lot`); }
  else if (comparable && money.maxLot < z.entryPrice! * 0.85) { verdict = 'pass'; reasons.push(`lots and teardowns ${z.entryFrom ?? 'there'} sell around ${fmt(z.entryPrice!)}, well over the ${fmt(money.maxLot)} we can pay`); }
  else if (!comparable) { verdict = 'watch'; reasons.push(`not enough lot or teardown sales there to compare (${z.entryCount}); we can pay up to ${fmt(money.maxLot)}`); }
  else if (margin! < 0) { verdict = 'watch'; reasons.push(`lots ${z.entryFrom ?? 'there'} sell around ${fmt(z.entryPrice!)}, a little over our ${fmt(money.maxLot)}: look for the below-market ones`); }
  else { verdict = 'buy'; reasons.push(`we can pay up to ${fmt(money.maxLot)}; lots and teardowns ${z.entryFrom ?? 'there'} sell around ${fmt(z.entryPrice!)}`); }
  // Can the zone absorb a house at our price? If not, a buy becomes a watch.
  if (absorb < s.minAbsorb && verdict !== 'pass') {
    if (verdict === 'buy') verdict = 'watch';
    reasons.push(`only ${absorb} ${absorb === 1 ? 'sale' : 'sales'} at ${price(money.value)}-level prices there in 12 months (needs ${s.minAbsorb})`);
  }
  // How fast homes sell there (owner: "areas with lowest days on market are super important").
  if (z.dom !== null && z.dom !== undefined) {
    if (z.dom > s.maxDom && verdict === 'buy') { verdict = 'watch'; reasons.push(`homes in ${z.zip ?? 'its ZIP'} take about ${Math.round(z.dom)} days to sell (over ${s.maxDom})`); }
    else if (z.dom <= 20) reasons.push(`homes in ${z.zip ?? 'its ZIP'} sell in about ${Math.round(z.dom)} days`);
  }
  if (near.miles > s.nearMiles) reasons.push(`${near.miles} miles from ${near.name}`);
  const ahead = outlook(z.finishedPsf, z, s);
  if (ahead.trend !== null && Math.abs(ahead.trend) >= 3) reasons.push(`prices there are ${ahead.trend > 0 ? 'up' : 'down'} ${Math.abs(ahead.trend)}% in a year`);
  if (verdict === 'buy' && ahead.holdsUp === false) reasons.push(`if prices fall ${s.downsidePct}% we could pay only ${fmt(ahead.low)}: buy below market`);
  return { ...z, near, verdict, money, band, absorb, margin, marginPct, reasons, outlook: ahead };
}
export type JudgedZone = ReturnType<typeof judgeZone>;

const fmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);

/** Best first: buy zones by margin, then watch, then the rest; near a downtown first within each. */
export function rankZones<T extends JudgedZone>(zs: T[], s: BuyBoxSettings): T[] {
  const order: Record<Verdict, number> = { buy: 0, watch: 1, pass: 2, thin: 3 };
  return [...zs].sort((a, b) => order[a.verdict] - order[b.verdict]
    || Number(a.near.miles > s.nearMiles) - Number(b.near.miles > s.nearMiles)
    || Number((a.dom ?? 999) > 30) - Number((b.dom ?? 999) > 30) // homes selling within a month first
    || (b.marginPct ?? -1e9) - (a.marginPct ?? -1e9)
    || (b.money?.maxLot ?? -1e9) - (a.money?.maxLot ?? -1e9));
}
