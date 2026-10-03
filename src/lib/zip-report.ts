import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { addDays, today } from './format';
import { builderName, isNewBuild, isTeardown } from './market-feeds';
import { isPlaceName } from './market-stats';
import type { ZipFacts } from './zip-report-rules';

// Everything we have on one ZIP code, for /market/zip/<zip>: Redfin's latest,
// county sales (this year against last), permits, its neighborhoods, the
// newest sales and our own places there. Read only; public data and our records.

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function zipReport(zip: string) {
  const t = today(), y1 = addDays(t, -365), y2 = addDays(t, -730);
  const [redfin, sales, uses, hoods, recent, permits, ours, where] = await Promise.all([
    db.execute<Record<string, string | number | null>>(sql`
      with cur as (select * from market_trends where region_type = 'zip' and region = ${zip} and property_type = 'all' order by period_end desc limit 1)
      select cur.period_end::text as period_end, cur.median_dom, cur.months_of_supply, cur.sale_to_list, cur.price_drops, cur.inventory, cur.median_sale_price, cur.median_ppsf, cur.homes_sold,
        (select a.median_dom from market_trends a where a.region_type = 'zip' and a.region = ${zip} and a.property_type = 'all' and a.period_end between cur.period_end - interval '1 year' - interval '10 days' and cur.period_end - interval '1 year' + interval '10 days' limit 1) as dom_ago,
        (select a.median_ppsf from market_trends a where a.region_type = 'zip' and a.region = ${zip} and a.property_type = 'all' and a.period_end between cur.period_end - interval '1 year' - interval '10 days' and cur.period_end - interval '1 year' + interval '10 days' limit 1) as ppsf_ago
      from cur`),
    db.execute<Record<string, string | number | null>>(sql`
      select count(*) filter (where s.sold_on > ${y1})::int as now, count(*) filter (where s.sold_on <= ${y1})::int as before,
        percentile_cont(0.5) within group (order by s.price) filter (where s.sold_on > ${y1}) as price_now,
        percentile_cont(0.5) within group (order by s.price) filter (where s.sold_on <= ${y1}) as price_before,
        percentile_cont(0.5) within group (order by s.price / nullif(s.heated_sf, 0)) filter (where s.sold_on > ${y1} and s.heated_sf > 300) as psf_now,
        percentile_cont(0.5) within group (order by s.price / nullif(s.heated_sf, 0)) filter (where s.sold_on <= ${y1} and s.heated_sf > 300) as psf_before
      from market_sales s join market_parcels p on p.id = s.parcel_id where left(p.zip, 5) = ${zip} and s.sold_on > ${y2}`),
    db.execute<{ land_use: string | null; now: number; before: number; price: string | null; psf: string | null }>(sql`
      select p.land_use, count(*) filter (where s.sold_on > ${y1})::int as now, count(*) filter (where s.sold_on <= ${y1})::int as before,
        percentile_cont(0.5) within group (order by s.price) filter (where s.sold_on > ${y1}) as price,
        percentile_cont(0.5) within group (order by s.price / nullif(s.heated_sf, 0)) filter (where s.sold_on > ${y1} and s.heated_sf > 300) as psf
      from market_sales s join market_parcels p on p.id = s.parcel_id where left(p.zip, 5) = ${zip} and s.sold_on > ${y2}
      group by p.land_use order by count(*) filter (where s.sold_on > ${y1}) desc`),
    db.execute<{ name: string; sales: number; price: string | null; psf: string | null }>(sql`
      select p.neighborhood as name, count(*)::int as sales, percentile_cont(0.5) within group (order by s.price) as price,
        percentile_cont(0.5) within group (order by s.price / nullif(s.heated_sf, 0)) filter (where s.heated_sf > 300) as psf
      from market_sales s join market_parcels p on p.id = s.parcel_id where left(p.zip, 5) = ${zip} and s.sold_on > ${y1} and p.neighborhood is not null
      group by p.neighborhood order by count(*) desc limit 30`),
    db.execute<{ address: string | null; neighborhood: string | null; land_use: string | null; sold_on: string; price: string; heated_sf: number | null; lat: string | null; lng: string | null }>(sql`
      select p.address, p.neighborhood, p.land_use, s.sold_on::text as sold_on, s.price::text as price, s.heated_sf, p.lat::text as lat, p.lng::text as lng
      from market_sales s join market_parcels p on p.id = s.parcel_id where left(p.zip, 5) = ${zip} order by s.sold_on desc limit 15`),
    db.execute<{ kind: string; builder: string | null; address: string | null; issued: string | null; cost: string | null; description: string | null }>(sql`
      select kind, builder, address, issued_on::text as issued, cost::text as cost, left(description, 120) as description from market_permits
      where zip = ${zip} and issued_on >= ${y1} order by issued_on desc`),
    db.execute<{ kind: string; id: string; name: string; stage: string | null }>(sql`
      select 'project' as kind, id, name, stage::text as stage from projects where archived_at is null and left(zip, 5) = ${zip}
      union all select 'watch', id, address, stage::text from properties where archived_at is null and left(zip, 5) = ${zip}`),
    db.execute<{ lat: number | null; lng: number | null; city: string | null; county: string | null }>(sql`
      select avg(lat::float) as lat, avg(lng::float) as lng, mode() within group (order by city) as city, min(county) as county
      from market_parcels where left(zip, 5) = ${zip} and lat is not null`),
  ]);
  const r = redfin.rows[0], s = sales.rows[0];
  const builders = new Map<string, number>();
  for (const p of permits.rows) if (isNewBuild(p.kind)) { const b = builderName(p.builder); if (b) builders.set(b, (builders.get(b) ?? 0) + 1); }
  const topBuilders = [...builders.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, n: count }));
  const projects = ours.rows.filter((o) => o.kind === 'project'), watched = ours.rows.filter((o) => o.kind === 'watch');
  const facts: ZipFacts = {
    zip,
    redfin: r ? {
      periodEnd: String(r.period_end), medianDom: n(r.median_dom), domYearAgo: n(r.dom_ago), monthsOfSupply: n(r.months_of_supply), saleToList: n(r.sale_to_list),
      priceDrops: n(r.price_drops), inventory: n(r.inventory), medianSalePrice: n(r.median_sale_price), medianPpsf: n(r.median_ppsf), ppsfYearAgo: n(r.ppsf_ago), homesSold: n(r.homes_sold),
    } : null,
    sales: {
      now: Number(s?.now ?? 0), before: Number(s?.before ?? 0),
      medianPrice: s?.price_now === null || s?.price_now === undefined ? null : Math.round(Number(s.price_now)),
      medianPriceBefore: s?.price_before === null || s?.price_before === undefined ? null : Math.round(Number(s.price_before)),
      medianPsf: s?.psf_now === null || s?.psf_now === undefined ? null : Math.round(Number(s.psf_now)),
      medianPsfBefore: s?.psf_before === null || s?.psf_before === undefined ? null : Math.round(Number(s.psf_before)),
    },
    permits: {
      newHomes: permits.rows.filter((p) => isNewBuild(p.kind)).length, teardowns: permits.rows.filter((p) => isTeardown(p.kind)).length,
      topBuilder: topBuilders[0] ?? null,
    },
    ours: { projects: projects.length, watched: watched.length },
  };
  const w = where.rows[0];
  return {
    facts,
    place: { lat: n(w?.lat), lng: n(w?.lng), city: w?.city ?? null, county: w?.county ?? null },
    uses: uses.rows.map((u) => ({ use: u.land_use ?? 'other', now: u.now, before: u.before, price: n(u.price), psf: u.psf === null ? null : Math.round(Number(u.psf)) })),
    hoods: hoods.rows.filter((h) => isPlaceName(h.name)).slice(0, 10).map((h) => ({ name: h.name, sales: h.sales, price: n(h.price), psf: h.psf === null ? null : Math.round(Number(h.psf)) })),
    recent: recent.rows.map((x) => ({ ...x, price: Number(x.price), psf: x.heated_sf && x.heated_sf > 300 ? Math.round(Number(x.price) / x.heated_sf) : null })),
    permits: permits.rows.slice(0, 12).map((p) => ({ ...p, builder: builderName(p.builder), cost: n(p.cost) })),
    builders: topBuilders.slice(0, 8),
    projects, watched,
  };
}
