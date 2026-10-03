import { ActionForm } from './ActionForm';
import { Section } from './ui';
import { saveReview } from '@/app/(app)/project-actions';
import { review } from '@/lib/review';
import { cents } from '@/lib/budget';
import { formatCents, formatDateTime } from '@/lib/format';
import type { projectMoney } from '@/lib/projects';

type Money = NonNullable<Awaited<ReturnType<typeof projectMoney>>>;

export function ProjectReview({ data, canEdit }: { data: Money; canEdit: boolean }) {
  const p = data.project;
  const value = p.actualSalePrice ?? p.marketValue ?? p.proformaSalePrice;
  const basis = p.actualSalePrice ? 'sold' : p.marketValue ? 'market' : p.proformaSalePrice ? 'pro forma' : null;
  const gcIds = new Set(data.bills.filter((b) => !b.includedInBillId && /luxury|builder|construction|gc/i.test(b.vendor ?? '') && b.kind === 'invoice').map((b) => b.id));
  const counted = data.billLines.filter((l) => !l.backup && (l.kind === 'build' || l.kind === 'fee'));
  const gcBilled = counted.filter((l) => gcIds.has(l.billId)).reduce((s, l) => s + cents(l.amount), 0);
  const ownerDirect = counted.filter((l) => !gcIds.has(l.billId)).reduce((s, l) => s + cents(l.amount), 0);
  const r = review({
    value: value ? cents(value) : null, valueBasis: basis as never, sellingCostPct: Number(p.sellingCostPct ?? 0), closingAtSale: cents(p.closingCostAtSale), actualSaleCosts: p.actualSaleCosts ? cents(p.actualSaleCosts) : null,
    lotCost: cents(p.lotCost), acquisition: data.acquisition.projected, build: data.all.projected, staging: data.selling.projected, holding: data.holdingToDate,
    keptAssets: cents(p.keptAssetsValue), heatedSf: p.heatedSf, originalEstimate: p.originalEstimate ? cents(p.originalEstimate) : null,
    targetProfitPct: p.targetProfitPct ? Number(p.targetProfitPct) : 15, purchasedOn: p.purchasedOn, completedOn: p.completedOn,
    plannedExit: p.plannedExit, actualExit: p.actualExit,
    byCode: data.codes.map((c) => ({ code: c.code, name: c.name, amount: data.money.get(c.id)?.billed ?? 0, budget: data.money.get(c.id)?.budget ?? 0 })),
    gcBilled, ownerDirect,
  });
  const m = (c: number | null) => (c === null ? '—' : formatCents(c));
  const color = { good: 'aqua', warn: 'energy', bad: 'red' } as const;
  return (
    <div className="stack">
      <div className="tiles">
        <div className="tile"><div className="k">All-In Cost</div><div className="v">{m(r.allIn)}</div><div className="s">{r.perSf !== null ? `${formatCents(r.perSf, { cents: true })} / heated sf` : ''}</div></div>
        <div className="tile"><div className="k">Worth ({basis ?? '—'})</div><div className="v">{m(value ? cents(value) : null)}</div><div className="s">{r.valuePerSf !== null ? `${formatCents(r.valuePerSf, { cents: true })} / heated sf` : ''}</div></div>
        <div className="tile" style={{ borderTopColor: r.profit !== null && r.profit < 0 ? 'var(--red)' : 'var(--aqua)' }}><div className="k">Profit</div><div className="v">{r.profit === null ? '—' : r.profit < 0 ? <span className="red">−{formatCents(-r.profit)}</span> : formatCents(r.profit)}</div><div className="s">Target {m(r.target)}</div></div>
        <div className="tile"><div className="k">Could Have Paid</div><div className="v">{r.maxLot === null ? '—' : r.maxLot <= 0 ? <span className="red">Nothing</span> : m(r.maxLot)}</div><div className="s">Paid {m(cents(p.lotCost))}, at this scope and the target</div></div>
      </div>
      <Section title="What the Numbers Say" kind="blue" hint="Worked out from this project's own bills, budget, dates and value">
        <ul className="rows">{r.findings.map((f, i) => (
          <li key={i}><span className={`chip ${color[f.tone]}`}>{f.tone === 'good' ? 'Worked' : f.tone === 'warn' ? 'Watch' : 'Missed'}</span> <strong>{f.title}</strong><div>{f.detail}</div></li>
        ))}</ul>
      </Section>
      {r.top.length ? (
        <Section title="Where the Money Went" kind="blue">
          <table className="t"><tbody>{r.top.map((c) => <tr key={c.code}><td>{c.code} {c.name}</td><td className="num">{formatCents(c.amount)}</td><td className="num small muted">{r.allIn ? `${Math.round((c.amount / r.allIn) * 100)}%` : ''}</td></tr>)}</tbody></table>
        </Section>
      ) : null}
      <Section title="Lessons" kind="energy" hint={p.reviewUpdatedAt ? `Updated ${formatDateTime(p.reviewUpdatedAt)}` : 'What we should have done, even if it’s that we shouldn’t have bought'}>
        {canEdit ? (
          <ActionForm action={saveReview} submit="Save Review">
            <input type="hidden" name="projectId" value={p.id} />
            <div className="fields">
              <label className="f">Bought On<input type="date" name="purchasedOn" defaultValue={p.purchasedOn ?? ''} /></label>
              <label className="f">Finished On<input type="date" name="completedOn" defaultValue={p.completedOn ?? ''} /></label>
              <label className="f">First Estimate (Build)<input name="originalEstimate" inputMode="decimal" defaultValue={p.originalEstimate ?? ''} /></label>
              <label className="f">Target Profit %<input name="targetProfitPct" inputMode="decimal" defaultValue={p.targetProfitPct ?? '15'} /></label>
              <label className="f">Planned Exit<input name="plannedExit" defaultValue={p.plannedExit ?? ''} placeholder="Sell after the remodel" /></label>
              <label className="f">Backup Exit<input name="backupExit" defaultValue={p.backupExit ?? ''} placeholder="Rent" /></label>
              <label className="f">What We Actually Did<input name="actualExit" defaultValue={p.actualExit ?? ''} /></label>
            </div>
            <label className="f">What We Should Have Done<textarea name="reviewNotes" rows={8} defaultValue={p.reviewNotes ?? ''} placeholder="Scope, price, comps, the GC's estimate, staging, timing, the exit…" /></label>
          </ActionForm>
        ) : <p style={{ whiteSpace: 'pre-wrap' }}>{p.reviewNotes ?? 'No lessons written yet.'}</p>}
      </Section>
    </div>
  );
}
