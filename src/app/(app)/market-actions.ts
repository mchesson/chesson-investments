'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { marketSyncs } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { isCounty, sources } from '@/lib/market-sources';
import { countSince, locateOurPlaces, nextSince, runStep } from '@/lib/market-sync';

export type SyncState = { id: string; county: string; status: string; offset: number; total: number | null; parcels: number; newSales: number; error: string | null };
const view = (s: typeof marketSyncs.$inferSelect): SyncState => ({ id: s.id, county: s.county, status: s.status, offset: s.offset, total: s.total, parcels: s.parcels, newSales: s.newSales, error: s.error });

/** Starts refreshing a county's sales (the page then asks for each next page). */
export async function startMarketSync(county: string): Promise<SyncState | { problem: string }> {
  const user = await requireAction('properties.edit');
  if (!isCounty(county)) return { problem: 'Pick a county.' };
  const since = await nextSince(county);
  let total: number;
  try { total = await countSince(sources[county], since); } catch (e) { return { problem: `${sources[county].label} didn’t answer: ${e instanceof Error ? e.message : e}. Try again in a minute.` }; }
  const s = await db.transaction(async (tx) => {
    await tx.update(marketSyncs).set({ status: 'failed', error: 'replaced by a newer refresh', finished: new Date() }).where(eq(marketSyncs.status, 'running'));
    const [row] = await tx.insert(marketSyncs).values({ county, since, total, startedBy: user.id }).returning();
    await audit({ userId: user.id, entity: 'market', entityId: row.id, action: 'sync-start', summary: `started refreshing ${sources[county].label}'s sales since ${since} (${total.toLocaleString()} records)` }, tx);
    return row;
  });
  return view(s);
}

/** Reads the next page; History records how a refresh ended. */
export async function stepMarketSync(id: string): Promise<SyncState | { problem: string }> {
  const user = await requireAction('properties.edit');
  const s = await runStep(id);
  if (!s) return { problem: 'Not found.' };
  if (s.status !== 'running') {
    await audit({ userId: user.id, entity: 'market', entityId: s.id, action: s.status === 'done' ? 'sync-done' : 'sync-failed',
      summary: s.status === 'done' ? `refreshed ${sources[s.county as 'wake'].label}: ${s.parcels.toLocaleString()} parcels, ${s.newSales.toLocaleString()} new sales` : `refreshing ${s.county} stopped: ${s.error}` });
    revalidatePath('/market');
  }
  return view(s);
}

/** Finds our projects and the watchlist on the county parcels, to show them on the map. */
export async function placeOurPlaces() {
  const user = await requireAction('properties.edit');
  const n = await locateOurPlaces();
  await audit({ userId: user.id, entity: 'market', entityId: user.id, action: 'locate', summary: `put ${n} of our projects and watched properties on the map` });
  revalidatePath('/market');
}
