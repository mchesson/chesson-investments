import 'server-only';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { marketParcels, marketSales, marketSyncs, projects, properties } from '@/db/schema';
import { normalizeAddress, pageQuery, sources, type MarketRow, type Source } from './market-sources';
import { addDays, today } from './format';

// Reading a county's sales into the app, a page at a time (each step is one
// request to the county, so nothing runs long). Read-only on the county.

export const PAGE = 1000;
/** The first load reaches back three years; later ones from a month before the last. */
export const FIRST_LOOKBACK_DAYS = 3 * 365;

async function getJson(url: string): Promise<{ features?: { attributes: Record<string, string | number | null>; centroid?: { x: number; y: number } }[]; count?: number; error?: { message?: string }; exceededTransferLimit?: boolean }> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25_000), headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!r.ok) throw new Error(`the county answered ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error.message ?? 'the county refused the request');
      return j;
    } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error('the county didn’t answer');
}

export async function countSince(src: Source, since: string) {
  const q = new URLSearchParams({ where: src.where(since), returnCountOnly: 'true', f: 'json' });
  return (await getJson(`${src.url}?${q}`)).count ?? 0;
}

/** Where a refresh should start: three years back the first time, else a month before the last finished one. */
export async function nextSince(county: string) {
  const [last] = await db.select({ started: marketSyncs.started }).from(marketSyncs)
    .where(and(eq(marketSyncs.county, county), eq(marketSyncs.status, 'done'))).orderBy(desc(marketSyncs.started)).limit(1);
  return last ? addDays(last.started.toISOString().slice(0, 10), -30) : addDays(today(), -FIRST_LOOKBACK_DAYS);
}

const n = (v: number | null) => (v === null ? null : String(v));

/** Saves one page: parcels updated in place, each new sale kept in the history. */
export async function savePage(all: MarketRow[]) {
  // One row per parcel (a page can list a parcel twice); the latest sale wins.
  const byKey = new Map<string, MarketRow>();
  for (const r of all) { const k = `${r.county}|${r.parcelKey}`; const o = byKey.get(k); if (!o || (r.lastSaleOn ?? '') >= (o.lastSaleOn ?? '')) byKey.set(k, r); }
  const rows = [...byKey.values()];
  if (!rows.length) return { parcels: 0, newSales: 0 };
  return db.transaction(async (tx) => {
    const saved = await tx.insert(marketParcels).values(rows.map((r) => ({
      county: r.county, parcelKey: r.parcelKey, address: r.address, street: r.street, city: r.city, zip: r.zip, neighborhood: r.neighborhood,
      landUse: r.landUse, heatedSf: r.heatedSf, yearBuilt: r.yearBuilt, acres: n(r.acres), assessedValue: n(r.assessedValue),
      ownerName: r.ownerName, absentee: r.absentee, lat: n(r.lat), lng: n(r.lng), lastSalePrice: n(r.lastSalePrice), lastSaleOn: r.lastSaleOn,
    }))).onConflictDoUpdate({
      target: [marketParcels.county, marketParcels.parcelKey],
      set: {
        address: sql`excluded.address`, street: sql`excluded.street`, city: sql`excluded.city`, zip: sql`excluded.zip`, neighborhood: sql`excluded.neighborhood`,
        landUse: sql`excluded.land_use`, heatedSf: sql`excluded.heated_sf`, yearBuilt: sql`excluded.year_built`, acres: sql`excluded.acres`,
        assessedValue: sql`excluded.assessed_value`, ownerName: sql`excluded.owner_name`, absentee: sql`excluded.absentee`, lat: sql`excluded.lat`, lng: sql`excluded.lng`,
        lastSalePrice: sql`excluded.last_sale_price`, lastSaleOn: sql`excluded.last_sale_on`, updated: new Date(),
      },
    }).returning({ id: marketParcels.id, lastSaleOn: marketParcels.lastSaleOn, lastSalePrice: marketParcels.lastSalePrice, heatedSf: marketParcels.heatedSf });
    const sales = saved.filter((p) => p.lastSaleOn && p.lastSalePrice).map((p) => ({ parcelId: p.id, soldOn: p.lastSaleOn!, price: p.lastSalePrice!, heatedSf: p.heatedSf }));
    const added = sales.length ? await tx.insert(marketSales).values(sales).onConflictDoNothing().returning({ id: marketSales.id }) : [];
    return { parcels: saved.length, newSales: added.length };
  });
}

/** Reads the next page of a running refresh; marks it done after the last one. */
export async function runStep(syncId: string) {
  const [s] = await db.select().from(marketSyncs).where(eq(marketSyncs.id, syncId));
  if (!s || s.status !== 'running') return s ?? null;
  const src = sources[s.county as keyof typeof sources];
  try {
    const page = await getJson(`${src.url}?${pageQuery(src, s.since, s.offset, PAGE)}`);
    const feats = page.features ?? [];
    const rows = feats.map(src.map).filter((r): r is MarketRow => !!r);
    const { parcels, newSales } = await savePage(rows);
    const done = feats.length < PAGE && !page.exceededTransferLimit;
    const [next] = await db.update(marketSyncs).set({
      offset: s.offset + feats.length, parcels: s.parcels + parcels, newSales: s.newSales + newSales,
      ...(done ? { status: 'done', finished: new Date() } : {}),
    }).where(eq(marketSyncs.id, syncId)).returning();
    if (done) await locateOurPlaces();
    return next;
  } catch (e) {
    const [next] = await db.update(marketSyncs).set({ status: 'failed', error: e instanceof Error ? e.message : String(e), finished: new Date() }).where(eq(marketSyncs.id, syncId)).returning();
    return next;
  }
}

/** One address on a county's parcels: the centroid, or null. */
async function findAddress(src: Source, address: string) {
  const a = address.replace(/'/g, "''");
  const q = new URLSearchParams({ where: `${src.addressField} = '${a}'`, outFields: 'OBJECTID', returnGeometry: 'false', returnCentroid: 'true', outSR: '4326', resultRecordCount: '1', f: 'json' });
  const j = await getJson(`${src.url}?${q}`);
  const c = j.features?.[0]?.centroid;
  return c ? { lat: String(Math.round(c.y * 1e6) / 1e6), lng: String(Math.round(c.x * 1e6) / 1e6) } : null;
}

/** Puts our projects and the watchlist on the map: their address on Wake's parcels, else Durham's. */
export async function locateOurPlaces() {
  let placed = 0;
  for (const table of [projects, properties] as const) {
    const rows = await db.select({ id: table.id, address: table.address }).from(table).where(and(isNull(table.lat), isNull(table.archived))).limit(200);
    for (const r of rows) {
      const a = normalizeAddress(r.address);
      if (!a) continue;
      const hit = (await findAddress(sources.wake, a).catch(() => null)) ?? (await findAddress(sources.durham, a).catch(() => null));
      if (hit) { await db.update(table).set(hit).where(eq(table.id, r.id)); placed++; }
    }
  }
  return placed;
}

export async function lastSyncs() {
  return db.execute<{ county: string; status: string; started: Date; finished: Date | null; parcels: number; new_sales: number; offset: number; total: number | null; error: string | null; id: string }>(sql`
    select distinct on (county) id, county, status, created_at as started, finished_at as finished, parcels, new_sales, "offset", total, error
    from ${marketSyncs} order by county, created_at desc`).then((r) => r.rows);
}

/** The county parcel at a point on the map (staff only: it names the owner). */
export async function parcelAt(lat: number, lng: number) {
  for (const src of [sources.wake, sources.durham]) {
    const q = new URLSearchParams({
      geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: src.fields.join(','), returnGeometry: 'false', returnCentroid: 'true', outSR: '4326', resultRecordCount: '1', f: 'json',
    });
    const j = await getJson(`${src.url}?${q}`).catch(() => null);
    const f = j?.features?.[0];
    if (f) {
      // Every residential and land parcel maps; anything else still answers with its address and owner.
      const row = src.map(f);
      const a = f.attributes;
      return {
        county: src.label, address: row?.address ?? String(a[src.addressField] ?? ''), city: row?.city ?? null,
        owner: row?.ownerName ?? (typeof a.OWNER === 'string' ? a.OWNER : typeof a.PROPERTY_OWNER === 'string' ? a.PROPERTY_OWNER : null),
        absentee: row?.absentee ?? null, landUse: row?.landUse ?? 'other', heatedSf: row?.heatedSf ?? null, yearBuilt: row?.yearBuilt ?? null,
        acres: row?.acres ?? null, assessedValue: row?.assessedValue ?? null, lastSalePrice: row?.lastSalePrice ?? null, lastSaleOn: row?.lastSaleOn ?? null,
        neighborhood: row?.neighborhood ?? null, lat: f.centroid?.y ?? lat, lng: f.centroid?.x ?? lng,
      };
    }
  }
  return null;
}

/** Addresses on the county parcels that start with what was typed (for "Go to an address"). */
export async function countyAddressSearch(text: string) {
  const a = normalizeAddress(text);
  if (!a || a.length < 4 || !/^\d/.test(a)) return [];
  const out: { label: string; lat: number; lng: number }[] = [];
  for (const src of [sources.wake, sources.durham]) {
    const q = new URLSearchParams({ where: `${src.addressField} LIKE '${a.replace(/'/g, "''")}%'`, outFields: `${src.addressField},${src.cityField}`, returnGeometry: 'false', returnCentroid: 'true', outSR: '4326', resultRecordCount: '5', f: 'json' });
    const j = await getJson(`${src.url}?${q}`).catch(() => null);
    for (const f of j?.features ?? []) if (f.centroid) out.push({ label: `${f.attributes[src.addressField]}, ${String(f.attributes[src.cityField] ?? '').replace(/\b\w/g, (c) => c.toUpperCase())}`, lat: f.centroid.y, lng: f.centroid.x });
  }
  return out.slice(0, 8);
}
