import 'server-only';
import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { can, effectivePermissions, linkRoles, type Permission, type Role } from './permissions';
import { sessionHours } from './guests';
import { readStandards } from './access-standards';

export type SessionUser = { id: string; email: string; name: string | null; role: Role; permissions: Permission[]; personId: string | null; companyId: string | null };

/** The signed-in user, read from the database on every request (role changes apply at once). */
export async function currentUser(): Promise<SessionUser | null> {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return null;
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u || !u.active) return null;
  // Staff signed in with Microsoft for 12 hours; guests (by link) for 30 days.
  const meta = s as unknown as { provider?: string; signedInAt?: number };
  if (meta.signedInAt && Date.now() / 1000 - meta.signedInAt > sessionHours(u.role, meta.provider) * 3600) return null;
  // Someone who signed in by link is a guest page user only, whatever their role.
  if (meta.provider === 'link' && !linkRoles.includes(u.role)) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, permissions: effectivePermissions(u.role, u.permissions, u.permissions ? null : (await readStandards()).roles), personId: u.personId, companyId: u.companyId };
}

/** For pages: signed in, with a role, and the permission (else "not found"). */
export async function requirePage(p?: Permission): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect('/signin');
  if (u.role === 'pending') redirect('/waiting');
  if (u.role === 'guest') redirect('/guest');
  if (p && !can(u, p)) notFound();
  return u;
}

/** For Server Actions: throws instead of redirecting. */
export async function requireAction(p: Permission): Promise<SessionUser> {
  const u = await currentUser();
  if (!u || !can(u, p)) throw new Error('You do not have access to do that.');
  return u;
}

/** For the guest pages: a signed-in guest (staff are sent to their own pages). */
export async function requireGuest(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect('/signin');
  if (u.role !== 'guest') redirect('/');
  return u;
}
