'use server';

import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireAction } from '@/lib/session';
import { AREA_CITIES } from '@/lib/places';

/** Suggestions as someone types a city, ZIP or neighborhood: from the county records and our own. */
export async function suggestAreas(kind: 'city' | 'zip' | 'hood', q: string): Promise<string[]> {
  await requireAction('contacts.edit');
  const t = q.trim().slice(0, 60);
  if (!t) return [];
  if (kind === 'city') {
    const r = await db.execute<{ v: string }>(sql`select distinct initcap(lower(city)) as v from market_parcels where city ilike ${`${t}%`} limit 8`);
    return [...new Set([...AREA_CITIES.filter((c) => c.toLowerCase().startsWith(t.toLowerCase())), ...r.rows.map((x) => x.v)])].slice(0, 8);
  }
  if (kind === 'zip') {
    if (!/^\d{1,5}$/.test(t)) return [];
    const r = await db.execute<{ v: string }>(sql`select distinct left(zip, 5) as v from market_parcels where zip like ${`${t}%`} order by 1 limit 8`);
    return r.rows.map((x) => x.v);
  }
  // Neighborhoods: the busiest that match first.
  const r = await db.execute<{ v: string }>(sql`
    select v from (
      select initcap(lower(neighborhood)) as v, count(*) as n from market_parcels where neighborhood ilike ${`%${t}%`} group by 1
      union all select neighborhood, 1000000 from projects where neighborhood ilike ${`%${t}%`}
      union all select neighborhood, 1000000 from properties where neighborhood ilike ${`%${t}%`}
    ) x group by v order by max(n) desc limit 8`);
  return r.rows.map((x) => x.v);
}
