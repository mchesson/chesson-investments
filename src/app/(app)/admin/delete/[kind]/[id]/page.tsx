import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { companies, people } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { isUuid } from '@/lib/forms';
import { deletePlan } from '@/lib/delete';
import { deleteRecord } from '../../../../delete-actions';
import { ActionForm } from '@/components/ActionForm';
import { PageHead, Section } from '@/components/ui';

export const metadata = { title: 'Delete Permanently' };

export default async function DeletePage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  await requirePage('users.manage');
  const { kind, id } = await params;
  if ((kind !== 'person' && kind !== 'company') || !isUuid(id)) notFound();
  const [rec] = kind === 'person'
    ? await db.select({ name: people.firstName, last: people.lastName }).from(people).where(eq(people.id, id))
    : await db.select({ name: companies.name, last: companies.name }).from(companies).where(eq(companies.id, id));
  if (!rec) notFound();
  const name = kind === 'person' ? `${rec.name} ${rec.last}`.trim() : rec.name;
  const plan = await deletePlan(kind, id);
  const back = kind === 'person' ? `/people/${id}` : `/companies/${id}`;
  const list = (does: string) => plan.rows.filter((r) => r.does === does && r.count > 0);
  return (
    <div className="stack">
      <PageHead eyebrow="Delete Permanently" title={name} sub="This can’t be undone. History keeps a copy of what was removed." actions={<Link className="btn secondary" href={back}>Cancel</Link>} />
      {plan.blocked.length ? (
        <Section title="Can’t Be Deleted" kind="grey">
          <div className="notice error">It has {plan.blocked.map((b) => `${b.count} ${b.label}`).join(' and ')}. Money history stays whole, so archive it instead.</div>
        </Section>
      ) : (
        <>
          <Section title="What Happens" kind="grey">
            {list('delete').length ? <><p><strong>Removed with it:</strong></p><ul>{list('delete').map((r) => <li key={r.table + r.column}>{r.count} {r.label}</li>)}</ul></> : <p>Nothing else is removed with it.</p>}
            {list('clear').length ? <><p><strong>Links cleared on other records:</strong></p><ul>{list('clear').map((r) => <li key={r.table + r.column}>{r.count} {r.label}</li>)}</ul></> : null}
          </Section>
          <Section title="Confirm" kind="grey">
            <ActionForm action={deleteRecord} submit="Delete Permanently" submitClass="btn danger">
              <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
              <label className="f">Type the name to confirm: <strong>{name}</strong><input name="confirm" autoComplete="off" required /></label>
            </ActionForm>
          </Section>
        </>
      )}
    </div>
  );
}
