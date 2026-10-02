import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bills, companies, files, leases, loans, people, rentals, rentReceipts } from '@/db/schema';

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
