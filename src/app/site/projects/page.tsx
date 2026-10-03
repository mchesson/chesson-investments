import type { Metadata } from 'next';
import Link from 'next/link';
import { publishedProjects } from '@/lib/site-data';
import { siteBase } from '@/lib/site-host';
import { siteContent } from '@/lib/site-content';
import { countView } from '@/lib/site-views';
import { ProjectCard } from '@/components/site/parts';

export const metadata: Metadata = { title: 'Projects', description: siteContent.projectsIntro, alternates: { canonical: '/projects' } };

export default async function SiteProjects() {
  const [{ href }, projects] = await Promise.all([siteBase(), publishedProjects(), countView('/projects')]);
  return (
    <>
      <header className="page-hero"><div className="wrap"><div className="label">Projects</div><h1>{siteContent.projectsTitle}</h1><p>{siteContent.projectsIntro}</p></div></header>
      <section className="block">
        <div className="wrap">
          {projects.length ? <div className="cards">{projects.map((p) => <ProjectCard key={p.slug} p={p} href={href} />)}</div> : <p className="empty">New projects are on the way.</p>}
          <p className="aside">Have a lot or a house that could be our next project? <Link href={href('/sell')}>Tell us about it</Link>.</p>
        </div>
      </section>
    </>
  );
}
