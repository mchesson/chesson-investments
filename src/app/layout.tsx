import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/open-sans';
import '@fontsource-variable/vollkorn';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Chesson Investments', template: '%s · Chesson Investments' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#212121' };

// Applies the remembered menu choice before first paint (no flash).
const SIDENAV_BOOT = `try{var v=localStorage.getItem('ci-sidenav');if(!v){v=innerWidth<1100?'collapsed':'expanded'}document.documentElement.dataset.sidenav=v}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDENAV_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
