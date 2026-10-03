import Link from 'next/link';
import { notFound } from 'next/navigation';
import { associationOptions, getEvent, historyFor, peopleOptions } from '@/lib/contacts';
import { SearchPicker } from '@/components/SearchPicker';
import { requirePage } from '@/lib/session';
import { isUuid } from '@/lib/forms';
import { formatDate } from '@/lib/format';
import { Facts, PageHead, Section, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { HistoryList } from '@/components/contacts';
import { addPersonToEvent, setEventAssociation } from '../../contacts-actions';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('contacts.view');
  const { id } = await params;
  const data = isUuid(id) ? await getEvent(id) : null;
  if (!data) notFound();
  const { event: e, met, association } = data;
  const [people, assocs] = await Promise.all([peopleOptions(), associationOptions()]);
  return (
    <>
      <PageHead eyebrow="Event" title={e.name} sub={`${formatDate(e.happenedOn)}${e.location ? ` · ${e.location}` : ''}`} />
      <div className="stack">
        <Section title="About" kind="blue">
          <Facts items={[['Association', association ? <Link key="a" href={`/companies/${association.id}`}>{association.name}</Link> : 'None'], ...(e.notes ? [['Notes', e.notes] as [string, string]] : [])]} />
          <details className="fold"><summary>Change the Association</summary>
            <ActionForm action={setEventAssociation} submit="Save">
              <input type="hidden" name="eventId" value={id} />
              <SearchPicker name="associationId" label="Association" hint="Leave empty for none" options={assocs.map((a) => ({ id: a.id, label: a.name }))} defaultId={e.associationId} />
            </ActionForm>
          </details>
        </Section>
        <Section title="People We Met" kind="aqua" hint={`${met.length}`}>
          {met.length ? <ul className="rows">{met.map((m) => (
            <li key={m.id}><Link href={`/people/${m.personId}`}>{m.firstName} {m.lastName}</Link>{m.companyName ? <span className="muted">, {m.companyName}</span> : null}{m.note ? <div className="small">{m.note}</div> : null}</li>
          ))}</ul> : <Empty>No one yet.</Empty>}
          <details className="fold" style={{ marginTop: 10 }}>
            <summary>Add Someone You Met</summary>
            <ActionForm action={addPersonToEvent} submit="Add" resetOnOk>
              <input type="hidden" name="eventId" value={id} />
              <SearchPicker name="personId" label="Who" required placeholder="Type their name or company" options={people.map((p) => ({ id: p.id, label: p.name, sub: p.companyName }))} />
              <label className="f">How You Met and What You Talked About<input name="note" placeholder="Introduced by Sam at the bar; building in Five Points" /></label>
              <p className="small muted">Not on file yet? <Link href="/people/new">Add them</Link> first. Adding them here logs an event touch on their record.</p>
            </ActionForm>
          </details>
        </Section>
        <Section title="History" kind="grey"><HistoryList rows={await historyFor('event', id)} /></Section>
      </div>
    </>
  );
}
