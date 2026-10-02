import { PlaceLists } from '@/components/PlaceLists';
import Link from 'next/link';
import { AutoCloseDetails } from '@/components/AutoCloseDetails';
import { signOut } from '@/auth';
import { requirePage } from '@/lib/session';
import { can, roleNames } from '@/lib/permissions';
import { MenuButton, SideNav } from '@/components/sidenav/SideNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  const items = [
    { href: '/', label: 'Home', icon: 'home' },
    ...(can(user.role, 'contacts.view') ? [
      { href: '/people', label: 'People', icon: 'people' },
      { href: '/companies', label: 'Companies', icon: 'companies' },
      { href: '/going-cold', label: 'Going Cold', icon: 'cold' },
      { href: '/events', label: 'Events', icon: 'events' },
      { href: '/lists', label: 'Lists', icon: 'lists' },
    ] : []),
    ...(can(user.role, 'properties.view') ? [{ href: '/watchlist', label: 'Watchlist', icon: 'watch' }, { href: '/market', label: 'Market Map', icon: 'map' }] : []),
    { href: '/projects', label: 'Projects', icon: 'projects' },
    ...(can(user.role, 'contacts.view') ? [{ href: '/tasks', label: 'My Tasks', icon: 'tasks' }] : []),
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
            {can(user.role, 'users.manage') ? <Link href="/admin/users">Users and Access</Link> : null}
            {can(user.role, 'users.manage') ? <Link href="/admin/history">History (Everything)</Link> : null}
            {can(user.role, 'users.manage') ? <Link href="/admin/import">Import</Link> : null}
            {can(user.role, 'users.manage') ? <Link href="/admin/archived">Archived</Link> : null}
            {can(user.role, 'users.manage') ? <Link href="/admin/duplicates">Possible Duplicates</Link> : null}
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
              <button type="submit">Sign Out</button>
            </form>
          </div>
        </AutoCloseDetails>
      </header>
      <SideNav items={items} />
      <div className="app-body"><main>{children}</main></div>
      <PlaceLists />
    </>
  );
}
