import { ActionButton } from '@/components/ActionButton';
import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Empty, Section } from './ui';
import { saveAssignment, saveBudgetVersion, saveMilestone, setAssignmentDone } from '@/app/(app)/schedule-actions';
import { compareVersions, doneLate, latestByKind, ownerSavings, responsibleKinds, responsibleLabel, versionKinds, versionLabel } from '@/lib/schedule';
import type { scheduleFor } from '@/lib/schedule-data';
import { formatCents, formatDate, formatMoney, today } from '@/lib/format';
import { Choice } from './Choice';

type Sched = Awaited<ReturnType<typeof scheduleFor>>;
const m = (c: number | null) => (c === null ? '—' : formatCents(c));
const stateChip: Record<string, [string, string]> = {
  missed: ['red', 'Missed'], due_soon: ['energy', 'Due soon'], upcoming: ['', 'Upcoming'], done: ['aqua', 'Done'], no_date: ['', 'No date'],
};

export function BudgetStages({ projectId, codes, current, sched, canEdit, canApprove }: {
  projectId: string; codes: { id: string; code: string; name: string }[]; current: Map<string, number>; sched: Sched; canEdit: boolean; canApprove: boolean;
}) {
  const latest = latestByKind(sched.versions);
  const rows = compareVersions(codes, latest, current);
  const tot = (k: 'rough' | 'design' | 'approved') => (latest[k] ? latest[k]!.totalCents : null);
  const shown = rows.filter((r) => r.current || r.rough || r.design || r.approved);
  return (
    <Section title="Budget Stages" kind="blue" hint="Rough estimate before design → post-design budget with real numbers → approved budget (the baseline)">
      <div className="tiles">
        {versionKinds.map((k) => (
          <div className="tile" key={k.key}><div className="k">{k.label}</div><div className="v">{m(tot(k.key))}</div>
            <div className="s">{latest[k.key] ? `${formatDate(latest[k.key]!.created.toISOString())}${latest[k.key]!.preparedBy ? ` · ${latest[k.key]!.preparedBy}` : ''}` : k.hint}</div></div>
        ))}
      </div>
      {sched.versions.length ? (
        <details className="fold"><summary>Line by Line</summary>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Cost Code</th><th className="num">Rough</th><th className="num">Post-Design</th><th className="num">Approved</th><th className="num">Now</th><th className="num">vs Approved</th></tr></thead>
            <tbody>{shown.map((r) => {
              const c = codes.find((x) => x.id === r.costCodeId)!;
              return (
                <tr key={r.costCodeId} className={r.vsApproved !== null && r.vsApproved > 0 ? 'over' : undefined}>
                  <td>{c.code} {c.name}</td><td className="num">{m(r.rough)}</td><td className="num">{m(r.design)}</td><td className="num">{m(r.approved)}</td><td className="num">{m(r.current)}</td>
                  <td className="num">{r.vsApproved === null ? '—' : r.vsApproved > 0 ? <span className="red">+{formatCents(r.vsApproved)}</span> : r.vsApproved < 0 ? `−${formatCents(-r.vsApproved)}` : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </details>
      ) : null}
      {canEdit ? (
        <ActionForm action={saveBudgetVersion} submit="Save Today's Budget as This Stage" className="inline-form">
          <input type="hidden" name="projectId" value={projectId} />
          <select name="kind" defaultValue={latest.rough ? 'design' : 'rough'} aria-label="Stage">
            {versionKinds.filter((k) => k.key !== 'approved' || canApprove).map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <input name="preparedBy" placeholder="From (GC, engineer…)" aria-label="Prepared by" />
          <input name="label" placeholder="Note (optional)" aria-label="Note" />
        </ActionForm>
      ) : null}
      {!canApprove ? <p className="small muted">Only the owner approves the budget.</p> : null}
    </Section>
  );
}

export function ScheduleTab({ projectId, sched, codes, companies, people, canEdit }: {
  projectId: string; sched: Sched; codes: { id: string; code: string; name: string }[]; companies: { id: string; name: string }[]; people: { id: string; name: string }[]; canEdit: boolean;
}) {
  const sav = ownerSavings(sched.assignments);
  const missed = sched.assignments.filter((a) => a.state === 'missed');
  return (
    <div className="stack">
      {missed.length ? <div className="notice error"><strong>{missed.length} missed {missed.length === 1 ? 'commitment' : 'commitments'}:</strong> {missed.map((a) => `${a.description} (${a.who ?? responsibleLabel(a.responsible)}, due ${formatDate(a.due)})`).join('; ')}.</div> : null}
      <Section title="Commitments" kind="energy" hint="Who supplies or does what, by when: the GC, us, or a vendor. Due dates tied to a milestone move with the GC's schedule.">
        {sched.assignments.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>What</th><th>Who</th><th>Due</th><th className="num">GC Allowance</th><th className="num">Our Cost</th><th></th></tr></thead>
            <tbody>{sched.assignments.map((a) => {
              const [cls, label] = stateChip[a.state];
              return (
                <tr key={a.id} className={a.state === 'missed' ? 'over' : undefined}>
                  <td>{a.description}{a.costCodeId ? <div className="small muted">{codes.find((c) => c.id === a.costCodeId)?.name}</div> : null}{a.notes ? <div className="small">{a.notes}</div> : null}</td>
                  <td>{responsibleLabel(a.responsible)}{a.who ? <div className="small">{a.who}</div> : null}</td>
                  <td>{a.due ? formatDate(a.due) : '—'}{a.milestoneName ? <div className="small muted">{a.offsetDays ? `${Math.abs(a.offsetDays)} days ${a.offsetDays < 0 ? 'before' : 'after'} ` : 'at '}{a.milestoneName}</div> : null}
                    <div><span className={`chip ${cls}`}>{label}</span>{doneLate(a, a.due) ? <span className="chip red">Late</span> : null}</div></td>
                  <td className="num">{formatMoney(a.gcAllowance)}</td><td className="num">{formatMoney(a.ourCost)}</td>
                  <td>{canEdit ? <ActionButton action={setAssignmentDone.bind(null, a.id, a.status !== 'done')} className="btn small secondary" label={a.status === 'done' ? 'Reopen' : 'Done'} done={a.status === 'done' ? 'Reopened.' : 'Marked done.'} /> : null}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <Empty>No commitments yet. Example: kitchen appliance package, us, 5 days before trim-out, GC allowance $47,000, our cost $30,000.</Empty>}
        {sav.allowance ? <p className="small" style={{ marginBottom: 0 }}><strong>Owner-supplied savings: {formatCents(sav.savings)}</strong> ({formatCents(sav.allowance)} of GC allowances, {formatCents(sav.cost)} our cost). Make sure the GC credits the full allowance.</p> : null}
      </Section>
      {canEdit ? (
        <Section title="Add a Commitment" kind="energy">
          <ActionForm action={saveAssignment} submit="Add" resetOnOk>
            <input type="hidden" name="projectId" value={projectId} />
            <div className="fields">
              <label className="f">What<input name="description" required placeholder="Kitchen appliance package" /></label>
              <Choice name="responsible" label="Who Is Responsible" options={responsibleKinds} defaultValue="gc" />
              <label className="f">Vendor (Company)<select name="companyId" defaultValue=""><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="f">Or Person<select name="personId" defaultValue=""><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label className="f">Cost Code<select name="costCodeId" defaultValue=""><option value="">—</option>{codes.map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}</select></label>
              <label className="f">Milestone<select name="milestoneId" defaultValue=""><option value="">— (use a date)</option>{sched.milestones.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="f">Days Before (−) or After<input name="offsetDays" inputMode="numeric" placeholder="-5" /></label>
              <label className="f">Or Due On<input type="date" name="dueOn" /></label>
              <label className="f">GC Allowance<input name="gcAllowance" inputMode="decimal" placeholder="47,000" /></label>
              <label className="f">Our Cost<input name="ourCost" inputMode="decimal" placeholder="30,000" /></label>
            </div>
            <label className="f">Notes<input name="notes" placeholder="Same trim level, new with warranty" /></label>
          </ActionForm>
        </Section>
      ) : null}
      <Section title="GC Schedule" kind="blue" hint="Milestones from the GC's schedule; change a date and the commitments tied to it move">
        {sched.milestones.length ? (
          <ul className="rows">{sched.milestones.map((x) => (
            <li key={x.id}>
              <strong>{x.name}</strong> <span className="small muted">planned {x.plannedStart ? formatDate(x.plannedStart) : '?'} – {x.plannedEnd ? formatDate(x.plannedEnd) : '?'}{x.actualStart ? ` · started ${formatDate(x.actualStart)}` : ''}{x.actualEnd ? ` · done ${formatDate(x.actualEnd)}` : ''}{x.source ? ` · ${x.source}` : ''}</span>
              {x.plannedEnd && !x.actualEnd && x.plannedEnd < today() ? <span className="chip red">Behind</span> : null}
              {canEdit ? (
                <details className="fold"><summary>Change</summary>
                  <ActionForm action={saveMilestone} submit="Save" className="inline-form">
                    <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="id" value={x.id} /><input type="hidden" name="name" value={x.name} /><input type="hidden" name="sort" value={x.sort} /><input type="hidden" name="source" value={x.source ?? ''} />
                    <label className="small">Planned <input type="date" name="plannedStart" defaultValue={x.plannedStart ?? ''} /></label>
                    <label className="small">to <input type="date" name="plannedEnd" defaultValue={x.plannedEnd ?? ''} /></label>
                    <label className="small">Started <input type="date" name="actualStart" defaultValue={x.actualStart ?? ''} /></label>
                    <label className="small">Done <input type="date" name="actualEnd" defaultValue={x.actualEnd ?? ''} /></label>
                  </ActionForm>
                </details>
              ) : null}
            </li>
          ))}</ul>
        ) : <Empty>No schedule yet. Add the GC's milestones: start, foundation, framing, rough-ins, drywall, trim-out, completion.</Empty>}
        {canEdit ? (
          <details className="fold" style={{ marginTop: 8 }}><summary>Add a Milestone</summary>
            <ActionForm action={saveMilestone} submit="Add" resetOnOk>
              <input type="hidden" name="projectId" value={projectId} />
              <div className="fields">
                <label className="f">Name<input name="name" required placeholder="Trim-Out" /></label>
                <label className="f">Planned Start<input type="date" name="plannedStart" /></label>
                <label className="f">Planned End<input type="date" name="plannedEnd" /></label>
                <label className="f">Order<input name="sort" inputMode="numeric" defaultValue={sched.milestones.length + 1} /></label>
                <label className="f">From<input name="source" placeholder="GC schedule 9/8/26" /></label>
              </div>
            </ActionForm>
          </details>
        ) : null}
      </Section>
      <p className="small muted"><Link href={`/projects/${projectId}?tab=history`}>Every change is in History.</Link></p>
    </div>
  );
}

export { versionLabel };
