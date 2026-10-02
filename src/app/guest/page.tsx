import Link from 'next/link';
import { requireGuest } from '@/lib/session';
import { guestDeals, guestProjects } from '@/lib/guest-data';
import { propertyStageLabel } from '@/lib/properties';
import { formatDate } from '@/lib/format';
import { Empty, PageHead, Section } from '@/components/ui';

export const metadata = { title: 'Your Projects' };

export default async function GuestHome() {
  const u = await requireGuest();
  const [ps, deals] = await Promise.all([guestProjects(u), guestDeals(u)]);
  return (
    <>
      <PageHead eyebrow="Welcome" title="Your Projects" sub="The projects Chesson Investments has shared with you." />
      <Section title="Projects" kind="aqua" hint={`${ps.length}`}>
        {ps.length ? <ul className="rows">{ps.map((p) => (
          <li key={p.a.id}><Link href={`/guest/projects/${p.a.projectId}`}><strong>{p.number ? `P-${p.number} · ` : ''}{p.name}</strong></Link><span className="small muted"> {p.address !== p.name ? p.address : ''}{p.city ? `, ${p.city}` : ''}</span></li>
        ))}</ul> : <Empty>No projects are shared with you right now.{deals.length ? '' : ' If that’s a mistake, contact Chesson Investments.'}</Empty>}
      </Section>
      {deals.length ? (
        <Section title="Deals You Sent Us" kind="blue" hint={`${deals.length}`}>
          <ul className="rows">{deals.map((d) => (
            <li key={d.id}><strong>{d.address}</strong>{d.city ? <span className="small muted">, {d.city}</span> : null} <span className="chip blue">{propertyStageLabel(d.stage)}</span><span className="small muted"> · sent {formatDate(d.created.toISOString())}</span></li>
          ))}</ul>
        </Section>
      ) : null}
    </>
  );
}
