import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { publishedProject } from '@/lib/site-data';
import { siteBase } from '@/lib/site-host';
import { siteContent } from '@/lib/site-content';
import { slugify } from '@/lib/site';
import { Gallery } from '@/components/site/Gallery';
import { photoSrc, Stats } from '@/components/site/parts';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return slug === slugify(slug) ? publishedProject(slug) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return { title: 'Not Found' };
  return {
    title: p.name,
    description: p.tagline ?? p.description.slice(0, 160),
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: { title: p.name, description: p.tagline ?? undefined, images: p.cover ? [`/photos/${p.cover.id}`] : undefined },
  };
}

export default async function SiteProject({ params }: Props) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const { href } = await siteBase();
  const src = (id: string) => photoSrc(href, id);
  const of = (kind: string) => p.photos.filter((f) => f.kind === kind).map((f) => ({ src: src(f.id), alt: f.caption ?? `${p.name}` }));
  const after = of('after'), before = of('before'), progress = of('progress'), plans = p.photos.filter((f) => f.kind === 'plan');
  const lead = p.team[0] && /general contractor|construction management|builder/i.test(p.team[0].role) ? p.team[0] : null;
  const rest = lead ? p.team.slice(1) : p.team;
  return (
    <>
      <header className="phero" style={p.cover ? { backgroundImage: `url(${src(p.cover.id)})` } : undefined}>
        <div className="wrap">
          <span className="badge">{p.statusLabel}</span>
          <h1>{p.name}</h1>
          <div className="place">{[p.place, p.tagline].filter(Boolean).join('  ·  ')}</div>
        </div>
      </header>

      <section className="block">
        <div className="wrap">
          <Stats p={p} />
          <p className="overview">{p.description}</p>
          {after.length ? <><div className="galhead"><span className="t">After</span><span className="sm">The finished home</span></div><Gallery photos={after} /></> : null}
          {before.length ? <><div className="galhead"><span className="t">Before</span><span className="sm">As we bought it</span></div><Gallery photos={before} /></> : null}
          {progress.length ? <><div className="galhead"><span className="t">In Progress</span><span className="sm">The build</span></div><Gallery photos={progress} /></> : null}
        </div>
      </section>

      {plans.length || p.details.length ? (
        <section className="block">
          <div className="wrap">
            <div className="sechead"><div className="label">Design & Finishes</div><h2>The details</h2></div>
            {plans.map((f) => (
              <figure key={f.id} className="floorplan" style={{ margin: '0 0 40px' }}>
                <img src={src(f.id)} alt={f.caption ?? 'Floor plan'} loading="lazy" />
                <figcaption className="empty" style={{ marginTop: 8, fontSize: 13 }}>{f.caption ?? 'Floor plan'}</figcaption>
              </figure>
            ))}
            {p.details.length ? (
              <div className="spec">
                {p.details.map((s) => (
                  <div key={s.title}>
                    <h3>{s.title}</h3>
                    {s.items.map((it, i) => <div key={i} className="row">{it.label ? <span className="k">{it.label}</span> : null}<span className="v">{it.value}</span></div>)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {p.team.length ? (
        <section className="block">
          <div className="wrap">
            <div className="sechead"><div className="label">Project Team</div><h2>Who did what</h2></div>
            {lead ? <div className="lead-credit"><div className="role">{lead.role}</div><div className="co">{lead.name}</div>{lead.detail ? <div className="person">{lead.detail}</div> : null}</div> : null}
            {rest.length ? (
              <div className="creditlist">
                {rest.map((t, i) => <div key={i} className="crow"><span className="trade">{t.role}</span><span className="co">{t.name}</span><span className="scope">{t.detail}</span></div>)}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="block contact">
        <div className="wrap">
          <div className="label">Interested?</div>
          <p className="big"><a href={`tel:${siteContent.phone}`}>{siteContent.phoneShown}</a></p>
          <Link className="back" href={`${href('/')}#projects`}>‹ All Projects</Link>
        </div>
      </section>
    </>
  );
}
