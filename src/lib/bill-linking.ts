import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db, type Tx } from '@/db';
import { bills, companies, people } from '@/db/schema';
import { audit } from './audit';
import { matchCompany, matchPerson } from './vendor-match';

// Bills that name a vendor but aren't linked to a company or person yet, and
// linking them (Match Bills on Import, and the twice-daily update). Each link is
// in History on the vendor and the project.

/** Bills with a vendor name but no company or person linked, and what each name would link to. */
export async function billMatches(x: Tx | typeof db) {
  const open = await x.select({ id: bills.id, projectId: bills.projectId, vendor: bills.vendorName, amount: bills.amount }).from(bills)
    .where(and(isNull(bills.archived), isNull(bills.vendorCompanyId), isNull(bills.vendorPersonId), sql`${bills.vendorName} is not null`));
  const cos = await x.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived));
  const ps = await x.select({ id: people.id, firstName: people.firstName, lastName: people.lastName }).from(people).where(isNull(people.archived));
  const byName = new Map<string, { ids: { id: string; projectId: string }[]; total: number; company: ReturnType<typeof matchCompany>; person: ReturnType<typeof matchPerson> }>();
  for (const b of open) {
    const v = b.vendor!;
    const e = byName.get(v) ?? { ids: [], total: 0, company: matchCompany(v, cos), person: null as ReturnType<typeof matchPerson> };
    if (!e.company && !e.person && !e.ids.length) e.person = matchPerson(v, ps);
    e.ids.push({ id: b.id, projectId: b.projectId }); e.total += Math.round(Number(b.amount) * 100);
    byName.set(v, e);
  }
  return byName;
}

/** Links every bill whose vendor name matches a company or person. `userId` null = the scheduled update. */
export async function linkBills(userId: string | null, via: string) {
  return db.transaction(async (tx) => {
    const m = await billMatches(tx);
    let linked = 0;
    for (const [vendor, e] of m) {
      const target = e.company ? { vendorCompanyId: e.company.id } : e.person ? { vendorPersonId: e.person.id } : null;
      if (!target) continue;
      for (const b of e.ids) await tx.update(bills).set(target).where(eq(bills.id, b.id));
      linked += e.ids.length;
      const who = e.company ?? e.person!;
      await audit({ userId, entity: e.company ? 'company' : 'person', entityId: who.id, action: 'bills-linked', summary: `linked ${e.ids.length} ${e.ids.length === 1 ? 'bill' : 'bills'} named “${vendor}” ($${(e.total / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })})`, via }, tx);
      for (const pid of new Set(e.ids.map((b) => b.projectId))) await audit({ userId, entity: 'project', entityId: pid, action: 'bills-linked', summary: `linked the bills from “${vendor}” to ${who.name}`, via }, tx);
    }
    return { linked };
  });
}
