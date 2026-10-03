import type { Metadata } from 'next';
import { siteSettings } from '@/lib/site-settings';
import { countView } from '@/lib/site-views';
import { phoneLink, phoneShown } from '@/lib/site-leads';
import { Paragraphs } from '@/components/site/parts';
import { LeadForm } from '@/components/site/LeadForm';

export const metadata: Metadata = { title: 'Sell Us Your Property', description: 'Tell Chesson Investments about a lot, teardown, land or home you’re thinking of selling.', alternates: { canonical: '/sell' } };

export default async function SiteSell() {
  const [s] = await Promise.all([siteSettings(), countView('/sell')]);
  const tel = phoneLink(s.phone);
  return (
    <>
      <header className="page-hero"><div className="wrap"><div className="label">Sell Us Your Property</div><h1>Thinking of selling?</h1><Paragraphs text={s.sellIntro} /></div></header>
      <section className="block">
        <div className="wrap form-layout">
          <LeadForm kind="sell" />
          <aside className="reach">
            <h2 className="h3">What We Look For</h2>
            <ul>
              <li>Vacant and infill lots</li>
              <li>Teardowns</li>
              <li>Land we could develop</li>
              <li>Homes that need a full renovation</li>
            </ul>
            <p className="small">In {s.area}.</p>
            {tel ? <p><span className="k">Rather Talk?</span><a href={tel}>{phoneShown(s.phone)}</a></p> : null}
          </aside>
        </div>
      </section>
    </>
  );
}
