import 'server-only';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { sitePageViews } from '@/db/schema';
import { today } from './format';
import { isBotAgent } from './site-leads';

/**
 * Counts one visit to a website page (a path and a day; nothing about who).
 * Written after the page is sent, so it never slows a visitor down; link
 * prefetches, search engines and link checkers aren't counted.
 */
export async function countView(path: string) {
  const h = await headers();
  if (h.get('next-router-prefetch') || h.get('purpose') === 'prefetch' || h.get('sec-purpose')?.includes('prefetch')) return;
  if (isBotAgent(h.get('user-agent'))) return;
  const p = path.slice(0, 200);
  after(async () => {
    try {
      await db.insert(sitePageViews).values({ day: today(), path: p, views: 1 })
        .onConflictDoUpdate({ target: [sitePageViews.day, sitePageViews.path], set: { views: sql`${sitePageViews.views} + 1` } });
    } catch (e) {
      console.error('website visit not counted:', e instanceof Error ? e.message : e);
    }
  });
}
