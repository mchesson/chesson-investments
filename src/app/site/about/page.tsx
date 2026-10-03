import type { Metadata } from 'next';
import Link from 'next/link';
import { siteBase } from '@/lib/site-host';
import { siteSettings } from '@/lib/site-settings';
import { countView } from '@/lib/site-views';
import { Paragraphs } from '@/components/site/parts';

export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about' } };

export default async function SiteAbout() {
  const [{ href }, s] = await Promise.all([siteBase(), siteSettings(), countView('/about')]);
  return (
    <>
      <header className="page-hero"><div className="wrap"><div className="label">About</div><h1>About Chesson Investments</h1><p>{s.area}</p></div></header>
      <section className="block">
        <div className="wrap prose">
          <Paragraphs text={s.aboutText} />
          <div className="link-row">
            <Link className="btnlink" href={href('/projects')}>See Our Projects</Link>
            <Link className="btnlink outline" href={href('/contact')}>Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
