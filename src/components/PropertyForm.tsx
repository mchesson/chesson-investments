import { ActionForm } from './ActionForm';
import { saveProperty } from '@/app/(app)/watch-actions';
import { Choice } from './Choice';
import { commercialUses, dealTypes, entitlements, sourceKinds, utilities } from '@/lib/deal-sources';

type P = { id: string; address: string; city: string | null; state: string | null; zip: string | null; neighborhood: string | null; sourcePersonId: string | null; askingPrice: string | null; lotSf: number | null; lotAcres: string | null; zoning: string | null; metBuyBox: boolean | null; referralFee: string | null; notes: string | null;
  dealType?: string; sourceCompanyId?: string | null; sourceKind?: string | null; sourceAccurate?: boolean | null; sourceNote?: string | null;
  lotsPossible?: number | null; utilities?: string | null; entitlement?: string | null; commercialUse?: string | null };

export function PropertyForm({ property, people, companies = [], defaultSource, defaultAddress, defaultCity, defaultType }: { property?: P; people: { id: string; name: string; companyName: string | null }[]; companies?: { id: string; name: string }[]; defaultSource?: string; defaultAddress?: string; defaultCity?: string; defaultType?: string }) {
  return (
    <ActionForm action={saveProperty} submit={property ? 'Save Changes' : 'Add to Watchlist'}>
      {property ? <input type="hidden" name="id" value={property.id} /> : null}
      <div className="section" data-c="blue"><header><h2>What Kind of Deal</h2></header>
        <div className="body">
          <Choice name="dealType" label="Kind" options={dealTypes.map((t) => ({ key: t.key, label: t.label }))} defaultValue={property?.dealType ?? defaultType ?? 'lot'} />
        </div>
      </div>
      <div className="section" data-c="aqua"><header><h2>Where</h2></header>
        <div className="body fields">
          <label className="f">Address<input name="address" required defaultValue={property?.address ?? defaultAddress} placeholder="109 Plainview Ave" /></label>
          <label className="f">City<input name="city" list="city-options" autoComplete="off" defaultValue={property?.city ?? defaultCity ?? 'Raleigh'} /></label>
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
      <div className="section" data-c="grey"><header><h2>Land and Commercial</h2><span className="hint">For acreage, subdivisions and commercial deals; leave blank for a single lot</span></header>
        <div className="body fields">
          <label className="f">Lots or Units It Could Hold<input name="lotsPossible" inputMode="numeric" defaultValue={property?.lotsPossible ?? ''} placeholder="24" /></label>
          <label className="f">Water and Sewer
            <select name="utilities" defaultValue={property?.utilities ?? ''}><option value="">Not entered</option>{utilities.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select>
          </label>
          <label className="f">Approvals
            <select name="entitlement" defaultValue={property?.entitlement ?? ''}><option value="">Not entered</option>{entitlements.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select>
          </label>
          <label className="f">Commercial Use
            <select name="commercialUse" defaultValue={property?.commercialUse ?? ''}><option value="">Not commercial</option>{commercialUses.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select>
          </label>
        </div>
      </div>
      <div className="section" data-c="energy"><header><h2>Where It Came From</h2><span className="hint">Credits who sent it; over time this shows which sources bring the best deals</span></header>
        <div className="body">
          <div className="fields">
            <label className="f">How It Came to Us
              <select name="sourceKind" defaultValue={property?.sourceKind ?? ''}><option value="">Not recorded</option>{sourceKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
            </label>
            <label className="f">Their Company
              <select name="sourceCompanyId" defaultValue={property?.sourceCompanyId ?? ''}><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            <label className="f">Sent by
              <select name="sourcePersonId" defaultValue={property?.sourcePersonId ?? defaultSource ?? ''}>
                <option value="">We found it ourselves</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.companyName ? ` (${p.companyName})` : ''}</option>)}
              </select>
            </label>
            <label className="f">Referral Fee<input name="referralFee" inputMode="decimal" defaultValue={property?.referralFee ?? ''} /></label>
          </div>
          <div className="fields">
            <Choice name="sourceAccurate" label="Did Their Numbers Hold Up?" options={[{ key: '', label: 'Not Checked Yet' }, { key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }]}
              defaultValue={property?.sourceAccurate === true ? 'yes' : property?.sourceAccurate === false ? 'no' : ''} />
            <label className="f grow">What Was Off<span className="h">e.g. “said 0.4 acres, it’s 0.3”, “their after-repair value was 10% high”</span><input name="sourceNote" defaultValue={property?.sourceNote ?? ''} /></label>
          </div>
          <label className="f">Notes<textarea name="notes" defaultValue={property?.notes ?? ''} /></label>
        </div>
      </div>
    </ActionForm>
  );
}
