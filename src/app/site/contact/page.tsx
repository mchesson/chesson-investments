import type { Metadata } from 'next';
import { siteSettings } from '@/lib/site-settings';
import { countView } from '@/lib/site-views';
import { phoneLink, phoneShown } from '@/lib/site-leads';
import { Paragraphs } from '@/components/site/parts';
import { LeadForm } from '@/components/site/LeadForm';

export const metadata: Metadata = { title: 'Contact Us', alternates: { canonical: '/contact' } };

export default async function SiteContact() {
  const [s] = await Promise.all([siteSettings(), countView('/contact')]);
  const tel = phoneLink(s.phone);
  return (
    <>
      <header className="page-hero"><div className="wrap"><div className="label">Contact</div><h1>Contact Us</h1><Paragraphs text={s.contactIntro} /></div></header>
      <section className="block">
        <div className="wrap form-layout">
          <LeadForm kind="contact" />
          <aside className="reach">
            <h2 className="h3">Other Ways to Reach Us</h2>
            {tel ? <p><span className="k">Phone</span><a href={tel}>{phoneShown(s.phone)}</a></p> : null}
            {s.email ? <p><span className="k">Email</span><a href={`mailto:${s.email}`}>{s.email}</a></p> : null}
            <p><span className="k">Where We Work</span>{s.area}</p>
          </aside>
        </div>
      </section>
    </>
  );
}
