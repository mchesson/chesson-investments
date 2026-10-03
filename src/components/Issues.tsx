// Issues with a contractor or vendor (owner, Oct 2, 2026): a tab per status, how
// long each took to fix, and who was involved.
import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Choice } from './Choice';
import { SearchPicker, type PickOption } from './SearchPicker';
import { Empty, Section, Tile } from './ui';
import { saveIssue, setIssueStatus } from '@/app/(app)/grade-actions';
import { daysToFix, involvedRoles, isClosed, isOverdue, issueStatusLabel, issueStatuses, issueSummary, severities } from '@/lib/issues';
import { formatDate, formatMoney, today } from '@/lib/format';
import type { IssueRow } from '@/lib/grade-data';

type Opt = { id: string; name: string; sub?: string | null };
type WhoProps = { personId?: string; companyId?: string };

function Target({ personId, companyId }: WhoProps) {
  return personId ? <input type="hidden" name="personId" value={personId} /> : <input type="hidden" name="companyId" value={companyId} />;
}

/** Who was involved: tick their people and ours; one more from everyone on file. */
function Involved({ theirs, staff, everyone, picked }: { theirs: Opt[]; staff: Opt[]; everyone: Opt[]; picked?: IssueRow['involved'] }) {
  const has = (id: string) => !!picked?.some((p) => p.personId === id || p.userId === id);
  const others = (picked ?? []).filter((p) => p.personId && !theirs.some((t) => t.id === p.personId));
  return (
    <fieldset className="f choice">
      <legend>Who Was Involved<span className="h">Their people and ours</span></legend>
      {theirs.length ? <div className="role-pick">{theirs.map((p) => (
        <label key={p.id} className="role-btn"><input type="checkbox" name="involvedPeople" value={p.id} defaultChecked={has(p.id)} /><span>{p.name}</span></label>
      ))}</div> : null}
      <div className="role-pick">{staff.map((u) => (
        <label key={u.id} className="role-btn"><input type="checkbox" name="involvedStaff" value={u.id} defaultChecked={has(u.id)} /><span>{u.name} (us)</span></label>
      ))}</div>
      {others.map((p) => <input key={p.personId} type="hidden" name="involvedPeople" value={p.personId!} />)}
      <SearchPicker name="involvedPeople" label="Someone Else on File" hint="Optional" placeholder="Type their name or company" options={everyone.map((p) => ({ id: p.id, label: p.name, sub: p.sub }))} />
    </fieldset>
  );
}

export function IssueForm({ who, vendors, projects, theirs, staff, everyone, issue, projectId }: {
  /** The vendor, when the form is on their page; else `vendors` to pick from by typing. */
  who?: WhoProps; vendors?: PickOption[]; projects: Opt[]; theirs: Opt[]; staff: Opt[]; everyone: Opt[]; issue?: IssueRow; projectId?: string;
}) {
  return (
    <ActionForm action={saveIssue} submit={issue ? 'Save Changes' : 'Open the Issue'}>
      {who ? <Target {...who} /> : <SearchPicker name="vendor" label="Vendor" required placeholder="Type the company or person" hint="Who the issue is with" options={vendors ?? []} />}
      {issue ? <input type="hidden" name="id" value={issue.id} /> : null}
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      <label className="f">What’s Wrong<input name="title" required defaultValue={issue?.title} placeholder="Shower pan leaking into the subfloor" /></label>
      <Choice name="severity" label="How Serious" options={severities} defaultValue={issue?.severity ?? 'medium'} color="energy" />
      <div className="fields">
        {projectId ? null : <label className="f">Job<select name="projectId" defaultValue={issue?.projectId ?? ''}><option value="">Not on a job</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <label className="f">Reported On<input type="date" name="reportedOn" defaultValue={issue?.reportedOn ?? today()} required /></label>
        <label className="f">Fix By<span className="h">Optional</span><input type="date" name="dueOn" defaultValue={issue?.dueOn ?? ''} /></label>
        <label className="f">Cost to Fix<span className="h">Optional</span><input name="costToFix" inputMode="decimal" defaultValue={issue?.costToFix ?? ''} /></label>
      </div>
      <label className="f">Details<textarea name="details" rows={3} defaultValue={issue?.details ?? ''} /></label>
      <Involved theirs={theirs} staff={staff} everyone={everyone} picked={issue?.involved} />
    </ActionForm>
  );
}

function IssueCard({ i, canEdit, showVendor, form }: { i: IssueRow; canEdit: boolean; showVendor: boolean; form: React.ReactNode }) {
  const t = today();
  const d = daysToFix(i, t);
  const late = isOverdue(i, t);
  const vendorHref = i.companyId ? `/companies/${i.companyId}?tab=issues` : `/people/${i.personId}?tab=issues`;
  return (
    <li className="issue-card" data-status={i.status} data-sev={i.severity}>
      <div className="issue-head">
        <span className="issue-no">#{i.number}</span>
        <strong className="issue-title">{i.title}</strong>
        <span className={`chip sev-${i.severity}`}>{severities.find((s) => s.key === i.severity)?.label}</span>
        <span className="chip status">{issueStatusLabel(i.status)}</span>
        {late ? <span className="chip red-chip">Overdue</span> : null}
      </div>
      <div className="issue-facts small">
        {showVendor ? <span><Link href={vendorHref}>{i.vendorName}</Link></span> : null}
        {i.projectId ? <span><Link href={`/projects/${i.projectId}?tab=vendors`}>{i.projectName}</Link></span> : null}
        <span>Reported {formatDate(i.reportedOn)}{i.reportedBy ? ` by ${i.reportedBy}` : ''}</span>
        {i.dueOn ? <span>Fix by {formatDate(i.dueOn)}</span> : null}
        <span className="issue-time"><b>{d.days} {d.days === 1 ? 'day' : 'days'}</b> {d.closed ? 'to fix' : 'open so far'}</span>
        {i.resolvedOn ? <span>{i.status === 'resolved' ? 'Fixed' : 'Closed'} {formatDate(i.resolvedOn)}</span> : null}
        {i.costToFix ? <span>Cost to fix {formatMoney(i.costToFix)}</span> : null}
      </div>
      {i.details ? <p className="issue-details">{i.details}</p> : null}
      {i.involved.length ? (
        <div className="issue-who small"><span className="muted">Involved:</span> {i.involved.map((p, k) => (
          <span key={k} className="chip">{p.personId ? <Link href={`/people/${p.personId}`}>{p.personName}</Link> : `${p.userName} (us)`}{p.role && p.role !== 'involved' ? ` · ${involvedRoles.find((r) => r.key === p.role)?.label ?? p.role}` : ''}</span>
        ))}</div>
      ) : null}
      {i.vendorNote ? <p className="issue-details vendor-note"><span className="small muted">Their update ({i.vendorNoteAt ? formatDate(i.vendorNoteAt.toISOString()) : ''}):</span> {i.vendorNote}</p> : null}
      {i.resolution ? <p className="issue-details"><span className="small muted">How it ended:</span> {i.resolution}</p> : null}
      {canEdit ? (
        <div className="issue-actions">
          <details className="fold"><summary>Move It</summary>
            <ActionForm action={setIssueStatus} submit="Move">
              <input type="hidden" name="id" value={i.id} />
              <Choice name="status" label="Status" options={issueStatuses} defaultValue={i.status} />
              <div className="fields">
                <label className="f">Fixed / Closed On<span className="h">When it’s Fixed or Closed (today if empty)</span><input type="date" name="resolvedOn" defaultValue={i.resolvedOn ?? ''} /></label>
              </div>
              <label className="f">How It Was Fixed<span className="h">Needed when it’s Fixed or Closed</span><textarea name="resolution" rows={2} defaultValue={i.resolution ?? ''} /></label>
            </ActionForm>
          </details>
          <details className="fold"><summary>Edit</summary>{form}</details>
        </div>
      ) : null}
    </li>
  );
}

/** The Issues tab: a tab per status with counts, the time-to-fix summary, and the list. */
export function IssuesTab({ issues, status, href, canEdit, showVendor = false, form, editForm }: {
  issues: IssueRow[]; status: string | null; href: (status: string | null) => string; canEdit: boolean; showVendor?: boolean;
  form: React.ReactNode | null; editForm: (i: IssueRow) => React.ReactNode;
}) {
  const s = issueSummary(issues, today());
  const tabs = [{ key: 'active', label: 'All Open', count: s.open }, ...issueStatuses.map((x) => ({ key: x.key, label: x.label, count: s.counts[x.key] })), { key: 'all', label: 'Everything', count: issues.length }];
  const cur = status && tabs.some((t) => t.key === status) ? status : 'active';
  const shown = issues.filter((i) => (cur === 'all' ? true : cur === 'active' ? !isClosed(i.status) : i.status === cur));
  return (
    <div className="stack">
      <div className="tiles">
        <Tile k="Open" v={s.open} color="var(--energy)" />
        <Tile k="Overdue" v={<span className={s.overdue ? 'red' : undefined}>{s.overdue}</span>} color="var(--red)" />
        <Tile k="Fixed" v={s.counts.resolved} color="var(--aqua)" />
        <Tile k="Average Days to Fix" v={s.avgDaysToFix ?? '—'} s="From reported to fixed" color="var(--true-blue)" />
      </div>
      <nav className="status-tabs" aria-label="Issues by status">
        {tabs.map((t) => <Link key={t.key} href={href(t.key === 'active' ? null : t.key)} className="status-tab" data-k={t.key} aria-current={cur === t.key ? 'page' : undefined}>{t.label} <span className="count">{t.count}</span></Link>)}
      </nav>
      <Section title={tabs.find((t) => t.key === cur)!.label} kind="energy" hint={`${shown.length}`}>
        {shown.length ? <ul className="issue-list">{shown.map((i) => <IssueCard key={i.id} i={i} canEdit={canEdit} showVendor={showVendor} form={editForm(i)} />)}</ul> : <Empty>Nothing here.</Empty>}
      </Section>
      {form ? <Section title="Open an Issue" kind="grey">{form}</Section> : null}
    </div>
  );
}
