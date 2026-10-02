import Link from 'next/link';
import { listEvents } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { formatDate, today } from '@/lib/format';
import { PageHead, Section, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { createEvent } from '../contacts-actions';

export const metadata = { title: 'Events' };

export default async function Events() {
  await requirePage('contacts.view');
  const rows = await listEvents();
  return (
    <>
      <PageHead title="Events" sub="Meetups, REIA nights, open houses: who you met where." />
      <div className="stack">
        <Section title="Events" hint={`${rows.length}`}>
          {rows.length ? <ul className="rows">{rows.map((e) => (
            <li key={e.id}><Link href={`/events/${e.id}`}>{e.name}</Link> <span className="small muted">{formatDate(e.happenedOn)}{e.location ? ` · ${e.location}` : ''} · {e.count} met</span></li>
          ))}</ul> : <Empty>No events yet.</Empty>}
        </Section>
        <Section title="Add an Event" kind="energy">
          <ActionForm action={createEvent} submit="Add Event">
            <div className="fields">
              <label className="f">Name<input name="name" required placeholder="Triangle REIA October meetup" /></label>
              <label className="f">Date<input type="date" name="happenedOn" defaultValue={today()} required /></label>
              <label className="f">Where<input name="location" /></label>
            </div>
            <label className="f">Notes<textarea name="notes" /></label>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
