export const dynamic = 'force-dynamic';

import { publishedProjects } from '@/lib/site-data';

export async function GET() {
  const base = 'https://chessoninvestments.com';
  const urls = ['/', ...(await publishedProjects()).map((p) => `/projects/${p.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } });
}
