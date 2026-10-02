import Link from 'next/link';
import { siteBase } from '@/lib/site-host';

export default async function SiteNotFound() {
  const { href } = await siteBase();
  return (
    <section className="block contact"><div className="wrap">
      <div className="label">Not Found</div>
      <p className="big">That page isn’t here.</p>
      <Link className="btnlink" href={href('/')}>Go to the Home Page</Link>
    </div></section>
  );
}
