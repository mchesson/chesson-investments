'use server';

import { eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { companies, people, personCompanies } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { formatName, normalizeEmail, storePhone, today } from '@/lib/format';
import { likeCompanies, likePeople } from '@/lib/duplicates';
import type { PickOption } from '@/components/SearchPicker';

// "+ Add" in a type-to-find box (owner, Oct 3, 2026: "if i have typed a name in
// it should allow me to click a plus button and add the person"): a person or a
// company added in place, without leaving the page, with the same like-name,
// email and phone checks as the full forms.

export type QuickAddResult = { option: PickOption } | { like: PickOption[] } | { error: string };
const VIA = 'quick add';

/** A person. `prefix` is what the box's ids start with ("p:" in a vendor box). */
export async function quickAddPerson(input: { firstName: string; lastName: string; company?: string; phone?: string; email?: string; different?: boolean; prefix?: string }): Promise<QuickAddResult> {
  const user = await requireAction('contacts.edit');
  const firstName = formatName(input.firstName?.trim() ?? ''), lastName = formatName(input.lastName?.trim() ?? '');
  if (!firstName || !lastName) return { error: 'First and last name are needed.' };
  const email = normalizeEmail(input.email?.trim() || null), phone = storePhone(input.phone?.trim() || null);
  const pre = input.prefix ?? '';
  if (!input.different) {
    const on = await db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email, phone: people.phone, company: companies.name })
      .from(people).leftJoin(companies, eq(companies.id, people.companyId)).where(isNull(people.archived));
    const same = on.filter((p) => (email && p.email === email) || (phone && p.phone === phone));
    const like = [...same, ...likePeople({ firstName, lastName }, on).filter((p) => !same.includes(p))].slice(0, 5);
    if (like.length) return { like: like.map((p) => ({ id: `${pre}${p.id}`, label: `${p.firstName} ${p.lastName}`, sub: p.company ?? 'Person' })) };
  }
  const companyName = input.company?.trim() || null;
  const out = await db.transaction(async (tx) => {
    let companyId: string | null = null, coName: string | null = null;
    if (companyName) {
      // The company they're with: the one on file by that name (or a near one), else a new one.
      const cos = await tx.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived));
      const exact = cos.find((c) => c.name.toLowerCase() === companyName.toLowerCase()) ?? likeCompanies(companyName, cos)[0];
      if (exact) { companyId = exact.id; coName = exact.name; } else {
        const [c] = await tx.insert(companies).values({ name: companyName, createdBy: user.id }).returning();
        companyId = c.id; coName = c.name;
        await audit({ userId: user.id, entity: 'company', entityId: c.id, action: 'create', summary: `added the company ${c.name}`, via: VIA }, tx);
      }
    }
    const [p] = await tx.insert(people).values({ firstName, lastName, email, phone, companyId, createdBy: user.id }).returning();
    if (companyId) await tx.insert(personCompanies).values({ personId: p.id, companyId, startedOn: today() });
    await audit({ userId: user.id, entity: 'person', entityId: p.id, action: 'create', summary: `added ${firstName} ${lastName}${coName ? ` (${coName})` : ''}`, via: VIA, after: { firstName, lastName, email, phone, companyId } }, tx);
    if (input.different) await audit({ userId: user.id, entity: 'person', entityId: p.id, action: 'not-duplicate', summary: 'saved as a different person despite a matching or similar name, email or phone', via: VIA }, tx);
    return { id: p.id, coName };
  });
  return { option: { id: `${pre}${out.id}`, label: `${firstName} ${lastName}`, sub: out.coName ?? 'Person' } };
}

/** A company. */
export async function quickAddCompany(input: { name: string; phone?: string; different?: boolean; prefix?: string }): Promise<QuickAddResult> {
  const user = await requireAction('contacts.edit');
  const name = input.name?.trim().replace(/\s+/g, ' ') ?? '';
  if (!name) return { error: 'The company’s name is needed.' };
  const pre = input.prefix ?? '';
  if (!input.different) {
    const on = await db.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived));
    const like = likeCompanies(name, on).slice(0, 5);
    const exact = on.filter((c) => c.name.toLowerCase() === name.toLowerCase());
    const all = [...exact, ...like.filter((c) => !exact.includes(c))];
    if (all.length) return { like: all.map((c) => ({ id: `${pre}${c.id}`, label: c.name, sub: 'Company' })) };
  }
  const phone = storePhone(input.phone?.trim() || null);
  const id = await db.transaction(async (tx) => {
    const [c] = await tx.insert(companies).values({ name, phone, createdBy: user.id }).returning({ id: companies.id });
    await audit({ userId: user.id, entity: 'company', entityId: c.id, action: 'create', summary: `added the company ${name}`, via: VIA }, tx);
    if (input.different) await audit({ userId: user.id, entity: 'company', entityId: c.id, action: 'not-duplicate', summary: 'saved as a different company despite a like name', via: VIA }, tx);
    return c.id;
  });
  return { option: { id: `${pre}${id}`, label: name, sub: 'Company' } };
}
