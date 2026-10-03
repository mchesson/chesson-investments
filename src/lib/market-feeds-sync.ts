import 'server-only';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { marketPermits, marketRates, marketSyncs, marketTrends } from '@/db/schema';
import { FRED_30YR, headerCols, parseFredCsv, parseRedfinLine, PERMIT_PAGE, permitQuery, permitSources, redfinFiles, redfinMetros, type PermitRow, type TrendRow } from './market-feeds';
import { addDays, today } from './format';

// Reading the free sources into the app (read-only on each). Each update is a
// market_syncs row (county = 'rates' / 'redfin' / 'permits') so the page can
// say when it last ran and what it added.

export const feedKeys = ['rates', 'redfin', 'permits'] as const;
export type FeedKey = (typeof feedKeys)[number];
export const isFeed = (k: string): k is FeedKey => (feedKeys as readonly string[]).includes(k);

async function record<T extends { rows: number; added: number }>(key: FeedKey, since: string, userId: string | null, run: () => Promise<T>) {
  const [row] = await db.insert(marketSyncs).values({ county: key, since, startedBy: userId }).returning();
  try {
    const r = await run();
    await db.update(marketSyncs).set({ status: 'done', parcels: r.rows, newSales: r.added, total: r.rows, offset: r.rows, finished: new Date() }).where(eq(marketSyncs.id, row.id));
    return { ok: true as const, id: row.id, ...r };
  } catch (e) {
    // A database error's own message, not the whole query it came with.
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : null;
    const error = (cause ?? (e instanceof Error ? e.message : String(e))).slice(0, 300);
    await db.update(marketSyncs).set({ status: 'failed', error, finished: new Date() }).where(eq(marketSyncs.id, row.id));
    return { ok: false as const, id: row.id, error };
  }
}

async function lastDone(key: FeedKey) {
  const [r] = await db.select({ started: marketSyncs.started }).from(marketSyncs)
    .where(and(eq(marketSyncs.county, key), eq(marketSyncs.status, 'done'))).orderBy(desc(marketSyncs.started)).limit(1);
  return r?.started ?? null;
}

// ---------- Mortgage rates ----------

export async function updateRates(userId: string | null, fetcher: typeof fetch = fetch) {
  return record('rates', '2015-01-01', userId, async () => {
    const r = await fetcher(FRED_30YR, { signal: AbortSignal.timeout(30_000), cache: 'no-store', headers: { 'user-agent': 'Mozilla/5.0 (compatible; ChessonInvestments/1.0)', accept: 'text/csv' } });
    if (!r.ok) throw new Error(`the Federal Reserve answered ${r.status}`);
    const weeks = parseFredCsv(await r.text()).filter((w) => w.week >= '2015-01-01');
    if (!weeks.length) throw new Error('no rates in what came back');
    let added = 0;
    for (let i = 0; i < weeks.length; i += 500) {
      const rows = weeks.slice(i, i + 500).map((w) => ({ series: '30yr', week: w.week, rate: String(w.rate) }));
      const res = await db.insert(marketRates).values(rows).onConflictDoUpdate({ target: [marketRates.series, marketRates.week], set: { rate: sql`excluded.rate` } })
        .returning({ added: sql<boolean>`xmax = 0` });
      added += res.filter((x) => x.added).length;
    }
    return { rows: weeks.length, added };
  });
}

// ---------- Redfin ----------

/**
 * Streams one of Redfin's national files and keeps the lines for our metros.
 * The file is never held in memory or on disk: each piece is searched for the
 * metro names as bytes, and only matching lines are read.
 */
export async function readRedfin(body: ReadableStream<Uint8Array>, onRows: (rows: TrendRow[]) => Promise<void>) {
  const needles = redfinMetros.map((m) => Buffer.from(`"${m}"`));
  const gunzip = createGunzip({ chunkSize: 1 << 20 });
  const stream = Readable.fromWeb(body as import('node:stream/web').ReadableStream).pipe(gunzip);
  let rest: Buffer = Buffer.alloc(0);
  let cols: Map<string, number> | null = null;
  let batch: TrendRow[] = [];
  let kept = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const buf: Buffer = rest.length ? Buffer.concat([rest, chunk]) : chunk;
    const end = buf.lastIndexOf(10);
    if (end < 0) { rest = buf; continue; }
    let from = 0;
    if (!cols) { const nl = buf.indexOf(10); cols = headerCols(buf.subarray(0, nl).toString('utf8').replace(/\r$/, '')); from = nl + 1; }
    for (const needle of needles) {
      let at = buf.indexOf(needle, from);
      while (at >= 0 && at < end) {
        const s = buf.lastIndexOf(10, at) + 1, e = buf.indexOf(10, at);
        const row = parseRedfinLine(buf.subarray(s, e).toString('utf8').replace(/\r$/, ''), cols);
        if (row) { batch.push(row); kept++; }
        at = buf.indexOf(needle, e);
      }
    }
    rest = Buffer.from(buf.subarray(end + 1));
    if (batch.length >= 1000) { await onRows(batch); batch = []; }
  }
  if (batch.length) await onRows(batch);
  return kept;
}

/** { field: column } → { field: excluded.column } for an upsert. */
const excludedSet = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, c]) => [k, sql.raw(`excluded."${c}"`)]));

async function saveTrends(rows: TrendRow[]) {
  const byKey = new Map(rows.map((r) => [`${r.regionType}|${r.region}|${r.propertyType}|${r.periodEnd}`, r]));
  const s = (v: number | null) => (v === null ? null : String(v));
  const values = [...byKey.values()].map((r) => ({
    regionType: r.regionType, region: r.region, metro: r.metro, propertyType: r.propertyType, periodEnd: r.periodEnd,
    medianSalePrice: s(r.medianSalePrice), medianListPrice: s(r.medianListPrice), medianPpsf: s(r.medianPpsf), homesSold: r.homesSold, pendingSales: r.pendingSales,
    newListings: r.newListings, inventory: r.inventory, monthsOfSupply: s(r.monthsOfSupply), medianDom: s(r.medianDom), saleToList: s(r.saleToList),
    soldAboveList: s(r.soldAboveList), priceDrops: s(r.priceDrops), offMarket2Wk: s(r.offMarket2Wk),
  }));
  let added = 0;
  for (let i = 0; i < values.length; i += 500) {
    const res = await db.insert(marketTrends).values(values.slice(i, i + 500)).onConflictDoUpdate({
      target: [marketTrends.regionType, marketTrends.region, marketTrends.propertyType, marketTrends.periodEnd],
      set: excludedSet({ metro: 'metro', medianSalePrice: 'median_sale_price', medianListPrice: 'median_list_price', medianPpsf: 'median_ppsf', homesSold: 'homes_sold',
        pendingSales: 'pending_sales', newListings: 'new_listings', inventory: 'inventory', monthsOfSupply: 'months_of_supply', medianDom: 'median_dom',
        saleToList: 'sale_to_list', soldAboveList: 'sold_above_list', priceDrops: 'price_drops', offMarket2Wk: 'off_market_2wk' }),
    }).returning({ added: sql<boolean>`xmax = 0` });
    added += res.filter((x) => x.added).length;
  }
  return added;
}

export async function updateRedfin(userId: string | null, fetcher: typeof fetch = fetch) {
  return record('redfin', '2019-01-01', userId, async () => {
    let rows = 0, added = 0;
    for (const f of redfinFiles) {
      const r = await fetcher(f.url, { cache: 'no-store' });
      if (!r.ok || !r.body) throw new Error(`Redfin answered ${r.status} for the ${f.key} file`);
      rows += await readRedfin(r.body, async (batch) => { added += await saveTrends(batch); });
    }
    if (!rows) throw new Error('no Raleigh or Durham rows in Redfin’s files');
    return { rows, added };
  });
}

// ---------- Building permits ----------

async function savePermits(rows: PermitRow[]) {
  const byKey = new Map(rows.map((r) => [`${r.source}|${r.permitNo}`, r]));
  const s = (v: number | null) => (v === null ? null : String(v));
  const int = (v: number | null) => (v === null ? null : Math.round(v));
  const values = [...byKey.values()].map((r) => ({ ...r, lat: s(r.lat), lng: s(r.lng), cost: s(r.cost), sf: int(r.sf), units: int(r.units) }));
  if (!values.length) return 0;
  const set = excludedSet({ kind: 'kind', issuedOn: 'issued_on', year: 'year', address: 'address', city: 'city', zip: 'zip', lat: 'lat', lng: 'lng', cost: 'cost',
    sf: 'sf', units: 'units', builder: 'builder', description: 'description', status: 'status' });
  const res = await db.insert(marketPermits).values(values).onConflictDoUpdate({ target: [marketPermits.source, marketPermits.permitNo], set: { ...set, updated: new Date() } })
    .returning({ added: sql<boolean>`xmax = 0` });
  return res.filter((x) => x.added).length;
}

export async function updatePermits(userId: string | null, fetcher: typeof fetch = fetch) {
  const last = await lastDone('permits');
  const since = last ? addDays(last.toISOString().slice(0, 10), -60) : addDays(today(), -3 * 365);
  return record('permits', since, userId, async () => {
    let rows = 0, added = 0;
    for (const src of Object.values(permitSources)) {
      for (let offset = 0; offset < 100_000; offset += PERMIT_PAGE) {
        const r = await fetcher(`${src.url}?${permitQuery(src, since, offset)}`, { signal: AbortSignal.timeout(30_000), cache: 'no-store', headers: { accept: 'application/json' } });
        if (!r.ok) throw new Error(`${src.label} answered ${r.status}`);
        const j = await r.json() as { features?: Parameters<typeof src.map>[0][]; error?: { message?: string }; exceededTransferLimit?: boolean };
        if (j.error) throw new Error(`${src.label}: ${j.error.message ?? 'an error'}`);
        const feats = j.features ?? [];
        const mapped = feats.map(src.map).filter((x): x is PermitRow => !!x && x.year > 0);
        rows += mapped.length;
        added += await savePermits(mapped);
        if (feats.length < PERMIT_PAGE && !j.exceededTransferLimit) break;
      }
    }
    return { rows, added };
  });
}
