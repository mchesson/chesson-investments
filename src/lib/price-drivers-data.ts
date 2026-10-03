import 'server-only';
import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { addDays, today } from './format';
import { priceDrivers, usable, type Drivers, type Sale } from './price-drivers';

// The sales the price model is measured on: houses and townhouses sold in the
// last two years, ordinary sales only (price-drivers.ts `usable`). Cached for
// six hours (one second in the tests); it reads about 35,000 sales.
const CACHE_SECONDS = process.env.COUNTY_LOOKUPS === 'off' ? 1 : 6 * 3600;

async function salesFor(county: 'wake' | 'durham' | null, zip: string | null): Promise<Sale[]> {
  const r = await db.execute<{ price: number; sf: number | null; age: number | null; acres: number | null; use: 'single_family' | 'townhouse'; zip: string; month: number }>(sql`
    select s.price::float as price, coalesce(s.heated_sf, p.heated_sf) as sf, (extract(year from s.sold_on)::int - p.year_built) as age, p.acres::float as acres,
      p.land_use as use, left(p.zip, 5) as zip, (extract(year from s.sold_on)::int * 12 + extract(month from s.sold_on)::int) as month
    from market_sales s join market_parcels p on p.id = s.parcel_id
    where s.sold_on > ${addDays(today(), -730)} and p.land_use in ('single_family', 'townhouse') and p.zip is not null
      ${county ? sql`and p.county = ${county}` : sql``} ${zip ? sql`and left(p.zip, 5) = ${zip}` : sql``}`);
  return r.rows.filter((x) => usable({ price: x.price, sf: x.sf, age: x.age, acres: x.acres })).map((x) => ({ ...x, sf: x.sf!, age: x.age === null ? null : Number(x.age), price: Number(x.price), acres: x.acres === null ? null : Number(x.acres) }));
}

/** The whole area (or one county): every factor, ZIPs included. */
export const areaDrivers = unstable_cache(async (county: 'wake' | 'durham' | null): Promise<Drivers | null> => priceDrivers(await salesFor(county, null)),
  ['price-drivers-area'], { revalidate: CACHE_SECONDS });

/** One ZIP on its own: what size, age and lot are worth there. */
export const zipDrivers = unstable_cache(async (zip: string): Promise<Drivers | null> => priceDrivers(await salesFor(null, zip), { minZip: 1 }),
  ['price-drivers-zip'], { revalidate: CACHE_SECONDS });
