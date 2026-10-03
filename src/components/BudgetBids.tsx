import { ActionForm } from './ActionForm';
import { Empty, Section } from './ui';
import { addBid, selectBid } from '@/app/(app)/bid-actions';
import { compareBids, contractTypeLabel, contractTypes, withFee, type BidLine } from '@/lib/bids';
import { formatCents, formatDate } from '@/lib/format';
import { Choice } from './Choice';
import { SearchPicker } from './SearchPicker';

type BidRow = {
  id: string; kind: string; who: string; label: string | null; lines: BidLine[]; totalCents: number; submittedOn: string | null; validUntil: string | null;
  contractType: string | null; feePct: string | null; status: string | null; decidedReason: string | null; notes: string | null; files: { id: string; name: string }[];
};
type Code = { id: string; code: string; name: string };

const flagText = { missing: 'Not in this bid', high: '25%+ above the others', low: '25%+ below the others' } as const;
const statusChip = (s: string | null) => s === 'selected' ? <span className="chip energy">Winner</span> : s === 'declined' ? <span className="chip">Declined</span> : s === 'open' ? <span className="chip blue">Open</span> : null;

/** GC bids and our estimate side by side by cost code, the gaps flagged, and Select the Winning Budget. */
export function BudgetBids({ projectId, codes, bids, heatedSf, companies, canEdit, canChoose }: {
  projectId: string; codes: Code[]; bids: BidRow[]; heatedSf: number | null; canEdit: boolean; canChoose: boolean;
  companies: { id: string; name: string; gc: boolean }[];
}) {
  const shown = [...bids].reverse(); // oldest on the left
  const rows = compareBids(codes, shown.map((b) => ({ id: b.id, kind: b.kind, who: b.who, total: b.totalCents, lines: b.lines, status: b.status })));
  const codeOf = new Map(codes.map((c) => [c.id, c]));
  const m = (c: number | null) => (c === null ? '—' : formatCents(c));
  return (
    <div className="stack">
      <Section title="Bids and Our Estimate" kind="blue" hint={bids.length ? `${bids.filter((b) => b.kind === 'bid').length} GC ${bids.filter((b) => b.kind === 'bid').length === 1 ? 'bid' : 'bids'} · ${bids.filter((b) => b.kind === 'ours').length} of ours` : undefined}>
        {shown.length ? (
          <div className="table-wrap">
            <table className="t bids">
              <thead>
                <tr><th>Cost Code</th>{shown.map((b) => (
                  <th key={b.id} className="num">
                    <div>{b.who}</div>
                    <div className="small muted" style={{ fontWeight: 400 }}>{b.kind === 'ours' ? 'Our Estimate' : 'GC Bid'}{b.submittedOn ? ` · ${formatDate(b.submittedOn)}` : ''}</div>
                    <div>{statusChip(b.status)}</div>
                  </th>
                ))}<th className="num">Spread</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = codeOf.get(r.costCodeId);
                  return (
                    <tr key={r.costCodeId}>
                      <td>{c ? `${c.code} ${c.name}` : '—'}</td>
                      {shown.map((b) => {
                        const f = r.flags[b.id];
                        return <td key={b.id} className={`num ${f === 'high' ? 'red' : f === 'missing' ? 'amber' : ''}`} title={f ? flagText[f] : undefined}>{m(r.cents[b.id])}{f ? <div className="small">{f === 'missing' ? 'not in it' : f === 'high' ? 'high' : 'low'}</div> : null}</td>;
                      })}
                      <td className="num small muted">{r.spread ? formatCents(r.spread) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><th>Total</th>{shown.map((b) => <th key={b.id} className="num">{formatCents(b.totalCents)}</th>)}<th /></tr>
                {shown.some((b) => b.contractType === 'cost_plus' && b.feePct) ? (
                  <tr><th>With the GC’s Fee</th>{shown.map((b) => <th key={b.id} className="num">{b.contractType === 'cost_plus' && b.feePct ? `${formatCents(withFee(b.totalCents, b.contractType, b.feePct))} (${Number(b.feePct)}%)` : ''}</th>)}<th /></tr>
                ) : null}
                {heatedSf ? <tr><th>Per Heated SF</th>{shown.map((b) => <th key={b.id} className="num">{formatCents(Math.round(b.totalCents / heatedSf), { cents: true })}</th>)}<th /></tr> : null}
              </tfoot>
            </table>
          </div>
        ) : <Empty>No bids yet. Add each GC’s proposal and our own estimate to compare them line by line.</Empty>}
        {shown.length ? (
          <ul className="rows" style={{ marginTop: 12 }}>
            {shown.map((b) => (
              <li key={b.id}>
                <div><strong>{b.who}</strong> {statusChip(b.status)} <span className="small muted">{[b.kind === 'ours' ? 'Our Estimate' : 'GC Bid', contractTypeLabel(b.contractType), b.feePct ? `${Number(b.feePct)}% fee` : null, b.validUntil ? `good until ${formatDate(b.validUntil)}` : null].filter(Boolean).join(' · ')}</span></div>
                {b.files.map((f) => <div key={f.id} className="small"><a href={`/documents/${f.id}`}>{f.name}</a></div>)}
                {b.notes ? <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{b.notes}</div> : null}
                {b.decidedReason ? <div className="small">Why: {b.decidedReason}</div> : null}
                {canChoose && b.status !== 'selected' ? (
                  <details className="fold"><summary>Select as the Winning Budget</summary>
                    <ActionForm action={selectBid} submit="Select the Winning Budget" confirm={`Make ${b.who} the approved budget? Other open bids are declined; History keeps everything.`}>
                      <input type="hidden" name="versionId" value={b.id} />
                      <label className="f">Why this one<input name="reason" required placeholder="Best price with the scope we want; Jason's schedule works" /></label>
                      <label className="check"><input type="checkbox" name="setWorking" defaultChecked /> Also set the working budget to these numbers</label>
                    </ActionForm>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
      {canEdit ? (
        <Section title="Add a Bid or Our Estimate" kind="blue">
          <details className="fold"><summary>Add one</summary>
            <ActionForm action={addBid} submit="Add" resetOnOk>
              <input type="hidden" name="projectId" value={projectId} />
              <div className="fields">
                <Choice name="bidKind" label="What It Is" options={[{ key: 'bid', label: 'A GC’s Bid' }, { key: 'ours', label: 'Our Estimate' }]} defaultValue="bid" />
                <SearchPicker name="companyId" label="From (the GC)" hint="Empty for our own estimate" placeholder="Type the GC"
                  options={[...companies.filter((c) => c.gc).map((c) => ({ id: c.id, label: c.name, sub: 'General Contractor' })), ...companies.filter((c) => !c.gc).map((c) => ({ id: c.id, label: c.name }))]} add={{ kind: 'company' }} />
                <label className="f">Name<span className="h">e.g. “Preliminary” or “Our estimate from Peyton’s costs”</span><input name="label" /></label>
                <label className="f">Dated<input type="date" name="submittedOn" /></label>
                <Choice name="contractType" label="Contract" options={[{ key: '', label: 'Not Said' }, ...contractTypes]} defaultValue="" />
                <label className="f">GC Fee %<span className="h">Cost plus, if not in the lines</span><input name="feePct" inputMode="decimal" /></label>
                <label className="f">Good Until<input type="date" name="validUntil" /></label>
                <label className="f">Who Prepared It<input name="preparedBy" /></label>
              </div>
              <label className="f">The Proposal (PDF)<input type="file" name="file" accept="application/pdf,image/*" /></label>
              <fieldset className="bid-grid"><legend className="small muted">Amounts by cost code (leave blank what isn’t in it)</legend>
                {codes.map((c) => <label key={c.id} className="f"><span className="small">{c.code} {c.name}</span><input name={`line_${c.id}`} inputMode="decimal" placeholder="0" /></label>)}
              </fieldset>
              <label className="f">Notes<textarea name="notes" rows={2} placeholder="Allowances, what’s excluded, questions to ask" /></label>
            </ActionForm>
          </details>
        </Section>
      ) : null}
    </div>
  );
}
