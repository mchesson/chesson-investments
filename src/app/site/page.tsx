import Link from 'next/link';
import { publishedProjects } from '@/lib/site-data';
import { siteBase } from '@/lib/site-host';
import { siteContent } from '@/lib/site-content';
import { siteSettings } from '@/lib/site-settings';
import { countView } from '@/lib/site-views';
import { phoneLink, phoneShown } from '@/lib/site-leads';
import { Icon, Mark, ProjectCard } from '@/components/site/parts';

export default async function SiteHome() {
  const [{ href }, projects, s] = await Promise.all([siteBase(), publishedProjects(), siteSettings(), countView('/')]);
  const tel = phoneLink(s.phone);
  return (
    <>
      <header className="hero">
        <Mark size={92} light />
        <div><h1 className="name">CHESSON</h1><div className="sub">INVESTMENTS</div></div>
        <p className="tag">{siteContent.tagline}</p>
        <div className="hero-ctas">
          <Link className="btnlink light" href={href('/projects')}>See Our Projects</Link>
          <Link className="btnlink ghost" href={href('/sell')}>Sell Us Your Property</Link>
        </div>
      </header>

      <section className="block" id="services">
        <div className="wrap">
          <div className="sechead"><div className="label">What We Do</div><h2>{siteContent.servicesTitle}</h2><p>{s.whatWeDoIntro}</p></div>
          <div className="services">
            {siteContent.services.map((x) => (
              <div key={x.title} className="svc"><div className="ico"><Icon name={x.icon} /></div><h3>{x.title}</h3><p>{x.text}</p></div>
            ))}
          </div>
          <Link className="more-link" href={href('/what-we-do')}>More About What We Do ›</Link>
        </div>
      </section>

      <section className="block" id="projects">
        <div className="wrap">
          <div className="sechead"><div className="label">Projects</div><h2>{siteContent.projectsTitle}</h2><p>{siteContent.projectsIntro}</p></div>
          {projects.length ? (
            <div className="cards">{projects.slice(0, 4).map((p) => <ProjectCard key={p.slug} p={p} href={href} />)}</div>
          ) : <p className="empty">New projects are on the way.</p>}
          {projects.length > 4 ? <Link className="more-link" href={href('/projects')}>All {projects.length} Projects ›</Link> : null}
        </div>
      </section>

      <section className="block band">
        <div className="wrap band-inner">
          <div>
            <div className="label">Selling a Property?</div>
            <h2>Lots, teardowns and homes that need a full renovation</h2>
            <p>If you own a property in {s.area.replace(/, North Carolina$/, '')} and are thinking of selling, tell us about it.</p>
          </div>
          <Link className="btnlink" href={href('/sell')}>Tell Us About It</Link>
        </div>
      </section>

      <section className="block contact" id="contact">
        <div className="wrap">
          <div className="label">Contact</div>
          {tel ? <p className="big"><a href={tel}>{phoneShown(s.phone)}</a></p> : null}
          {s.email ? <p className="mid"><a href={`mailto:${s.email}`}>{s.email}</a></p> : null}
          <p style={{ color: '#46505c', marginTop: 10 }}>{s.area}</p>
          <Link className="btnlink" href={href('/contact')}>Send Us a Message</Link>
        </div>
      </section>
    </>
  );
}
