import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEvent, historyFor, peopleOptions } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { isUuid } from '@/lib/forms';
import { formatDate } from '@/lib/format';
import { Facts, PageHead, Section, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { HistoryList } from '@/components/contacts';
import { addPersonToEvent } from '../../contacts-actions';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('contacts.view');
  const { id } = await params;
  const data = isUuid(id) ? await getEvent(id) : null;
  if (!data) notFound();
  const { event: e, met } = data;
  const people = await peopleOptions();
  return (
    <>
      <PageHead eyebrow="Event" title={e.name} sub={`${formatDate(e.happenedOn)}${e.location ? ` · ${e.location}` : ''}`} />
      <div className="stack">
        {e.notes ? <Section title="About" kind="blue"><Facts items={[['Notes', e.notes]]} /></Section> : null}
        <Section title="People We Met" kind="aqua" hint={`${met.length}`}>
          {met.length ? <ul className="rows">{met.map((m) => (
            <li key={m.id}><Link href={`/people/${m.personId}`}>{m.firstName} {m.lastName}</Link>{m.companyName ? <span className="muted">, {m.companyName}</span> : null}{m.note ? <div className="small">{m.note}</div> : null}</li>
          ))}</ul> : <Empty>No one yet.</Empty>}
          <details className="fold" style={{ marginTop: 10 }}>
            <summary>Add Someone You Met</summary>
            <ActionForm action={addPersonToEvent} submit="Add" resetOnOk>
              <input type="hidden" name="eventId" value={id} />
              <label className="f">Who
                <select name="personId" required defaultValue="">
                  <option value="" disabled>Pick a person</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.companyName ? ` (${p.companyName})` : ''}</option>)}
                </select>
              </label>
              <label className="f">What You Talked About<input name="note" /></label>
              <p className="small muted">Not on file yet? <Link href="/people/new">Add them</Link> first. Adding them here logs an event touch on their record.</p>
            </ActionForm>
          </details>
        </Section>
        <Section title="History" kind="grey"><HistoryList rows={await historyFor('event', id)} /></Section>
      </div>
    </>
  );
}
