// The suggestion lists every city, state, neighborhood and area field uses
// (list="city-options" ...), rendered once in the app layout.
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { AREA_CITIES, US_STATES, cityList } from '@/lib/places';

export async function PlaceLists() {
  const rows = await db.execute<{ kind: string; v: string }>(sql`
    select 'city' as kind, city as v from people where city is not null
    union select 'city', city from companies where city is not null
    union select 'city', city from projects where city is not null
    union select 'city', city from properties where city is not null
    union select 'hood', neighborhood from projects where neighborhood is not null
    union select 'hood', neighborhood from properties where neighborhood is not null`);
  const cities = cityList(rows.rows.filter((r) => r.kind === 'city').map((r) => r.v));
  const hoods = [...new Set(rows.rows.filter((r) => r.kind === 'hood').map((r) => r.v.trim()))].sort();
  return (
    <div hidden>
      <datalist id="city-options">{cities.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="state-options">{US_STATES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</datalist>
      <datalist id="neighborhood-options">{hoods.map((h) => <option key={h} value={h} />)}</datalist>
      <datalist id="area-options">{[...hoods, ...AREA_CITIES, 'Wake County', 'Durham County', 'Orange County', 'Johnston County', 'Chatham County'].map((a) => <option key={a} value={a} />)}</datalist>
    </div>
  );
}
