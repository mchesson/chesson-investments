import 'server-only';
import { and, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { projects, properties } from '@/db/schema';
import { isBand, isPlaceName, median, pace, priceBands, type BandKey } from './market-stats';
import { miles } from './buy-box';
import { landUses } from './market-sources';
import { addDays, today } from './format';

export type MarketFilters = { counties: string[]; uses: string[]; bands: BandKey[]; months: number };

/** Filters from the address (?county=wake,durham&use=single_family&band=u400&months=12). */
export function readFilters(sp: Record<string, string | undefined>): MarketFilters {
  const list = (v?: string) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
  const counties = list(sp.county).filter((c) => c === 'wake' || c === 'durham');
  const uses = list(sp.use).filter((u) => landUses.some((l) => l.key === u));
  const bands = list(sp.band).filter(isBand);
  const months = [6, 12, 24, 36].includes(Number(sp.months)) ? Number(sp.months) : 12;
  return { counties, uses, bands, months };
}

const bandSql = sql.raw(`case ${priceBands.map((b) => `when s.price >= ${b.min}${Number.isFinite(b.max) ? ` and s.price < ${b.max}` : ''} then '${b.key}'`).join(' ')} end`);

/** The where clause for sales: county, kind of property and price band (time is per query). */
function salesWhere(f: MarketFilters, withBand = true): SQL {
  const parts: SQL[] = [sql`true`];
  if (f.counties.length) parts.push(sql`p.county in (${sql.join(f.counties.map((c) => sql`${c}`), sql`, `)})`);
  if (f.uses.length) parts.push(sql`p.land_use in (${sql.join(f.uses.map((u) => sql`${u}`), sql`, `)})`);
  if (withBand && f.bands.length) parts.push(sql`(${bandSql}) in (${sql.join(f.bands.map((b) => sql`${b}`), sql`, `)})`);
  return sql.join(parts, sql` and `);
}

/** Each price band: sales now against the year before, and the median price and $/sf now. */
export async function bandTrends(f: MarketFilters) {
  // The 6 months before the last 30 days (the counties are still recording those)
  // against the same 6 months a year earlier, so seasons don't skew it.
  const t = today(), end = addDays(t, -30), six = addDays(end, -183), yearEnd = addDays(end, -365), yearStart = addDays(six, -365);
  const r = await db.execute<{ band: BandKey; recent: number; prior: number; median_price: number | null; median_psf: number | null }>(sql`
    select ${bandSql} as band,
      count(*) filter (where s.sold_on > ${six} and s.sold_on <= ${end})::int as recent,
      count(*) filter (where s.sold_on > ${yearStart} and s.sold_on <= ${yearEnd})::int as prior,
      percentile_cont(0.5) within group (order by s.price) filter (where s.sold_on > ${six} and s.sold_on <= ${end}) as median_price,
      percentile_cont(0.5) within group (order by s.price / nullif(s.heated_sf, 0)) filter (where s.sold_on > ${six} and s.sold_on <= ${end} and s.heated_sf > 300) as median_psf
    from market_sales s join market_parcels p on p.id = s.parcel_id
    where ${salesWhere(f, false)} and s.sold_on > ${yearStart}
    group by 1`);
  return priceBands.map((b) => {
    const x = r.rows.find((y) => y.band === b.key);
    return { band: b.key, label: b.label, recent: x?.recent ?? 0, prior: x?.prior ?? 0, medianPrice: x?.median_price ? Number(x.median_price) : null,
      medianPsf: x?.median_psf ? Math.round(Number(x.median_psf)) : null, ...pace(x?.recent ?? 0, x?.prior ?? 0) };
  });
}

export type AreaKind = 'neighborhood' | 'street' | 'city';
/** The busiest neighborhoods, streets or towns in the period: sales, median price and $/sf, and $/sf against the period before. */
export async function areaTable(kind: AreaKind, f: MarketFilters, limit = 40) {
  const t = today(), from = addDays(t, -Math.round(f.months * 30.44)), before = addDays(from, -Math.round(f.months * 30.44));
  const key = kind === 'neighborhood' ? sql`p.neighborhood` : kind === 'street' ? sql`p.street` : sql`p.city`;
  const r = await db.execute<{ name: string; city: string | null; county: string; sales: number; prior: number; median_price: number; median_psf: number | null; prior_psf: number | null; lat: number; lng: number }>(sql`
    select ${key} as name, ${kind === 'city' ? sql`null` : sql`min(p.city)`} as city, min(p.county) as county,
      count(*) filter (where s.sold_on > ${from})::int as sales,
      count(*) filter (where s.sold_on <= ${from} and s.sold_on > ${before})::int as prior,
      percentile_cont(0.5) within group (order by s.price) filter (where s.sold_on > ${from}) as median_price,
      percentile_cont(0.5) within group (order by s.price / nullif(s.heated_sf, 0)) filter (where s.sold_on > ${from} and s.heated_sf > 300) as median_psf,
      percentile_cont(0.5) within group (order by s.price / nullif(s.heated_sf, 0)) filter (where s.sold_on <= ${from} and s.sold_on > ${before} and s.heated_sf > 300) as prior_psf,
      avg(p.lat::float) as lat, avg(p.lng::float) as lng
    from market_sales s join market_parcels p on p.id = s.parcel_id
    where ${salesWhere(f)} and ${key} is not null and s.sold_on > ${before}
    group by ${key}${kind === 'city' ? sql`` : sql`, p.county`}
    having count(*) filter (where s.sold_on > ${from}) >= ${kind === 'street' ? 3 : 5}
    order by sales desc limit ${limit * 2}`);
  return r.rows.filter((x) => kind !== 'neighborhood' || isPlaceName(x.name)).slice(0, limit).map((x) => ({ ...x, median_price: Number(x.median_price), median_psf: x.median_psf ? Math.round(Number(x.median_psf)) : null, prior_psf: x.prior_psf ? Math.round(Number(x.prior_psf)) : null }));
}

export type Point = { id: string; lat: number; lng: number; price: number; psf: number | null; on: string; a: string | null; h: string | null; u: string; sf: number | null };
/** Sales inside the map's view (newest first, at most `limit`). */
export async function pointsIn(bbox: [number, number, number, number], f: MarketFilters, limit = 4000) {
  const [west, south, east, north] = bbox;
  const from = addDays(today(), -Math.round(f.months * 30.44));
  const r = await db.execute<{ id: string; lat: string; lng: string; price: string; heated_sf: number | null; sold_on: string; address: string | null; neighborhood: string | null; land_use: string }>(sql`
    select p.id, p.lat, p.lng, s.price, s.heated_sf, s.sold_on, p.address, p.neighborhood, p.land_use
    from market_sales s join market_parcels p on p.id = s.parcel_id
    where ${salesWhere(f)} and s.sold_on > ${from} and p.lat between ${south} and ${north} and p.lng between ${west} and ${east}
    order by s.sold_on desc limit ${limit + 1}`);
  const more = r.rows.length > limit;
  const points: Point[] = r.rows.slice(0, limit).map((x) => {
    const price = Number(x.price);
    return { id: x.id, lat: Number(x.lat), lng: Number(x.lng), price, sf: x.heated_sf, psf: x.heated_sf && x.heated_sf > 300 ? Math.round(price / x.heated_sf) : null, on: String(x.sold_on).slice(0, 10), a: x.address, h: x.neighborhood, u: x.land_use };
  });
  return { points, more };
}

/** Our projects and the watchlist with a place on the map. */
export async function ourPlaces() {
  const [ps, ws, missing] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, stage: projects.stage, lat: projects.lat, lng: projects.lng }).from(projects).where(and(isNull(projects.archived), isNotNull(projects.lat))),
    db.select({ id: properties.id, name: properties.address, stage: properties.stage, lat: properties.lat, lng: properties.lng }).from(properties).where(and(isNull(properties.archived), isNotNull(properties.lat))),
    db.execute<{ n: number }>(sql`select ((select count(*) from projects where archived_at is null and lat is null) + (select count(*) from properties where archived_at is null and lat is null))::int as n`),
  ]);
  return {
    projects: ps.map((p) => ({ id: p.id, name: p.name, stage: p.stage, lat: Number(p.lat), lng: Number(p.lng) })),
    watch: ws.map((p) => ({ id: p.id, name: p.name, stage: p.stage, lat: Number(p.lat), lng: Number(p.lng) })),
    notPlaced: missing.rows[0]?.n ?? 0,
  };
}

export async function marketCounts() {
  const r = await db.execute<{ county: string; parcels: number; sales: number; newest: string | null }>(sql`
    select p.county, count(distinct p.id)::int as parcels, count(s.id)::int as sales, max(s.sold_on)::text as newest
    from market_parcels p left join market_sales s on s.parcel_id = p.id group by p.county`);
  return r.rows;
}

/**
 * Each zone's numbers for the buy box: finished-house $/sf (new builds when
 * there are enough, else the top quarter of bigger houses), lot and teardown
 * sales, and sales by price band in the last 12 months.
 */
export async function zoneStats(kind: 'neighborhood' | 'street', counties: string[], minSales: number, only?: { name: string; city?: string | null }) {
  const t = today(), y2 = addDays(t, -730), y3 = addDays(t, -1095), y1 = addDays(t, -365);
  const newYear = Number(t.slice(0, 4)) - 10;
  const key = kind === 'neighborhood' ? sql`p.neighborhood` : sql`p.street`;
  const where = sql.join([
    counties.length ? sql`p.county in (${sql.join(counties.map((c) => sql`${c}`), sql`, `)})` : sql`true`,
    // One zone only (a watched property's street or neighborhood): fast.
    only ? sql`lower(${key}) = lower(${only.name})` : sql`true`,
    only?.city && kind === 'street' ? sql`lower(p.city) = lower(${only.city})` : sql`true`,
  ], sql` and `);
  const r = await db.execute<{
    name: string; city: string | null; county: string; lat: number; lng: number;
    finished: number; top_psf: number | null; new_count: number; new_psf: number | null; entry_count: number; entry_price: number | null; psf_recent: number | null; psf_prior: number | null; zip: string | null;
  }>(sql`
    with z as (
      select ${key} as name, p.city, p.county, left(p.zip, 5) as zip, p.lat::float as lat, p.lng::float as lng, p.land_use, p.year_built, p.heated_sf as sf, s.price::float as price, s.sold_on,
        ${bandSql} as band
      from market_sales s join market_parcels p on p.id = s.parcel_id
      where ${where} and ${key} is not null and s.sold_on > ${y3}
    )
    select name, min(city) as city, min(county) as county, mode() within group (order by zip) as zip, avg(lat) as lat, avg(lng) as lng,
      count(*) filter (where sold_on > ${y2} and land_use in ('single_family', 'townhouse') and sf >= 1500)::int as finished,
      percentile_cont(0.75) within group (order by price / sf) filter (where sold_on > ${y2} and land_use in ('single_family', 'townhouse') and sf >= 1500) as top_psf,
      count(*) filter (where sold_on > ${y2} and land_use = 'single_family' and year_built >= ${newYear} and sf >= 1500)::int as new_count,
      percentile_cont(0.5) within group (order by price / sf) filter (where sold_on > ${y2} and land_use = 'single_family' and year_built >= ${newYear} and sf >= 1500) as new_psf,
      0 as entry_count, null::float as entry_price,
      percentile_cont(0.5) within group (order by price / sf) filter (where sold_on > ${y1} and land_use in ('single_family', 'townhouse') and sf >= 1500) as psf_recent,
      case when count(*) filter (where sold_on > ${y2} and sold_on <= ${y1} and land_use in ('single_family', 'townhouse') and sf >= 1500) >= 3
        and count(*) filter (where sold_on > ${y1} and land_use in ('single_family', 'townhouse') and sf >= 1500) >= 3
        then percentile_cont(0.5) within group (order by price / sf) filter (where sold_on > ${y2} and sold_on <= ${y1} and land_use in ('single_family', 'townhouse') and sf >= 1500) end as psf_prior
    from z group by name ${kind === 'street' ? sql`, city` : sql`, county`}
    having count(*) filter (where sold_on > ${y2}) >= 3`);
  // Sales by price band in the last 12 months, per zone (a second, plain grouping: fast).
  const sub = kind === 'street' ? sql`p.city` : sql`p.county`;
  const bandRows = await db.execute<{ name: string; sub: string | null; band: BandKey; n: number }>(sql`
    select ${key} as name, ${sub} as sub, ${bandSql} as band, count(*)::int as n
    from market_sales s join market_parcels p on p.id = s.parcel_id
    where ${where} and ${key} is not null and s.sold_on > ${y1} group by 1, 2, 3`);
  // A box a little over a mile around the zone, for one zone's nearby lot sales.
  const c0 = r.rows[0];
  const box = c0 ? { s: Number(c0.lat) - 0.016, n: Number(c0.lat) + 0.016, w: Number(c0.lng) - 0.02, e: Number(c0.lng) + 0.02 } : { s: 0, n: 0, w: 0, e: 0 };
  // Lots and teardowns: land sales, and old small houses that sold well under the
  // zone's finished $/sf (a renovated old house isn't a teardown).
  const entryRows = await db.execute<{ name: string; sub: string | null; land_use: string; price: number; psf: number | null; lat: number; lng: number }>(sql`
    select ${key} as name, ${sub} as sub, p.land_use, s.price::float as price, case when p.heated_sf > 0 then s.price::float / p.heated_sf end as psf, p.lat::float as lat, p.lng::float as lng
    from market_sales s join market_parcels p on p.id = s.parcel_id
    where ${only ? sql`p.lat between ${box.s} and ${box.n} and p.lng between ${box.w} and ${box.e}` : where} and ${key} is not null and s.sold_on > ${y3}
      and (p.land_use = 'land' or (p.land_use = 'single_family' and p.year_built < 1970 and p.heated_sf < 1600))`);
  const allEntries = entryRows.rows.map((x) => ({ key: `${x.name}|${x.sub ?? ''}`, landUse: x.land_use, price: Number(x.price), psf: x.psf === null ? null : Number(x.psf), lat: Number(x.lat), lng: Number(x.lng) }));
  const bands = new Map<string, Partial<Record<BandKey, number>>>();
  for (const x of bandRows.rows) {
    const k = `${x.name}|${x.sub ?? ''}`;
    bands.set(k, { ...(bands.get(k) ?? {}), [x.band]: x.n });
  }
  return r.rows.filter((z) => kind === 'street' || isPlaceName(z.name)).map((z) => {
    const useNew = z.new_count >= minSales && z.new_psf;
    const finishedPsf = useNew ? Math.round(Number(z.new_psf)) : z.top_psf ? Math.round(Number(z.top_psf)) : null;
    const zoneKey = `${z.name}|${(kind === 'street' ? z.city : z.county) ?? ''}`;
    const isLot = (e: (typeof allEntries)[number]) => e.landUse === 'land' || (!!finishedPsf && e.psf !== null && e.psf < finishedPsf * 0.65);
    // Lot and teardown sales in the zone; with fewer than 3, the nearest within a mile (street by street, not town by town).
    let lots = allEntries.filter((e) => e.key === zoneKey && isLot(e)).map((e) => e.price);
    let lotsFrom = 'in it';
    if (lots.length < 3) {
      const near = allEntries.filter(isLot).map((e) => ({ e, d: miles({ lat: Number(z.lat), lng: Number(z.lng) }, e) })).filter((x) => x.d <= 1).sort((x, y) => x.d - y.d).slice(0, 7);
      if (near.length >= 3) { lots = near.map((x) => x.e.price); lotsFrom = `within ${Math.max(0.1, Math.round(near[near.length - 1].d * 10) / 10)} mi`; }
    }
    return {
      name: z.name, city: z.city, county: z.county, zip: z.zip, lat: Number(z.lat), lng: Number(z.lng),
      finished: useNew ? z.new_count : z.finished, finishedPsf,
      basis: useNew ? 'new builds' as const : 'top quarter of houses' as const,
      entryCount: lots.length, entryPrice: lots.length ? Math.round(median(lots)!) : null, entryFrom: lotsFrom,
      bandCounts: bands.get(`${z.name}|${(kind === 'street' ? z.city : z.county) ?? ''}`) ?? {},
      psfRecent: z.psf_recent === null ? null : Number(z.psf_recent), psfPrior: z.psf_prior === null ? null : Number(z.psf_prior),
    };
  });
}
