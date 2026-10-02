import { ActionForm } from './ActionForm';
import { saveProperty } from '@/app/(app)/watch-actions';
import { Choice } from './Choice';

type P = { id: string; address: string; city: string | null; state: string | null; zip: string | null; neighborhood: string | null; sourcePersonId: string | null; askingPrice: string | null; lotSf: number | null; lotAcres: string | null; zoning: string | null; metBuyBox: boolean | null; referralFee: string | null; notes: string | null };

export function PropertyForm({ property, people, defaultSource }: { property?: P; people: { id: string; name: string; companyName: string | null }[]; defaultSource?: string }) {
  return (
    <ActionForm action={saveProperty} submit={property ? 'Save Changes' : 'Add to Watchlist'}>
      {property ? <input type="hidden" name="id" value={property.id} /> : null}
      <div className="section" data-c="aqua"><header><h2>Where</h2></header>
        <div className="body fields">
          <label className="f">Address<input name="address" required defaultValue={property?.address} placeholder="109 Plainview Ave" /></label>
          <label className="f">City<input name="city" list="city-options" autoComplete="off" defaultValue={property?.city ?? 'Raleigh'} /></label>
          <label className="f">State<input name="state" list="state-options" autoComplete="off" defaultValue={property?.state ?? 'NC'} /></label>
          <label className="f">ZIP<input name="zip" defaultValue={property?.zip ?? ''} /></label>
          <label className="f">Neighborhood<input name="neighborhood" list="neighborhood-options" defaultValue={property?.neighborhood ?? ''} /></label>
        </div>
      </div>
      <div className="section"><header><h2>The Lot</h2></header>
        <div className="body fields">
          <label className="f">Asking Price<input name="askingPrice" inputMode="decimal" defaultValue={property?.askingPrice ?? ''} placeholder="450,000" /></label>
          <label className="f">Lot Size (sq ft)<input name="lotSf" inputMode="numeric" defaultValue={property?.lotSf ?? ''} /></label>
          <label className="f">Acres<span className="h">Worked out from sq ft if blank</span><input name="lotAcres" inputMode="decimal" defaultValue={property?.lotAcres ?? ''} /></label>
          <label className="f">Zoning<input name="zoning" defaultValue={property?.zoning ?? ''} placeholder="R-10" /></label>
          <Choice name="metBuyBox" label="Meets Our Buy Box?" options={[{ key: '', label: 'Not Decided' }, { key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }]}
            defaultValue={property?.metBuyBox === true ? 'yes' : property?.metBuyBox === false ? 'no' : ''} />
        </div>
      </div>
      <div className="section" data-c="energy"><header><h2>Where It Came From</h2><span className="hint">Credits the person who sent it</span></header>
        <div className="body">
          <div className="fields">
            <label className="f">Sent by
              <select name="sourcePersonId" defaultValue={property?.sourcePersonId ?? defaultSource ?? ''}>
                <option value="">We found it ourselves</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.companyName ? ` (${p.companyName})` : ''}</option>)}
              </select>
            </label>
            <label className="f">Referral Fee<input name="referralFee" inputMode="decimal" defaultValue={property?.referralFee ?? ''} /></label>
          </div>
          <label className="f">Notes<textarea name="notes" defaultValue={property?.notes ?? ''} /></label>
        </div>
      </div>
    </ActionForm>
  );
}
