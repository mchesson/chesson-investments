import { PlaceLists } from '@/components/PlaceLists';
import Link from 'next/link';
import { AutoCloseDetails } from '@/components/AutoCloseDetails';
import { signOut } from '@/auth';
import { requirePage } from '@/lib/session';
import { can, roleNames } from '@/lib/permissions';
import { MenuButton, SideNav } from '@/components/sidenav/SideNav';
import { ToastHost } from '@/components/Toast';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  const items = [
    // The owner's order (Oct 3, 2026): projects, then the market map, companies, people; Going Cold last.
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/projects', label: 'Projects', icon: 'projects' },
    ...(can(user, 'projects.edit') ? [{ href: '/documents/drop', label: 'Drop Documents', icon: 'docs' }] : []),
    ...(can(user, 'bills.edit') ? [{ href: '/receipts/snap', label: 'Snap a Receipt', icon: 'camera' }, { href: '/trips', label: 'Trip Log', icon: 'car' }] : []),
    ...(can(user, 'money.view') ? [{ href: '/overhead', label: 'Overhead', icon: 'receipt' }] : []),
    ...(can(user, 'properties.view') ? [{ href: '/market', label: 'Market Map', icon: 'map' }, { href: '/watchlist', label: 'Watchlist', icon: 'watch' }] : []),
    ...(can(user, 'contacts.view') ? [
      { href: '/companies', label: 'Companies', icon: 'companies' },
      { href: '/people', label: 'People', icon: 'people' },
      { href: '/leads', label: 'Leads', icon: 'leads' },
      { href: '/events', label: 'Events', icon: 'events' },
      { href: '/lists', label: 'Lists', icon: 'lists' },
      { href: '/tasks', label: 'My Tasks', icon: 'tasks' },
    ] : []),
    ...(can(user, 'sensitive.view') ? [{ href: '/entities', label: 'Business Entities', icon: 'building' }] : []),
    ...(can(user, 'contacts.view') ? [{ href: '/going-cold', label: 'Going Cold', icon: 'cold' }] : []),
  ];
  return (
    <>
      <header className="topbar">
        <MenuButton />
        <Link href="/" className="wordmark">Chesson <span>Investments</span></Link>
        <span className="spacer" />
        <AutoCloseDetails className="account">
          <summary>{user.name ?? user.email} ▾</summary>
          <div className="pop">
            <div className="small muted" style={{ padding: '4px 10px' }}>{user.email} · {roleNames[user.role]}</div>
            {can(user, 'users.manage') ? <Link href="/admin/users">Users and Access</Link> : null}
            {can(user, 'history.all') ? <Link href="/admin/history">History (Everything)</Link> : null}
            {can(user, 'import.run') ? <Link href="/admin/import">Import</Link> : null}
            {can(user, 'records.delete') ? <Link href="/admin/archived">Archived</Link> : null}
            {can(user, 'records.delete') ? <Link href="/admin/duplicates">Possible Duplicates</Link> : null}
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
              <button type="submit">Sign Out</button>
            </form>
          </div>
        </AutoCloseDetails>
      </header>
      <SideNav items={items} />
      <div className="app-body"><main>{children}</main></div>
      <ToastHost />
      <PlaceLists />
    </>
  );
}
