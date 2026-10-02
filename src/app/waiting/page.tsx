import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { currentUser } from '@/lib/session';

export default async function Waiting() {
  const u = await currentUser();
  if (!u) redirect('/signin');
  if (u.role !== 'pending') redirect('/');
  return (
    <div className="signin">
      <div className="panel">
        <h1>Waiting for Access</h1>
        <p>You&apos;re signed in as {u.email}. Matthew needs to give you access before you can use Chesson Investments.</p>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
          <button className="btn secondary" type="submit">Sign Out</button>
        </form>
      </div>
    </div>
  );
}
