import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { associationEvents, gcOptions, activeStaff, getCompany, historyFor, tasksForRecord, vendorBills } from '@/lib/contacts';
import { VendorSpend } from '@/components/VendorSpend';
import { VendorGrades, VendorIssues } from '@/components/VendorRecordTabs';
import { GradeBadge } from '@/components/Grades';
import { gradesFor, issuesFor } from '@/lib/grade-data';
import { isClosed } from '@/lib/issues';
import { bidsFromCompany } from '@/lib/bid-data';
import { formatCents } from '@/lib/format';
import { DoNotUseBanner, DoNotUseSection } from '@/components/DoNotUse';
import { RecordManage } from '@/components/RecordManage';
import { isUuid } from '@/lib/forms';
import { formatDate } from '@/lib/format';
import { Facts, PageHead, Section, Tabs, Empty } from '@/components/ui';
import { Phone } from '@/components/Phone';
import { HistoryList, RoleChips, RolesPanel, TaskForm, TaskRows } from '@/components/contacts';

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; status?: string; merged?: string }> }) {
  const user = await requirePage('contacts.view');
  const { id } = await params;
  const { tab = 'overview', status, merged } = await searchParams;
  const [gs, iss] = await Promise.all([gradesFor({ companyId: id }), issuesFor({ companyId: id })]);
  const openIssues = iss.filter((i) => !isClosed(i.status)).length;
  const data = isUuid(id) ? await getCompany(id) : null;
  if (!data || data.company.archived) notFound();
  const { company: c, roles, current, former, subs } = data;
  const edit = can(user, 'contacts.edit');
  const base = `/companies/${id}`;
  const seeMoney = can(user, 'money.view');
  // An association's events and who we met at each (owner, Oct 3, 2026).
  const evs = await associationEvents(id);
  const isAssociation = roles.some((r) => r.role === 'association') || evs.length > 0;
  return (
    <>
      <PageHead eyebrow="Company" title={c.name} sub={<span className="sub-row"><GradeBadge letter={gs.overall?.letter} size="sm" /><RoleChips items={roles} /></span>}
        actions={edit ? (<><Link className="btn" href={`/people/new?company=${id}`}>Add Person Here</Link><Link className="btn secondary" href={`${base}/edit`}>Edit</Link></>) : null} />
      {merged ? <div className="notice" role="status">Merged {merged} into this record: everything linked to it is here now, and it’s archived. History has the details.</div> : null}
      <DoNotUseBanner on={c.doNotUse} reason={c.doNotUseReason} at={c.doNotUseAt} />
      <div className="record">
        <div className="card-side">
          <Section title="Company" kind="blue">
            <Facts items={[
              ['Phone', <Phone key="p" value={c.phone} />],
              ['Email', c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null],
              ['Website', c.website ? <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} rel="noreferrer" target="_blank">{c.website}</a> : null],
              ['Where', [c.city, c.state].filter(Boolean).join(', ')],
            ]} />
          </Section>
          <DoNotUseSection companyId={id} on={c.doNotUse} reason={c.doNotUseReason} at={c.doNotUseAt} canEdit={edit} />
          <RecordManage kind="company" id={id} canArchive={edit} canDelete={can(user, 'records.delete')} />
        </div>
        <div>
          <Tabs base={base} current={tab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'people', label: 'People', count: current.length }, ...(isAssociation ? [{ key: 'events', label: 'Events', count: evs.length }] : []), { key: 'grades', label: gs.overall ? `Grades (${gs.overall.letter})` : 'Grades' }, { key: 'issues', label: 'Issues', count: openIssues }, { key: 'tasks', label: 'Tasks' }, { key: 'history', label: 'History' }]} />
          {tab === 'overview' ? (
            <div className="stack">
              {seeMoney ? <VendorSpend bills={await vendorBills({ companyId: id })} /> : null}
              {seeMoney ? await (async () => { const bs = await bidsFromCompany(id); return bs.length ? (
                <Section title="Bids They’ve Sent" kind="blue" hint={`${bs.length}`}>
                  <ul className="rows">{bs.map((b) => <li key={b.id}><Link href={`/projects/${b.projectId}?tab=budget`}>{b.projectName}</Link> · {formatCents(b.totalCents)}{b.submittedOn ? ` · ${formatDate(b.submittedOn)}` : ''} <span className="small muted">{b.status === 'selected' ? 'Won' : b.status === 'declined' ? 'Declined' : 'Open'}</span></li>)}</ul>
                </Section>) : null; })() : null}
              <Section title="What They Do" kind="blue" hint="The company’s type. Its people have their own roles."><RolesPanel items={roles} companyId={id} canEdit={edit} gcs={await gcOptions()} /></Section>
              {subs.length ? (
                <Section title="Subs and Suppliers Through Them" kind="aqua" hint="Their invoices come through this GC">
                  <ul className="rows">{subs.map((x, i) => (
                    <li key={i}><Link href={x.companyId ? `/companies/${x.companyId}` : `/people/${x.personId}`}>{x.name}</Link> <span className="small muted">{x.role === 'supplier' ? 'Supplier' : 'Subcontractor'}{x.trade ? ` · ${x.trade}` : ''}</span></li>
                  ))}</ul>
                </Section>
              ) : null}
              {c.notes ? <Section title="Notes" kind="energy"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{c.notes}</p></Section> : null}
            </div>
          ) : null}
          {tab === 'events' && isAssociation ? (
            <div className="stack">
              <Section title="Their Events and Who We Met" kind="aqua" hint={`${evs.length}`}>
                {evs.length ? <ul className="rows">{evs.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}`}><strong>{e.name}</strong></Link> <span className="small muted">{formatDate(e.happenedOn)}{e.location ? ` · ${e.location}` : ''} · {e.met.length} met</span>
                    {e.met.length ? <ul className="met-list">{e.met.map((m) => (
                      <li key={m.personId}><Link href={`/people/${m.personId}`}>{m.name}</Link>{m.companyName ? <span className="muted">, {m.companyName}</span> : null}{m.note ? <span className="small"> · {m.note}</span> : null}</li>
                    ))}</ul> : null}
                  </li>
                ))}</ul> : <Empty>No events logged for them yet.</Empty>}
                <p className="small" style={{ marginBottom: 0 }}><Link href="/events">Add an Event</Link> and pick {c.name} as the association.</p>
              </Section>
            </div>
          ) : null}
          {tab === 'people' ? (
            <div className="stack">
              <Section title="People Here Now" kind="blue">
                {current.length ? (
                  <ul className="rows">{current.map((p) => (
                    <li key={p.id}><Link href={`/people/${p.id}`}>{p.firstName} {p.lastName}</Link>{p.title ? `, ${p.title}` : ''} · <Phone value={p.phone} />
                      <div className="small muted">Last touch {p.lastTouch ? formatDate(p.lastTouch) : 'never'}</div></li>
                  ))}</ul>
                ) : <Empty>No one yet.</Empty>}
              </Section>
              {former.length ? (
                <Section title="Used to Work Here" kind="grey">
                  <ul className="rows">{former.map((p, i) => <li key={i}><Link href={`/people/${p.id}`}>{p.firstName} {p.lastName}</Link>{p.title ? `, ${p.title}` : ''} <span className="small muted">until {formatDate(p.endedOn)}</span></li>)}</ul>
                </Section>
              ) : null}
            </div>
          ) : null}
          {tab === 'tasks' ? (
            <div className="stack">
              <Section title="Tasks" kind="energy"><TaskRows items={await tasksForRecord('companyId', id)} /></Section>
              {edit ? <Section title="Add a Task" kind="energy"><TaskForm companyId={id} staff={await activeStaff()} me={user.id} /></Section> : null}
            </div>
          ) : null}
          {tab === 'grades' ? <VendorGrades who={{ companyId: id }} canEdit={edit} override={{ on: c.gradeOverride, reason: c.gradeOverrideReason }} /> : null}
          {tab === 'issues' ? <VendorIssues who={{ companyId: id }} theirs={current.map((x) => ({ id: x.id, name: `${x.firstName} ${x.lastName}` }))} base={base} status={status ?? null} canEdit={edit} /> : null}
          {tab === 'history' ? <Section title="History" kind="grey"><HistoryList rows={await historyFor('company', id)} /></Section> : null}
        </div>
      </div>
    </>
  );
}
