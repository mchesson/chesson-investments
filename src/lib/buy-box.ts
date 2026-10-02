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
};
// Starting numbers from the owner's Plainview math (Sept 10, 2025): 2,600 sf at
// $190/sf; holding, demolition, survey and closing about 18% of the build;
// realtor and closing about 6%; profit about $150k on $1.1M (13.5%).
export const defaultBuyBox: BuyBoxSettings = { houseSf: 2600, buildPerSf: 190, softPct: 18, sellingPct: 6, profitPct: 13.5, financingPct: 8, nearMiles: 6, minSales: 5, minAbsorb: 3, minLot: 75000 };

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
};
/**
 * One zone's verdict: Buy when the most we can pay covers what lots and
 * teardowns sell for there and the zone absorbs houses at our price; Watch when
 * it's within 15%; Too Expensive otherwise; Not Enough Sales to say.
 */
export function judgeZone(z: ZoneStats, s: BuyBoxSettings) {
  const near = nearestDowntown(z);
  if (!z.finishedPsf || z.finished < s.minSales) return { ...z, near, verdict: 'thin' as Verdict, money: null, band: null, absorb: 0, margin: null, marginPct: null, reasons: [`only ${z.finished} finished-house sales in 2 years (needs ${s.minSales})`] };
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
  if (near.miles > s.nearMiles) reasons.push(`${near.miles} miles from ${near.name}`);
  return { ...z, near, verdict, money, band, absorb, margin, marginPct, reasons };
}
export type JudgedZone = ReturnType<typeof judgeZone>;

const fmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);

/** Best first: buy zones by margin, then watch, then the rest; near a downtown first within each. */
export function rankZones<T extends JudgedZone>(zs: T[], s: BuyBoxSettings): T[] {
  const order: Record<Verdict, number> = { buy: 0, watch: 1, pass: 2, thin: 3 };
  return [...zs].sort((a, b) => order[a.verdict] - order[b.verdict]
    || Number(a.near.miles > s.nearMiles) - Number(b.near.miles > s.nearMiles)
    || (b.marginPct ?? -1e9) - (a.marginPct ?? -1e9)
    || (b.money?.maxLot ?? -1e9) - (a.money?.maxLot ?? -1e9));
}
