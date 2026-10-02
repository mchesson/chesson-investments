import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { gcOptions, activeStaff, getCompany, historyFor, tasksForRecord, vendorBills } from '@/lib/contacts';
import { VendorSpend } from '@/components/VendorSpend';
import { DoNotUseBanner, DoNotUseSection } from '@/components/DoNotUse';
import { isUuid } from '@/lib/forms';
import { formatDate } from '@/lib/format';
import { Facts, PageHead, Section, Tabs, Empty } from '@/components/ui';
import { Phone } from '@/components/Phone';
import { HistoryList, RoleChips, RolesPanel, TaskForm, TaskRows } from '@/components/contacts';

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePage('contacts.view');
  const { id } = await params;
  const { tab = 'overview' } = await searchParams;
  const data = isUuid(id) ? await getCompany(id) : null;
  if (!data || data.company.archived) notFound();
  const { company: c, roles, current, former, subs } = data;
  const edit = can(user.role, 'contacts.edit');
  const base = `/companies/${id}`;
  const seeMoney = can(user.role, 'money.view');
  return (
    <>
      <PageHead eyebrow="Company" title={c.name} sub={<RoleChips items={roles} />}
        actions={edit ? (<><Link className="btn" href={`/people/new?company=${id}`}>Add Person Here</Link><Link className="btn secondary" href={`${base}/edit`}>Edit</Link></>) : null} />
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
        </div>
        <div>
          <Tabs base={base} current={tab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'people', label: 'People', count: current.length }, { key: 'tasks', label: 'Tasks' }, { key: 'history', label: 'History' }]} />
          {tab === 'overview' ? (
            <div className="stack">
              {seeMoney ? <VendorSpend bills={await vendorBills({ companyId: id })} /> : null}
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
          {tab === 'history' ? <Section title="History" kind="grey"><HistoryList rows={await historyFor('company', id)} /></Section> : null}
        </div>
      </div>
    </>
  );
}
