import { ActionForm } from './ActionForm';
import { saveCompany } from '@/app/(app)/contacts-actions';
import { roles } from '@/lib/roles';
import { showPhone } from '@/lib/format';
import { RoleFields } from './contacts';

type C = { id: string; name: string; website: string | null; phone: string | null; email: string | null; city: string | null; state: string | null; notes: string | null };

export function CompanyForm({ company, defaultRole }: { company?: C; defaultRole?: string }) {
  return (
    <ActionForm action={saveCompany} submit={company ? 'Save Changes' : 'Add Company'}>
      {company ? <input type="hidden" name="id" value={company.id} /> : null}
      <div className="section"><header><h2>Company</h2></header>
        <div className="body fields">
          <label className="f">Name<input name="name" required defaultValue={company?.name} /></label>
          <label className="f">Website<input name="website" defaultValue={company?.website ?? ''} /></label>
          <label className="f">Main Phone<input name="phone" type="tel" defaultValue={showPhone(company?.phone)} /></label>
          <label className="f">Email<input name="email" type="email" defaultValue={company?.email ?? ''} /></label>
          <label className="f">City<input name="city" list="city-options" autoComplete="off" defaultValue={company?.city ?? ''} /></label>
          <label className="f">State<input name="state" list="state-options" autoComplete="off" defaultValue={company?.state ?? 'NC'} /></label>
        </div>
      </div>
      {!company ? (
        <div className="section"><header><h2>Role</h2></header>
          <div className="body">
            <label className="f">What They Are to Us
              <select name="role" defaultValue={defaultRole ?? ''}>
                <option value="">Decide later</option>
                {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <RoleFields />
          </div>
        </div>
      ) : null}
      <div className="section" data-c="energy"><header><h2>Notes</h2></header>
        <div className="body">
          <label className="f">Notes<textarea name="notes" defaultValue={company?.notes ?? ''} /></label>
          <label className="check"><input type="checkbox" name="different" /> Different company (save even if the name looks like one on file)</label>
        </div>
      </div>
    </ActionForm>
  );
}
