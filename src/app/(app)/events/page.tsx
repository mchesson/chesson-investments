import Link from 'next/link';
import { associationOptions, listEvents } from '@/lib/contacts';
import { SearchPicker } from '@/components/SearchPicker';
import { requirePage } from '@/lib/session';
import { formatDate, today } from '@/lib/format';
import { PageHead, Section, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { createEvent } from '../contacts-actions';

export const metadata = { title: 'Events' };

export default async function Events() {
  await requirePage('contacts.view');
  const [rows, assocs] = await Promise.all([listEvents(), associationOptions()]);
  return (
    <>
      <PageHead title="Events" sub="Meetups, REIA nights, open houses: who you met where." />
      <div className="stack">
        <Section title="Events" hint={`${rows.length}`}>
          {rows.length ? <ul className="rows">{rows.map((e) => (
            <li key={e.id}><Link href={`/events/${e.id}`}>{e.name}</Link> {e.associationName ? <> <Link className="chip blue" href={`/companies/${e.associationId}`}>{e.associationName}</Link></> : null} <span className="small muted">{formatDate(e.happenedOn)}{e.location ? ` · ${e.location}` : ''} · {e.count} met</span></li>
          ))}</ul> : <Empty>No events yet.</Empty>}
        </Section>
        <Section title="Add an Event" kind="energy">
          <ActionForm action={createEvent} submit="Add Event">
            <div className="fields">
              <label className="f">Name<input name="name" required placeholder="Triangle REIA October meetup" /></label>
              <label className="f">Date<input type="date" name="happenedOn" defaultValue={today()} required /></label>
              <label className="f">Where<input name="location" /></label>
              <SearchPicker name="associationId" label="Association" hint="Optional: who held it" placeholder="Type the association’s name" options={assocs.map((a) => ({ id: a.id, label: a.name }))} />
            </div>
            {!assocs.length ? <p className="small muted">No associations yet: add the group under Companies with the type Association, then it shows here.</p> : null}
            <label className="f">Notes<textarea name="notes" /></label>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
