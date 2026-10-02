import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { looksLikeToken } from '@/lib/guests';

export const metadata = { title: 'Sign In' };

// A sign-in link opens here and signs in only when the button is pressed, so
// an email scanner that opens links by itself can't use it up.
export default async function LinkSignIn({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const ok = looksLikeToken(t);
  return (
    <div className="signin">
      <div className="panel">
        <div className="type">Private</div>
        <h1>Chesson Investments</h1>
        <div className="stripe" />
        {ok ? (
          <>
            <p>Press Sign In to open your projects.</p>
            <form action={async () => {
              'use server';
              try { await signIn('link', { token: t, redirectTo: '/guest' }); } catch (e) {
                // A used, expired or unknown link: back to sign-in with a plain message.
                if (e instanceof AuthError) redirect('/signin?error=CredentialsSignin');
                throw e;
              }
            }}>
              <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Sign In</button>
            </form>
          </>
        ) : <p className="notice error">This link isn’t complete. Open it again from the email, or ask for a new one.</p>}
      </div>
    </div>
  );
}
