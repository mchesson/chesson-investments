import Link from 'next/link';
import { requireGuest } from '@/lib/session';
import { guestProjects } from '@/lib/guest-data';
import { Empty, PageHead, Section } from '@/components/ui';

export const metadata = { title: 'Your Projects' };

export default async function GuestHome() {
  const u = await requireGuest();
  const ps = await guestProjects(u);
  return (
    <>
      <PageHead eyebrow="Welcome" title="Your Projects" sub="The projects Chesson Investments has shared with you." />
      <Section title="Projects" kind="aqua" hint={`${ps.length}`}>
        {ps.length ? <ul className="rows">{ps.map((p) => (
          <li key={p.a.id}><Link href={`/guest/projects/${p.a.projectId}`}><strong>{p.number ? `P-${p.number} · ` : ''}{p.name}</strong></Link><span className="small muted"> {p.address !== p.name ? p.address : ''}{p.city ? `, ${p.city}` : ''}</span></li>
        ))}</ul> : <Empty>No projects are shared with you right now. If that’s a mistake, contact Chesson Investments.</Empty>}
      </Section>
    </>
  );
}
