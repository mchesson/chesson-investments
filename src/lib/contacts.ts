import 'server-only';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { db, type Reader } from '@/db';
import { auditLog, companies, eventPeople, events, partyRoles, people, personCompanies, properties, projects, savedListMembers, savedLists, tasks, touches, users, bills, projectUtilities } from '@/db/schema';
import { isCold } from './roles';
import { today } from './format';
import { ref } from '@/lib/sql-ref';

const PAGE = 50;

export const lastTouchSql = sql<string | null>`(select max(t.happened_on)::text from ${touches} t where t.person_id = ${ref(people.id)} and t.archived_at is null)`;

export async function listPeople(opts: { q?: string; roles?: string[]; supply?: string[]; stage?: string; page?: number; business?: boolean }) {
  const where = [isNull(people.archived)];
  if (opts.q) {
    const like = `%${opts.q}%`;
    where.push(or(
      ilike(sql`${people.firstName} || ' ' || ${people.lastName}`, like),
      ilike(people.email, like), ilike(people.phone, `%${opts.q.replace(/\D/g, '') || opts.q}%`),
      sql`exists (select 1 from ${companies} c where c.id = ${ref(people.companyId)} and c.name ilike ${like})`,
      sql`exists (select 1 from ${partyRoles} r where r.person_id = ${ref(people.id)} and r.removed_at is null and (r.trade ilike ${like} or r.areas ilike ${like}))`,
    )!);
  }
  if (opts.roles?.length) {
    // Any of the chosen roles; a stage only narrows when one role is chosen.
    const list = sql.join(opts.roles.map((r) => sql`${r}`), sql`, `);
    where.push(sql`exists (select 1 from ${partyRoles} r where r.person_id = ${ref(people.id)} and r.removed_at is null and r.role in (${list})
      ${opts.stage && opts.roles.length === 1 ? sql`and r.stage = ${opts.stage}` : sql``})`);
  }
  if (opts.supply?.length) {
    // Suppliers of any of these kinds.
    const kinds = sql`array[${sql.join(opts.supply.map((k) => sql`${k}`), sql`, `)}]::text[]`;
    where.push(sql`exists (select 1 from ${partyRoles} r where r.person_id = ${ref(people.id)} and r.removed_at is null and r.role = 'supplier' and r.supplier_types && ${kinds})`);
  }
  if (opts.business) {
    // Hide people whose only roles are Personal Connection (friends and family).
    where.push(sql`not (exists (select 1 from ${partyRoles} r where r.person_id = ${ref(people.id)} and r.removed_at is null and r.role = 'personal')
      and not exists (select 1 from ${partyRoles} r where r.person_id = ${ref(people.id)} and r.removed_at is null and r.role <> 'personal'))`);
  }
  const page = Math.max(1, opts.page ?? 1);
  const rows = await db.select({
    id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email, phone: people.phone,
    title: people.title, companyId: people.companyId, companyName: companies.name, lastTouch: lastTouchSql,
    introducedById: people.introducedById,
    introducedByName: sql<string | null>`(select i.first_name || ' ' || i.last_name from ${people} i where i.id = ${ref(people.introducedById)})`,
    doNotUse: people.doNotUse, doNotUseReason: people.doNotUseReason,
    companyTypes: sql<{ role: string; stage: string; supplierTypes: string[] | null }[]>`coalesce((select json_agg(json_build_object('role', r.role, 'stage', r.stage, 'supplierTypes', r.supplier_types) order by r.created_at) from ${partyRoles} r where r.company_id = ${ref(people.companyId)} and r.removed_at is null), '[]')`,
    roles: sql<{ role: string; stage: string; supplierTypes: string[] | null; areas: string | null }[]>`coalesce((select json_agg(json_build_object('role', r.role, 'stage', r.stage, 'supplierTypes', r.supplier_types, 'areas', r.areas) order by r.created_at) from ${partyRoles} r where r.person_id = ${ref(people.id)} and r.removed_at is null), '[]')`,
    // The properties they're tied to (owner, Oct 3, 2026: "a column for the property they are associated with"):
    // our projects they worked on, billed, bid, look after or had issues on, and watched properties they sent us.
    places: sql<{ kind: 'project' | 'property'; id: string; name: string }[]>`coalesce((select json_agg(x order by x.name) from (
      select distinct 'project' as kind, pr.id, pr.name from projects pr where pr.archived_at is null and pr.id in (
        select b.project_id from bills b where b.vendor_person_id = ${ref(people.id)} and b.archived_at is null
        union select c.project_id from commitments c where c.vendor_person_id = ${ref(people.id)} and c.archived_at is null
        union select a.project_id from assignments a where a.person_id = ${ref(people.id)} and a.archived_at is null
        union select u.project_id from project_utilities u where u.person_id = ${ref(people.id)} and u.removed_at is null
        union select rc.project_id from rental_contacts rc where rc.person_id = ${ref(people.id)}
        union select vi.project_id from vendor_issues vi where vi.person_id = ${ref(people.id)} and vi.archived_at is null
        union select bv.project_id from budget_versions bv where bv.person_id = ${ref(people.id)})
      union select distinct 'property' as kind, w.id, w.address as name from properties w where w.source_person_id = ${ref(people.id)} and w.archived_at is null
    ) x), '[]')`,
    total: sql<number>`count(*) over ()`.mapWith(Number),
  }).from(people).leftJoin(companies, eq(companies.id, people.companyId))
    .where(and(...where)).orderBy(asc(people.lastName), asc(people.firstName))
    .limit(PAGE).offset((page - 1) * PAGE);
  return { rows, total: rows[0]?.total ?? 0, page, pageSize: PAGE };
}

function rolesWithGc(where: ReturnType<typeof eq>) {
  return db.select({
    id: partyRoles.id, role: partyRoles.role, stage: partyRoles.stage, trade: partyRoles.trade, areas: partyRoles.areas,
    licenseNumber: partyRoles.licenseNumber, notes: partyRoles.notes, stageChangedAt: partyRoles.stageChangedAt, supplierTypes: partyRoles.supplierTypes,
    hiredThroughCompanyId: partyRoles.hiredThroughCompanyId,
    hiredThroughName: sql<string | null>`(select c.name from ${companies} c where c.id = ${ref(partyRoles.hiredThroughCompanyId)})`,
  }).from(partyRoles).where(and(where, isNull(partyRoles.removed))).orderBy(asc(partyRoles.created));
}

export async function getPerson(id: string) {
  const [p] = await db.select().from(people).where(eq(people.id, id));
  if (!p) return null;
  const [company] = p.companyId ? await db.select().from(companies).where(eq(companies.id, p.companyId)) : [];
  const [introducedBy] = p.introducedById ? await db.select().from(people).where(eq(people.id, p.introducedById)) : [];
  const roleRows = await rolesWithGc(eq(partyRoles.personId, id));
  const [last] = await db.select({ on: sql<string | null>`max(happened_on)::text` }).from(touches).where(and(eq(touches.personId, id), isNull(touches.archived)));
  const introduced = await db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName, introNote: people.introNote, created: people.created, companyName: companies.name })
    .from(people).leftJoin(companies, eq(companies.id, people.companyId))
    .where(and(eq(people.introducedById, id), isNull(people.archived))).orderBy(desc(people.created));
  const [metAt] = p.metAtEventId ? await db.select({ id: events.id, name: events.name, happenedOn: events.happenedOn }).from(events).where(eq(events.id, p.metAtEventId)) : [];
  return { person: p, company: company ?? null, introducedBy: introducedBy ?? null, roles: roleRows, lastTouch: last?.on ?? null, introduced, metAt: metAt ?? null };
}

export function touchesFor(personId: string, limit = 100) {
  return db.select({
    id: touches.id, kind: touches.kind, happenedOn: touches.happenedOn, notes: touches.notes,
    userName: users.name, eventId: touches.eventId, eventName: events.name,
  }).from(touches).leftJoin(users, eq(users.id, touches.userId)).leftJoin(events, eq(events.id, touches.eventId))
    .where(and(eq(touches.personId, personId), isNull(touches.archived)))
    .orderBy(desc(touches.happenedOn), desc(touches.created)).limit(limit);
}

export function workHistory(personId: string) {
  return db.select({
    id: personCompanies.id, companyId: personCompanies.companyId, companyName: companies.name, title: personCompanies.title,
    startedOn: personCompanies.startedOn, endedOn: personCompanies.endedOn,
  }).from(personCompanies).innerJoin(companies, eq(companies.id, personCompanies.companyId))
    .where(eq(personCompanies.personId, personId)).orderBy(sql`${personCompanies.endedOn} desc nulls first`, desc(personCompanies.startedOn));
}

export function dealsFrom(personId: string) {
  return db.select({
    id: properties.id, address: properties.address, city: properties.city, stage: properties.stage,
    metBuyBox: properties.metBuyBox, referralFee: properties.referralFee, askingPrice: properties.askingPrice,
    projectId: sql<string | null>`(select p.id from ${projects} p where p.property_id = ${ref(properties.id)} and p.archived_at is null limit 1)`,
    created: properties.created,
  }).from(properties).where(and(eq(properties.sourcePersonId, personId), isNull(properties.archived))).orderBy(desc(properties.created));
}

export function historyFor(entity: string, entityId: string, x: Reader = db) {
  return x.select({ id: auditLog.id, at: auditLog.at, action: auditLog.action, summary: auditLog.summary, via: auditLog.via, userName: users.name, before: auditLog.before, after: auditLog.after })
    .from(auditLog).leftJoin(users, eq(users.id, auditLog.userId))
    .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId))).orderBy(desc(auditLog.at)).limit(200);
}

export async function listCompanies(opts: { q?: string; role?: string; page?: number }) {
  const where = [isNull(companies.archived)];
  if (opts.q) where.push(ilike(companies.name, `%${opts.q}%`));
  if (opts.role) where.push(sql`exists (select 1 from ${partyRoles} r where r.company_id = ${ref(companies.id)} and r.removed_at is null and r.role = ${opts.role})`);
  const page = Math.max(1, opts.page ?? 1);
  const rows = await db.select({
    id: companies.id, name: companies.name, phone: companies.phone, website: companies.website, city: companies.city,
    roles: sql<{ role: string; stage: string; trade: string | null; supplierTypes: string[] | null }[]>`coalesce((select json_agg(json_build_object('role', r.role, 'stage', r.stage, 'trade', r.trade, 'supplierTypes', r.supplier_types) order by r.created_at) from ${partyRoles} r where r.company_id = ${ref(companies.id)} and r.removed_at is null), '[]')`,
    peopleCount: sql<number>`(select count(*) from ${people} p where p.company_id = ${ref(companies.id)} and p.archived_at is null)`.mapWith(Number),
    total: sql<number>`count(*) over ()`.mapWith(Number),
  }).from(companies).where(and(...where)).orderBy(asc(companies.name)).limit(PAGE).offset((page - 1) * PAGE);
  return { rows, total: rows[0]?.total ?? 0, page, pageSize: PAGE };
}

export async function getCompany(id: string) {
  const [c] = await db.select().from(companies).where(eq(companies.id, id));
  if (!c) return null;
  const roleRows = await rolesWithGc(eq(partyRoles.companyId, id));
  const current = await db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName, title: people.title, phone: people.phone, email: people.email, lastTouch: lastTouchSql })
    .from(people).where(and(eq(people.companyId, id), isNull(people.archived))).orderBy(asc(people.lastName));
  const former = await db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName, title: personCompanies.title, endedOn: personCompanies.endedOn })
    .from(personCompanies).innerJoin(people, eq(people.id, personCompanies.personId))
    .where(and(eq(personCompanies.companyId, id), sql`${personCompanies.endedOn} is not null`)).orderBy(desc(personCompanies.endedOn));
  const subs = await db.select({ companyId: partyRoles.companyId, personId: partyRoles.personId, role: partyRoles.role, trade: partyRoles.trade,
    name: sql<string>`coalesce((select c.name from ${companies} c where c.id = ${ref(partyRoles.companyId)}), (select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${ref(partyRoles.personId)}))` })
    .from(partyRoles).where(and(eq(partyRoles.hiredThroughCompanyId, id), isNull(partyRoles.removed)));
  return { company: c, roles: roleRows, current, former, subs };
}

/** Everyone who is cold for at least one live role. */
export async function goingCold(role?: string) {
  const rows = await db.select({
    personId: people.id, firstName: people.firstName, lastName: people.lastName, phone: people.phone, email: people.email,
    companyName: companies.name, role: partyRoles.role, stage: partyRoles.stage,
    createdOn: sql<string>`${partyRoles.created}::date::text`, lastTouch: lastTouchSql,
  }).from(partyRoles).innerJoin(people, eq(people.id, partyRoles.personId)).leftJoin(companies, eq(companies.id, people.companyId))
    .where(and(isNull(partyRoles.removed), isNull(people.archived), role ? eq(partyRoles.role, role) : undefined));
  const day = today();
  return rows.filter((r) => isCold(r, r.lastTouch, day)).sort((a, b) => (a.lastTouch ?? '').localeCompare(b.lastTouch ?? ''));
}

export function myOpenTasks(userId: string) {
  return db.select({
    id: tasks.id, title: tasks.title, dueOn: tasks.dueOn, notes: tasks.notes, status: tasks.status,
    personId: tasks.personId, personName: sql<string | null>`(select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${ref(tasks.personId)})`,
    companyId: tasks.companyId, propertyId: tasks.propertyId, projectId: tasks.projectId,
    recordName: sql<string | null>`coalesce((select c.name from ${companies} c where c.id = ${ref(tasks.companyId)}), (select pr.address from ${properties} pr where pr.id = ${ref(tasks.propertyId)}), (select pj.name from ${projects} pj where pj.id = ${ref(tasks.projectId)}))`,
  }).from(tasks).where(and(eq(tasks.assignedTo, userId), eq(tasks.status, 'open'), isNull(tasks.archived))).orderBy(asc(tasks.dueOn));
}

export function tasksForRecord(field: 'personId' | 'companyId' | 'propertyId' | 'projectId', id: string) {
  return db.select({ id: tasks.id, title: tasks.title, dueOn: tasks.dueOn, status: tasks.status, assignee: users.name })
    .from(tasks).leftJoin(users, eq(users.id, tasks.assignedTo))
    .where(and(eq(tasks[field], id), isNull(tasks.archived))).orderBy(asc(tasks.status), asc(tasks.dueOn));
}

export function activeStaff() {
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users)
    .where(and(eq(users.active, true), sql`${users.role} in ('owner','staff')`)).orderBy(asc(users.name));
}

export function peopleOptions() {
  return db.select({ id: people.id, name: sql<string>`${people.firstName} || ' ' || ${people.lastName}`, companyName: companies.name })
    .from(people).leftJoin(companies, eq(companies.id, people.companyId)).where(isNull(people.archived))
    .orderBy(asc(people.lastName), asc(people.firstName)).limit(2000);
}

export function companyOptions() {
  return db.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived)).orderBy(asc(companies.name)).limit(2000);
}

export function listEvents(associationId?: string) {
  return db.select({ id: events.id, name: events.name, happenedOn: events.happenedOn, location: events.location,
    associationId: events.associationId, associationName: sql<string | null>`(select c.name from ${companies} c where c.id = ${ref(events.associationId)})`,
    count: sql<number>`(select count(*) from ${eventPeople} ep where ep.event_id = ${ref(events.id)})`.mapWith(Number) })
    .from(events).where(and(isNull(events.archived), associationId ? eq(events.associationId, associationId) : undefined)).orderBy(desc(events.happenedOn));
}

/** Companies with the Association role, for the event form. */
export function associationOptions() {
  return db.select({ id: companies.id, name: companies.name }).from(companies)
    .where(and(isNull(companies.archived), sql`exists (select 1 from ${partyRoles} r where r.company_id = ${ref(companies.id)} and r.role = 'association' and r.removed_at is null)`))
    .orderBy(asc(companies.name));
}

/** An association's events with the people met at each (its company page). */
export async function associationEvents(companyId: string) {
  const evs = await listEvents(companyId);
  if (!evs.length) return [];
  const met = await db.select({ eventId: eventPeople.eventId, personId: people.id, name: sql<string>`${people.firstName} || ' ' || ${people.lastName}`, companyName: companies.name, note: eventPeople.note })
    .from(eventPeople).innerJoin(people, eq(people.id, eventPeople.personId)).leftJoin(companies, eq(companies.id, people.companyId))
    .where(inArray(eventPeople.eventId, evs.map((e) => e.id))).orderBy(asc(people.lastName));
  return evs.map((e) => ({ ...e, met: met.filter((m) => m.eventId === e.id) }));
}

export async function getEvent(id: string) {
  const [e] = await db.select().from(events).where(eq(events.id, id));
  if (!e) return null;
  const [association] = e.associationId ? await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.id, e.associationId)) : [];
  const met = await db.select({ id: eventPeople.id, personId: people.id, firstName: people.firstName, lastName: people.lastName, companyName: companies.name, note: eventPeople.note })
    .from(eventPeople).innerJoin(people, eq(people.id, eventPeople.personId)).leftJoin(companies, eq(companies.id, people.companyId))
    .where(eq(eventPeople.eventId, id)).orderBy(asc(people.lastName));
  return { event: e, met, association: association ?? null };
}

export function listLists() {
  return db.select({ id: savedLists.id, name: savedLists.name, purpose: savedLists.purpose, created: savedLists.created,
    count: sql<number>`(select count(*) from ${savedListMembers} m where m.list_id = ${ref(savedLists.id)} and m.removed_at is null)`.mapWith(Number) })
    .from(savedLists).where(isNull(savedLists.archived)).orderBy(desc(savedLists.created));
}

export async function getList(id: string) {
  const [l] = await db.select().from(savedLists).where(eq(savedLists.id, id));
  if (!l) return null;
  const members = await db.select({ id: savedListMembers.id, status: savedListMembers.status, note: savedListMembers.note,
    personId: people.id, firstName: people.firstName, lastName: people.lastName, phone: people.phone, email: people.email, companyName: companies.name, lastTouch: lastTouchSql })
    .from(savedListMembers).innerJoin(people, eq(people.id, savedListMembers.personId)).leftJoin(companies, eq(companies.id, people.companyId))
    .where(and(eq(savedListMembers.listId, id), isNull(savedListMembers.removed))).orderBy(asc(people.lastName));
  return { list: l, members };
}

/** Companies (and people) with a live GC role: who a sub can work through. */
export function gcOptions() {
  return db.select({ id: companies.id, name: companies.name }).from(companies)
    .where(and(isNull(companies.archived), sql`exists (select 1 from ${partyRoles} r where r.company_id = ${ref(companies.id)} and r.role = 'gc' and r.removed_at is null)`))
    .orderBy(asc(companies.name));
}

/** Every bill from a company (or a person), with its project, for "What We've Spent". */
export function vendorBills(by: { companyId?: string; personId?: string }) {
  return db.select({
    id: bills.id, projectId: bills.projectId, projectName: projects.name, number: bills.invoiceNumber, date: sql<string>`${bills.invoiceOn}::text`,
    kind: bills.kind, amount: bills.amount, status: bills.status,
    throughBillId: bills.includedInBillId,
    throughVendor: sql<string | null>`(select coalesce(pb.vendor_name, (select gc.name from ${companies} gc where gc.id = pb.vendor_company_id)) from ${bills} pb where pb.id = ${ref(bills.includedInBillId)})`,
  }).from(bills).innerJoin(projects, eq(projects.id, bills.projectId))
    .where(and(by.companyId ? eq(bills.vendorCompanyId, by.companyId) : eq(bills.vendorPersonId, by.personId!), isNull(bills.archived), isNull(projects.archived)));
}

/** A property's utilities: service, company, the person we deal with there. */
export function utilitiesFor(projectId: string) {
  return db.select({
    id: projectUtilities.id, service: projectUtilities.service, startedOn: projectUtilities.startedOn, endedOn: projectUtilities.endedOn, notes: projectUtilities.notes,
    companyId: projectUtilities.companyId, companyName: sql<string | null>`(select c.name from ${companies} c where c.id = ${ref(projectUtilities.companyId)})`,
    personId: projectUtilities.personId, personName: sql<string | null>`(select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${ref(projectUtilities.personId)})`,
    personPhone: sql<string | null>`(select p.phone from ${people} p where p.id = ${ref(projectUtilities.personId)})`,
    personEmail: sql<string | null>`(select p.email from ${people} p where p.id = ${ref(projectUtilities.personId)})`,
  }).from(projectUtilities).where(and(eq(projectUtilities.projectId, projectId), isNull(projectUtilities.removed))).orderBy(asc(projectUtilities.service));
}

/** Companies to pick for a utility: utility suppliers first. */
export function utilityCompanyOptions() {
  return db.select({ id: companies.id, name: companies.name,
    utility: sql<boolean>`exists (select 1 from ${partyRoles} r where r.company_id = ${ref(companies.id)} and r.removed_at is null and r.role = 'supplier' and 'utilities' = any(r.supplier_types))` })
    .from(companies).where(isNull(companies.archived)).orderBy(asc(companies.name)).limit(2000);
}

/** Every property a person or company is the utility contact for (their page). */
export function utilityWorkFor(by: { personId?: string; companyId?: string }) {
  return db.select({ id: projectUtilities.id, service: projectUtilities.service, projectId: projectUtilities.projectId, projectName: projects.name,
    personName: sql<string | null>`(select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${ref(projectUtilities.personId)})`, personId: projectUtilities.personId })
    .from(projectUtilities).innerJoin(projects, eq(projects.id, projectUtilities.projectId))
    .where(and(by.personId ? eq(projectUtilities.personId, by.personId) : eq(projectUtilities.companyId, by.companyId!), isNull(projectUtilities.removed), isNull(projects.archived)));
}

/** Companies to pick for a bid: general contractors first. */
export function gcCompanyOptions() {
  return db.select({ id: companies.id, name: companies.name,
    gc: sql<boolean>`exists (select 1 from ${partyRoles} r where r.company_id = ${ref(companies.id)} and r.removed_at is null and r.role = 'gc')` })
    .from(companies).where(isNull(companies.archived)).orderBy(asc(companies.name)).limit(2000);
}
