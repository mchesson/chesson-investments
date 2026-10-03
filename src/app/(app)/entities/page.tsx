import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { entityKindLabel, listEntities } from '@/lib/entities';
import { formatDate } from '@/lib/format';
import { Empty, PageHead, Section } from '@/components/ui';

export const metadata = { title: 'Business Entities' };

export default async function EntitiesPage() {
  await requirePage('sensitive.view');
  const rows = await listEntities();
  return (
    <>
      <PageHead title="Business Entities" sub="The companies we own or hold a share of: who owns what, their documents (operating agreements, articles, tax returns) and their tax IDs. Only people with restricted-records access see this."
        actions={<Link className="btn" href="/entities/new">Add an Entity</Link>} />
      <Section title="Entities" kind="blue" hint={`${rows.length}`}>
        {rows.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Name</th><th>Kind</th><th>Formed</th><th>Taxes</th><th className="num">Members</th><th className="num">Projects</th><th className="num">Documents</th><th className="num">Tax IDs</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/entities/${e.id}`}><strong>{e.name}</strong></Link>{e.status === 'dissolved' ? <span className="chip"> Dissolved</span> : null}</td>
                <td>{entityKindLabel(e.kind)}{e.state ? ` · ${e.state}` : ''}</td>
                <td>{e.formedOn ? formatDate(e.formedOn) : '—'}</td>
                <td>{e.taxForm ?? '—'}</td>
                <td className="num">{e.members}</td><td className="num">{e.projects}</td><td className="num">{e.docs}</td><td className="num">{e.taxIds}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>No entities yet. Add Chesson Investments, LLC and WJ Investment Group, LLC to start.</Empty>}
      </Section>
    </>
  );
}
