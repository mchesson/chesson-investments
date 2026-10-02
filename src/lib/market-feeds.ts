// Free market data beyond the county sales (owner, Oct 2, 2026: "I don't want
// to buy anything at this point ... proceed with free items"):
// - mortgage rates each week (the Federal Reserve's FRED, Freddie Mac's survey),
// - Redfin's public market data by ZIP code and county (days on market, homes
//   for sale, new listings, sale price against list, price drops),
// - building permits: new homes and teardowns (Raleigh and Durham open data).
// Pure (no network or database), tested in market-feeds.test.ts.

// ---------- Mortgage rates ----------

export const FRED_30YR = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US';

/** FRED's CSV ("observation_date,MORTGAGE30US" or "DATE,..."): weeks with a rate ("." is a missing week). */
export function parseFredCsv(csv: string): { week: string; rate: number }[] {
  const out: { week: string; rate: number }[] = [];
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) continue;
    const n = Number(v);
    if (v && v.trim() !== '.' && Number.isFinite(n) && n > 0 && n < 30) out.push({ week: d, rate: n });
  }
  return out;
}

/** Monthly principal and interest on a loan. */
export function monthlyPayment(loan: number, ratePct: number, years = 30) {
  const r = ratePct / 100 / 12, n = years * 12;
  if (loan <= 0) return 0;
  return r === 0 ? loan / n : (loan * r) / (1 - (1 + r) ** -n);
}

/**
 * What buying a house at a price costs a month with 20% down: principal and
 * interest, plus taxes and insurance (about 1.2% of the price a year), and the
 * household income a lender would want for it (that payment at 28% of income).
 */
export function affordability(price: number, ratePct: number, downPct = 20) {
  const pi = monthlyPayment(price * (1 - downPct / 100), ratePct);
  const total = pi + (price * 0.012) / 12;
  return { payment: Math.round(total), income: Math.round(((total * 12) / 0.28) / 1000) * 1000 };
}

/**
 * How a price band's sales move with rates: the least-squares line through
 * sales per month against that month's average rate, as the % change in sales
 * for each 1-point rise (from the band's average month). Needs 12 months and
 * rates that moved at least half a point; otherwise null.
 */
export function rateSensitivity(months: { rate: number; sales: number }[]): { pctPerPoint: number; months: number } | null {
  const xs = months.filter((m) => Number.isFinite(m.rate) && Number.isFinite(m.sales));
  if (xs.length < 12) return null;
  const mx = xs.reduce((s, m) => s + m.rate, 0) / xs.length, my = xs.reduce((s, m) => s + m.sales, 0) / xs.length;
  const range = Math.max(...xs.map((m) => m.rate)) - Math.min(...xs.map((m) => m.rate));
  if (range < 0.5 || my <= 0) return null;
  const cov = xs.reduce((s, m) => s + (m.rate - mx) * (m.sales - my), 0), vx = xs.reduce((s, m) => s + (m.rate - mx) ** 2, 0);
  return { pctPerPoint: Math.round(((cov / vx) / my) * 100), months: xs.length };
}
export const sensitivityLabel = (p: number | null | undefined) => (p === null || p === undefined ? 'Not enough to say'
  : p <= -15 ? 'Rate-sensitive' : p <= -5 ? 'Somewhat rate-sensitive' : 'Barely moves with rates');

// ---------- Redfin's market data ----------

export const REDFIN = 'https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker';
export const redfinFiles = [
  { key: 'county', url: `${REDFIN}/county_market_tracker.tsv000.gz` },
  { key: 'zip', url: `${REDFIN}/zip_code_market_tracker.tsv000.gz` },
] as const;
/** The metros we keep (everything else in the national file is passed over). */
export const redfinMetros = ['Raleigh, NC', 'Durham, NC', 'Durham-Chapel Hill, NC'];
export const REDFIN_FROM = '2019-01-01';

/** ZIP codes: the 3 months to the period's end; counties: that month. */
export type TrendRow = {
  regionType: 'zip' | 'county'; region: string; metro: string | null; propertyType: string; periodEnd: string;
  medianSalePrice: number | null; medianListPrice: number | null; medianPpsf: number | null; homesSold: number | null;
  pendingSales: number | null; newListings: number | null; inventory: number | null; monthsOfSupply: number | null;
  medianDom: number | null; saleToList: number | null; soldAboveList: number | null; priceDrops: number | null; offMarket2Wk: number | null;
};
const propTypes: Record<string, string> = { 'All Residential': 'all', 'Single Family Residential': 'single_family', Townhouse: 'townhouse', 'Condo/Co-op': 'condo', 'Multi-Family (2-4 Unit)': 'multi_family' };
export const trendTypes = [{ key: 'all', label: 'All Homes' }, { key: 'single_family', label: 'Single Family' }, { key: 'townhouse', label: 'Townhouse' }, { key: 'condo', label: 'Condo' }] as const;

/** One line of Redfin's TSV (columns found from the header) → a row we keep, or null. */
export function parseRedfinLine(line: string, cols: Map<string, number>): TrendRow | null {
  const cells = line.split('\t').map((c) => c.replace(/^"|"$/g, ''));
  const g = (k: string) => cells[cols.get(k) ?? -1] ?? '';
  const n = (k: string) => { const v = g(k); if (!v || v === 'NA') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
  const metro = g('PARENT_METRO_REGION') || null;
  const type = g('REGION_TYPE');
  const regionType = type === 'zip code' ? 'zip' : type === 'county' ? 'county' : null;
  // ZIP codes come as 3-month rolling numbers, counties month by month.
  if (g('PERIOD_DURATION') !== (regionType === 'county' ? '30' : '90') || g('IS_SEASONALLY_ADJUSTED') !== 'false') return null;
  if (!regionType || !metro || !redfinMetros.includes(metro)) return null;
  const end = g('PERIOD_END');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < REDFIN_FROM) return null;
  const pt = propTypes[g('PROPERTY_TYPE')];
  if (!pt) return null;
  const region = regionType === 'zip' ? g('REGION').replace(/^Zip Code:\s*/, '') : g('REGION');
  if (!region) return null;
  const round = (v: number | null, d = 0) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
  return {
    regionType, region, metro, propertyType: pt, periodEnd: end,
    medianSalePrice: round(n('MEDIAN_SALE_PRICE')), medianListPrice: round(n('MEDIAN_LIST_PRICE')), medianPpsf: round(n('MEDIAN_PPSF'), 1),
    homesSold: round(n('HOMES_SOLD')), pendingSales: round(n('PENDING_SALES')), newListings: round(n('NEW_LISTINGS')), inventory: round(n('INVENTORY')),
    monthsOfSupply: round(n('MONTHS_OF_SUPPLY'), 1), medianDom: round(n('MEDIAN_DOM'), 1), saleToList: round(n('AVG_SALE_TO_LIST'), 4),
    soldAboveList: round(n('SOLD_ABOVE_LIST'), 4), priceDrops: round(n('PRICE_DROPS'), 4), offMarket2Wk: round(n('OFF_MARKET_IN_TWO_WEEKS'), 4),
  };
}
export const headerCols = (header: string) => new Map(header.split('\t').map((c, i) => [c.replace(/^"|"$/g, ''), i] as const));

/** Hot, balanced or slow, from months of supply and days on market (the usual rule of thumb: under 3 months a seller's market, over 6 a buyer's). */
export function marketHeat(r: { monthsOfSupply: number | null; medianDom: number | null }): 'hot' | 'balanced' | 'slow' | null {
  const m = r.monthsOfSupply, d = r.medianDom;
  if (m === null && d === null) return null;
  if ((m !== null && m < 3) || (m === null && d! <= 20)) return 'hot';
  if ((m !== null && m > 6) || (m === null && d! >= 60)) return 'slow';
  return 'balanced';
}
export const heatLabel = { hot: 'Seller’s Market', balanced: 'Balanced', slow: 'Buyer’s Market' } as const;

// ---------- Building permits ----------

export type PermitRow = {
  source: string; county: 'wake' | 'durham'; permitNo: string; kind: PermitKind; issuedOn: string | null; year: number;
  address: string | null; city: string | null; zip: string | null; lat: number | null; lng: number | null;
  cost: number | null; sf: number | null; units: number | null; builder: string | null; description: string | null; status: string | null;
};
/** new_home; rebuild = a new home on a lot whose old house was torn down; demolition = a teardown on its own. */
export type PermitKind = 'new_home' | 'rebuild' | 'demolition';
type Attrs = Record<string, string | number | null | undefined>;
export type PermitFeature = { attributes: Attrs; geometry?: { x: number; y: number } | null };
export type PermitSource = { key: string; label: string; county: 'wake' | 'durham'; url: string; where: (since: string) => string; outFields: string; map: (f: PermitFeature) => PermitRow | null };

const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const day = (v: unknown) => { const n = num(v); return n ? new Date(n).toISOString().slice(0, 10) : null; };
const pos = (v: unknown) => { const n = num(v); return n && n > 0 ? n : null; };
const coord = (lat: unknown, lng: unknown) => {
  const a = num(lat), b = num(lng);
  return a && b && Math.abs(a - 35.9) < 1 && Math.abs(b + 78.8) < 1 ? { lat: Math.round(a * 1e6) / 1e6, lng: Math.round(b * 1e6) / 1e6 } : { lat: null, lng: null };
};
const cityCase = (s: string | null) => (s ? s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()) : null);
/** A new home, not a pool, wall, shed or warehouse. */
/** Raleigh writes the demolition permit into a new home's description ("DEMO-061636-2022 Finaled"): a rebuild on a teardown. */
export const isRebuild = (d: string | null) => !!d && /\bDEMO-\d{4,}/i.test(d);
export const isNewHome = (d: string | null) => !!d && /\b(SFD|single[- ]family|townho(me|use)s?|duplex|dwelling|new home|new residence)\b/i.test(d) && !/\b(pool|retaining wall|shed|garage only|deck only|addition)\b/i.test(d);

export const permitSources: Record<string, PermitSource> = {
  raleigh: {
    key: 'raleigh', label: 'Raleigh permits', county: 'wake',
    url: 'https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Building_Permits/FeatureServer/0/query',
    // New homes by Raleigh's own work class ("New Residential Dwelling" is filed under Existing in its mapped field, so that one isn't used).
    // Its demolition permits stopped appearing in this list in 2021; a rebuild names its demolition in the description.
    where: (since) => `issueddate >= DATE '${since}' AND workclass IN ('New Residential Dwelling', 'Townhouse', 'Manufactured Home')`,
    outFields: 'permitnum,workclass,issueddate,originaladdress1,originalcity,originalzip,estprojectcost,totalsqft,housingunitstotal,contractorcompanyname,proposedworkdescription,statuscurrentmapped,latitude_perm,longitude_perm',
    map: (f) => {
      const a = f.attributes, no = txt(a.permitnum);
      if (!no) return null;
      const issuedOn = day(a.issueddate);
      const d = txt(a.proposedworkdescription);
      // The map point is the permit's geometry; its latitude_perm field is sometimes another spot.
      const at = f.geometry ? coord(f.geometry.y, f.geometry.x) : coord(a.latitude_perm, a.longitude_perm);
      return {
        source: 'raleigh', county: 'wake', permitNo: no, kind: isRebuild(d) ? 'rebuild' : 'new_home', issuedOn, year: Number((issuedOn ?? '0').slice(0, 4)),
        address: txt(a.originaladdress1)?.toUpperCase() ?? null, city: cityCase(txt(a.originalcity)), zip: txt(a.originalzip)?.slice(0, 5) ?? null,
        ...(at.lat === null ? coord(a.latitude_perm, a.longitude_perm) : at), cost: pos(a.estprojectcost), sf: pos(a.totalsqft), units: pos(a.housingunitstotal),
        builder: txt(a.contractorcompanyname), description: d?.slice(0, 300) ?? null, status: txt(a.statuscurrentmapped),
      };
    },
  },
  durham_demo: {
    key: 'durham_demo', label: 'Durham demolitions', county: 'durham',
    url: 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Permits/FeatureServer/10/query',
    where: (since) => `ISSUE_DATE >= DATE '${since}' AND TYPE = 'RESI'`,
    outFields: 'PermitNum,ISSUE_DATE,DESCRIPTION,BLD_Cost,SQFT_FLOOR,BLD_Type,PmtStatus',
    map: (f) => {
      const a = f.attributes, no = txt(a.PermitNum);
      if (!no || txt(a.PmtStatus) === 'Void') return null;
      const issuedOn = day(a.ISSUE_DATE);
      return {
        source: 'durham_demo', county: 'durham', permitNo: no, kind: 'demolition', issuedOn, year: Number((issuedOn ?? '0').slice(0, 4)),
        address: null, city: 'Durham', zip: null, ...coord(f.geometry?.y, f.geometry?.x), cost: pos(a.BLD_Cost), sf: pos(a.SQFT_FLOOR), units: null,
        builder: null, description: [txt(a.BLD_Type), txt(a.DESCRIPTION)].filter(Boolean).join(': ').slice(0, 300) || null, status: txt(a.PmtStatus),
      };
    },
  },
  durham_new: {
    key: 'durham_new', label: 'Durham new homes (active permits)', county: 'durham',
    url: 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Permits/FeatureServer/13/query',
    // Active permits only (no issue date in this layer): the year is the permit number's first two digits.
    where: () => `P_Activity = 'NEW' AND P_Type = 'BI_BLD'`,
    outFields: 'Permit_ID,P_Descript,P_Status,SiteAdd',
    map: (f) => {
      const a = f.attributes, no = txt(a.Permit_ID), d = txt(a.P_Descript);
      if (!no || !isNewHome(d)) return null;
      const yy = Number(no.slice(0, 2));
      return {
        source: 'durham_new', county: 'durham', permitNo: no, kind: 'new_home', issuedOn: null, year: yy >= 10 && yy <= 60 ? 2000 + yy : 0,
        address: txt(a.SiteAdd)?.toUpperCase() ?? null, city: 'Durham', zip: null, ...coord(f.geometry?.y, f.geometry?.x),
        cost: null, sf: null, units: null, builder: null, description: d?.slice(0, 300) ?? null, status: txt(a.P_Status) === 'ISS' ? 'Issued' : txt(a.P_Status),
      };
    },
  },
};
export const permitKinds = { new_home: 'New Home', rebuild: 'New Home on a Teardown', demolition: 'Teardown' } as const;
/** A rebuild is both: a new home and a teardown. */
export const isTeardown = (k: string) => k === 'demolition' || k === 'rebuild';
export const isNewBuild = (k: string) => k === 'new_home' || k === 'rebuild';
export const PERMIT_PAGE = 2000;
export function permitQuery(src: PermitSource, since: string, offset: number, n = PERMIT_PAGE) {
  return new URLSearchParams({
    where: src.where(since), outFields: src.outFields, returnGeometry: 'true', outSR: '4326', orderByFields: 'OBJECTID',
    resultOffset: String(offset), resultRecordCount: String(n), f: 'json',
  }).toString();
}

/** Builders' names written the same way ("D.R. Horton, Inc. T/A Emerald Homes" → "D.R. Horton"; "LENNAR CAROLINAS" → "Lennar Carolinas"). */
export function builderName(s: string | null): string | null {
  if (!s) return null;
  let b = s.replace(/\s+(t\/a|dba|d\/b\/a)\s+.*$/i, '').trim();
  for (let i = 0; i < 2; i++) b = b.replace(/,?\s+(inc|llc|l\.l\.c|co|corp|corporation|company|ltd|i|in|ll)\.?$/i, '').replace(/[,\s]+$/, '').trim(); // "…, I" is a cut-off "Inc"
  // All capitals: Title Case, keeping short letter groups (KB, DRB, M/I) and the state as they are.
  if (b === b.toUpperCase() && /[A-Z]{4,}/.test(b)) b = b.toLowerCase().replace(/\b([a-z])([a-z]*)/g, (_, f: string, r: string) => f.toUpperCase() + r).replace(/\b(Nc|Drb|Kb|Usa)\b/g, (m) => m.toUpperCase()).replace(/\bOf\b/g, 'of');
  return b || null;
}

/** New-home permits and teardowns within a distance of a point, in a set of permits. */
export function permitsNear(p: { lat: number; lng: number }, permits: { lat: number; lng: number; kind: string }[], milesAway = 0.5) {
  const dLat = milesAway / 69, dLng = milesAway / (69 * Math.cos((p.lat * Math.PI) / 180));
  let newHomes = 0, teardowns = 0;
  for (const x of permits) {
    if (Math.abs(x.lat - p.lat) > dLat || Math.abs(x.lng - p.lng) > dLng) continue;
    if (((x.lat - p.lat) / dLat) ** 2 + ((x.lng - p.lng) / dLng) ** 2 > 1) continue;
    if (isTeardown(x.kind)) teardowns++;
    if (isNewBuild(x.kind)) newHomes++;
  }
  return { newHomes, teardowns };
}
