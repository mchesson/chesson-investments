import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { entities, entityMembers, entityTaxIds, files, projects } from '@/db/schema';

// Our business entities: who owns what, their documents and tax IDs (the
// numbers stay sealed here; only revealTaxId in entity-actions opens one).

export const entityKinds = [
  { key: 'llc', label: 'LLC' }, { key: 'corporation', label: 'Corporation' }, { key: 'partnership', label: 'Partnership' },
  { key: 'trust', label: 'Trust' }, { key: 'other', label: 'Other' },
] as const;
export const entityKindLabel = (v: string) => entityKinds.find((k) => k.key === v)?.label ?? v;
export const memberRoles = [{ key: 'member', label: 'Member' }, { key: 'manager', label: 'Manager' }, { key: 'member_manager', label: 'Member-Manager' }] as const;
export const memberRoleLabel = (v: string | null) => memberRoles.find((r) => r.key === v)?.label ?? v ?? '';
/** The kinds of business document, kept as the file's caption ("Tax Return · 2025 Form 1065"). */
export const entityDocTypes = [
  'Operating Agreement', 'Articles of Organization', 'Certificate of Existence', 'EIN Letter', 'Tax Return', 'Tax Filing Instructions',
  'Annual Report', 'Insurance', 'Bank Letter', 'Amendment', 'Minutes or Resolution', 'Other',
] as const;

export async function listEntities() {
  const rows = await db.select({
    id: entities.id, name: entities.name, kind: entities.kind, state: entities.state, formedOn: entities.formedOn, status: entities.status, taxForm: entities.taxForm,
    members: sql<number>`(select count(*)::int from entity_members m where m.entity_id = ${entities.id} and m.removed_at is null)`,
    docs: sql<number>`(select count(*)::int from files f where f.entity = 'entity' and f.entity_id = ${entities.id} and f.archived_at is null)`,
    taxIds: sql<number>`(select count(*)::int from entity_tax_ids t where t.entity_id = ${entities.id} and t.archived_at is null)`,
    projects: sql<number>`(select count(*)::int from projects p where p.archived_at is null and p.owned_by ilike '%' || ${entities.name} || '%')`,
  }).from(entities).where(isNull(entities.archived)).orderBy(asc(entities.name));
  return rows;
}

export async function getEntity(id: string) {
  const [e] = await db.select().from(entities).where(eq(entities.id, id));
  if (!e || e.archived) return null;
  const [members, taxIds, docs, owned, partOf] = await Promise.all([
    db.select({
      id: entityMembers.id, name: entityMembers.name, personId: entityMembers.personId, memberEntityId: entityMembers.memberEntityId,
      percent: entityMembers.percent, capital: entityMembers.capital, role: entityMembers.role, since: entityMembers.since, notes: entityMembers.notes,
    }).from(entityMembers).where(and(eq(entityMembers.entityId, id), isNull(entityMembers.removed))).orderBy(sql`${entityMembers.percent} desc nulls last`),
    db.select({ id: entityTaxIds.id, kind: entityTaxIds.kind, label: entityTaxIds.label, last4: entityTaxIds.last4, issuedOn: entityTaxIds.issuedOn, updated: entityTaxIds.updated })
      .from(entityTaxIds).where(and(eq(entityTaxIds.entityId, id), isNull(entityTaxIds.archived))).orderBy(asc(entityTaxIds.kind)),
    db.select({ id: files.id, name: files.name, caption: files.caption, size: files.size, created: files.created, contentType: files.contentType })
      .from(files).where(and(eq(files.entity, 'entity'), eq(files.entityId, id), isNull(files.archived))).orderBy(sql`${files.created} desc`),
    db.select({ id: projects.id, name: projects.name, stage: projects.stage, ownedBy: projects.ownedBy })
      .from(projects).where(and(isNull(projects.archived), sql`${projects.ownedBy} ilike ${'%' + e.name.replace(/[%_]/g, '') + '%'}`)),
    // Where this entity is itself a member (Chesson Investments in WJ Investment Group).
    db.select({ entityId: entityMembers.entityId, name: entities.name, percent: entityMembers.percent, role: entityMembers.role })
      .from(entityMembers).innerJoin(entities, eq(entities.id, entityMembers.entityId))
      .where(and(eq(entityMembers.memberEntityId, id), isNull(entityMembers.removed), isNull(entities.archived))),
  ]);
  const total = members.reduce((s, m) => s + (m.percent ? Number(m.percent) : 0), 0);
  return { entity: e, members, taxIds, docs, projects: owned, partOf, percentTotal: Math.round(total * 10000) / 10000 };
}

export function entityOptions() {
  return db.select({ id: entities.id, name: entities.name }).from(entities).where(isNull(entities.archived)).orderBy(asc(entities.name));
}
