// What's happening in a ZIP code (owner, Oct 3, 2026: "put in a zip code in the
// market map and tell me what's happening with it"). The page's plain-English
// read of the numbers; pure, tested in zip-report-rules.test.ts. Every sentence
// comes from a number on the page, never a guess: a missing number leaves its
// sentence out.
import { heatLabel, marketHeat } from './market-feeds';
import { pctChange } from './market-stats';

export const cleanZipInput = (v: string | null | undefined) => {
  const m = String(v ?? '').trim().match(/^(\d{5})(?:-\d{4})?$/);
  return m ? m[1] : null;
};

export type ZipFacts = {
  zip: string;
  // Redfin, the latest 3 months (all homes), and a year earlier.
  redfin: { periodEnd: string; medianDom: number | null; domYearAgo: number | null; monthsOfSupply: number | null; saleToList: number | null;
    priceDrops: number | null; inventory: number | null; medianSalePrice: number | null; medianPpsf: number | null; ppsfYearAgo: number | null; homesSold: number | null } | null;
  // County sales: the last 12 months and the 12 before.
  sales: { now: number; before: number; medianPrice: number | null; medianPriceBefore: number | null; medianPsf: number | null; medianPsfBefore: number | null };
  permits: { newHomes: number; teardowns: number; topBuilder: { name: string; n: number } | null };
  ours: { projects: number; watched: number };
};

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000).toLocaleString()}k`);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const change = (c: number | null) => (c === null ? '' : Math.abs(c) < 3 ? 'about the same as' : c > 0 ? `up ${Math.round(c)}% from` : `down ${Math.round(-c)}% from`);

/** The headline: seller's / balanced / buyer's market (Redfin), else how sales are moving. */
export function zipHeadline(f: ZipFacts): string {
  const heat = f.redfin ? marketHeat(f.redfin) : null;
  const sc = pctChange(f.sales.now, f.sales.before);
  const moving = f.sales.now + f.sales.before < 6 ? null : sc === null ? null : sc >= 10 ? 'more homes selling than a year ago' : sc <= -10 ? 'fewer homes selling than a year ago' : 'about as many homes selling as a year ago';
  if (heat) return `${f.zip}: ${heatLabel[heat].toLowerCase()}${moving ? `, ${moving}` : ''}.`;
  if (moving) return `${f.zip}: ${moving}.`;
  return `${f.zip}: not enough sales on file to say.`;
}

/** The story, a sentence per thing we know. */
export function zipStory(f: ZipFacts): string[] {
  const out: string[] = [];
  const r = f.redfin;
  if (r && r.medianDom !== null) {
    const bits = [`Homes are going under contract in a median ${Math.round(r.medianDom)} days`];
    if (r.domYearAgo !== null) bits.push(`(${Math.round(r.domYearAgo)} a year ago)`);
    const more = [r.monthsOfSupply !== null ? `${r.monthsOfSupply} months of supply` : null, r.saleToList !== null ? `selling at ${pct(r.saleToList)} of list` : null].filter(Boolean);
    out.push(`${bits.join(' ')}${more.length ? `, with ${more.join(', ')}` : ''}.`);
  }
  if (r && r.priceDrops !== null) out.push(`${pct(r.priceDrops)} of listings have had a price cut${r.inventory !== null ? `; ${r.inventory} for sale now` : ''}.`);
  const s = f.sales;
  if (s.now || s.before) {
    const c = pctChange(s.now, s.before);
    out.push(`${s.now} ${s.now === 1 ? 'sale' : 'sales'} recorded by the county in the last 12 months${s.before ? `, ${change(c)} ${s.before} the year before` : ''}.`);
  }
  if (s.medianPrice !== null) {
    const pc = pctChange(s.medianPrice, s.medianPriceBefore);
    const psf = s.medianPsf !== null ? `; $${s.medianPsf}/sf${s.medianPsfBefore !== null ? ` (${change(pctChange(s.medianPsf, s.medianPsfBefore)) || 'vs'} $${s.medianPsfBefore} the year before)` : ''}` : '';
    out.push(`Median sale ${money(s.medianPrice)}${s.medianPriceBefore !== null ? `, ${change(pc)} ${money(s.medianPriceBefore)}` : ''}${psf}.`);
  } else if (r && r.medianSalePrice !== null) {
    out.push(`Median sale ${money(r.medianSalePrice)}${r.medianPpsf !== null ? `, $${Math.round(r.medianPpsf)}/sf` : ''} (Redfin).`);
  }
  const p = f.permits;
  if (p.newHomes || p.teardowns) {
    out.push(`${p.newHomes} new ${p.newHomes === 1 ? 'home' : 'homes'} and ${p.teardowns} ${p.teardowns === 1 ? 'teardown' : 'teardowns'} permitted in the last 12 months${p.topBuilder ? `; ${p.topBuilder.name} is building the most (${p.topBuilder.n})` : ''}.`);
  }
  if (f.ours.projects || f.ours.watched) {
    out.push(`We have ${[f.ours.projects ? `${f.ours.projects} ${f.ours.projects === 1 ? 'project' : 'projects'}` : null, f.ours.watched ? `${f.ours.watched} watched ${f.ours.watched === 1 ? 'property' : 'properties'}` : null].filter(Boolean).join(' and ')} here.`);
  }
  return out;
}
