import type { Metadata } from 'next';
import Script from 'next/script';
import '@fontsource-variable/outfit';
import './site.css';
import { siteBase } from '@/lib/site-host';
import { siteContent } from '@/lib/site-content';
import { siteSettings } from '@/lib/site-settings';
import { phoneLink, phoneShown } from '@/lib/site-leads';
import { SiteFooter, sitePages } from '@/components/site/parts';
import { SiteNav } from '@/components/site/Nav';
import { SourceTracker } from '@/components/site/SourceTracker';

// Search engines may list the website only on its own address; on the app's
// address (/site) it stays hidden like the rest of the app.
export async function generateMetadata(): Promise<Metadata> {
  const [{ pub, href }, s] = await Promise.all([siteBase(), siteSettings()]);
  return {
    icons: { icon: href('/mark.svg') },
    title: { absolute: 'Chesson Investments', template: '%s · Chesson Investments' },
    description: `Chesson Investments: ${siteContent.tagline.toLowerCase().replace(/\.$/, '')} in ${s.area}.`,
    metadataBase: new URL(`https://${siteContent.domain}`),
    robots: pub ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { siteName: 'Chesson Investments', type: 'website' },
    // Search Console's "HTML tag" check, when it's set on Website Settings.
    verification: s.searchConsole ? { google: s.searchConsole } : undefined,
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ href }, s] = await Promise.all([siteBase(), siteSettings()]);
  const shown = phoneShown(s.phone), link = phoneLink(s.phone);
  const phone = shown && link ? { shown, link } : null;
  return (
    <div className="ci-site">
      <a className="skip" href="#main">Skip to the content</a>
      <SiteNav home={href('/')} links={sitePages.map((p) => ({ ...p, href: href(p.path) }))} phone={phone} />
      <main id="main">{children}</main>
      <SiteFooter href={href} phone={phone} email={s.email} area={s.area} />
      <SourceTracker />
      {/* Google Analytics, only on the website and only when its measurement ID is set (Website Settings). */}
      {s.gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${s.gaId}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(s.gaId)});`}</Script>
        </>
      ) : null}
    </div>
  );
}
