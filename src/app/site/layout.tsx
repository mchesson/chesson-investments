import type { Metadata } from 'next';
import '@fontsource-variable/outfit';
import './site.css';
import { siteBase } from '@/lib/site-host';
import { siteContent } from '@/lib/site-content';
import { SiteFooter, SiteNav } from '@/components/site/parts';

// Search engines may list the website only on its own address; on the app's
// address (/site) it stays hidden like the rest of the app.
export async function generateMetadata(): Promise<Metadata> {
  const { pub, href } = await siteBase();
  return {
    icons: { icon: href('/mark.svg') },
    title: { absolute: 'Chesson Investments', template: '%s · Chesson Investments' },
    description: `Chesson Investments: ${siteContent.tagline.toLowerCase().replace(/\.$/, '')} in ${siteContent.area}.`,
    metadataBase: new URL(`https://${siteContent.domain}`),
    robots: pub ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { siteName: 'Chesson Investments', type: 'website' },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { href } = await siteBase();
  return (
    <div className="ci-site">
      <a className="skip" href="#main">Skip to the content</a>
      <SiteNav href={href} />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
