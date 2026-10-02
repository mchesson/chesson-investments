import Link from 'next/link';
import { listLists } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { PageHead, Section, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { createList } from '../contacts-actions';

export const metadata = { title: 'Lists' };

export default async function Lists() {
  await requirePage('contacts.view');
  const rows = await listLists();
  return (
    <>
      <PageHead title="Lists" sub="Saved lists for outreach: every agent in Raleigh, framers to call for bids." />
      <div className="stack">
        <Section title="Lists" hint={`${rows.length}`}>
          {rows.length ? <ul className="rows">{rows.map((l) => (
            <li key={l.id}><Link href={`/lists/${l.id}`}>{l.name}</Link> <span className="small muted">{l.count} people{l.purpose ? ` · ${l.purpose}` : ''}</span></li>
          ))}</ul> : <Empty>No lists yet.</Empty>}
        </Section>
        <Section title="New List" kind="energy">
          <ActionForm action={createList} submit="Make List">
            <div className="fields">
              <label className="f">Name<input name="name" required placeholder="Agents to send our buy box" /></label>
              <label className="f">What It's For<input name="purpose" /></label>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
