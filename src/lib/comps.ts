// Comparable sales: where each came from, its finish level, and what they say a
// house is worth (owner, Oct 3, 2026). Pure, so it's tested without a database.

export const compSources = [
  { key: 'public_record', label: 'Public Record', hint: 'County sales: anyone can see them' },
  { key: 'appraisal', label: 'Appraisal', hint: 'From an appraiser’s report' },
  { key: 'new_build', label: 'Presale / New Build', hint: 'A builder’s presale or new construction' },
  { key: 'broker', label: 'Broker Opinion', hint: 'An agent’s CMA or opinion of value' },
  { key: 'listing', label: 'Active Listing', hint: 'For sale now, not sold' },
  { key: 'private', label: 'Private Data', hint: 'Off-market sales and what we know ourselves' },
] as const;
export type CompSource = (typeof compSources)[number]['key'];
export const isCompSource = (s: unknown): s is CompSource => compSources.some((x) => x.key === s);
export const compSourceLabel = (s: string) => compSources.find((x) => x.key === s)?.label ?? s;
/** Public = anyone can look it up; the rest came to us privately. */
export const isPublicSource = (s: string) => s === 'public_record' || s === 'listing';

// Finish level (the "trim level" of a house). Appraisals rate quality Q1 (best) to Q6.
export const finishLevels = [
  { key: 'basic', label: 'Basic', quality: ['Q5', 'Q6'] },
  { key: 'builder', label: 'Builder Grade', quality: ['Q4'] },
  { key: 'upgraded', label: 'Upgraded', quality: ['Q3'] },
  { key: 'high', label: 'High End', quality: ['Q2'] },
  { key: 'luxury', label: 'Luxury / Custom', quality: ['Q1'] },
] as const;
export type FinishLevel = (typeof finishLevels)[number]['key'];
export const isFinishLevel = (s: unknown): s is FinishLevel => finishLevels.some((x) => x.key === s);
export const finishLabel = (s: string | null | undefined) => (s ? finishLevels.find((x) => x.key === s)?.label ?? s : 'Not known');
/** "Q3" (or "Q3;C1", "q 3") → upgraded. Null when there's no Q rating. */
export function finishFromQuality(q: string | null | undefined): FinishLevel | null {
  const m = /\bQ\s*([1-6])\b/i.exec(q ?? '');
  if (!m) return null;
  return finishLevels.find((f) => (f.quality as readonly string[]).includes(`Q${m[1]}`))!.key;
}
/** How far apart two finish levels are (0 = same, null = one not known). */
export function finishGap(a: string | null | undefined, b: string | null | undefined): number | null {
  const i = finishLevels.findIndex((f) => f.key === a);
  const j = finishLevels.findIndex((f) => f.key === b);
  return i < 0 || j < 0 ? null : Math.abs(i - j);
}

export const compStatuses = [
  { key: 'sold', label: 'Sold' }, { key: 'pending', label: 'Pending' }, { key: 'active', label: 'For Sale' }, { key: 'presale', label: 'Presale' },
  { key: 'appraised', label: 'Appraised (Bank Approved)' },
] as const;
export const isCompStatus = (s: unknown): s is (typeof compStatuses)[number]['key'] => compStatuses.some((x) => x.key === s);
export const compStatusLabel = (s: string) => compStatuses.find((x) => x.key === s)?.label ?? s;

export type Adjustment = { label: string; amount: number };
export type CompLike = {
  source: string; status: string; price: number | null; heatedSf: number | null; finishLevel: string | null;
  adjustments: Adjustment[]; adjustedPrice: number | null; counted: boolean; checked: boolean;
  /** What the county recorded once a presale or pending sale closed. */
  actualPrice?: number | null;
};

/** "Size: -12,000; Garage +5000" → adjustments. Lines or semicolons; anything without an amount is dropped. */
export function parseAdjustments(text: string | null | undefined): Adjustment[] {
  const out: Adjustment[] = [];
  for (const part of (text ?? '').split(/[;\n]/)) {
    const m = /^(.*?)[:\s]\s*([+-−]?)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*$/.exec(part.trim());
    if (!m || !m[1].trim()) continue;
    const n = Number(m[3].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    out.push({ label: m[1].trim().replace(/[:\s]+$/, ''), amount: m[2] === '-' || m[2] === '−' ? -n : n });
  }
  return out;
}
export const adjustmentsText = (a: Adjustment[]) => a.map((x) => `${x.label}: ${x.amount < 0 ? '-' : '+'}${Math.abs(x.amount).toLocaleString('en-US')}`).join('; ');

/** The price after adjustments: the appraiser's own figure when given, else price plus the adjustments. */
export function adjusted(c: Pick<CompLike, 'price' | 'adjustments' | 'adjustedPrice' | 'actualPrice'>): number | null {
  const sum = c.adjustments.reduce((s, a) => s + a.amount, 0);
  // Once a presale has closed, the recorded price is the truth.
  if (c.actualPrice != null) return c.actualPrice + sum;
  if (c.adjustedPrice != null) return c.adjustedPrice;
  if (c.price == null) return null;
  return c.price + sum;
}
export const perSf = (price: number | null, sf: number | null) => (price != null && sf ? price / sf : null);

/** A size adjustment (GLA, square feet): it moves a comp to the appraised house's size, so it's left out of $/sf. */
export const isSizeAdjustment = (label: string) => /\b(gla|gross living|living area|size|sq\.? ?ft|square f)/i.test(label);
/**
 * What a comp says per heated square foot: its price (the recorded one once closed)
 * with every adjustment except size, over its own square feet. An appraiser's
 * adjusted price is for the house they appraised, so it isn't divided by the
 * comp's size; with no itemized adjustments the plain price is used.
 */
export function valuePerSf(c: Pick<CompLike, 'price' | 'adjustments' | 'actualPrice' | 'heatedSf'>): number | null {
  const base = c.actualPrice ?? c.price;
  if (base == null || !c.heatedSf) return null;
  return (base + c.adjustments.filter((a) => !isSizeAdjustment(a.label)).reduce((x, a) => x + a.amount, 0)) / c.heatedSf;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** The middle half (25th to 75th percentile) with four or more, else lowest to highest. */
function spread(xs: number[]): [number, number] | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  if (s.length < 4) return [s[0], s[s.length - 1]];
  const at = (p: number) => { const i = (s.length - 1) * p; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
  return [at(0.25), at(0.75)];
}

export type CompSummary = {
  total: number;
  bySource: { key: string; label: string; count: number; counted: number }[];
  publicCount: number; privateCount: number;
  counted: number; toCheck: number;
  medianPerSf: number | null;
  perSfRange: [number, number] | null;
  /** Subject's heated SF × the median adjusted $/sf of the comps counted. */
  value: number | null;
  valueRange: [number, number] | null;
  byFinish: { key: string; label: string; count: number; medianPerSf: number | null; sameAsOurs: boolean }[];
  /** Same as above but only comps at our finish level, when we know it and there are some. */
  sameFinishValue: number | null;
};

/** What the comps say. Only comps counted and looked at (checked) and sold, pending or presale go into the value. */
export function summarize(rows: CompLike[], subject: { heatedSf: number | null; finishLevel: string | null }): CompSummary {
  const used = rows.filter((c) => c.counted && c.checked && c.status !== 'active');
  const psf = (c: CompLike) => valuePerSf(c);
  const ps = used.map(psf).filter((x): x is number => x != null);
  const med = median(ps);
  const range = spread(ps);
  const sf = subject.heatedSf;
  const same = subject.finishLevel ? used.filter((c) => c.finishLevel === subject.finishLevel).map(psf).filter((x): x is number => x != null) : [];
  const sameMed = median(same);
  return {
    total: rows.length,
    bySource: compSources.map((s) => ({ key: s.key, label: s.label, count: rows.filter((c) => c.source === s.key).length, counted: used.filter((c) => c.source === s.key).length })).filter((s) => s.count),
    publicCount: rows.filter((c) => isPublicSource(c.source)).length,
    privateCount: rows.filter((c) => !isPublicSource(c.source)).length,
    counted: used.length,
    toCheck: rows.filter((c) => !c.checked).length,
    medianPerSf: med,
    perSfRange: range,
    value: med != null && sf ? Math.round(med * sf) : null,
    valueRange: range && sf ? [Math.round(range[0] * sf), Math.round(range[1] * sf)] : null,
    byFinish: [...finishLevels.map((f) => ({ key: f.key as string, label: f.label as string })), { key: '', label: 'Not Known' }].map((f) => {
      const these = rows.filter((c) => (c.finishLevel ?? '') === f.key);
      return { ...f, count: these.length, medianPerSf: median(these.filter((c) => used.includes(c)).map(psf).filter((x): x is number => x != null)), sameAsOurs: !!f.key && f.key === subject.finishLevel };
    }).filter((f) => f.count),
    sameFinishValue: sameMed != null && sf ? Math.round(sameMed * sf) : null,
  };
}

/** Straight-line miles between two points. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** Rank county sales offered as comps: closer, newer, and nearer our size first. */
export function rankSuggestions<T extends { miles: number; soldOn: string; heatedSf: number | null }>(rows: T[], subjectSf: number | null, today: string): T[] {
  const days = (d: string) => (Date.parse(today) - Date.parse(d)) / 86400000;
  const score = (r: T) => r.miles / 0.5 + days(r.soldOn) / 180 + (subjectSf && r.heatedSf ? Math.abs(r.heatedSf - subjectSf) / subjectSf / 0.2 : 1);
  return [...rows].sort((a, b) => score(a) - score(b));
}

/** A presale, pending sale or appraised house not sold yet: the twice-daily update looks for it in the county sales. */
export const WATCHED_STATUSES = ['presale', 'pending', 'appraised'] as const;
export const isWatched = (c: { status: string; actualPrice?: number | null }) => (WATCHED_STATUSES as readonly string[]).includes(c.status) && c.actualPrice == null;
/** A recorded sale is the house's close, not the lot's: at least half the price we were given (any price when none was). */
export const looksLikeTheClose = (given: number | null | undefined, recorded: number) => !given || recorded >= given * 0.5;

/** The same house: number, street and unit (suffixes and directions aside). */
export function sameAddress(a: string | null | undefined, b: string | null | undefined, key: (s: string | null | undefined) => { number: number; street: string; unit: string | null } | null): boolean {
  const x = key(a), y = key(b);
  return !!x && !!y && x.number === y.number && x.street === y.street && (x.unit ?? '') === (y.unit ?? '');
}

/** Within 3% of what actually happened is "held up". */
export const HELD_UP_PCT = 3;
/** How far the number we were given was from what actually happened (+ = it sold for more). */
export function offBy(given: number | null | undefined, actual: number | null | undefined): number | null {
  if (!given || actual == null) return null;
  return Math.round(((actual - given) / given) * 1000) / 10;
}

export type Provided = { provider: string | null; price: number | null; actualPrice: number | null };
/** Per person or company who gave us comps: how many, how many we could check, and how close they were. */
export function reliability(rows: Provided[]) {
  const by = new Map<string, { provider: string; given: number; compared: number; heldUp: number; offs: number[] }>();
  for (const r of rows) {
    if (!r.provider) continue;
    const e = by.get(r.provider) ?? { provider: r.provider, given: 0, compared: 0, heldUp: 0, offs: [] };
    e.given++;
    const off = offBy(r.price, r.actualPrice);
    if (off != null) { e.compared++; e.offs.push(off); if (Math.abs(off) <= HELD_UP_PCT) e.heldUp++; }
    by.set(r.provider, e);
  }
  return [...by.values()].map((e) => ({
    provider: e.provider, given: e.given, compared: e.compared, heldUp: e.heldUp,
    averageOff: e.offs.length ? Math.round((e.offs.reduce((a, b) => a + Math.abs(b), 0) / e.offs.length) * 10) / 10 : null,
    verdict: !e.compared ? 'Not known yet' : e.heldUp === e.compared ? 'Held up' : e.heldUp === 0 ? 'Didn’t hold up' : 'Mixed',
  })).sort((a, b) => b.compared - a.compared || a.provider.localeCompare(b.provider));
}
