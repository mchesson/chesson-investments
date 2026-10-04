import 'server-only';
import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { addDays, today } from './format';
import { marketDrivers, type Extras, type MarketDrivers } from './market-drivers';
import { countyMetro } from './econ-sources';

// Read for Buyer Factors: Redfin's monthly county numbers with each month's
// average 30-year rate, and who bought in the last 12 months (county records).
const CACHE_SECONDS = process.env.COUNTY_LOOKUPS === 'off' ? 1 : 6 * 3600;

export const marketDriversNow = unstable_cache(async (): Promise<MarketDrivers | null> => {
  const r = await db.execute<{ region: string; period: string; homes_sold: number | null; new_listings: number | null; price: string | null; rate: string | null }>(sql`
    with rates as (select date_trunc('month', week)::date as month, avg(rate) as rate from market_rates where series = '30yr' group by 1)
    select t.region, t.period_end::text as period, t.homes_sold, t.new_listings, t.median_sale_price::text as price, rates.rate::text as rate
    from market_trends t left join rates on rates.month = date_trunc('month', t.period_end)::date
    where t.region_type = 'county' and t.property_type = 'all' order by t.region, t.period_end`);
  const extras = await economyFor();
  return marketDrivers(r.rows.map((x) => ({ region: x.region, period: x.period, homesSold: Number(x.homes_sold ?? 0), newListings: Number(x.new_listings ?? 0), price: Number(x.price ?? 0),
    rate: x.rate === null ? null : Number(x.rate), extras: extras(x.region, x.period) })));
}, ['market-drivers'], { revalidate: CACHE_SECONDS });

export type WhoBuys = { n: number; investor: number | null; newBuild: number | null; townhouse: number; condo: number; bands: { label: string; pct: number }[] };

/** Who bought homes in the last 12 months, as shares of the market. */
export const whoIsBuying = unstable_cache(async (county: 'wake' | 'durham' | null): Promise<WhoBuys | null> => {
  const r = await db.execute<Record<string, string | number | null>>(sql`
    select count(*)::int as n,
      round(100.0 * count(*) filter (where p.absentee) / nullif(count(*) filter (where p.absentee is not null), 0), 1) as investor,
      round(100.0 * count(*) filter (where p.year_built >= extract(year from s.sold_on)::int - 1) / nullif(count(*) filter (where p.year_built is not null), 0), 1) as new_build,
      round(100.0 * count(*) filter (where p.land_use = 'townhouse') / count(*), 1) as townhouse,
      round(100.0 * count(*) filter (where p.land_use = 'condo') / count(*), 1) as condo,
      round(100.0 * count(*) filter (where s.price < 400000) / count(*), 1) as b1,
      round(100.0 * count(*) filter (where s.price >= 400000 and s.price < 700000) / count(*), 1) as b2,
      round(100.0 * count(*) filter (where s.price >= 700000 and s.price < 1000000) / count(*), 1) as b3,
      round(100.0 * count(*) filter (where s.price >= 1000000 and s.price < 1500000) / count(*), 1) as b4,
      round(100.0 * count(*) filter (where s.price >= 1500000) / count(*), 1) as b5
    from market_sales s join market_parcels p on p.id = s.parcel_id
    where s.sold_on > ${addDays(today(), -365)} and s.price >= 50000 and p.land_use in ('single_family', 'townhouse', 'condo') ${county ? sql`and p.county = ${county}` : sql``}`);
  const x = r.rows[0];
  if (!x || !Number(x.n)) return null;
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    n: Number(x.n), investor: n(x.investor), newBuild: n(x.new_build), townhouse: Number(x.townhouse), condo: Number(x.condo),
    bands: [['Under $400k', x.b1], ['$400k–700k', x.b2], ['$700k–1M', x.b3], ['$1M–1.5M', x.b4], ['$1.5M and up', x.b5]].map(([label, v]) => ({ label: String(label), pct: Number(v) })),
  };
}, ['who-is-buying'], { revalidate: CACHE_SECONDS });

/** The economy for a county-month: its metro's jobs and unemployment, the county's migration that year (the latest year up to two back), last-known national confidence, stocks and inflation over the year. */
async function economyFor() {
  const r = await db.execute<{ series: string; period: string; value: string }>(sql`select series, period::text, value::text from market_econ`);
  const v = new Map(r.rows.map((x) => [`${x.series}|${x.period}`, Number(x.value)]));
  const get = (series: string, period: string) => v.get(`${series}|${period}`) ?? null;
  const shift = (period: string, months: number) => { const d = new Date(`${period}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10); };
  return (region: string, redfinPeriod: string): Extras => {
    const m = `${redfinPeriod.slice(0, 7)}-01`, metro = countyMetro[region], y = Number(redfinPeriod.slice(0, 4));
    let migration: number | null = null;
    for (const yy of [y, y - 1, y - 2]) { migration = get(`migration:${region}`, `${yy}-07-01`); if (migration !== null) break; }
    const cpi = get('cpi', m), cpiAgo = get('cpi', shift(m, -12));
    return {
      jobs: metro ? get(`jobs_${metro}`, m) : null, unemployment: metro ? get(`unemp_${metro}`, m) : null, migration,
      confidence: get('sentiment', m), stocks: get('stocks', m), inflation: cpi !== null && cpiAgo ? Math.round((cpi / cpiAgo - 1) * 1000) / 10 : null,
    };
  };
}
