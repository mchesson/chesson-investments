import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Empty } from './ui';
import { addRole, createTask, logTouch, removeRole, setTaskDone, updateRole } from '@/app/(app)/contacts-actions';
import { roles, roleDef, roleLabel, stageLabel } from '@/lib/roles';
import { formatDate, formatDateTime, today, addDays } from '@/lib/format';
import { daysSince } from '@/lib/roles';

type RoleRow = { id: string; role: string; stage: string; trade: string | null; areas: string | null; licenseNumber: string | null; notes: string | null; stageChangedAt: Date; hiredThroughCompanyId?: string | null; hiredThroughName?: string | null };

export function RoleChips({ items }: { items: { role: string; stage: string }[] }) {
  if (!items.length) return <span className="muted small">No role yet</span>;
  return (
    <span className="chips">
      {items.map((r, i) => (
        <span key={i} className={`chip ${r.stage === 'avoid' ? 'red' : 'blue'}`}>{roleLabel(r.role)} · {stageLabel(r.role, r.stage)}</span>
      ))}
    </span>
  );
}

export function RoleFields({ prefix = '' }: { prefix?: string }) {
  return (
    <div className="fields">
      <label className="f">Trade or Specialty<span className="h">Contractors, suppliers, designers</span><input name={`${prefix}trade`} placeholder="Framing, plumbing…" /></label>
      <label className="f">Areas<input name={`${prefix}areas`} placeholder="Raleigh, Durham, Wake County" /></label>
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
                  <span className={`chip ${r.stage === 'avoid' ? 'red' : 'blue'}`}>{stageLabel(r.role, r.stage)}</span>
                  <span className="small muted">since {formatDate(r.stageChangedAt.toISOString())}</span>
                </div>
                {r.hiredThroughCompanyId ? <div className="small">Through <Link href={`/companies/${r.hiredThroughCompanyId}`}>{r.hiredThroughName ?? 'the GC'}</Link> (bills come through the GC)</div> : null}
                {r.trade || r.areas || r.licenseNumber ? (
                  <div className="small">{[r.trade, r.areas, r.licenseNumber ? `License ${r.licenseNumber}` : null].filter(Boolean).join(' · ')}</div>
                ) : null}
                {r.notes ? <div className="small muted">{r.notes}</div> : null}
                {canEdit ? (
                  <details className="fold">
                    <summary>Change</summary>
                    <ActionForm action={updateRole} submit="Save">
                      <input type="hidden" name="id" value={r.id} />
                      <div className="fields">
                        <label className="f">Stage
                          <select name="stage" defaultValue={r.stage}>
                            {def?.stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </label>
                        {def?.trade ? <label className="f">Trade<input name="trade" defaultValue={r.trade ?? ''} /></label> : <input type="hidden" name="trade" value={r.trade ?? ''} />}
                        <label className="f">Areas<input name="areas" defaultValue={r.areas ?? ''} /></label>
                        {def?.trade ? <label className="f">License #<input name="licenseNumber" defaultValue={r.licenseNumber ?? ''} /></label> : <input type="hidden" name="licenseNumber" value={r.licenseNumber ?? ''} />}
                      </div>
                      <label className="f">Notes<input name="notes" defaultValue={r.notes ?? ''} /></label>
                    </ActionForm>
                    <form action={removeRole.bind(null, r.id)} style={{ marginTop: 6 }}>
                      <button className="link-btn small" type="submit">Take off this role</button>
                    </form>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : <Empty>No roles yet.</Empty>}
      {canEdit ? (
        <details className="fold" style={{ marginTop: 10 }}>
          <summary>Add a Role</summary>
          <ActionForm action={addRole} submit="Add Role" resetOnOk>
            {personId ? <input type="hidden" name="personId" value={personId} /> : null}
            {companyId ? <input type="hidden" name="companyId" value={companyId} /> : null}
            <label className="f">Role
              <select name="role" required defaultValue="">
                <option value="" disabled>Pick a role</option>
                {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <RoleFields />
            {gcs.length ? (
              <label className="f">Through a GC<span className="h">Subs and suppliers whose bills come through a general contractor</span>
                <select name="hiredThroughCompanyId" defaultValue=""><option value="">No: we hire them directly</option>{gcs.filter((g) => g.id !== companyId).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              </label>
            ) : null}
          </ActionForm>
        </details>
      ) : null}
    </div>
  );
}

export function TouchForm({ personId, propertyId, projectId }: { personId: string; propertyId?: string; projectId?: string }) {
  return (
    <ActionForm action={logTouch} submit="Log It" resetOnOk>
      <input type="hidden" name="personId" value={personId} />
      {propertyId ? <input type="hidden" name="propertyId" value={propertyId} /> : null}
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      <div className="fields">
        <label className="f">What
          <select name="kind" defaultValue="call">
            <option value="call">Call</option><option value="email">Email</option><option value="text">Text</option>
            <option value="meeting">Meeting</option><option value="site_walk">Site Walk</option><option value="event">Event</option>
          </select>
        </label>
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
          <form action={setTaskDone.bind(null, t.id, t.status !== 'done')}>
            <button className="btn secondary small" type="submit">{t.status === 'done' ? 'Reopen' : 'Done'}</button>
          </form>
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
