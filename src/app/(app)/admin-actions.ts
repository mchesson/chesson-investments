'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { isRole, roleNames } from '@/lib/permissions';
import { normalizeEmail } from '@/lib/format';
import { str } from '@/lib/forms';
import type { FormResult } from '@/components/ActionForm';

/** Add someone before they sign in (their Microsoft 365 email). */
export async function addUser(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const email = normalizeEmail(str(d, 'email'));
  const role = str(d, 'role') ?? '';
  if (!email || !email.includes('@')) return { error: 'Enter their email.' };
  if (!isRole(role) || role === 'pending') return { error: 'Pick a role.' };
  const [exists] = await db.select().from(users).where(eq(users.email, email));
  if (exists) return { error: 'They’re already listed.' };
  await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, name: str(d, 'name'), role }).returning();
    await audit({ userId: me.id, entity: 'user', entityId: u.id, action: 'create', summary: `added ${email} as ${roleNames[role]}` }, tx);
  });
  revalidatePath('/admin/users');
  return { ok: 'Added. They can sign in now.' };
}

export async function setUserRole(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const id = str(d, 'id');
  const role = str(d, 'role') ?? '';
  const active = d.get('active') === 'on';
  if (!id || !isRole(role)) return { error: 'Pick a role.' };
  if (id === me.id && (role !== 'owner' || !active)) return { error: 'You can’t remove your own Owner access.' };
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) return { error: 'Not found.' };
  if (u.role === role && u.active === active) return { ok: 'No changes.' };
  await db.transaction(async (tx) => {
    await tx.update(users).set({ role, active }).where(eq(users.id, id));
    await audit({ userId: me.id, entity: 'user', entityId: id, action: 'update', summary: `set ${u.email} to ${roleNames[role]}${active ? '' : ' (access off)'}`, before: { role: u.role, active: u.active }, after: { role, active } }, tx);
  });
  revalidatePath('/admin/users');
  return { ok: 'Saved.' };
}
