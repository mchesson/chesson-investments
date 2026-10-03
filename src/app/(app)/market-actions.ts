'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { db } from '@/db';
import { appSettings, marketSyncs } from '@/db/schema';
import { buyBoxFields } from '@/lib/buy-box';
import { BUY_BOX_KEY, buyBoxSettings, ZONES_TAG } from '@/lib/buy-box-data';
import type { FormResult } from '@/components/ActionForm';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { isCounty, sources } from '@/lib/market-sources';
import { countSince, locateOurPlaces, nextSince, runStep } from '@/lib/market-sync';
import { placeAndZoneAll } from '@/lib/locate';
import { isFeed, updatePermits, updateRates, updateRedfin } from '@/lib/market-feeds-sync';
import { FEEDS_TAG } from '@/lib/market-feeds-data';
import { isAutoPart, runAutoUpdate } from '@/lib/market-auto';

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
    updateTag(ZONES_TAG);
  }
  return view(s);
}

const feedLabel = { rates: 'mortgage rates (Federal Reserve)', redfin: 'Redfin market data by ZIP code', permits: 'building permits (Raleigh and Durham)' } as const;

/** Reads one of the free sources: rates, Redfin or permits (each in one go; Redfin's file takes a minute or two). */
export async function updateFeed(key: string): Promise<{ ok?: string; problem?: string }> {
  const user = await requireAction('market.update');
  if (!isFeed(key)) return { problem: 'Pick a source.' };
  const run = key === 'rates' ? updateRates : key === 'redfin' ? updateRedfin : updatePermits;
  const r = await run(user.id);
  await audit({ userId: user.id, entity: 'market', entityId: r.id, action: r.ok ? 'feed-done' : 'feed-failed',
    summary: r.ok ? `updated ${feedLabel[key]}: ${r.rows.toLocaleString()} records read, ${r.added.toLocaleString()} new` : `updating ${feedLabel[key]} stopped: ${r.error}` });
  updateTag(FEEDS_TAG);
  updateTag(ZONES_TAG);
  revalidatePath('/market');
  revalidatePath('/market/buy-box');
  return r.ok ? { ok: `Done: ${r.rows.toLocaleString()} records read, ${r.added.toLocaleString()} new.` } : { problem: `It stopped: ${r.error}. Try again in a few minutes.` };
}

/** Finds our projects and the watchlist on the county parcels, to show them on the map. */
export async function placeOurPlaces() {
  const user = await requireAction('market.update');
  const n = await locateOurPlaces();
  // Anything the parcel match missed, from the address points; and its zoning.
  const r = await placeAndZoneAll(user.id);
  await audit({ userId: user.id, entity: 'market', entityId: user.id, action: 'locate', summary: `put ${n + r.placed} of our projects and watched properties on the map; zoning for ${r.zoned}` });
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
  updateTag(ZONES_TAG);
  revalidatePath('/market/buy-box');
  return { ok: 'Saved: every zone is worked out again with these numbers.' };
}
const BUY_BOX_ID = '00000000-0000-0000-0000-00000000b001';

/** Update Everything Now: one part at a time (the page calls counties, feeds, then places). */
export async function updateEverything(part: string): Promise<{ ok?: string; problem?: string }> {
  const user = await requireAction('market.update');
  if (!isAutoPart(part)) return { problem: 'Pick a part.' };
  const r = await runAutoUpdate(part, { userId: user.id, budgetMs: 240_000, redfin: true });
  updateTag(FEEDS_TAG);
  updateTag(ZONES_TAG);
  revalidatePath('/market');
  return { ok: r.lines.join('; ') };
}
