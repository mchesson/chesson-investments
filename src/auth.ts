import { audit } from '@/lib/audit';
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { normalizeEmail } from '@/lib/format';
import { consumeLink } from '@/lib/sign-in-links';

export const devLogin = process.env.NODE_ENV === 'development' && process.env.DEV_LOGIN === 'true';

const ownerEmails = () =>
  (process.env.OWNER_EMAILS ?? '').split(',').map((e) => normalizeEmail(e)).filter(Boolean) as string[];

const providers: NextAuthConfig['providers'] = [];
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  providers.push(MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  }));
}
// Outside people (guests) sign in with a one-time link: an invite, or one they
// ask for at sign-in (src/lib/sign-in-links.ts). Never for a Technical Source owner.
providers.push(Credentials({
  id: 'link',
  credentials: { token: {} },
  authorize: async (c, req) => {
    const ip = req?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const u = await consumeLink(c?.token, ip);
    if (!u || ownerEmails().includes(u.email)) return null;
    return { id: u.id, email: u.email, name: u.name };
  },
}));
if (devLogin) {
  // Local only: sign in as a sample user (the seed makes them).
  providers.push(Credentials({
    id: 'dev',
    credentials: { email: {} },
    authorize: async (c) => {
      const email = normalizeEmail(String(c?.email ?? ''));
      if (!email) return null;
      const [u] = await db.select().from(users).where(eq(users.email, email));
      return u ? { id: u.id, email: u.email, name: u.name } : null;
    },
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  // Guests stay signed in 30 days; staff sessions are cut at 12 hours in currentUser().
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/signin' },
  callbacks: {
    // Single-tenant Entra app: only Technical Source accounts reach here.
    // Owner emails become Owners; anyone else waits for an Owner to give them a role.
    async jwt({ token, account }) {
      if (account) { token.provider = account.provider; token.signedInAt = Math.floor(Date.now() / 1000); }
      return token;
    },
    async session({ session, token }) {
      (session as unknown as { provider?: unknown; signedInAt?: unknown }).provider = token.provider;
      (session as unknown as { signedInAt?: unknown }).signedInAt = token.signedInAt;
      return session;
    },
    async signIn({ user, account }) {
      const by = account?.provider === 'link' ? 'sign-in link' : account?.provider === 'dev' ? 'sample sign-in' : 'Microsoft sign-in';
      const email = normalizeEmail(user.email);
      if (!email) return false;
      const role = ownerEmails().includes(email) ? 'owner' : 'pending';
      const [u] = await db.insert(users)
        .values({ email, name: user.name ?? null, role, lastSignIn: new Date() })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            lastSignIn: new Date(),
            name: sql`coalesce(${users.name}, excluded.name)`,
            ...(role === 'owner' ? { role: 'owner' as const } : {}),
          },
        })
        .returning({ id: users.id, active: users.active, role: users.role, inserted: sql<boolean>`(xmax = 0)` });
      // Every sign-in is in History (who, when, and whether access was given).
      await audit({ userId: u.id, entity: 'user', entityId: u.id, action: u.inserted ? 'create' : 'sign-in',
        summary: u.inserted ? `signed in for the first time (${u.role === 'owner' ? 'owner' : 'waiting for access'})` : u.active ? 'signed in' : 'tried to sign in (access is off)', via: by });
      return u.active;
    },
  },
});
