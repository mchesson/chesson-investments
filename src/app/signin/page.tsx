import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { devLogin, signIn } from '@/auth';
import { currentUser } from '@/lib/session';
import { db } from '@/db';
import { users } from '@/db/schema';

export const metadata = { title: 'Sign In' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect('/');
  const { error } = await searchParams;
  const entra = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const samples = devLogin ? await db.select().from(users).orderBy(desc(users.role)) : [];
  return (
    <div className="signin">
      <div className="panel">
        <div className="type">Private</div>
        <h1>Chesson Investments</h1>
        <p className="muted">Sign in with your Microsoft 365 account.</p>
        <div className="stripe" />
        {error ? <div className="notice error">That account can&apos;t sign in here. Ask Matthew to add you.</div> : null}
        {entra ? (
          <form action={async () => { 'use server'; await signIn('microsoft-entra-id', { redirectTo: '/' }); }}>
            <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Sign In With Microsoft</button>
          </form>
        ) : <p className="notice warn">Microsoft sign-in isn&apos;t set up yet.</p>}
        {samples.length ? (
          <div style={{ marginTop: 18 }}>
            <p className="small muted">Local only: sign in as a sample user.</p>
            {samples.map((u) => (
              <form key={u.id} action={async () => { 'use server'; await signIn('dev', { email: u.email, redirectTo: '/' }); }} style={{ marginBottom: 6 }}>
                <button className="btn secondary small" type="submit">{u.name} ({u.role})</button>
              </form>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
