import { ActionForm } from './ActionForm';
import { saveProject } from '@/app/(app)/project-actions';
import { projectStages } from '@/lib/project-stages';

type P = { id: string; name: string; address: string; city: string | null; state: string | null; zip: string | null; neighborhood: string | null; stage: string; lotSf: number | null; zoning: string | null; lotCost: string | null; lotValue: string | null; heatedSf: number | null; plan: string | null; ownedBy: string | null; saleLow: string | null; saleHigh: string | null; closingCostAtSale: string | null; keptAssetsValue: string | null; taxRatePct: string | null; marketValue: string | null; marketValueOn: string | null; marketValueSource: string | null; proformaSalePrice: string | null; sellingCostPct: string | null; actualSalePrice: string | null; notes: string | null };

export function ProjectForm({ project }: { project?: P }) {
  return (
    <ActionForm action={saveProject} submit={project ? 'Save Changes' : 'Add Project'}>
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <div className="section" data-c="aqua"><header><h2>Where</h2></header>
        <div className="body fields">
          <label className="f">Project Name<span className="h">Usually the address</span><input name="name" defaultValue={project?.name ?? ''} /></label>
          <label className="f">Address<input name="address" required defaultValue={project?.address} /></label>
          <label className="f">City<input name="city" list="city-options" autoComplete="off" defaultValue={project?.city ?? 'Raleigh'} /></label>
          <label className="f">State<input name="state" list="state-options" autoComplete="off" defaultValue={project?.state ?? 'NC'} /></label>
          <label className="f">ZIP<input name="zip" defaultValue={project?.zip ?? ''} /></label>
          <label className="f">Neighborhood<input name="neighborhood" list="neighborhood-options" defaultValue={project?.neighborhood ?? ''} /></label>
          <label className="f">Owned By<span className="h">The entity on the deed</span><input name="ownedBy" defaultValue={project?.ownedBy ?? 'Chesson Investments, LLC'} /></label>
          {project ? null : <label className="f">Starting Stage<span className="h">After this, change stages with the buttons at the top of the project</span><select name="stage" defaultValue="under_contract">{projectStages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>}
        </div>
      </div>
      <div className="section" data-c="aqua"><header><h2>Lot and House</h2></header>
        <div className="body fields">
          <label className="f">Lot (sq ft)<input name="lotSf" inputMode="numeric" defaultValue={project?.lotSf ?? ''} /></label>
          <label className="f">Zoning<input name="zoning" defaultValue={project?.zoning ?? ''} /></label>
          <label className="f">Plan<input name="plan" defaultValue={project?.plan ?? ''} /></label>
          <label className="f">Heated SF<input name="heatedSf" inputMode="numeric" defaultValue={project?.heatedSf ?? ''} /></label>
        </div>
      </div>
      <div className="section"><header><h2>Money</h2></header>
        <div className="body fields">
          <label className="f">Lot Cost (All-In)<input name="lotCost" inputMode="decimal" defaultValue={project?.lotCost ?? ''} /></label>
          <label className="f">Lot Market Value<input name="lotValue" inputMode="decimal" defaultValue={project?.lotValue ?? ''} /></label>
          <label className="f">Sale Price: Low<input name="saleLow" inputMode="decimal" defaultValue={project?.saleLow ?? ''} /></label>
          <label className="f">Sale Price: Mid (Pro Forma)<input name="proformaSalePrice" inputMode="decimal" defaultValue={project?.proformaSalePrice ?? ''} /></label>
          <label className="f">Sale Price: High<input name="saleHigh" inputMode="decimal" defaultValue={project?.saleHigh ?? ''} /></label>
          <label className="f">Commissions %<span className="h">Both agents</span><input name="sellingCostPct" inputMode="decimal" defaultValue={project?.sellingCostPct ?? '5'} /></label>
          <label className="f">Closing Cost at Sale<input name="closingCostAtSale" inputMode="decimal" defaultValue={project?.closingCostAtSale ?? ''} /></label>
          <label className="f">What We Keep<span className="h">Staging furniture, tools: added back</span><input name="keptAssetsValue" inputMode="decimal" defaultValue={project?.keptAssetsValue ?? ''} /></label>
          <label className="f">Tax Rate %<span className="h">For profit after tax; blank to skip</span><input name="taxRatePct" inputMode="decimal" defaultValue={project?.taxRatePct ?? ''} /></label>
          <label className="f">Actual Sale Price<span className="h">Once it sells</span><input name="actualSalePrice" inputMode="decimal" defaultValue={project?.actualSalePrice ?? ''} /></label>
        </div>
      </div>
      <div className="section" data-c="grey"><header><h2>Market Check</h2><span className="hint">What the finished house would sell for today: catches over-building</span></header>
        <div className="body fields">
          <label className="f">Market Value Today<input name="marketValue" inputMode="decimal" defaultValue={project?.marketValue ?? ''} /></label>
          <label className="f">As Of<input type="date" name="marketValueOn" defaultValue={project?.marketValueOn ?? ''} /></label>
          <label className="f">From<span className="h">Agent's opinion, comps, appraisal</span><input name="marketValueSource" defaultValue={project?.marketValueSource ?? ''} /></label>
        </div>
      </div>
      <div className="section" data-c="energy"><header><h2>Notes</h2></header>
        <div className="body"><label className="f">Notes<textarea name="notes" defaultValue={project?.notes ?? ''} /></label></div>
      </div>
    </ActionForm>
  );
}
