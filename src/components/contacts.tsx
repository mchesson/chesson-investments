import { ActionButton } from '@/components/ActionButton';
import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Empty } from './ui';
import { addRole, createTask, logTouch, removeRole, setTaskDone, updateRole } from '@/app/(app)/contacts-actions';
import { roles, roleDef, roleLabel, roleTag, stageLabel, supplierTypes, supplierTypeLabel } from '@/lib/roles';
import { formatDate, formatDateTime, today, addDays } from '@/lib/format';
import { daysSince } from '@/lib/roles';
import { Choice } from './Choice';
import { SearchPicker } from './SearchPicker';
import { AreaPicker } from './AreaPicker';
import { areaSummary, areasOf } from '@/lib/areas';

type RoleRow = { id: string; role: string; stage: string; supplierTypes?: string[] | null; trade: string | null; areas: string | null; cities?: string[] | null; zips?: string[] | null; neighborhoods?: string[] | null; licenseNumber: string | null; notes: string | null; stageChangedAt: Date; hiredThroughCompanyId?: string | null; hiredThroughName?: string | null };

export function RoleChips({ items, empty = 'No role yet' }: { items: { role: string; stage: string; supplierTypes?: string[] | null; trade?: string | null }[]; empty?: string }) {
  if (!items.length) return <span className="muted small">{empty}</span>;
  return (
    <span className="chips">
      {items.map((r, i) => (
        <span key={i} className={`chip ${r.stage === 'avoid' ? 'red' : 'blue'}`} title={r.stage === 'avoid' ? 'Marked Avoid' : undefined}>{roleTag(r)}{r.trade && r.role !== 'supplier' ? `: ${r.trade}` : ''}{r.stage === 'avoid' ? ' (Avoid)' : ''}</span>
      ))}
    </span>
  );
}

/** Toggle buttons for roles: tick one or several (they post as name="roles"). */
export function RolePicker({ selected = [], name = 'roles' }: { selected?: string[]; name?: string }) {
  return (
    <fieldset className="role-pick">
      <legend className="sr-only">Roles</legend>
      {roles.map((r) => (
        <label key={r.key} className="role-btn"><input type="checkbox" name={name} value={r.key} defaultChecked={selected.includes(r.key)} /><span>{r.label}</span></label>
      ))}
    </fieldset>
  );
}

/** A supplier's kinds as buttons (they post as name="supplierTypes"). */
export function SupplierTypePicker({ selected = [], hint = true }: { selected?: string[]; hint?: boolean }) {
  return (
    <fieldset className="role-pick">
      <legend className="small muted" style={{ width: '100%', marginBottom: 4 }}>Kind of Supplier{hint ? ' (ticking one makes them a Supplier)' : ''}</legend>
      {supplierTypes.map((t) => (
        <label key={t.key} className="role-btn small-btn"><input type="checkbox" name="supplierTypes" value={t.key} defaultChecked={selected.includes(t.key)} /><span>{t.label}</span></label>
      ))}
    </fieldset>
  );
}

export function RoleFields({ prefix = '' }: { prefix?: string }) {
  return (
    <div className="fields">
      <label className="f">Trade or Specialty<span className="h">Contractors, suppliers, designers</span><input name={`${prefix}trade`} placeholder="Framing, plumbing…" /></label>
      <AreaPicker label="Areas They Cover (Agents: Where They Specialize)" />
      <label className="f">License #<input name={`${prefix}licenseNumber`} /></label>
    </div>
  );
}

export function RolesPanel({ items, personId, companyId, canEdit, gcs = [] }: { items: RoleRow[]; personId?: string; companyId?: string; canEdit: boolean; gcs?: { id: string; name: string }[] }) {
  return (
    <div>
      {items.length ? (
        <ul className="rows">
          {items.map((r) => {
            const def = roleDef(r.role);
            return (
              <li key={r.id}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <strong>{roleLabel(r.role)}</strong>
                  {r.role === 'supplier' && r.supplierTypes?.length ? <span className="chips">{r.supplierTypes.map((k) => <span key={k} className="chip aqua">{supplierTypeLabel(k)}</span>)}</span> : null}
                  <span className={`small ${r.stage === 'avoid' ? 'red' : 'muted'}`}>Where we are with them: {stageLabel(r.role, r.stage)} (since {formatDate(r.stageChangedAt.toISOString())})</span>
                </div>
                {r.hiredThroughCompanyId ? <div className="small">Through <Link href={`/companies/${r.hiredThroughCompanyId}`}>{r.hiredThroughName ?? 'the GC'}</Link> (bills come through the GC)</div> : null}
                {r.role === 'agent' ? <div className="small specialty">{areaSummary(areasOf(r)) ? <>Specializes in <strong>{areaSummary(areasOf(r))}</strong></> : <span className="muted">Areas they specialize in: not recorded yet (Change to add them)</span>}</div> : null}
                {r.trade || (r.areas && r.role !== 'agent') || r.licenseNumber ? (
                  <div className="small">{[r.trade, r.role !== 'agent' ? r.areas : null, r.licenseNumber ? `License ${r.licenseNumber}` : null].filter(Boolean).join(' · ')}</div>
                ) : null}
                {r.notes ? <div className="small muted">{r.notes}</div> : null}
                {canEdit ? (
                  <details className="fold">
                    <summary>Change</summary>
                    <ActionForm action={updateRole} submit="Save">
                      <input type="hidden" name="id" value={r.id} />
                      <div className="fields">
                        <Choice name="stage" label="Where We Are With Them" options={def?.stages ?? []} defaultValue={r.stage} />
                        {def?.trade ? <label className="f">Trade<input name="trade" defaultValue={r.trade ?? ''} /></label> : <input type="hidden" name="trade" value={r.trade ?? ''} />}
                        <AreaPicker label={r.role === 'agent' ? 'Areas They Specialize In' : 'Areas They Cover'} start={areasOf(r)} />
                        {def?.trade ? <label className="f">License #<input name="licenseNumber" defaultValue={r.licenseNumber ?? ''} /></label> : <input type="hidden" name="licenseNumber" value={r.licenseNumber ?? ''} />}
                      </div>
                      {r.role === 'supplier' ? <><input type="hidden" name="hasSupplierTypes" value="1" /><SupplierTypePicker selected={r.supplierTypes ?? []} hint={false} /></> : null}
                      <label className="f">Notes<input name="notes" defaultValue={r.notes ?? ''} /></label>
                    </ActionForm>
                    <div style={{ marginTop: 6 }}><ActionButton action={removeRole.bind(null, r.id)} className="link-btn small" label="Take off this role" done="Role taken off." /></div>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : <Empty>{companyId ? 'Not set yet: say what they do (General Contractor, Subcontractor, Supplier…).' : 'No roles yet.'}</Empty>}
      {canEdit ? (
        <details className="fold" style={{ marginTop: 10 }}>
          <summary>{companyId ? 'Add What They Do' : 'Add a Role'}</summary>
          <ActionForm action={addRole} submit={companyId ? 'Add' : 'Add Role'} resetOnOk>
            {personId ? <input type="hidden" name="personId" value={personId} /> : null}
            {companyId ? <input type="hidden" name="companyId" value={companyId} /> : null}
            <label className="f">{companyId ? 'Type' : 'Role'}
              <select name="role" defaultValue="">
                <option value="">{supplierHint}</option>
                {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <RoleFields />
            <SupplierTypePicker hint={false} />
            {gcs.length ? (
              <SearchPicker name="hiredThroughCompanyId" label="Through a GC" hint="Subs and suppliers whose bills come through a general contractor; empty: we hire them directly"
                placeholder="Type the GC" options={gcs.filter((g) => g.id !== companyId).map((g) => ({ id: g.id, label: g.name }))} />
            ) : null}
          </ActionForm>
        </details>
      ) : null}
    </div>
  );
}

const supplierHint = 'Pick one (or just tick a kind of supplier below)';

export function TouchForm({ personId, propertyId, projectId }: { personId: string; propertyId?: string; projectId?: string }) {
  return (
    <ActionForm action={logTouch} submit="Log It" resetOnOk>
      <input type="hidden" name="personId" value={personId} />
      {propertyId ? <input type="hidden" name="propertyId" value={propertyId} /> : null}
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      <div className="fields">
        <Choice name="kind" label="What" options={[{ key: 'call', label: 'Call' }, { key: 'email', label: 'Email' }, { key: 'text', label: 'Text' }, { key: 'meeting', label: 'Meeting' }, { key: 'site_walk', label: 'Site Walk' }, { key: 'event', label: 'Event' }]} defaultValue="call" color="energy" />
        <label className="f">When<input type="date" name="happenedOn" defaultValue={today()} max={today()} /></label>
      </div>
      <label className="f">What Happened<textarea name="notes" placeholder="What you talked about, what they said, what's next" /></label>
      <div className="fields">
        <label className="f">Follow-Up Task<span className="h">Optional</span><input name="followUp" placeholder="Call back about the Oakwood lot" /></label>
        <label className="f">Follow Up On<input type="date" name="followUpOn" defaultValue={addDays(today(), 7)} /></label>
      </div>
    </ActionForm>
  );
}

const kindLabel: Record<string, string> = { call: 'Call', email: 'Email', text: 'Text', meeting: 'Meeting', site_walk: 'Site Walk', event: 'Event' };

export function TouchList({ items }: { items: { id: string; kind: string; happenedOn: string; notes: string | null; userName: string | null; eventId: string | null; eventName: string | null }[] }) {
  if (!items.length) return <Empty>No calls, meetings or site walks logged yet.</Empty>;
  return (
    <ul className="rows">
      {items.map((t) => (
        <li key={t.id}>
          <div><span className="type">{kindLabel[t.kind] ?? t.kind}</span> <span className="small muted">{formatDate(t.happenedOn)}{t.userName ? ` · ${t.userName}` : ''}</span>
            {t.eventId ? <> · <Link href={`/events/${t.eventId}`} className="small">{t.eventName}</Link></> : null}</div>
          {t.notes ? <div style={{ whiteSpace: 'pre-wrap' }}>{t.notes}</div> : null}
        </li>
      ))}
    </ul>
  );
}

export function TaskForm(props: { personId?: string; companyId?: string; propertyId?: string; projectId?: string; staff: { id: string; name: string | null; email: string }[]; me: string }) {
  return (
    <ActionForm action={createTask} submit="Add Task" resetOnOk>
      {props.personId ? <input type="hidden" name="personId" value={props.personId} /> : null}
      {props.companyId ? <input type="hidden" name="companyId" value={props.companyId} /> : null}
      {props.propertyId ? <input type="hidden" name="propertyId" value={props.propertyId} /> : null}
      {props.projectId ? <input type="hidden" name="projectId" value={props.projectId} /> : null}
      <div className="fields">
        <label className="f">Task<input name="title" required /></label>
        <label className="f">Due<input type="date" name="dueOn" defaultValue={addDays(today(), 1)} required /></label>
        <label className="f">For
          <select name="assignedTo" defaultValue={props.me}>
            {props.staff.map((s) => <option key={s.id} value={s.id}>{s.name ?? s.email}</option>)}
          </select>
        </label>
      </div>
    </ActionForm>
  );
}

export function DueLabel({ dueOn }: { dueOn: string }) {
  const d = daysSince(dueOn, today()) ?? 0;
  if (d > 0) return <span className="red">Overdue {d} {d === 1 ? 'day' : 'days'}</span>;
  if (d === 0) return <span className="amber">Today</span>;
  return <span className="muted">{formatDate(dueOn)}</span>;
}

export function TaskRows({ items }: { items: { id: string; title: string; dueOn: string; status: string; assignee?: string | null }[] }) {
  if (!items.length) return <Empty>No tasks.</Empty>;
  return (
    <ul className="rows">
      {items.map((t) => (
        <li key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ActionButton action={setTaskDone.bind(null, t.id, t.status !== 'done')} className="btn secondary small" label={t.status === 'done' ? 'Reopen' : 'Done'} done={t.status === 'done' ? 'Task reopened.' : 'Task marked done.'} />
          <span style={{ flex: 1, textDecoration: t.status === 'done' ? 'line-through' : undefined }}>{t.title}</span>
          {t.assignee ? <span className="small muted">{t.assignee}</span> : null}
          {t.status === 'done' ? <span className="small muted">Done</span> : <DueLabel dueOn={t.dueOn} />}
        </li>
      ))}
    </ul>
  );
}

export function HistoryList({ rows }: { rows: { id: string; at: Date; summary: string | null; via: string | null; userName: string | null }[] }) {
  if (!rows.length) return <Empty>No history yet.</Empty>;
  return (
    <ul className="rows">
      {rows.map((h) => (
        <li key={h.id}>
          <div><strong>{h.userName ?? 'System'}</strong> {h.summary}</div>
          <div className="small muted">{formatDateTime(h.at)}{h.via && h.via !== 'screen' ? ` · via ${h.via}` : ''}</div>
        </li>
      ))}
    </ul>
  );
}

export function Pager({ base, page, total, pageSize, params }: { base: string; page: number; total: number; pageSize: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: p > 1 ? String(p) : undefined }).filter(([, v]) => v) as [string, string][]);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const from = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <div className="form-actions" style={{ marginTop: 10 }}>
      <span className="small muted">{from}–{Math.min(total, page * pageSize)} of {total}</span>
      {page > 1 ? <Link href={href(page - 1)}>‹ Previous</Link> : null}
      {page < pages ? <Link href={href(page + 1)}>Next ›</Link> : null}
    </div>
  );
}
