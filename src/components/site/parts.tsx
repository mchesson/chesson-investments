import Link from 'next/link';
import { siteContent } from '@/lib/site-content';
import { formatNumber, type PublicProject } from '@/lib/site';

export const photoSrc = (base: (p: string) => string, id: string) => base(`/photos/${id}`);

export function Mark({ size = 38, light = false }: { size?: number; light?: boolean }) {
  const a = light ? '#FFFFFF' : '#1E4D7B', b = light ? '#A7B0BC' : '#707A89';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <path d="M90.38 47.11 A33 33 0 1 0 90.38 72.89" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round" />
      <line x1="49" y1="40" x2="71" y2="40" stroke={b} strokeWidth="4" strokeLinecap="round" />
      <line x1="60" y1="40" x2="60" y2="80" stroke={b} strokeWidth="4" strokeLinecap="round" />
      <line x1="49" y1="80" x2="71" y2="80" stroke={b} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const icons: Record<string, React.ReactNode> = {
  house: <><path d="M3 11l9-7 9 7" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></>,
  land: <><path d="M3 20h18" /><path d="M5 20V8l5-3 5 3v12" /><path d="M15 20v-7l4-2v9" /></>,
  tools: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></>,
};
export function Icon({ name }: { name: string }) {
  return <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">{icons[name]}</svg>;
}

export function SiteNav({ href }: { href: (p: string) => string }) {
  return (
    <nav className="top" aria-label="Main">
      <div className="nav-inner">
        <Link href={href('/')} className="brand"><Mark /><span className="n">CHESSON<small>INVESTMENTS</small></span></Link>
        <div className="nav-links">
          <Link href={`${href('/')}#services`} className="wide">What We Do</Link>
          <Link href={`${href('/')}#projects`}>Projects</Link>
          <Link href={`${href('/')}#contact`}>Contact</Link>
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="name">CHESSON<small>INVESTMENTS</small></div>
          <div className="site">
            <span>{siteContent.domain}</span>
            <a href={`tel:${siteContent.phone}`}>{siteContent.phoneShown}</a>
          </div>
        </div>
        <div className="foot-bottom">© {new Date().getFullYear()} Chesson Investments. All rights reserved.</div>
      </div>
    </footer>
  );
}

export const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function ProjectCard({ p, href }: { p: PublicProject; href: (s: string) => string }) {
  return (
    <Link className="pcard" href={href(`/projects/${p.slug}`)}>
      <div className="img" style={p.cover ? { backgroundImage: `url(${photoSrc(href, p.cover.id)})` } : undefined} role="img" aria-label={p.cover?.caption ?? p.name} />
      <div className="meta">
        <span className={`badge ${['sold', 'rented', 'completed'].includes(p.status) ? 'done' : ''}`}>{p.statusLabel}</span>
        <h3>{p.name}</h3>
        {p.place ? <div className="addr">{p.place}</div> : null}
        {p.tagline ? <p style={{ color: '#46505c' }}>{p.tagline}</p> : null}
        {p.price ? <div className="price">{money0(p.price)}</div> : null}
        <span className="more">See the project ›</span>
      </div>
    </Link>
  );
}

export function Stats({ p }: { p: PublicProject }) {
  const items = [
    p.price ? [money0(p.price), 'Offered At'] : null,
    p.beds ? [formatNumber(p.beds), p.beds === 1 ? 'Bedroom' : 'Bedrooms'] : null,
    p.baths ? [formatNumber(p.baths), p.baths === 1 ? 'Bathroom' : 'Bathrooms'] : null,
    p.sqft ? [formatNumber(p.sqft), 'Sq Ft'] : null,
    p.acres ? [formatNumber(p.acres), 'Acres'] : null,
  ].filter(Boolean) as [string, string][];
  if (!items.length) return null;
  return <div className="stats">{items.map(([n, c]) => <div key={c} className="stat"><div className="num">{n}</div><div className="cap">{c}</div></div>)}</div>;
}
