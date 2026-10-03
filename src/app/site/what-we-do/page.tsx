import type { Metadata } from 'next';
import Link from 'next/link';
import { siteBase } from '@/lib/site-host';
import { siteContent } from '@/lib/site-content';
import { siteSettings } from '@/lib/site-settings';
import { countView } from '@/lib/site-views';
import { Icon, Paragraphs } from '@/components/site/parts';

export const metadata: Metadata = { title: 'What We Do', description: siteContent.whatWeDoIntro, alternates: { canonical: '/what-we-do' } };

export default async function SiteWhatWeDo() {
  const [{ href }, s] = await Promise.all([siteBase(), siteSettings(), countView('/what-we-do')]);
  return (
    <>
      <header className="page-hero"><div className="wrap"><div className="label">What We Do</div><h1>{siteContent.servicesTitle}</h1><Paragraphs text={s.whatWeDoIntro} /></div></header>
      <section className="block">
        <div className="wrap">
          <div className="services">
            {siteContent.services.map((x) => (
              <div key={x.title} className="svc"><div className="ico"><Icon name={x.icon} /></div><h2 className="h3">{x.title}</h2><p>{x.text}</p></div>
            ))}
          </div>
        </div>
      </section>
      <section className="block band">
        <div className="wrap band-inner">
          <div>
            <div className="label">See the Work</div>
            <h2>Homes we’ve built and reimagined</h2>
            <p>{siteContent.projectsIntro}</p>
          </div>
          <Link className="btnlink" href={href('/projects')}>See Our Projects</Link>
        </div>
      </section>
      <section className="block contact">
        <div className="wrap">
          <div className="label">Have a Property?</div>
          <p className="mid">We’re always looking at lots, teardowns, land and homes that need a full renovation.</p>
          <Link className="btnlink" href={href('/sell')}>Sell Us Your Property</Link>
        </div>
      </section>
    </>
  );
}
