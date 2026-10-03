import 'server-only';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { companies, comps, files, people } from '@/db/schema';
import { addDays, today } from './format';
import { milesBetween, rankSuggestions, reliability, type Adjustment } from './comps';

const n = (v: string | null) => (v == null ? null : Number(v));

export type CompRecord = Awaited<ReturnType<typeof compsFor>>[number];

/** A project's comps, sold newest first; those still to look at come first. */
export async function compsFor(projectId: string) {
  const rows = await db.select({
    id: comps.id, source: comps.source, status: comps.status, address: comps.address, city: comps.city, neighborhood: comps.neighborhood,
    soldOn: comps.soldOn, price: comps.price, heatedSf: comps.heatedSf, beds: comps.beds, baths: comps.baths, yearBuilt: comps.yearBuilt,
    lotAcres: comps.lotAcres, finishLevel: comps.finishLevel, quality: comps.quality, distanceMi: comps.distanceMi, adjustments: comps.adjustments,
    adjustedPrice: comps.adjustedPrice, counted: comps.counted, checked: comps.checked, notes: comps.notes, fileId: comps.fileId, fileName: files.name,
    marketSaleId: comps.marketSaleId, expectedCloseOn: comps.expectedCloseOn, actualPrice: comps.actualPrice, actualSoldOn: comps.actualSoldOn,
    providedByPersonId: comps.providedByPersonId, providedByCompanyId: comps.providedByCompanyId, builderName: comps.builderName, customBuild: comps.customBuild,
    provider: sql<string | null>`coalesce(${people.firstName} || ' ' || ${people.lastName}, ${companies.name})`,
  }).from(comps).leftJoin(files, eq(files.id, comps.fileId))
    .leftJoin(people, eq(people.id, comps.providedByPersonId)).leftJoin(companies, eq(companies.id, comps.providedByCompanyId))
    .where(and(eq(comps.projectId, projectId), isNull(comps.archived)))
    .orderBy(asc(comps.checked), desc(sql`coalesce(${comps.soldOn}, '1900-01-01')`), asc(comps.address));
  return rows.map((r) => ({
    ...r, price: n(r.price), beds: n(r.beds), baths: n(r.baths), lotAcres: n(r.lotAcres), distanceMi: n(r.distanceMi),
    adjustedPrice: n(r.adjustedPrice), actualPrice: n(r.actualPrice), adjustments: (r.adjustments ?? []) as Adjustment[],
  }));
}

/** The project's documents Claude can read comps from (PDFs and photos), likely ones first. */
export async function compDocs(projectId: string) {
  const rows = await db.select({ id: files.id, name: files.name, caption: files.caption, contentType: files.contentType }).from(files)
    .where(and(eq(files.entity, 'project'), eq(files.entityId, projectId), isNull(files.archived), isNull(files.photoKind),
      inArray(files.contentType, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])))
    .orderBy(desc(files.created));
  const likely = (r: (typeof rows)[number]) => /apprais|comp|cma|broker|bpo|valuation|market analysis/i.test(`${r.name} ${r.caption ?? ''}`);
  return [...rows.filter(likely), ...rows.filter((r) => !likely(r))].map((r) => ({ ...r, likely: likely(r) }));
}

export type Suggestion = {
  saleId: string; address: string; city: string | null; neighborhood: string | null; soldOn: string; price: number; heatedSf: number | null;
  yearBuilt: number | null; acres: number | null; landUse: string | null; miles: number;
};

/**
 * County sales near the project offered as comps: houses (not lots) sold in the
 * last 18 months within a mile, sized 60% to 160% of ours when we know ours, not
 * already added. Ranked closer, newer and nearer our size first.
 */
export async function suggestedComps(p: { id: string; lat: string | null; lng: string | null; heatedSf: number | null; address: string }, limit = 12): Promise<Suggestion[]> {
  if (!p.lat || !p.lng) return [];
  const lat = Number(p.lat), lng = Number(p.lng);
  const dLat = 1 / 69, dLng = 1 / (69 * Math.cos((lat * Math.PI) / 180));
  const since = addDays(today(), -548);
  const sf = p.heatedSf;
  const r = await db.execute<{ sale_id: string; address: string | null; city: string | null; neighborhood: string | null; sold_on: string; price: string; heated_sf: number | null; year_built: number | null; acres: string | null; land_use: string | null; lat: string; lng: string }>(sql`
    select s.id as sale_id, pa.address, pa.city, pa.neighborhood, s.sold_on, s.price, coalesce(s.heated_sf, pa.heated_sf) as heated_sf, pa.year_built, pa.acres, pa.land_use, pa.lat, pa.lng
    from market_sales s join market_parcels pa on pa.id = s.parcel_id
    where pa.lat between ${lat - dLat} and ${lat + dLat} and pa.lng between ${lng - dLng} and ${lng + dLng}
      and s.sold_on >= ${since} and s.price >= 50000
      and pa.land_use in ('single_family', 'townhouse', 'condo')
      and coalesce(s.heated_sf, pa.heated_sf, 0) > 400
      ${sf ? sql`and coalesce(s.heated_sf, pa.heated_sf) between ${Math.round(sf * 0.6)} and ${Math.round(sf * 1.6)}` : sql``}
      and not exists (select 1 from comps c where c.market_sale_id = s.id and c.project_id = ${p.id} and c.archived_at is null)
    order by s.sold_on desc limit 300`);
  const self = p.address.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rows = r.rows
    .filter((x) => x.address && x.address.toLowerCase().replace(/[^a-z0-9]/g, '') !== self)
    .map((x) => ({
      saleId: x.sale_id, address: x.address!, city: x.city, neighborhood: x.neighborhood, soldOn: String(x.sold_on).slice(0, 10), price: Number(x.price),
      heatedSf: x.heated_sf, yearBuilt: x.year_built, acres: x.acres == null ? null : Number(x.acres), landUse: x.land_use,
      miles: Math.round(milesBetween({ lat, lng }, { lat: Number(x.lat), lng: Number(x.lng) }) * 100) / 100,
    }))
    .filter((x) => x.miles <= 1);
  return rankSuggestions(rows, sf, today()).slice(0, limit);
}

/** Whose numbers hold up, across every project: what each source told us against what the county recorded. */
export async function providerReliability() {
  const rows = await db.select({
    provider: sql<string | null>`coalesce(${people.firstName} || ' ' || ${people.lastName}, ${companies.name})`,
    price: comps.price, actualPrice: comps.actualPrice,
  }).from(comps).leftJoin(people, eq(people.id, comps.providedByPersonId)).leftJoin(companies, eq(companies.id, comps.providedByCompanyId))
    .where(and(isNull(comps.archived), sql`(${comps.providedByPersonId} is not null or ${comps.providedByCompanyId} is not null)`));
  return reliability(rows.map((r) => ({ provider: r.provider, price: n(r.price), actualPrice: n(r.actualPrice) })));
}
