import 'server-only';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { siteContent } from './site-content';
import { WEBSITE_SETTINGS_KEY, websiteSettings, type WebsiteSettings } from './site-leads';
import { SITE_TAG } from './site-data';

/** What the website shows until the owner changes it on Website Settings. */
export const websiteDefaults: WebsiteSettings = {
  phone: siteContent.phone, email: siteContent.email, area: siteContent.area,
  aboutText: siteContent.aboutText, whatWeDoIntro: siteContent.whatWeDoIntro, sellIntro: siteContent.sellIntro, contactIntro: siteContent.contactIntro,
  gaId: null, searchConsole: null,
};

export async function readWebsiteSettings(): Promise<WebsiteSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, WEBSITE_SETTINGS_KEY));
  return websiteSettings(row?.value, websiteDefaults);
}

/** The website's settings, cached with the rest of the website (cleared when they're saved). */
export const siteSettings = unstable_cache(readWebsiteSettings, ['site-settings'], { tags: [SITE_TAG], revalidate: 300 });
