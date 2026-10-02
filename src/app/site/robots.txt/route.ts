import { siteBase } from '@/lib/site-host';

export async function GET() {
  const { pub } = await siteBase();
  const body = pub ? 'User-agent: *\nAllow: /\nSitemap: https://chessoninvestments.com/sitemap.xml\n' : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
