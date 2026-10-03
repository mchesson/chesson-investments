import 'server-only';
import { sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { addDays, today } from './format';
import { priceBands, type BandKey } from './market-stats';
import { affordability, builderBucket, builderName, builderRecord, rateSensitivity, type BuilderBucket } from './market-feeds';

// Reading the free data for the Market Map and the buy box.

export const FEEDS_TAG = 'market-feeds';
const bandSql = sql.raw(`case ${priceBands.map((b) => `when s.price >= ${b.min}${Number.isFinite(b.max) ? ` and s.price < ${b.max}` : ''} then '${b.key}'`).join(' ')} end`);

/** The 30-year rate now, a year ago and three years ago, and every week for three years. */
export async function rateSummary() {
  const from = addDays(today(), -3 * 365 - 14);
  const r = await db.execute<{ week: string; rate: string }>(sql`select week::text, rate::text from market_rates where series = '30yr' and week >= ${from} order by week`);
  const weeks = r.rows.map((x) => ({ week: x.week, rate: Number(x.rate) }));
  if (!weeks.length) return null;
  const now = weeks[weeks.length - 1];
  const at = (days: number) => { const d = addDays(now.week, -days); return [...weeks].reverse().find((w) => w.week <= d) ?? null; };
  const yearAgo = at(365), threeAgo = at(3 * 365 - 7);
  const min = weeks.reduce((a, b) => (b.rate < a.rate ? b : a)), max = weeks.reduce((a, b) => (b.rate > a.rate ? b : a));
  return { now, yearAgo, threeAgo, min, max, weeks };
}

/** What a house at each price band's middle costs a month, now and a year ago, and how each band's sales have moved with rates. */
export async function bandsAndRates(rate: { now: number; yearAgo: number | null }) {
  const from = addDays(today(), -3 * 365), to = addDays(today(), -30);
  const r = await db.execute<{ band: BandKey; month: string; n: number; rate: string | null }>(sql`
    with m as (select date_trunc('month', s.sold_on)::date as month, ${bandSql} as band, count(*)::int as n
      from market_sales s join market_parcels p on p.id = s.parcel_id
      where s.sold_on > ${from} and s.sold_on <= ${to} and p.land_use in ('single_family', 'townhouse', 'condo') group by 1, 2),
    r as (select date_trunc('month', week)::date as month, avg(rate) as rate from market_rates where series = '30yr' group by 1)
    select m.band, m.month::text, m.n, r.rate::text from m join r on r.month = m.month`);
  const mid: Record<BandKey, number> = { u400: 325_000, '400_700': 550_000, '700_1m': 850_000, '1m_15m': 1_250_000, '15m': 2_000_000 };
  return priceBands.map((b) => {
    const months = r.rows.filter((x) => x.band === b.key && x.rate !== null).map((x) => ({ rate: Number(x.rate), sales: x.n }));
    return {
      band: b.key, label: b.label, price: mid[b.key],
      now: affordability(mid[b.key], rate.now), before: rate.yearAgo === null ? null : affordability(mid[b.key], rate.yearAgo),
      sensitivity: rateSensitivity(months),
    };
  });
}

export type ZipTrend = {
  zip: string; county: string | null; city: string | null; lat: number | null; lng: number | null; periodEnd: string;
  medianSalePrice: number | null; medianPpsf: number | null; ppsfYoy: number | null; homesSold: number | null; newListings: number | null; inventory: number | null;
  monthsOfSupply: number | null; medianDom: number | null; domYearAgo: number | null; saleToList: number | null; priceDrops: number | null; offMarket2Wk: number | null;
};
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Each ZIP code's latest Redfin numbers for a kind of home, with a year earlier to compare; where on the map from our parcels. */
export async function zipTrends(type = 'all'): Promise<ZipTrend[]> {
  const r = await db.execute<Record<string, string | number | null>>(sql`
    with cur as (select distinct on (region) * from market_trends where region_type = 'zip' and property_type = ${type} and period_end >= ${addDays(today(), -365)}
      order by region, period_end desc),
    ago as (select t.region, t.median_dom, t.median_ppsf from market_trends t join cur on cur.region = t.region
      where t.region_type = 'zip' and t.property_type = ${type} and t.period_end between (cur.period_end - interval '1 year' - interval '10 days') and (cur.period_end - interval '1 year' + interval '10 days')),
    -- Where each ZIP is on the map: its parcels' middle, else its permits'.
    loc as (select zip, min(county) as county, mode() within group (order by city) as city, avg(lat) as lat, avg(lng) as lng from (
      select left(zip, 5) as zip, county, city, lat::float as lat, lng::float as lng from market_parcels where zip is not null and lat is not null
      union all select zip, county, city, lat::float, lng::float from market_permits where zip is not null and lat is not null) x group by zip)
    select cur.region as zip, loc.county, loc.city, loc.lat, loc.lng, cur.period_end::text as period_end, cur.median_sale_price, cur.median_ppsf, cur.homes_sold, cur.new_listings, cur.inventory,
      cur.months_of_supply, cur.median_dom, ago.median_dom as dom_ago, case when ago.median_ppsf > 0 then round((cur.median_ppsf / ago.median_ppsf - 1) * 100, 1) end as ppsf_yoy,
      cur.sale_to_list, cur.price_drops, cur.off_market_2wk
    from cur left join ago on ago.region = cur.region left join loc on loc.zip = cur.region
    order by cur.median_dom nulls last`);
  return r.rows.map((x) => ({
    zip: String(x.zip), county: (x.county as string) ?? null, city: (x.city as string) ?? null, lat: num(x.lat), lng: num(x.lng), periodEnd: String(x.period_end),
    medianSalePrice: num(x.median_sale_price), medianPpsf: num(x.median_ppsf), ppsfYoy: num(x.ppsf_yoy), homesSold: num(x.homes_sold), newListings: num(x.new_listings),
    inventory: num(x.inventory), monthsOfSupply: num(x.months_of_supply), medianDom: num(x.median_dom), domYearAgo: num(x.dom_ago), saleToList: num(x.sale_to_list),
    priceDrops: num(x.price_drops), offMarket2Wk: num(x.off_market_2wk),
  }));
}

/** Wake's and Durham's latest month next to the same month a year earlier (all homes). */
export async function countyTrends() {
  const r = await db.execute<Record<string, string | number | null>>(sql`
    with cur as (select distinct on (region) * from market_trends where region_type = 'county' and property_type = 'all'
      and region in ('Wake County, NC', 'Durham County, NC') order by region, period_end desc)
    select cur.region, cur.period_end::text as period_end, cur.median_sale_price, cur.median_dom, cur.months_of_supply, cur.inventory, cur.new_listings, cur.sale_to_list, cur.price_drops,
      ago.median_sale_price as price_ago, ago.median_dom as dom_ago, ago.inventory as inv_ago, ago.months_of_supply as mos_ago
    from cur left join market_trends ago on ago.region_type = 'county' and ago.property_type = 'all' and ago.region = cur.region and ago.period_end = (cur.period_end - interval '1 year')::date`);
  return r.rows.map((x) => ({
    region: String(x.region).replace(', NC', ''), periodEnd: String(x.period_end), medianSalePrice: num(x.median_sale_price), priceAgo: num(x.price_ago),
    medianDom: num(x.median_dom), domAgo: num(x.dom_ago), monthsOfSupply: num(x.months_of_supply), mosAgo: num(x.mos_ago), inventory: num(x.inventory), invAgo: num(x.inv_ago),
    newListings: num(x.new_listings), saleToList: num(x.sale_to_list), priceDrops: num(x.price_drops),
  }));
}

/** Permits on the map: new homes and teardowns in the view, the last two years. */
export async function permitsIn(bbox: [number, number, number, number], kinds: string[]) {
  const [w, s, e, n] = bbox;
  const y = Number(today().slice(0, 4)) - 2;
  const r = await db.execute<{ kind: string; lat: string; lng: string; address: string | null; city: string | null; issued: string | null; year: number; builder: string | null; cost: string | null; description: string | null }>(sql`
    select kind, lat::text, lng::text, address, city, issued_on::text as issued, year, builder, cost::text, left(description, 140) as description from market_permits
    where lat between ${s} and ${n} and lng between ${w} and ${e} and kind in (${sql.join([...new Set((kinds.length ? kinds : ['new_home', 'demolition']).flatMap((k) => [k, 'rebuild']))].map((k) => sql`${k}`), sql`, `)})
      and (issued_on >= ${addDays(today(), -730)} or (issued_on is null and year >= ${y}))
    order by issued_on desc nulls last limit 3000`);
  return r.rows.map((x) => ({ k: x.kind, lat: Number(x.lat), lng: Number(x.lng), a: x.address, c: x.city, d: x.issued ?? String(x.year), b: builderName(x.builder), v: x.cost === null ? null : Number(x.cost), t: x.description }));
}

/** Who is building new homes, the last 12 months (Raleigh's permits name the builder), and where. */
export async function topBuilders(limit = 15) {
  const r = await db.execute<{ builder: string; n: number; cost: string | null; zips: string | null; latest: string }>(sql`
    select builder, count(*)::int as n, percentile_cont(0.5) within group (order by cost) as cost, string_agg(distinct zip, ', ') as zips, max(issued_on)::text as latest
    from market_permits where kind in ('new_home', 'rebuild') and builder is not null and issued_on >= ${addDays(today(), -365)} group by builder`);
  const merged = new Map<string, { builder: string; n: number; cost: number | null; zips: Set<string>; latest: string }>();
  for (const x of r.rows) {
    const name = builderName(x.builder) ?? x.builder;
    const o = merged.get(name) ?? { builder: name, n: 0, cost: null, zips: new Set<string>(), latest: '' };
    o.n += x.n; o.cost = o.cost ?? (x.cost === null ? null : Math.round(Number(x.cost)));
    for (const z of (x.zips ?? '').split(', ').filter(Boolean)) o.zips.add(z);
    if (x.latest > o.latest) o.latest = x.latest;
    merged.set(name, o);
  }
  return [...merged.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((o) => ({ ...o, zips: [...o.zips].sort().slice(0, 6) }));
}

/** New homes and teardowns per ZIP code (Raleigh) or city, the last 12 months. */
export async function permitsByArea(limit = 20) {
  const y = Number(today().slice(0, 4)) - 1;
  const r = await db.execute<{ area: string; county: string; homes: number; teardowns: number }>(sql`
    select coalesce(zip, city, 'Unknown') as area, min(county) as county,
      count(*) filter (where kind in ('new_home', 'rebuild'))::int as homes, count(*) filter (where kind in ('demolition', 'rebuild'))::int as teardowns
    from market_permits where (issued_on >= ${addDays(today(), -365)} or (issued_on is null and year >= ${y})) and coalesce(zip, city) is not null
    group by 1 order by count(*) filter (where kind in ('demolition', 'rebuild')) desc, count(*) desc limit ${limit}`);
  return r.rows;
}

/** Permit points in the last 12 months (for counting around each buy-box zone). */
export const recentPermitPoints = unstable_cache(async () => {
  const y = Number(today().slice(0, 4)) - 1;
  const r = await db.execute<{ kind: string; lat: string; lng: string; builder: string | null }>(sql`
    select kind, lat::text, lng::text, builder from market_permits where lat is not null and (issued_on >= ${addDays(today(), -365)} or (issued_on is null and year >= ${y}))`);
  const counts = new Map<string, number>();
  for (const x of r.rows) { const b = builderName(x.builder); if (b && x.kind !== 'demolition') counts.set(b, (counts.get(b) ?? 0) + 1); }
  return r.rows.map((x) => {
    const b = builderName(x.builder);
    return { kind: x.kind, lat: Number(x.lat), lng: Number(x.lng), builder: b, bucket: b ? builderBucket(b, counts.get(b) ?? 0) : null };
  });
}, ['recent-permits'], { tags: [FEEDS_TAG, 'market-zones'], revalidate: 6 * 3600 }); // market-zones: saving the buy box refreshes it too

export async function feedCounts() {
  const r = await db.execute<{ rates: number; trends: number; permits: number }>(sql`
    select (select count(*) from market_rates)::int as rates, (select count(*) from market_trends)::int as trends, (select count(*) from market_permits)::int as permits`);
  return r.rows[0];
}

export type BuilderRow = {
  builder: string; bucket: BuilderBucket; permits12: number; permitsBefore: number; teardowns: number; zips: string[]; latest: string | null;
  homes: number; sold: number; medianDays: number | null; medianPsf: number | null; quick: boolean; medianCost: number | null;
};

/**
 * Every builder on the permits: how many new homes in the last 12 months and the
 * 12 before, how many on teardown lots, where, and their track record: each
 * permit matched to the county sale of the same address after it (days from
 * permit to sale, $/sf). Raleigh's permits name the builder; Durham's don't.
 */
export const builderTable = unstable_cache(async (): Promise<BuilderRow[]> => {
  const y1 = addDays(today(), -365), y2 = addDays(today(), -730);
  const r = await db.execute<{ builder: string; kind: string; issued_on: string | null; zip: string | null; cost: string | null; sold_on: string | null; price: string | null; sf: number | null }>(sql`
    select p.builder, p.kind, p.issued_on::text, p.zip, p.cost::text, s.sold_on::text, s.price::text, coalesce(mp.heated_sf, p.sf) as sf
    from market_permits p
    left join market_parcels mp on mp.county = p.county and mp.address = p.address
    left join lateral (select ms.sold_on, ms.price from market_sales ms where ms.parcel_id = mp.id and ms.sold_on > p.issued_on order by ms.sold_on limit 1) s on true
    where p.builder is not null and p.kind in ('new_home', 'rebuild') and p.issued_on is not null`);
  const by = new Map<string, typeof r.rows>();
  for (const x of r.rows) { const b = builderName(x.builder); if (b) by.set(b, [...(by.get(b) ?? []), x]); }
  const mid = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  return [...by.entries()].map(([builder, rows]) => {
    const recent = rows.filter((x) => x.issued_on! >= y1);
    const rec = builderRecord(rows.map((x) => ({ issuedOn: x.issued_on!, soldOn: x.sold_on, price: x.price === null ? null : Number(x.price), sf: x.sf })));
    return {
      builder, bucket: builderBucket(builder, recent.length), permits12: recent.length, permitsBefore: rows.filter((x) => x.issued_on! < y1 && x.issued_on! >= y2).length,
      teardowns: rows.filter((x) => x.kind === 'rebuild').length, zips: [...new Set(recent.map((x) => x.zip).filter(Boolean) as string[])].sort(),
      latest: rows.reduce<string | null>((m, x) => (!m || x.issued_on! > m ? x.issued_on : m), null),
      medianCost: mid(rows.map((x) => Number(x.cost)).filter((c) => c > 0)), ...rec,
    };
  }).sort((a, b) => b.permits12 - a.permits12 || b.homes - a.homes);
}, ['builder-table'], { tags: [FEEDS_TAG, 'market-zones'], revalidate: 6 * 3600 });

/** Where local builders with a track record are moving in: their new permits in the last 6 months, by ZIP. */
export async function localBuildersMovingIn() {
  const builders = await builderTable();
  const proven = new Map(builders.filter((b) => b.bucket === 'local' && (b.quick || b.sold >= 3)).map((b) => [b.builder, b]));
  const r = await db.execute<{ builder: string; zip: string | null; n: number; first: string }>(sql`
    select builder, zip, count(*)::int as n, min(issued_on)::text as first from market_permits
    where builder is not null and kind in ('new_home', 'rebuild') and issued_on >= ${addDays(today(), -183)} group by builder, zip`);
  const byZip = new Map<string, { zip: string; builders: { name: string; n: number; medianDays: number | null }[]; permits: number }>();
  for (const x of r.rows) {
    const b = proven.get(builderName(x.builder) ?? '');
    if (!b || !x.zip) continue;
    const o = byZip.get(x.zip) ?? { zip: x.zip, builders: [], permits: 0 };
    o.builders.push({ name: b.builder, n: x.n, medianDays: b.medianDays });
    o.permits += x.n;
    byZip.set(x.zip, o);
  }
  return [...byZip.values()].sort((a, b) => b.builders.length - a.builders.length || b.permits - a.permits);
}
