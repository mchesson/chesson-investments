import 'server-only';
import { and, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { projects, properties } from '@/db/schema';
import { isBand, isPlaceName, pace, priceBands, type BandKey } from './market-stats';
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
