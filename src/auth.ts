import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { normalizeEmail } from '@/lib/format';

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
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/signin' },
  callbacks: {
    // Single-tenant Entra app: only Technical Source accounts reach here.
    // Owner emails become Owners; anyone else waits for an Owner to give them a role.
    async signIn({ user }) {
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
        .returning();
      return u.active;
    },
  },
});
