import { ActionForm } from './ActionForm';
import { savePerson } from '@/app/(app)/contacts-actions';
import { showPhone } from '@/lib/format';
import { RoleFields, RolePicker } from './contacts';
import { howMetOptions } from '@/lib/how-met';

type P = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; title: string | null; companyId: string | null; city: string | null; state: string | null; howMet: string | null; introducedById: string | null; introNote: string | null; metAtEventId: string | null; notes: string | null };

export function PersonForm({ person, companies, people, events, defaults }: {
  person?: P; companies: { id: string; name: string }[]; people: { id: string; name: string; companyName: string | null }[];
  events: { id: string; name: string; happenedOn: string }[];
  defaults?: { companyId?: string; role?: string; introducedById?: string };
}) {
  return (
    <ActionForm action={savePerson} submit={person ? 'Save Changes' : 'Add Person'}>
      {person ? <input type="hidden" name="id" value={person.id} /> : null}
      <fieldset className="section" data-c="blue" style={{ padding: 0 }}>
        <legend className="sr-only">Who</legend>
        <header><h2>Who</h2></header>
        <div className="body fields">
          <label className="f">First Name<input name="firstName" required defaultValue={person?.firstName} /></label>
          <label className="f">Last Name<input name="lastName" required defaultValue={person?.lastName} /></label>
          <label className="f">Mobile or Main Phone<input name="phone" type="tel" defaultValue={showPhone(person?.phone)} /></label>
          <label className="f">Email<input name="email" type="email" defaultValue={person?.email ?? ''} /></label>
          <label className="f">City<input name="city" defaultValue={person?.city ?? ''} /></label>
          <label className="f">State<input name="state" defaultValue={person?.state ?? 'NC'} /></label>
        </div>
      </fieldset>
      <fieldset className="section" data-c="aqua" style={{ padding: 0 }}>
        <legend className="sr-only">Company</legend>
        <header><h2>Company</h2><span className="hint">Changing it keeps the old one in their work history</span></header>
        <div className="body fields">
          <label className="f">Company
            <select name="companyId" defaultValue={person?.companyId ?? defaults?.companyId ?? ''}>
              <option value="">None, or a new one →</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="f">Or New Company<input name="newCompany" placeholder="Adds the company too" /></label>
          <label className="f">Title<input name="title" defaultValue={person?.title ?? ''} /></label>
        </div>
      </fieldset>
      {!person ? (
        <fieldset className="section" data-c="blue" style={{ padding: 0 }}>
          <legend className="sr-only">Role</legend>
          <header><h2>What They Are to Us</h2><span className="hint">Tick every role that fits; none is fine</span></header>
          <div className="body">
            <RolePicker selected={defaults?.role ? [defaults.role] : []} />
            <RoleFields />
          </div>
        </fieldset>
      ) : null}
      <fieldset className="section" data-c="energy" style={{ padding: 0 }}>
        <legend className="sr-only">Notes</legend>
        <header><h2>How We Know Them</h2><span className="hint">Most people come through introductions: always say who</span></header>
        <div className="body">
          <div className="fields">
            <label className="f">How We Know Them
              <select name="howMet" defaultValue={person?.howMet ?? (defaults?.introducedById ? 'introduction' : '')}>
                <option value="">Not sure</option>
                {howMetOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <label className="f">Introduced By<span className="h">Someone on file</span>
              <select name="introducedById" defaultValue={person?.introducedById ?? defaults?.introducedById ?? ''}>
                <option value="">No one / a new person →</option>
                {people.filter((o) => o.id !== person?.id).map((o) => <option key={o.id} value={o.id}>{o.name}{o.companyName ? ` (${o.companyName})` : ''}</option>)}
              </select>
            </label>
            <label className="f">Or Introducer Not on File Yet<span className="h">First and last name: adds them too</span><input name="newIntroducer" placeholder="Jane Smith" /></label>
            <label className="f">Met At (Event)
              <select name="metAtEventId" defaultValue={person?.metAtEventId ?? ''}>
                <option value="">—</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.happenedOn})</option>)}
              </select>
            </label>
          </div>
          <label className="f">About the Introduction<span className="h">Why they connected you, what was said</span><textarea name="introNote" defaultValue={person?.introNote ?? ''} /></label>
          <label className="f">Notes<textarea name="notes" defaultValue={person?.notes ?? ''} /></label>
          <label className="check"><input type="checkbox" name="different" /> Different person (save even if the email or phone matches someone)</label>
        </div>
      </fieldset>
    </ActionForm>
  );
}
