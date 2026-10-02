import 'server-only';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { signInLinks, users } from '@/db/schema';
import { hashToken, linkDays, looksLikeToken, newToken } from './guests';

type Reader = Pick<typeof db, 'insert' | 'select' | 'update'>;

/** A new sign-in link for someone: the token goes in the link, only its hash is kept. */
export async function createLink(userId: string, purpose: keyof typeof linkDays, createdBy: string | null, x: Reader = db, emailedTo: string | null = null) {
  const token = newToken();
  const expires = new Date(Date.now() + linkDays[purpose] * 86_400_000);
  await x.insert(signInLinks).values({ userId, tokenHash: hashToken(token), purpose, expires, createdBy, emailedTo });
  return { token, expires };
}

/** Uses a link once: the user it signs in, or null (unknown, used, expired, or their access is off). */
export async function consumeLink(token: unknown, ip: string | null) {
  if (typeof token !== 'string' || !looksLikeToken(token)) return null;
  const [l] = await db.update(signInLinks).set({ used: new Date(), usedIp: ip })
    .where(and(eq(signInLinks.tokenHash, hashToken(token)), isNull(signInLinks.used), gt(signInLinks.expires, new Date())))
    .returning({ userId: signInLinks.userId });
  if (!l) return null;
  const [u] = await db.select().from(users).where(eq(users.id, l.userId));
  return u && u.active && u.role !== 'pending' ? u : null;
}

/** The app's address for links in emails (the request's own when there is one). */
export const appUrl = (origin?: string | null) => (origin ?? process.env.APP_URL ?? 'https://chesson-investments.vercel.app').replace(/\/$/, '');
