import 'server-only';
import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { can, type Permission, type Role } from './permissions';

export type SessionUser = { id: string; email: string; name: string | null; role: Role };

/** The signed-in user, read from the database on every request (role changes apply at once). */
export async function currentUser(): Promise<SessionUser | null> {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return null;
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u || !u.active) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

/** For pages: signed in, with a role, and the permission (else "not found"). */
export async function requirePage(p?: Permission): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect('/signin');
  if (u.role === 'pending') redirect('/waiting');
  if (p && !can(u.role, p)) notFound();
  return u;
}

/** For Server Actions: throws instead of redirecting. */
export async function requireAction(p: Permission): Promise<SessionUser> {
  const u = await currentUser();
  if (!u || !can(u.role, p)) throw new Error('You do not have access to do that.');
  return u;
}
