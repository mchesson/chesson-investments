import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Empty, Section } from './ui';
import { Phone } from './Phone';
import { addUtility, removeUtility } from '@/app/(app)/utility-actions';
import { utilityServices, utilityServiceLabel } from '@/lib/roles';
import { formatDate } from '@/lib/format';

type Row = { id: string; service: string; companyId: string | null; companyName: string | null; personId: string | null; personName: string | null; personPhone: string | null; personEmail: string | null; startedOn: string | null; notes: string | null };

/** A property's utilities, and the person we deal with at each (it can differ by property). */
export function Utilities({ projectId, rows, companies, people, canEdit }: {
  projectId: string; rows: Row[]; canEdit: boolean;
  companies: { id: string; name: string; utility: boolean }[]; people: { id: string; name: string; companyName: string | null }[];
}) {
  const utilityCos = companies.filter((c) => c.utility), others = companies.filter((c) => !c.utility);
  return (
    <div className="stack">
      <Section title="Utilities" kind="aqua" hint="Who supplies each service here, and who we deal with">
        {rows.length ? (
          <ul className="rows">{rows.map((u) => (
            <li key={u.id}>
              <div><strong>{utilityServiceLabel(u.service)}</strong>{u.companyId ? <> · <Link href={`/companies/${u.companyId}`}>{u.companyName}</Link></> : null}</div>
              {u.personId ? <div className="small">Contact: <Link href={`/people/${u.personId}`}>{u.personName}</Link>{u.personPhone ? <> · <Phone value={u.personPhone} /></> : null}{u.personEmail ? <> · <a href={`mailto:${u.personEmail}`}>{u.personEmail}</a></> : null}</div> : null}
              {u.startedOn || u.notes ? <div className="small muted">{[u.startedOn ? `Since ${formatDate(u.startedOn)}` : null, u.notes].filter(Boolean).join(' · ')}</div> : null}
              {canEdit ? <form action={removeUtility.bind(null, u.id)}><button className="link-btn small" type="submit">Take off</button></form> : null}
            </li>
          ))}</ul>
        ) : <Empty>No utilities recorded yet.</Empty>}
      </Section>
      {canEdit ? (
        <Section title="Add a Utility" kind="aqua">
          <ActionForm action={addUtility} submit="Add" resetOnOk>
            <input type="hidden" name="projectId" value={projectId} />
            <div className="fields">
              <label className="f">Service<select name="service" required defaultValue="">
                <option value="" disabled>Pick one</option>{utilityServices.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
              <label className="f">Company<span className="h">Utility suppliers first</span><select name="companyId" defaultValue="">
                <option value="">None</option>
                {utilityCos.length ? <optgroup label="Utilities">{utilityCos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup> : null}
                <optgroup label="Everyone else">{others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
              </select></label>
              <label className="f">Contact Here<span className="h">The person we deal with for this property</span><select name="personId" defaultValue="">
                <option value="">None</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.companyName ? ` (${p.companyName})` : ''}</option>)}</select></label>
              <label className="f">Since<input type="date" name="startedOn" /></label>
            </div>
            <label className="f">Notes<input name="notes" placeholder="Service in our name from closing; deposit paid" /></label>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}
