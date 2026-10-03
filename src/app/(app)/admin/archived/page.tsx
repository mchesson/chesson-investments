import { ActionButton } from '@/components/ActionButton';
import Link from 'next/link';
import { desc, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { companies, people } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { formatDate } from '@/lib/format';
import { setArchived } from '../../delete-actions';
import { Empty, PageHead, Section } from '@/components/ui';

export const metadata = { title: 'Archived' };

export default async function ArchivedPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requirePage('records.delete');
  const { deleted } = await searchParams;
  const ps = await db.select({ id: people.id, f: people.firstName, l: people.lastName, at: people.archived }).from(people).where(isNotNull(people.archived)).orderBy(desc(people.archived)).limit(500);
  const cs = await db.select({ id: companies.id, name: companies.name, at: companies.archived }).from(companies).where(isNotNull(companies.archived)).orderBy(desc(companies.archived)).limit(500);
  const row = (kind: 'person' | 'company', id: string, name: string, at: Date | null) => (
    <li key={id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <strong style={{ flex: 1 }}>{name}</strong><span className="small muted">archived {formatDate(at?.toISOString())}</span>
      <ActionButton action={setArchived.bind(null, kind, id, false)} className="btn secondary small" label="Restore" done="Restored." />
      <Link className="red small" href={`/admin/delete/${kind}/${id}`}>Delete Permanently…</Link>
    </li>
  );
  return (
    <div className="stack">
      <PageHead title="Archived" sub="People and companies taken out of the lists. Restore one, or delete it for good." />
      {deleted ? <div className="notice">Deleted {deleted} permanently. History keeps a copy.</div> : null}
      <Section title="People" kind="grey" hint={`${ps.length}`}>{ps.length ? <ul className="rows">{ps.map((p) => row('person', p.id, `${p.f} ${p.l}`, p.at))}</ul> : <Empty>None archived.</Empty>}</Section>
      <Section title="Companies" kind="grey" hint={`${cs.length}`}>{cs.length ? <ul className="rows">{cs.map((c) => row('company', c.id, c.name, c.at))}</ul> : <Empty>None archived.</Empty>}</Section>
    </div>
  );
}
