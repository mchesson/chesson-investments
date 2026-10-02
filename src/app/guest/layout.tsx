import Link from 'next/link';
import { signOut } from '@/auth';
import { requireGuest } from '@/lib/session';
import { guestHasMarket } from '@/lib/guest-data';

export const metadata = { title: { absolute: 'Chesson Investments', template: '%s · Chesson Investments' }, robots: { index: false } };

// The guest pages: no menu, no staff pages; only their projects.
export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const u = await requireGuest();
  const market = await guestHasMarket(u.id);
  return (
    <>
      <header className="topbar">
        <Link href="/guest" className="wordmark">Chesson <span>Investments</span></Link>
        <nav className="guest-nav"><Link href="/guest">Your Projects</Link>{market ? <Link href="/guest/market">Market Map</Link> : null}</nav>
        <span className="spacer" />
        <span className="small muted guest-who">{u.name ?? u.email}</span>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}><button className="btn small secondary" type="submit">Sign Out</button></form>
      </header>
      <div className="guest-body"><main>{children}</main></div>
    </>
  );
}
