'use server';

import { and, eq, gt, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/db';
import { signInLinks, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { normalizeEmail } from '@/lib/format';
import { str } from '@/lib/forms';
import { appUrl, createLink } from '@/lib/sign-in-links';
import { linkEmail, mailReady, sendMail } from '@/lib/mail';
import type { FormResult } from '@/components/ActionForm';

/**
 * "Email me a sign-in link", for people without a Technical Source Microsoft
 * account (guests, an outside accountant). The answer never says whether the
 * email is on file; at most 3 links an hour per person.
 */
export async function requestLink(_: FormResult, d: FormData): Promise<FormResult> {
  const email = normalizeEmail(str(d, 'email'));
  if (!email || !email.includes('@')) return { error: 'Enter your email.' };
  const same = { ok: mailReady() ? 'If that email has access, a sign-in link is on its way. It works once, for 30 minutes.' : 'Email sign-in isn’t switched on yet. Ask Chesson Investments to send you a new link.' };
  if (!mailReady()) return same;
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u || !u.active || (u.role !== 'guest' && u.role !== 'accountant')) return same;
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(signInLinks)
    .where(and(eq(signInLinks.userId, u.id), eq(signInLinks.purpose, 'sign_in'), gt(signInLinks.created, new Date(Date.now() - 3600_000))));
  if ((recent?.n ?? 0) >= 3) return same;
  const h = await headers();
  const origin = h.get('origin');
  const { token } = await db.transaction(async (tx) => {
    const l = await createLink(u.id, 'sign_in', null, tx, email);
    await audit({ userId: u.id, entity: 'user', entityId: u.id, action: 'link-request', summary: 'asked for a sign-in link by email', via: 'sign-in page' }, tx);
    return l;
  });
  const url = `${appUrl(origin)}/signin/link?t=${token}`;
  const m = linkEmail({ title: 'Your sign-in link', intro: 'Use this button to sign in to Chesson Investments.', button: 'Sign In', url, note: 'It works once, for the next 30 minutes. If you didn’t ask for it, you can ignore this email.' });
  await sendMail({ to: email, subject: 'Your Chesson Investments sign-in link', ...m });
  return same;
}
