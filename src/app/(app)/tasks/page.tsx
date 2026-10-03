import { ActionButton } from '@/components/ActionButton';
import Link from 'next/link';
import { activeStaff, myOpenTasks } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { today, addDays } from '@/lib/format';
import { PageHead, Section, Empty } from '@/components/ui';
import { DueLabel, TaskForm } from '@/components/contacts';
import { setTaskDone } from '../contacts-actions';

export const metadata = { title: 'My Tasks' };

export default async function Tasks() {
  const user = await requirePage('contacts.view');
  const rows = await myOpenTasks(user.id);
  const t = today();
  const week = addDays(t, 7);
  const groups = [
    { title: 'Overdue', items: rows.filter((r) => r.dueOn < t) },
    { title: 'Today', items: rows.filter((r) => r.dueOn === t) },
    { title: 'This Week', items: rows.filter((r) => r.dueOn > t && r.dueOn <= week) },
    { title: 'Later', items: rows.filter((r) => r.dueOn > week) },
  ];
  const link = (r: (typeof rows)[number]) =>
    r.personId ? `/people/${r.personId}` : r.companyId ? `/companies/${r.companyId}` : r.propertyId ? `/watchlist/${r.propertyId}` : r.projectId ? `/projects/${r.projectId}` : null;
  return (
    <>
      <PageHead title="My Tasks" />
      <div className="stack">
        {groups.map((g) => (
          <Section key={g.title} title={g.title} kind={g.title === 'Overdue' ? 'energy' : 'blue'} hint={`${g.items.length}`}>
            {g.items.length ? (
              <ul className="rows">{g.items.map((r) => (
                <li key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <ActionButton action={setTaskDone.bind(null, r.id, true)} className="btn secondary small" label="Done" done="Task marked done." />
                  <span style={{ flex: 1 }}>{r.title}{link(r) ? <> · <Link href={link(r)!}>{r.personName ?? r.recordName}</Link></> : null}</span>
                  <DueLabel dueOn={r.dueOn} />
                </li>
              ))}</ul>
            ) : <Empty>Nothing here.</Empty>}
          </Section>
        ))}
        <Section title="New Task" kind="energy"><TaskForm staff={await activeStaff()} me={user.id} /></Section>
      </div>
    </>
  );
}
