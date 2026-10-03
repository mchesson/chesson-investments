'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

type Item = { href: string; label: string; icon: string };

// Inline line icons, 24px grid, 1.8 stroke (as TS Workspace).
const icons: Record<string, string> = {
  docs: 'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  people: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  companies: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1',
  watch: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  projects: 'M3 21h18M6 21V10l6-5 6 5v11M10 21v-5h4v5',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  cold: 'M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1L19.1 4.9',
  events: 'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  lists: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  building: 'M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M3 13h18',
};

export function SideNav({ items }: { items: Item[] }) {
  const path = usePathname();
  useEffect(() => { document.documentElement.classList.remove('drawer-open'); }, [path]);
  const toggle = () => {
    const el = document.documentElement;
    const next = el.dataset.sidenav === 'collapsed' ? 'expanded' : 'collapsed';
    el.dataset.sidenav = next;
    try { localStorage.setItem('ci-sidenav', next); } catch {}
  };
  return (
    <>
      <aside className="sidenav" id="sidenav" aria-label="Main menu">
        <nav>
          {items.map((i) => {
            const on = i.href === '/' ? path === '/' : path === i.href || path.startsWith(i.href + '/');
            return (
              <Link key={i.href} href={i.href} aria-current={on ? 'page' : undefined} title={i.label}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icons[i.icon]} /></svg>
                <span className="label">{i.label}</span>
              </Link>
            );
          })}
        </nav>
        <button type="button" className="collapse" onClick={toggle}>« <span className="label">Collapse</span></button>
      </aside>
      <div className="drawer-shade" onClick={() => document.documentElement.classList.remove('drawer-open')} />
    </>
  );
}

export function MenuButton() {
  return (
    <button type="button" className="menu-btn" aria-label="Open the menu" aria-controls="sidenav"
      onClick={() => document.documentElement.classList.toggle('drawer-open')}>☰</button>
  );
}
