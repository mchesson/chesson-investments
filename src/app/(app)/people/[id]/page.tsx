import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { gcOptions, activeStaff, dealsFrom, getPerson, historyFor, tasksForRecord, touchesFor, vendorBills, workHistory } from '@/lib/contacts';
import { VendorSpend } from '@/components/VendorSpend';
import { DoNotUseBanner, DoNotUseSection } from '@/components/DoNotUse';
import { RecordManage } from '@/components/RecordManage';
import { isUuid } from '@/lib/forms';
import { formatDate, formatMoney, today } from '@/lib/format';
import { daysSince } from '@/lib/roles';
import { dealCredit, propertyStageLabel } from '@/lib/properties';
import { Facts, PageHead, Section, Tabs, Empty } from '@/components/ui';
import { Phone } from '@/components/Phone';
import { HistoryList, RoleChips, RolesPanel, TaskForm, TaskRows, TouchForm, TouchList } from '@/components/contacts';
import { archivePerson } from '../../contacts-actions';
import { howMetLabel } from '@/lib/how-met';
import { VendorGrades, VendorIssues } from '@/components/VendorRecordTabs';
import { GradeBadge } from '@/components/Grades';
import { gradesFor, issuesFor } from '@/lib/grade-data';
import { isClosed } from '@/lib/issues';
import { isVendorRole } from '@/lib/roles';

type Intro = { id: string; firstName: string; lastName: string; introNote: string | null; created: Date; companyName: string | null };

function IntroRows({ introduced }: { introduced: Intro[] }) {
  return (
    <ul className="rows">{introduced.map((o) => (
      <li key={o.id}>
        <Link href={`/people/${o.id}`}>{o.firstName} {o.lastName}</Link>{o.companyName ? <span className="muted">, {o.companyName}</span> : null}
        <span className="small muted"> · {formatDate(o.created.toISOString())}</span>
        {o.introNote ? <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{o.introNote}</div> : null}
      </li>
    ))}</ul>
  );
}

function Intros({ introduced, edit, id }: { introduced: Intro[]; edit: boolean; id: string }) {
  return (
    <Section title="They Introduced Us To" kind="aqua" hint={`${introduced.length}`}
      actions={edit ? <Link className="btn small" href={`/people/new?introducedBy=${id}`}>Add Someone They Introduced</Link> : null}>
      {introduced.length ? <IntroRows introduced={introduced} /> : <Empty>No introductions from them yet.</Empty>}
    </Section>
  );
}

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; status?: string }> }) {
  const user = await requirePage('contacts.view');
  const { id } = await params;
  const { tab = 'overview', status } = await searchParams;
  const data = isUuid(id) ? await getPerson(id) : null;
  if (!data || data.person.archived) notFound();
  const { person: p, company, introducedBy, roles, lastTouch, introduced, metAt } = data;
  const edit = can(user.role, 'contacts.edit');
  const base = `/people/${id}`;
  const since = daysSince(lastTouch, today());
  const [gs, iss] = await Promise.all([gradesFor({ personId: id }), issuesFor({ personId: id })]);
  // Grades and Issues for contractors and vendors (and anyone already graded or with an issue).
  const vendor = roles.some((r) => isVendorRole(r.role)) || gs.rows.length > 0 || iss.length > 0;
  const openIssues = iss.filter((i) => !isClosed(i.status)).length;

  return (
    <>
      <PageHead
        eyebrow="Person"
        title={`${p.firstName} ${p.lastName}`}
        sub={<span className="sub-row">{vendor ? <GradeBadge letter={gs.overall?.letter} size="sm" /> : null}<RoleChips items={roles} /></span>}
        actions={edit ? (<><Link className="btn" href={`${base}?tab=touches`}>Log a Touch</Link><Link className="btn secondary" href={`${base}/edit`}>Edit</Link></>) : null}
      />
      <DoNotUseBanner on={p.doNotUse} reason={p.doNotUseReason} at={p.doNotUseAt} />
      <div className="record">
        <div className="card-side">
          <Section title="Contact" kind="blue">
            <Facts items={[
              ['Phone', <Phone key="p" value={p.phone} />],
              ['Email', p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : null],
              ['Company', company ? <Link href={`/companies/${company.id}`}>{company.name}</Link> : null],
              ['Title', p.title],
              ['Lives', [p.city, p.state].filter(Boolean).join(', ')],
              ['Last Touch', lastTouch ? `${formatDate(lastTouch)} (${since === 0 ? 'today' : `${since} days ago`})` : 'Never'],
            ]} />
            {p.phone || p.email ? (
              <div className="form-actions" style={{ marginTop: 10 }}>
                {p.phone ? <a className="btn small secondary" href={`tel:${p.phone}`}>Call</a> : null}
                {p.phone ? <a className="btn small secondary" href={`sms:${p.phone}`}>Text</a> : null}
                {p.email ? <a className="btn small secondary" href={`mailto:${p.email}`}>Email</a> : null}
              </div>
            ) : null}
          </Section>
          <Section title="How We Know Them" kind="aqua">
            <Facts items={[
              ['How', howMetLabel(p.howMet)],
              ['Introduced By', introducedBy ? <Link href={`/people/${introducedBy.id}`}>{introducedBy.firstName} {introducedBy.lastName}</Link> : null],
              ['Met At', metAt ? <Link href={`/events/${metAt.id}`}>{metAt.name}</Link> : null],
              ['Since', formatDate(p.created.toISOString())],
            ]} />
            {p.introNote ? <p className="small" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{p.introNote}</p> : null}
            {introduced.length ? <p className="small" style={{ marginBottom: 0 }}><Link href={`${base}?tab=intros`}>They introduced us to {introduced.length} {introduced.length === 1 ? 'person' : 'people'}</Link></p> : null}
            {edit ? <p className="small" style={{ marginBottom: 0 }}><Link href={`/people/new?introducedBy=${id}`}>Add someone they introduced</Link></p> : null}
          </Section>
          <DoNotUseSection personId={id} on={p.doNotUse} reason={p.doNotUseReason} at={p.doNotUseAt} canEdit={edit} />
          <RecordManage kind="person" id={id} canArchive={edit} canDelete={can(user.role, 'users.manage')} />
        </div>
        <div>
          <Tabs base={base} current={tab} tabs={[
            { key: 'overview', label: 'Overview' }, { key: 'touches', label: 'Touches' }, { key: 'tasks', label: 'Tasks' },
            { key: 'work', label: 'Work History' }, { key: 'intros', label: 'Introductions', count: introduced.length }, { key: 'deals', label: 'Deals Sent' },
            ...(vendor ? [{ key: 'grades', label: gs.overall ? `Grades (${gs.overall.letter})` : 'Grades' }, { key: 'issues', label: 'Issues', count: openIssues }] : []),
            { key: 'history', label: 'History' },
          ]} />
          {tab === 'grades' ? <VendorGrades who={{ personId: id }} canEdit={edit} override={{ on: p.gradeOverride, reason: p.gradeOverrideReason }} /> : null}
          {tab === 'issues' ? <VendorIssues who={{ personId: id }} theirs={[{ id, name: `${p.firstName} ${p.lastName}` }]} base={base} status={status ?? null} canEdit={edit} /> : null}
          {tab === 'overview' && can(user.role, 'money.view') ? await (async () => { const vb = await vendorBills({ personId: id }); return vb.length ? <div style={{ marginBottom: 16 }}><VendorSpend bills={vb} /></div> : null; })() : null}
          {tab === 'overview' ? <Overview id={id} roles={roles} edit={edit} notes={p.notes} introduced={introduced} /> : null}
          {tab === 'touches' ? (
            <div className="stack">
              {edit ? <Section title="Log a Touch" kind="energy"><TouchForm personId={id} /></Section> : null}
              <Section title="Every Touch" kind="grey"><TouchList items={await touchesFor(id)} /></Section>
            </div>
          ) : null}
          {tab === 'tasks' ? (
            <div className="stack">
              <Section title="Tasks" kind="energy"><TaskRows items={await tasksForRecord('personId', id)} /></Section>
              {edit ? <Section title="Add a Task" kind="energy"><TaskForm personId={id} staff={await activeStaff()} me={user.id} /></Section> : null}
            </div>
          ) : null}
          {tab === 'work' ? <Work id={id} /> : null}
          {tab === 'intros' ? <Intros introduced={introduced} edit={edit} id={id} /> : null}
          {tab === 'deals' ? <Deals id={id} /> : null}
          {tab === 'history' ? (
            <>
              <Section title="History" kind="grey"><HistoryList rows={await historyFor('person', id)} /></Section>
              {edit ? (
                <form action={archivePerson.bind(null, id)}>
                  <button className="btn danger small" type="submit">Archive This Person</button>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

async function Overview({ id, roles, edit, notes, introduced }: {
  id: string; roles: Parameters<typeof RolesPanel>[0]['items']; edit: boolean; notes: string | null;
  introduced: Intro[];
}) {
  const [recent, open] = await Promise.all([touchesFor(id, 5), tasksForRecord('personId', id)]);
  return (
    <div className="stack">
      <Section title="Roles" kind="blue" hint="Each role has its own stage"><RolesPanel items={roles} personId={id} canEdit={edit} gcs={await gcOptions()} /></Section>
      <Section title="Recent Touches" kind="energy" actions={<Link href={`/people/${id}?tab=touches`} className="small">All touches</Link>}><TouchList items={recent} /></Section>
      <Section title="Open Tasks" kind="energy"><TaskRows items={open.filter((t) => t.status === 'open')} /></Section>
      {notes ? <Section title="Notes" kind="energy"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{notes}</p></Section> : null}
      {introduced.length ? (
        <Section title="They Introduced Us To" kind="aqua" hint={`${introduced.length}`}>
          <IntroRows introduced={introduced} />
        </Section>
      ) : null}
    </div>
  );
}

async function Work({ id }: { id: string }) {
  const rows = await workHistory(id);
  return (
    <Section title="Work History" kind="blue" hint="Follows the person from company to company">
      {rows.length ? (
        <ul className="rows">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/companies/${r.companyId}`}>{r.companyName}</Link>{r.title ? `, ${r.title}` : ''}
              <div className="small muted">{r.startedOn ? formatDate(r.startedOn) : '?'} – {r.endedOn ? formatDate(r.endedOn) : 'now'}</div>
            </li>
          ))}
        </ul>
      ) : <Empty>No companies yet.</Empty>}
    </Section>
  );
}

async function Deals({ id }: { id: string }) {
  const rows = await dealsFrom(id);
  const credit = dealCredit(rows.map((r) => ({ stage: r.stage, metBuyBox: r.metBuyBox, hasProject: !!r.projectId, referralFee: r.referralFee })));
  return (
    <div className="stack">
      <div className="tiles">
        <div className="tile"><div className="k">Deals Sent</div><div className="v">{credit.sent}</div></div>
        <div className="tile"><div className="k">Met Our Buy Box</div><div className="v">{credit.metBuyBox}</div></div>
        <div className="tile"><div className="k">Closed</div><div className="v">{credit.closed}</div></div>
        <div className="tile"><div className="k">Referral Fees</div><div className="v">{formatMoney(credit.referralFees)}</div></div>
      </div>
      <Section title="Properties They Sent Us" kind="aqua">
        {rows.length ? (
          <ul className="rows">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/watchlist/${r.id}`}>{r.address}{r.city ? `, ${r.city}` : ''}</Link> <span className="chip">{propertyStageLabel(r.stage)}</span>
                {r.projectId ? <> <Link className="chip aqua" href={`/projects/${r.projectId}`}>Project</Link></> : null}
                <div className="small muted">Asking {formatMoney(r.askingPrice)}{r.metBuyBox ? ' · met our buy box' : ''}{r.referralFee ? ` · referral fee ${formatMoney(r.referralFee)}` : ''}</div>
              </li>
            ))}
          </ul>
        ) : <Empty>No properties from them yet. Pick them as the source when adding to the watchlist.</Empty>}
      </Section>
    </div>
  );
}
