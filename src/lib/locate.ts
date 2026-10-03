import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { projects, properties } from '@/db/schema';
import { audit } from './audit';
import { addressKey, arcText } from './locate-rules';
import { zoningAt } from './zoning-data';

// Where a project or watchlist property is, from the county address points
// (Wake's, then Durham's: public), and its zoning from the county zoning map.
// Runs after a save and from "Find Locations and Zoning". Read-only on the counties.

const WAKE_ADDRESSES = 'https://maps.wakegov.com/arcgis/rest/services/Property/Addresses/MapServer/0';
const DURHAM_ADDRESSES = 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Active_Addresses/FeatureServer/0';

type Hit = { lat: string; lng: string; city: string | null };

async function query(url: string, where: string, cityField: string): Promise<Hit[]> {
  const q = new URLSearchParams({ where, outFields: cityField, outSR: '4326', returnGeometry: 'true', resultRecordCount: '20', f: 'json' });
  const r = await fetch(`${url}/query?${q}`, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
  if (!r.ok) return [];
  const j = await r.json();
  return ((j.features ?? []) as { attributes: Record<string, unknown>; geometry?: { x: number; y: number } }[])
    .filter((f) => f.geometry)
    .map((f) => ({ lat: (Math.round(f.geometry!.y * 1e6) / 1e6).toFixed(6), lng: (Math.round(f.geometry!.x * 1e6) / 1e6).toFixed(6), city: (f.attributes[cityField] as string | null) ?? null }));
}

/** The spot for an address in Wake or Durham, or null (another state, or not found). */
export async function locateAddress(address: string, city: string | null, state: string | null): Promise<Hit | null> {
  if (process.env.COUNTY_LOOKUPS === 'off' || (state && state.toUpperCase() !== 'NC')) return null;
  const k = addressKey(address);
  if (!k) return null;
  const pick = (hits: Hit[]) => {
    if (!hits.length) return null;
    const c = city?.trim().toUpperCase();
    return (c && hits.find((h) => h.city?.toUpperCase() === c)) || (hits.length === 1 || !c ? hits[0] : null);
  };
  try {
    const wake = pick(await query(WAKE_ADDRESSES, `ST_NUM=${k.number} AND ST_NAME='${arcText(k.street)}'`, 'POSTAL_CITY'));
    if (wake) return wake;
    return pick(await query(DURHAM_ADDRESSES, `HOUSENUM='${k.number}' AND STREETNAME='${arcText(k.street)}'`, 'CITY'));
  } catch { return null; }
}

type Kind = 'project' | 'property';

/**
 * Places one project or property on the map if it isn't yet, then saves its
 * zoning (what it allows; the code itself only where none was typed). Each
 * change is in History, "via county records". Returns what it did.
 */
export async function placeAndZone(kind: Kind, id: string, userId: string | null): Promise<{ placed: boolean; zoned: boolean }> {
  const table = kind === 'project' ? projects : properties;
  const [row] = await db.select({ address: table.address, city: table.city, state: table.state, lat: table.lat, lng: table.lng, zoning: table.zoning, zoningFamily: table.zoningFamily })
    .from(table).where(eq(table.id, id));
  if (!row) return { placed: false, zoned: false };
  let { lat, lng } = row;
  let placed = false, zoned = false;
  if (!lat || !lng) {
    const hit = await locateAddress(row.address, row.city, row.state);
    if (hit) {
      await db.update(table).set({ lat: hit.lat, lng: hit.lng }).where(eq(table.id, id));
      await audit({ userId, entity: kind, entityId: id, action: 'update', summary: 'placed it on the map from the county address records', via: 'county records', after: { lat: hit.lat, lng: hit.lng } });
      ({ lat, lng } = hit);
      placed = true;
    }
  }
  if (lat && lng) {
    const z = await zoningAt(lat, lng);
    if (z) {
      const set = { zoningFamily: z.family, zoningPlace: z.place, zoningCheckedAt: new Date(), ...(row.zoning ? {} : { zoning: z.code }) };
      await db.update(table).set(set).where(eq(table.id, id));
      if (row.zoningFamily !== z.family || !row.zoning) {
        await audit({ userId, entity: kind, entityId: id, action: 'update', summary: `zoning from the ${z.place} county map: ${z.code} (${z.label})`, via: 'county records', before: { zoning: row.zoning, zoningFamily: row.zoningFamily }, after: { zoning: row.zoning ?? z.code, zoningFamily: z.family } });
      }
      zoned = true;
    }
  }
  return { placed, zoned };
}

/** Every project and watched property not yet placed or zoned (60 at a time). */
export async function placeAndZoneAll(userId: string | null) {
  const { and, isNull, or } = await import('drizzle-orm');
  let placed = 0, zoned = 0;
  const missed: string[] = [];
  for (const [kind, table] of [['project', projects], ['property', properties]] as const) {
    const rows = await db.select({ id: table.id, address: table.address, lat: table.lat }).from(table)
      .where(and(isNull(table.archived), or(isNull(table.lat), isNull(table.zoningCheckedAt)))).limit(60);
    for (const r of rows) {
      const did = await placeAndZone(kind, r.id, userId);
      if (did.placed) placed++;
      if (did.zoned) zoned++;
      if (!did.zoned) missed.push(r.address);
    }
  }
  return { placed, zoned, missed };
}

/** placeAndZone, but never holding a save up for more than a few seconds. */
export async function placeAndZoneQuickly(kind: Kind, id: string, userId: string | null) {
  await Promise.race([placeAndZone(kind, id, userId).catch(() => null), new Promise((ok) => setTimeout(ok, 8000))]);
}
