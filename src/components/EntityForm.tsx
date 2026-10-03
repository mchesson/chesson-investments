import { ActionForm } from './ActionForm';
import { saveEntity } from '@/app/(app)/entity-actions';
import { entityKinds } from '@/lib/entities';

type E = { id: string; name: string; kind: string; state: string | null; formedOn: string | null; status: string; taxForm: string | null; fiscalYearEnd: string | null;
  address: string | null; registeredAgent: string | null; website: string | null; companyId: string | null; notes: string | null };

export function EntityForm({ entity, companies }: { entity?: E; companies: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveEntity} submit={entity ? 'Save Changes' : 'Add the Entity'}>
      {entity ? <input type="hidden" name="id" value={entity.id} /> : null}
      <div className="section" data-c="blue"><header><h2>The Entity</h2></header>
        <div className="body fields">
          <label className="f">Name<input name="name" required defaultValue={entity?.name ?? ''} placeholder="WJ Investment Group, LLC" /></label>
          <label className="f">Kind<select name="kind" defaultValue={entity?.kind ?? 'llc'}>{entityKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>
          <label className="f">State Formed In<input name="state" defaultValue={entity?.state ?? 'NC'} /></label>
          <label className="f">Formed On<input type="date" name="formedOn" defaultValue={entity?.formedOn ?? ''} /></label>
          <label className="f">Status<select name="status" defaultValue={entity?.status ?? 'active'}><option value="active">Active</option><option value="dissolved">Dissolved</option></select></label>
          <label className="f">How It Files Taxes<span className="h">e.g. Form 1065 partnership, 1120-S, disregarded</span><input name="taxForm" defaultValue={entity?.taxForm ?? ''} /></label>
          <label className="f">Fiscal Year Ends<input name="fiscalYearEnd" defaultValue={entity?.fiscalYearEnd ?? '12/31'} /></label>
          <label className="f">Address<input name="address" defaultValue={entity?.address ?? ''} /></label>
          <label className="f">Registered Agent<input name="registeredAgent" defaultValue={entity?.registeredAgent ?? ''} /></label>
          <label className="f">Website<input name="website" defaultValue={entity?.website ?? ''} /></label>
          <label className="f">Same as Company<span className="h">Its company in People and Companies, for bills and contacts</span>
            <select name="companyId" defaultValue={entity?.companyId ?? ''}><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <div className="body"><label className="f">Notes<textarea name="notes" defaultValue={entity?.notes ?? ''} /></label></div>
      </div>
    </ActionForm>
  );
}
