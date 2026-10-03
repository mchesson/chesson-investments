import 'server-only';
import { isNull } from 'drizzle-orm';
import { db } from '@/db';
import { entities, projects } from '@/db/schema';
import { can } from './permissions';
import type { SessionUser } from './session';
import type { Target } from './doc-filing';

/** Where a document can be filed for this person: the properties, and the business entities when they may see them. */
export async function targetsFor(user: SessionUser): Promise<Target[]> {
  const ps = await db.select({ id: projects.id, name: projects.name, address: projects.address, city: projects.city, state: projects.state }).from(projects).where(isNull(projects.archived));
  // Entity names are listed for overhead too; filing business records on them still needs the owner (decide()).
  const es = can(user, 'sensitive.view') || can(user, 'money.view') ? await db.select({ id: entities.id, name: entities.name }).from(entities).where(isNull(entities.archived)) : [];
  return [
    ...ps.map((p) => ({ kind: 'project' as const, id: p.id, name: p.name, detail: [p.address, p.city, p.state].filter(Boolean).join(', ') })),
    ...es.map((e) => ({ kind: 'entity' as const, id: e.id, name: e.name })),
  ];
}
