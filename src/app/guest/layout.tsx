import Link from 'next/link';
import { signOut } from '@/auth';
import { requireGuest } from '@/lib/session';

export const metadata = { title: { absolute: 'Chesson Investments', template: '%s · Chesson Investments' }, robots: { index: false } };

// The guest pages: no menu, no staff pages; only their projects.
export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const u = await requireGuest();
  return (
    <>
      <header className="topbar">
        <Link href="/guest" className="wordmark">Chesson <span>Investments</span></Link>
        <span className="spacer" />
        <span className="small muted guest-who">{u.name ?? u.email}</span>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}><button className="btn small secondary" type="submit">Sign Out</button></form>
      </header>
      <div className="guest-body"><main>{children}</main></div>
    </>
  );
}
