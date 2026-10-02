'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/db';
import { appSettings, marketSyncs } from '@/db/schema';
import { buyBoxFields } from '@/lib/buy-box';
import { BUY_BOX_KEY, buyBoxSettings, ZONES_TAG } from '@/lib/buy-box-data';
import type { FormResult } from '@/components/ActionForm';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { isCounty, sources } from '@/lib/market-sources';
import { countSince, locateOurPlaces, nextSince, runStep } from '@/lib/market-sync';

export type SyncState = { id: string; county: string; status: string; offset: number; total: number | null; parcels: number; newSales: number; error: string | null };
const view = (s: typeof marketSyncs.$inferSelect): SyncState => ({ id: s.id, county: s.county, status: s.status, offset: s.offset, total: s.total, parcels: s.parcels, newSales: s.newSales, error: s.error });

/** Starts refreshing a county's sales (the page then asks for each next page). */
export async function startMarketSync(county: string): Promise<SyncState | { problem: string }> {
  const user = await requireAction('market.update');
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
  const user = await requireAction('market.update');
  const s = await runStep(id);
  if (!s) return { problem: 'Not found.' };
  if (s.status !== 'running') {
    await audit({ userId: user.id, entity: 'market', entityId: s.id, action: s.status === 'done' ? 'sync-done' : 'sync-failed',
      summary: s.status === 'done' ? `refreshed ${sources[s.county as 'wake'].label}: ${s.parcels.toLocaleString()} parcels, ${s.newSales.toLocaleString()} new sales` : `refreshing ${s.county} stopped: ${s.error}` });
    revalidatePath('/market');
    revalidateTag(ZONES_TAG, 'max');
  }
  return view(s);
}

/** Finds our projects and the watchlist on the county parcels, to show them on the map. */
export async function placeOurPlaces() {
  const user = await requireAction('market.update');
  const n = await locateOurPlaces();
  await audit({ userId: user.id, entity: 'market', entityId: user.id, action: 'locate', summary: `put ${n} of our projects and watched properties on the map` });
  revalidatePath('/market');
}

/** The buy box's numbers (what we build, what it costs, what we need to make). */
export async function saveBuyBox(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('properties.edit');
  const next: Record<string, number> = {};
  for (const f of buyBoxFields) {
    const raw = String(d.get(f.key) ?? '').replace(/[$,%\s]/g, '');
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < f.min || n > f.max) return { error: `${f.label}: enter a number from ${f.min} to ${f.max}.` };
    next[f.key] = n;
  }
  const { settings: before } = await buyBoxSettings();
  const changed = buyBoxFields.filter((f) => before[f.key] !== next[f.key]);
  if (!changed.length) return { ok: 'No changes.' };
  await db.transaction(async (tx) => {
    await tx.insert(appSettings).values({ key: BUY_BOX_KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updated: new Date() } });
    await audit({ userId: user.id, entity: 'settings', entityId: BUY_BOX_ID, action: 'buy-box', summary: `changed the buy box: ${changed.map((f) => `${f.label} ${before[f.key]} → ${next[f.key]}`).join('; ')}`, before, after: next }, tx);
  });
  revalidateTag(ZONES_TAG, 'max');
  revalidatePath('/market/buy-box');
  return { ok: 'Saved: every zone is worked out again with these numbers.' };
}
const BUY_BOX_ID = '00000000-0000-0000-0000-00000000b001';
