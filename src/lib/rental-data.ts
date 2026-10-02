import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bills, companies, files, leases, loans, people, rentalContacts, rentals, rentReceipts } from '@/db/schema';

/** Everything on a project's Rental tab. */
export async function rentalFor(projectId: string) {
  const [rental] = await db.select({
    r: rentals,
    managerCompany: sql<string | null>`(select c.name from ${companies} c where c.id = ${rentals.managerCompanyId})`,
    managerPerson: sql<string | null>`(select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${rentals.managerPersonId})`,
    managerPhone: sql<string | null>`(select p.phone from ${people} p where p.id = ${rentals.managerPersonId})`,
    managerEmail: sql<string | null>`(select p.email from ${people} p where p.id = ${rentals.managerPersonId})`,
  }).from(rentals).where(eq(rentals.projectId, projectId));
  const ls = await db.select().from(leases).where(eq(leases.projectId, projectId)).orderBy(desc(leases.startsOn));
  const leaseFiles = ls.length ? await db.select({ id: files.id, entityId: files.entityId, name: files.name }).from(files)
    .where(and(eq(files.entity, 'lease'), inArray(files.entityId, ls.map((l) => l.id)), isNull(files.archived))) : [];
  const receipts = await db.select().from(rentReceipts).where(and(eq(rentReceipts.projectId, projectId), isNull(rentReceipts.archived))).orderBy(desc(rentReceipts.receivedOn));
  const ln = await db.select({ l: loans, lender: sql<string | null>`(select c.name from ${companies} c where c.id = ${loans.lenderCompanyId})` })
    .from(loans).where(and(eq(loans.projectId, projectId), isNull(loans.archived))).orderBy(asc(loans.created));
  const firstStart = ls.length ? ls[ls.length - 1].startsOn : null;
  const whileRented = firstStart ? await db.select({ id: bills.id, date: sql<string>`${bills.invoiceOn}::text`, amount: bills.amount, number: bills.invoiceNumber,
    vendor: sql<string>`coalesce(${bills.vendorName}, (select c.name from ${companies} c where c.id = ${bills.vendorCompanyId}), (select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${bills.vendorPersonId}), '')`,
    vendorCompanyId: bills.vendorCompanyId })
    .from(bills).where(and(eq(bills.projectId, projectId), isNull(bills.archived), gte(bills.invoiceOn, firstStart))).orderBy(desc(bills.invoiceOn)) : [];
  return {
    rental: rental ?? null, leases: ls.map((l) => ({ ...l, files: leaseFiles.filter((f) => f.entityId === l.id) })),
    receipts, loans: ln.map((x) => ({ ...x.l, lender: x.lender ?? x.l.lenderName })), whileRented,
  };
}

/** Property management companies, each with its people (current employees or anyone listed at it). */
export async function managerOptions(alsoCompanyId?: string | null) {
  const cos = await db.select({ id: companies.id, name: companies.name }).from(companies)
    .where(and(isNull(companies.archived), sql`(exists (select 1 from party_roles r where r.company_id = ${companies.id} and r.removed_at is null and r.role = 'property_manager') ${alsoCompanyId ? sql`or ${companies.id} = ${alsoCompanyId}` : sql``})`))
    .orderBy(asc(companies.name));
  if (!cos.length) return [];
  const ps = await db.select({ id: people.id, first: people.firstName, last: people.lastName, title: people.title, companyId: people.companyId }).from(people)
    .where(and(isNull(people.archived), sql`(${people.companyId} in (${sql.join(cos.map((c) => sql`${c.id}`), sql`, `)}) or exists (select 1 from person_companies pc where pc.person_id = ${people.id} and pc.ended_on is null and pc.company_id in (${sql.join(cos.map((c) => sql`${c.id}`), sql`, `)})))`))
    .orderBy(asc(people.lastName), asc(people.firstName));
  const links = await db.execute<{ person_id: string; company_id: string }>(sql`select person_id, company_id from person_companies where ended_on is null and company_id in (${sql.join(cos.map((c) => sql`${c.id}`), sql`, `)})`);
  return cos.map((c) => ({
    ...c,
    people: ps.filter((p) => p.companyId === c.id || links.rows.some((l) => l.person_id === p.id && l.company_id === c.id)).map((p) => ({ id: p.id, name: `${p.first} ${p.last}`.trim(), title: p.title })),
  }));
}

/** The manager's people chosen for a rental, main first. */
export function rentalContactsFor(projectId: string) {
  return db.select({ personId: rentalContacts.personId, main: rentalContacts.main, name: sql<string>`(select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${rentalContacts.personId})`,
    phone: sql<string | null>`(select p.phone from ${people} p where p.id = ${rentalContacts.personId})`, email: sql<string | null>`(select p.email from ${people} p where p.id = ${rentalContacts.personId})`,
    title: sql<string | null>`(select p.title from ${people} p where p.id = ${rentalContacts.personId})` })
    .from(rentalContacts).where(eq(rentalContacts.projectId, projectId)).orderBy(desc(rentalContacts.main), asc(rentalContacts.created));
}
