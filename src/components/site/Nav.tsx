'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Mark } from './Mark';

export type NavLink = { href: string; label: string; path: string };

/** The website's top bar on every page: the name, the pages, the phone; a Menu button on phones. */
export function SiteNav({ home, links, phone }: { home: string; links: NavLink[]; phone: { shown: string; link: string } | null }) {
  const raw = usePathname() ?? '/';
  const path = raw.replace(/^\/site(?=\/|$)/, '') || '/';
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [raw]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  const on = (p: string) => (p === '/projects' ? path === p || path.startsWith('/projects/') : path === p);
  return (
    <nav className={`top ${open ? 'open' : ''}`} aria-label="Main">
      <div className="nav-inner">
        <Link href={home} className="brand" aria-label="Chesson Investments, home"><Mark /><span className="n">CHESSON<small>INVESTMENTS</small></span></Link>
        <div className="nav-links" id="site-menu">
          {links.map((l) => <Link key={l.path} href={l.href} aria-current={on(l.path) ? 'page' : undefined} className={l.path === '/sell' ? 'cta' : undefined}>{l.label}</Link>)}
          {phone ? <a className="nav-phone" href={phone.link}>{phone.shown}</a> : null}
        </div>
        <button ref={btn} type="button" className="menu-toggle" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">{open ? '✕' : '☰'}</span> Menu
        </button>
      </div>
    </nav>
  );
}
