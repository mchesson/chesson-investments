import { ActionButton } from '@/components/ActionButton';
import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Empty, Section } from './ui';
import { Phone } from './Phone';
import { addUtility, removeUtility } from '@/app/(app)/utility-actions';
import { utilityServices, utilityServiceLabel } from '@/lib/roles';
import { formatDate } from '@/lib/format';
import { Choice } from './Choice';
import { SearchPicker } from './SearchPicker';

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
              {canEdit ? <ActionButton action={removeUtility.bind(null, u.id)} className="link-btn small" label="Take off" done="Utility taken off." /> : null}
            </li>
          ))}</ul>
        ) : <Empty>No utilities recorded yet.</Empty>}
      </Section>
      {canEdit ? (
        <Section title="Add a Utility" kind="aqua">
          <ActionForm action={addUtility} submit="Add" resetOnOk>
            <input type="hidden" name="projectId" value={projectId} />
            <div className="fields">
              <Choice name="service" label="Service" options={utilityServices} required color="aqua" />
              <SearchPicker name="companyId" label="Company" hint="Utility suppliers first" placeholder="Type the company"
                options={[...utilityCos.map((c) => ({ id: c.id, label: c.name, sub: 'Utility' })), ...others.map((c) => ({ id: c.id, label: c.name }))]} add={{ kind: 'company' }} />
              <SearchPicker name="personId" label="Contact Here" hint="The person we deal with for this property" placeholder="Type a name or company"
                options={people.map((p) => ({ id: p.id, label: p.name, sub: p.companyName }))} add={{ kind: 'person' }} />
              <label className="f">Since<input type="date" name="startedOn" /></label>
            </div>
            <label className="f">Notes<input name="notes" placeholder="Service in our name from closing; deposit paid" /></label>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}
