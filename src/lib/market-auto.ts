import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog, marketSyncs } from '@/db/schema';
import { audit } from './audit';
import { linkBills } from './bill-linking';
import { watchPresales } from './comp-watch';
import { placeAndZoneAll } from './locate';
import { isCounty, sources } from './market-sources';
import { countSince, locateOurPlaces, nextSince, runStep } from './market-sync';
import { updateEconomy, updatePermits, updateRates, updateRedfin } from './market-feeds-sync';

// The twice-daily update (owner, Oct 3, 2026: "update at night or twice a day
// ... and then place them now automatically"), and Update Everything Now. In
// three parts so each fits in one run: the counties' sales, the free sources,
// then our places, zoning and bills. Read-only on every outside source.

export const AUTO_VIA = 'scheduled update';
export type AutoPart = 'counties' | 'feeds' | 'places';
export const isAutoPart = (v: string | null): v is AutoPart => v === 'counties' || v === 'feeds' || v === 'places';

/** Each county's new sales since the last refresh; carries on a refresh the last run didn't finish. */
async function counties(deadline: number, userId: string | null) {
  const out: string[] = [];
  for (const county of ['wake', 'durham'] as const) {
    if (!isCounty(county)) continue;
    let [s] = await db.select().from(marketSyncs).where(and(eq(marketSyncs.county, county), eq(marketSyncs.status, 'running'))).orderBy(desc(marketSyncs.started)).limit(1);
    if (!s) {
      const since = await nextSince(county);
      const total = await countSince(sources[county], since).catch(() => null);
      if (total === null) { out.push(`${sources[county].label} didn’t answer`); continue; }
      [s] = await db.insert(marketSyncs).values({ county, since, total, startedBy: userId }).returning();
    }
    let cur: typeof s | null = s;
    while (cur && cur.status === 'running' && Date.now() < deadline) cur = await runStep(cur.id);
    out.push(cur?.status === 'done' ? `${sources[county].label}: ${cur.newSales.toLocaleString()} new sales` : cur?.status === 'failed' ? `${sources[county].label} stopped: ${cur.error}` : `${sources[county].label}: carries on next run`);
  }
  return out;
}

async function feeds(withRedfin: boolean, userId: string | null) {
  const out: string[] = [];
  const r = await updateRates(userId);
  out.push(r.ok ? `rates: ${r.added} new` : `rates stopped: ${r.error}`);
  const e = await updateEconomy(userId);
  out.push(e.ok ? `economy: ${e.added.toLocaleString()} new${e.problems.length ? ` (${e.problems.length} source${e.problems.length === 1 ? '' : 's'} didn’t answer)` : ''}` : `economy stopped: ${e.error}`);
  const p = await updatePermits(userId);
  out.push(p.ok ? `permits: ${p.added.toLocaleString()} new` : `permits stopped: ${p.error}`);
  if (withRedfin) {
    const f = await updateRedfin(userId);
    out.push(f.ok ? `Redfin: ${f.added.toLocaleString()} new` : `Redfin stopped: ${f.error}`);
  }
  return out;
}

async function places(userId: string | null, via: string) {
  const parcelHits = process.env.COUNTY_LOOKUPS === 'off' ? 0 : await locateOurPlaces().catch(() => 0);
  const z = await placeAndZoneAll(userId);
  const b = await linkBills(userId, via);
  const w = await watchPresales(userId, via);
  return [`placed ${parcelHits + z.placed} on the map`, `zoning for ${z.zoned}`, `linked ${b.linked} bills`, `${w.found} of ${w.watched} presales found closed`];
}

/** One part of the update; History says what it did ("System (scheduled update)" when no one pressed it). */
export async function runAutoUpdate(part: AutoPart, opts: { userId?: string | null; budgetMs?: number; redfin?: boolean } = {}) {
  const userId = opts.userId ?? null;
  const via = userId ? 'Update Everything Now' : AUTO_VIA;
  const deadline = Date.now() + (opts.budgetMs ?? 240_000);
  let lines: string[];
  try {
    // Tests never call the counties or the free sources.
    if (process.env.COUNTY_LOOKUPS === 'off' && part !== 'places') lines = ['skipped (outside sources are off here)'];
    else lines = part === 'counties' ? await counties(deadline, userId) : part === 'feeds' ? await feeds(opts.redfin ?? true, userId) : await places(userId, via);
  } catch (e) {
    lines = [`stopped: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`];
  }
  const summary = `updated the ${part === 'counties' ? 'county sales' : part === 'feeds' ? 'rates, permits and market data' : 'map places, zoning and bills'}: ${lines.join('; ')}`;
  await audit({ userId, entity: 'market', entityId: null, action: `auto-${part}`, summary, via });
  return { part, lines, summary };
}

/** When each part last ran, and what it said (the Market page). */
export async function lastAutoUpdates() {
  const rows = await db.select({ action: auditLog.action, at: auditLog.at, summary: auditLog.summary, via: auditLog.via }).from(auditLog)
    .where(and(eq(auditLog.entity, 'market'))).orderBy(desc(auditLog.at)).limit(60);
  const last: Partial<Record<AutoPart, { at: Date; summary: string | null; via: string | null }>> = {};
  for (const r of rows) {
    const p = r.action.replace(/^auto-/, '');
    if (r.action.startsWith('auto-') && isAutoPart(p) && !last[p]) last[p] = { at: r.at, summary: r.summary, via: r.via };
  }
  return last;
}
