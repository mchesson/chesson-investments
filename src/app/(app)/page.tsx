import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { goingCold, myOpenTasks } from '@/lib/contacts';
import { listProjects } from '@/lib/projects';
import { listProperties } from '@/lib/watch';
import { formatMoney, today } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { projectStageLabel } from '@/lib/project-stages';
import { propertyStageLabel } from '@/lib/properties';
import { PageHead, Section, Tile, Empty } from '@/components/ui';
import { DueLabel } from '@/components/contacts';
import { setTaskDone } from './contacts-actions';
import { missedEverywhere } from '@/lib/schedule-data';
import { responsibleLabel } from '@/lib/schedule';
import { formatDate } from '@/lib/format';

export default async function Home() {
  const user = await requirePage();
  const contacts = can(user.role, 'contacts.view');
  const [tasks, cold, projects, watch] = await Promise.all([
    contacts ? myOpenTasks(user.id) : [],
    contacts ? goingCold() : [],
    listProjects(),
    can(user.role, 'properties.view') ? listProperties({ view: 'active' }) : null,
  ]);
  const due = tasks.filter((t) => t.dueOn <= today());
  const missed = can(user.role, 'projects.view') ? await missedEverywhere() : [];
  return (
    <>
      <PageHead title={`Hello${user.name ? `, ${user.name.split(' ')[0]}` : ''}`} sub="Chesson Investments" />
      {missed.length ? <div className="notice error"><strong>Missed commitments:</strong> {missed.map((x, i) => <span key={i}>{i ? '; ' : ''}<Link href={`/projects/${x.projectId}?tab=schedule`}>{x.projectName}</Link>: {x.description} ({x.who ?? responsibleLabel(x.responsible)}, due {formatDate(x.due)})</span>)}</div> : null}
      <div className="tiles">
        {contacts ? <Tile k="Tasks Due" v={due.length} s={<Link href="/tasks">My Tasks</Link>} color={due.length ? 'var(--energy)' : undefined} /> : null}
        {contacts ? <Tile k="Going Cold" v={cold.length} s={<Link href="/going-cold">Reach out</Link>} /> : null}
        {watch ? <Tile k="Watching" v={watch.total} s={<Link href="/watchlist">Watchlist</Link>} color="var(--aqua)" /> : null}
        <Tile k="Projects" v={projects.length} s={<Link href="/projects">All projects</Link>} />
      </div>
      <div className="grid-2">
        <div className="stack">
          {contacts ? (
            <Section title="Due Today" kind="energy" actions={<Link className="small" href="/tasks">All tasks</Link>}>
              {due.length ? <ul className="rows">{due.slice(0, 8).map((t) => (
                <li key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <form action={setTaskDone.bind(null, t.id, true)}><button className="btn secondary small" type="submit">Done</button></form>
                  <span style={{ flex: 1 }}>{t.title}{t.personName ? <> · <Link href={`/people/${t.personId}`}>{t.personName}</Link></> : null}</span>
                  <DueLabel dueOn={t.dueOn} />
                </li>
              ))}</ul> : <Empty>Nothing due. </Empty>}
            </Section>
          ) : null}
          {contacts ? (
            <Section title="Going Cold" kind="energy" actions={<Link className="small" href="/going-cold">See all</Link>}>
              {cold.length ? <ul className="rows">{cold.slice(0, 6).map((c, i) => (
                <li key={i}><Link href={`/people/${c.personId}`}>{c.firstName} {c.lastName}</Link> <span className="small muted">{roleLabel(c.role)} · last touch {c.lastTouch ?? 'never'}</span></li>
              ))}</ul> : <Empty>Everyone's warm.</Empty>}
            </Section>
          ) : null}
        </div>
        <div className="stack">
          <Section title="Projects" kind="aqua">
            {projects.length ? <ul className="rows">{projects.map((p) => (
              <li key={p.id}><Link href={`/projects/${p.id}`}>{p.name}</Link> <span className="chip blue">{projectStageLabel(p.stage)}</span></li>
            ))}</ul> : <Empty>No projects yet.</Empty>}
          </Section>
          {watch ? (
            <Section title="Watchlist" kind="aqua" actions={<Link className="small" href="/watchlist/new">Add a property</Link>}>
              {watch.rows.length ? <ul className="rows">{watch.rows.slice(0, 6).map((w) => (
                <li key={w.id}><Link href={`/watchlist/${w.id}`}>{w.address}</Link> <span className="small muted">{propertyStageLabel(w.stage)} · {formatMoney(w.askingPrice)}</span></li>
              ))}</ul> : <Empty>Nothing on the watchlist.</Empty>}
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}
