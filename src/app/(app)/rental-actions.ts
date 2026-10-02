'use server';

import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { companies, leases, loans, people, personCompanies, rentalContacts, rentals, rentReceipts } from '@/db/schema';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { bool, str, uuidOrNull } from '@/lib/forms';
import { isDay, parseMoney, parsePercent } from '@/lib/format';
import { isRentalStatus, rentalStatusLabel } from '@/lib/rentals';
import { saveFile } from '@/lib/files';
import type { FormResult } from '@/components/ActionForm';

class Bad extends Error {}
const money = (d: FormData, k: string, label: string) => { const v = parseMoney(d.get(k)); if (v === undefined) throw new Bad(`${label}: a dollar amount, like 2,450.`); return v; };
const pct = (d: FormData, k: string, label: string) => { const v = parsePercent(d.get(k)); if (v === undefined) throw new Bad(`${label}: a percent, like 8.`); return v; };
const day = (d: FormData, k: string, label: string) => { const v = str(d, k); if (v && !isDay(v)) throw new Bad(`${label}: pick a date.`); return v; };
async function run(projectId: string | null, fn: (projectId: string) => Promise<string>): Promise<FormResult> {
  if (!projectId) return { error: 'Not found.' };
  try { const ok = await fn(projectId); revalidatePath(`/projects/${projectId}`); return { ok }; }
  catch (e) { if (e instanceof Bad) return { error: e.message }; throw e; }
}
const $ = (v: string | null) => (v ? `$${Number(v).toLocaleString('en-US')}` : '—');

/** The rental's status on the market, the property manager and the monthly costs we expect. */
export async function saveRental(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  return run(uuidOrNull(d, 'projectId'), async (projectId) => {
    const status = str(d, 'status') ?? 'getting_ready';
    if (!isRentalStatus(status)) throw new Bad('Pick a status.');
    const f = {
      status, askingRent: money(d, 'askingRent', 'Asking rent'), listedOn: day(d, 'listedOn', 'Listed on'), listedWhere: str(d, 'listedWhere'),
      managerCompanyId: uuidOrNull(d, 'managerCompanyId'), managerPersonId: null as string | null,
      managementFeePct: pct(d, 'managementFeePct', 'Management fee'), leasingFee: money(d, 'leasingFee', 'Leasing fee'), managementTerms: str(d, 'managementTerms'),
      taxesMonthly: money(d, 'taxesMonthly', 'Taxes'), insuranceMonthly: money(d, 'insuranceMonthly', 'Insurance'), hoaMonthly: money(d, 'hoaMonthly', 'HOA'),
      utilitiesMonthly: money(d, 'utilitiesMonthly', 'Utilities'), repairsReservePct: pct(d, 'repairsReservePct', 'Repairs reserve'), vacancyPct: pct(d, 'vacancyPct', 'Vacancy'),
      notes: str(d, 'notes'),
    };
    // The manager's people: only from that company; one is the main contact.
    const contactIds = [...new Set(d.getAll('managerContacts').map(String))].filter((x) => /^[0-9a-f-]{36}$/i.test(x));
    if (contactIds.length && !f.managerCompanyId) throw new Bad('Pick the property management company first.');
    if (contactIds.length) {
      const ok = await db.select({ id: people.id }).from(people).leftJoin(personCompanies, and(eq(personCompanies.personId, people.id), isNull(personCompanies.endedOn)))
        .where(and(inArray(people.id, contactIds), or(eq(people.companyId, f.managerCompanyId!), eq(personCompanies.companyId, f.managerCompanyId!))));
      if (new Set(ok.map((x) => x.id)).size !== contactIds.length) throw new Bad('Pick people from that company only.');
    }
    const mainId = contactIds.includes(str(d, 'managerMain') ?? '') ? str(d, 'managerMain')! : contactIds[0] ?? null;
    f.managerPersonId = mainId;
    await db.transaction(async (tx) => {
      const before = await tx.select({ personId: rentalContacts.personId, main: rentalContacts.main }).from(rentalContacts).where(eq(rentalContacts.projectId, projectId));
      const sameContacts = before.length === contactIds.length && before.every((b) => contactIds.includes(b.personId) && b.main === (b.personId === mainId));
      if (!sameContacts) {
        await tx.delete(rentalContacts).where(eq(rentalContacts.projectId, projectId));
        if (contactIds.length) await tx.insert(rentalContacts).values(contactIds.map((personId) => ({ projectId, personId, main: personId === mainId })));
        const names = contactIds.length ? await tx.select({ id: people.id, f: people.firstName, l: people.lastName }).from(people).where(inArray(people.id, contactIds)) : [];
        const [co] = f.managerCompanyId ? await tx.select({ n: companies.name }).from(companies).where(eq(companies.id, f.managerCompanyId)) : [];
        const label = names.map((n) => `${n.f} ${n.l}${n.id === mainId ? ' (main)' : ''}`).join(', ');
        await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'rental-contacts', summary: contactIds.length ? `set ${co?.n ?? 'the manager'}’s people on this property: ${label}` : 'cleared the property manager’s people', before: { contacts: before }, after: { contacts: contactIds, main: mainId } }, tx);
      }
      const [old] = await tx.select().from(rentals).where(eq(rentals.projectId, projectId));
      if (!old) {
        await tx.insert(rentals).values({ projectId, ...f });
        await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'rental-create', summary: `set it up as a rental (${rentalStatusLabel(status)})`, after: f }, tx);
        return;
      }
      const ch = diff(old as Record<string, unknown>, f);
      if (!ch) return;
      await tx.update(rentals).set({ ...f, updated: new Date() }).where(eq(rentals.id, old.id));
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'rental-update', summary: old.status !== status ? `moved the rental from ${rentalStatusLabel(old.status)} to ${rentalStatusLabel(status)}` : `changed the rental (${Object.keys(ch.after).join(', ')})`, ...ch }, tx);
    });
    return 'Saved.';
  });
}

/** A lease: tenants, rent, dates, renewal, deposit, and the signed lease as a document. */
export async function addLease(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  return run(uuidOrNull(d, 'projectId'), async (projectId) => {
    const tenants = str(d, 'tenants');
    const rent = money(d, 'rent', 'Rent');
    const startsOn = day(d, 'startsOn', 'Starts');
    if (!tenants) throw new Bad('Who are the tenants?');
    if (!rent) throw new Bad('Enter the monthly rent.');
    if (!startsOn) throw new Bad('When does it start?');
    const endsOn = day(d, 'endsOn', 'Ends');
    if (endsOn && endsOn < startsOn) throw new Bad('It ends before it starts.');
    const dueDay = str(d, 'dueDay') ? Number(str(d, 'dueDay')) : null;
    if (dueDay !== null && !(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 28)) throw new Bad('Rent due: a day from 1 to 28.');
    const f = {
      tenants, rent, dueDay, startsOn, endsOn, renewalTerms: str(d, 'renewalTerms'), decideBy: day(d, 'decideBy', 'Decide by'),
      deposit: money(d, 'deposit', 'Deposit'), depositHeldBy: str(d, 'depositHeldBy'), pets: str(d, 'pets'), utilitiesPaidBy: str(d, 'utilitiesPaidBy'), terms: str(d, 'terms'),
    };
    const file = d.get('file');
    await db.transaction(async (tx) => {
      const [l] = await tx.insert(leases).values({ projectId, ...f, createdBy: user.id }).returning();
      if (file instanceof File && file.size > 0) {
        const saved = await saveFile(file, { entity: 'lease', entityId: l.id }, user.id, { caption: `Lease: ${tenants}` }, tx);
        if ('error' in saved) throw new Bad(saved.error);
      }
      // A signed lease means it's leased.
      await tx.insert(rentals).values({ projectId, status: 'leased' }).onConflictDoUpdate({ target: rentals.projectId, set: { status: 'leased', updated: new Date() } });
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'lease-add', summary: `added the lease with ${tenants}: ${$(rent)} a month from ${startsOn}${endsOn ? ` to ${endsOn}` : ''}`, after: { leaseId: l.id, ...f } }, tx);
    });
    return 'Lease added.';
  });
}

/** End a lease: the date and any deposit returned. */
export async function endLease(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const id = uuidOrNull(d, 'leaseId');
  const [l] = id ? await db.select().from(leases).where(eq(leases.id, id)) : [];
  if (!l) return { error: 'Not found.' };
  return run(l.projectId, async (projectId) => {
    const endedOn = day(d, 'endedOn', 'Ended');
    if (!endedOn) throw new Bad('When did it end?');
    const depositReturned = money(d, 'depositReturned', 'Deposit returned');
    await db.transaction(async (tx) => {
      await tx.update(leases).set({ status: 'ended', endedOn, depositReturned }).where(eq(leases.id, l.id));
      await tx.update(rentals).set({ status: bool(d, 'relisting') ? 'on_market' : 'vacant', updated: new Date() }).where(eq(rentals.projectId, projectId));
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'lease-end', summary: `ended the lease with ${l.tenants} on ${endedOn}${depositReturned ? `; returned ${$(depositReturned)} of the deposit` : ''}` }, tx);
    });
    return 'Lease ended.';
  });
}

/** Rent (or a late fee, deposit, other) received. */
export async function addRentReceipt(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  return run(uuidOrNull(d, 'projectId'), async (projectId) => {
    const receivedOn = day(d, 'receivedOn', 'Received');
    const amount = money(d, 'amount', 'Amount');
    const kind = str(d, 'kind') ?? 'rent';
    if (!receivedOn || !amount) throw new Bad('Enter the date and the amount.');
    if (!['rent', 'late_fee', 'deposit', 'other'].includes(kind)) throw new Bad('Pick what it was.');
    const forMonth = str(d, 'forMonth');
    if (forMonth && !/^\d{4}-\d{2}$/.test(forMonth)) throw new Bad('For month: pick a month.');
    const leaseId = uuidOrNull(d, 'leaseId');
    if (leaseId) { const [l] = await db.select({ p: leases.projectId }).from(leases).where(and(eq(leases.id, leaseId), eq(leases.projectId, projectId))); if (!l) throw new Bad('That lease isn’t on this property.'); }
    await db.transaction(async (tx) => {
      await tx.insert(rentReceipts).values({ projectId, leaseId, receivedOn, forMonth: forMonth ? `${forMonth}-01` : null, kind, amount, notes: str(d, 'notes'), createdBy: user.id });
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'rent-received', summary: `recorded ${$(amount)} ${kind === 'rent' ? 'rent' : kind.replace('_', ' ')} received ${receivedOn}${forMonth ? ` for ${forMonth}` : ''}` }, tx);
    });
    return 'Recorded.';
  });
}

/** The bank loan against the property (never an account number). */
export async function saveLoan(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  return run(uuidOrNull(d, 'projectId'), async (projectId) => {
    const f = {
      lenderCompanyId: uuidOrNull(d, 'lenderCompanyId'), lenderName: str(d, 'lenderName'), originalAmount: money(d, 'originalAmount', 'Original amount'),
      balance: money(d, 'balance', 'Balance'), balanceOn: day(d, 'balanceOn', 'Balance as of'), ratePct: pct(d, 'ratePct', 'Rate'),
      monthlyPayment: money(d, 'monthlyPayment', 'Monthly payment'), escrowIncluded: bool(d, 'escrowIncluded'),
      startedOn: day(d, 'startedOn', 'Started'), maturesOn: day(d, 'maturesOn', 'Matures'), notes: str(d, 'notes'),
    };
    if (!f.lenderCompanyId && !f.lenderName) throw new Bad('Who is the lender?');
    const id = uuidOrNull(d, 'loanId');
    await db.transaction(async (tx) => {
      if (!id) {
        const [l] = await tx.insert(loans).values({ projectId, ...f, createdBy: user.id }).returning();
        await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'loan-add', summary: `added the loan${f.originalAmount ? ` of ${$(f.originalAmount)}` : ''}${f.ratePct ? ` at ${f.ratePct}%` : ''}`, after: { loanId: l.id, ...f } }, tx);
        return;
      }
      const [old] = await tx.select().from(loans).where(and(eq(loans.id, id), eq(loans.projectId, projectId)));
      if (!old) throw new Bad('Not found.');
      const ch = diff(old as Record<string, unknown>, f);
      if (!ch) return;
      await tx.update(loans).set(f).where(eq(loans.id, id));
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'loan-update', summary: `updated the loan (${Object.keys(ch.after).join(', ')})`, ...ch }, tx);
    });
    return 'Saved.';
  });
}

/** One tap from the stage bar: the rental's sub-stage (Getting Ready … Vacant). */
