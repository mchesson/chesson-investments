import 'server-only';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { judgeZone, rankZones, readBuyBox } from './buy-box';
import { zoneStats } from './market-data';

export const BUY_BOX_KEY = 'buy_box';
/** Zone numbers only change when the county sales are updated (Update Market Data refreshes them). */
export const ZONES_TAG = 'market-zones';
const cachedZoneStats = unstable_cache(zoneStats, ['zone-stats'], { tags: [ZONES_TAG], revalidate: 6 * 3600 });

export async function buyBoxSettings() {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, BUY_BOX_KEY));
  return { settings: readBuyBox(row?.value), saved: !!row, updated: row?.updated ?? null };
}

/** Every zone judged against the buy box, best first. */
export async function judgedZones(kind: 'neighborhood' | 'street', counties: string[]) {
  const { settings } = await buyBoxSettings();
  const zs = await cachedZoneStats(kind, counties, settings.minSales);
  return { settings, zones: rankZones(zs.map((z) => ({ ...judgeZone(z, settings), basis: z.basis })), settings) };
}

/** The zone a property is in (its neighborhood, else its street), judged: only those two zones are worked out. */
export async function zoneFor(p: { neighborhood: string | null; address: string; city: string | null }) {
  const { normalizeAddress, streetOf } = await import('./market-sources');
  const { settings } = await buyBoxSettings();
  const street = streetOf(normalizeAddress(p.address));
  const [hoods, streets] = await Promise.all([
    p.neighborhood ? zoneStats('neighborhood', [], settings.minSales, { name: p.neighborhood }) : Promise.resolve([]),
    street ? zoneStats('street', [], settings.minSales, { name: street, city: p.city }) : Promise.resolve([]),
  ]);
  const judge = (z: (typeof hoods)[number] | undefined) => (z ? { ...judgeZone(z, settings), basis: z.basis } : null);
  return { settings, hood: judge(hoods[0]), street: judge(streets[0]) };
}
