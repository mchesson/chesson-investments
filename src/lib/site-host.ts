import 'server-only';
import { headers } from 'next/headers';
import { isPublicHost, siteHref } from './site';

/** Whether this request is on chessoninvestments.com, and how to write links for it. */
export async function siteBase() {
  const pub = isPublicHost((await headers()).get('host'));
  return { pub, href: (p: string) => siteHref(pub, p) };
}
