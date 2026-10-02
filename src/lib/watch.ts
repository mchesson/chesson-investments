import 'server-only';
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { people, projects, properties } from '@/db/schema';
import { activeStages, type PropertyStage } from './properties';

export type WatchView = 'active' | 'comps' | 'past' | 'all';

export async function listProperties(opts: { view: WatchView; q?: string; page?: number }) {
  const where: SQL[] = [isNull(properties.archived)];
  if (opts.view === 'active') where.push(inArray(properties.stage, activeStages));
  if (opts.view === 'comps') where.push(eq(properties.stage, 'sold'));
  if (opts.view === 'past') where.push(inArray(properties.stage, ['lost', 'passed', 'under_contract'] as PropertyStage[]));
  if (opts.q) {
    const like = `%${opts.q}%`;
    where.push(or(ilike(properties.address, like), ilike(properties.city, like), ilike(properties.neighborhood, like), ilike(properties.zoning, like), ilike(properties.zip, like))!);
  }
  const page = Math.max(1, opts.page ?? 1);
  const rows = await db.select({
    id: properties.id, address: properties.address, city: properties.city, zip: properties.zip, neighborhood: properties.neighborhood,
    stage: properties.stage, askingPrice: properties.askingPrice, lotSf: properties.lotSf, zoning: properties.zoning,
    ourOffer: properties.ourOffer, soldPrice: properties.soldPrice, soldOn: properties.soldOn, winningPrice: properties.winningPrice,
    sourceId: properties.sourcePersonId, sourceName: sql<string | null>`(select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${properties.sourcePersonId})`,
    updated: properties.updated,
    total: sql<number>`count(*) over ()`.mapWith(Number),
  }).from(properties).where(and(...where)).orderBy(desc(properties.updated)).limit(50).offset((page - 1) * 50);
  return { rows, total: rows[0]?.total ?? 0, page, pageSize: 50 };
}

export async function getProperty(id: string) {
  const [p] = await db.select().from(properties).where(eq(properties.id, id));
  if (!p) return null;
  const [source] = p.sourcePersonId ? await db.select().from(people).where(eq(people.id, p.sourcePersonId)) : [];
  const [project] = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.propertyId, id), isNull(projects.archived)));
  return { property: p, source: source ?? null, project: project ?? null };
}
