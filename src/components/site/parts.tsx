import Link from 'next/link';
import { formatNumber, type PublicProject } from '@/lib/site';

export const photoSrc = (base: (p: string) => string, id: string) => base(`/photos/${id}`);

export { Mark } from './Mark';

const icons: Record<string, React.ReactNode> = {
  house: <><path d="M3 11l9-7 9 7" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></>,
  land: <><path d="M3 20h18" /><path d="M5 20V8l5-3 5 3v12" /><path d="M15 20v-7l4-2v9" /></>,
  tools: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></>,
};
export function Icon({ name }: { name: string }) {
  return <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">{icons[name]}</svg>;
}

/** The website's pages, in the top bar's order. */
export const sitePages = [
  { path: '/projects', label: 'Projects' },
  { path: '/what-we-do', label: 'What We Do' },
  { path: '/about', label: 'About' },
  { path: '/contact', label: 'Contact' },
  { path: '/sell', label: 'Sell Us Your Property' },
] as const;

export function SiteFooter({ href, phone, email, area }: { href: (p: string) => string; phone: { shown: string; link: string } | null; email: string | null; area: string }) {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Link href={href('/')} className="name">CHESSON<small>INVESTMENTS</small></Link>
            <p className="foot-area">{area}</p>
          </div>
          <nav className="foot-links" aria-label="Website pages">
            <Link href={href('/')}>Home</Link>
            {sitePages.map((p) => <Link key={p.path} href={href(p.path)}>{p.label}</Link>)}
          </nav>
          <div className="site">
            <span className="foot-h">Contact</span>
            {phone ? <a href={phone.link}>{phone.shown}</a> : null}
            {email ? <a href={`mailto:${email}`}>{email}</a> : null}
            <Link href={href('/contact')}>Send Us a Message</Link>
          </div>
        </div>
        <div className="foot-bottom">© {new Date().getFullYear()} Chesson Investments, LLC. All rights reserved.</div>
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

/** Text typed on Website Settings: a blank line starts a new paragraph. */
export function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</>;
}
