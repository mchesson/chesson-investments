import Link from 'next/link';
import { publishedProjects } from '@/lib/site-data';
import { siteBase } from '@/lib/site-host';
import { siteContent } from '@/lib/site-content';
import { Icon, Mark, ProjectCard } from '@/components/site/parts';

export default async function SiteHome() {
  const [{ href }, projects] = await Promise.all([siteBase(), publishedProjects()]);
  return (
    <>
      <header className="hero">
        <Mark size={92} light />
        <div><div className="name">CHESSON</div><div className="sub">INVESTMENTS</div></div>
        <p className="tag">{siteContent.tagline}</p>
      </header>

      <section className="block" id="services">
        <div className="wrap">
          <div className="sechead"><div className="label">What We Do</div><h2>{siteContent.servicesTitle}</h2><p>{siteContent.servicesIntro}</p></div>
          <div className="services">
            {siteContent.services.map((s) => (
              <div key={s.title} className="svc"><div className="ico"><Icon name={s.icon} /></div><h3>{s.title}</h3><p>{s.text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="block" id="projects">
        <div className="wrap">
          <div className="sechead"><div className="label">Projects</div><h2>{siteContent.projectsTitle}</h2><p>{siteContent.projectsIntro}</p></div>
          {projects.length ? (
            <div className="cards">{projects.map((p) => <ProjectCard key={p.slug} p={p} href={href} />)}</div>
          ) : <p className="empty">New projects are on the way.</p>}
        </div>
      </section>

      <section className="block contact" id="contact">
        <div className="wrap">
          <div className="label">Contact</div>
          <p className="big"><a href={`tel:${siteContent.phone}`}>{siteContent.phoneShown}</a></p>
          <p style={{ color: '#46505c', marginTop: 10 }}>{siteContent.area}</p>
          {projects.length ? <Link className="btnlink" href={href(`/projects/${projects[0].slug}`)}>See Our Latest Project</Link> : null}
        </div>
      </section>
    </>
  );
}
