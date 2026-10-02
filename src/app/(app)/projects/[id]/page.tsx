import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { activeStaff, companyOptions, historyFor, peopleOptions, tasksForRecord, utilitiesFor, utilityCompanyOptions } from '@/lib/contacts';
import { Utilities } from '@/components/Utilities';
import { dailyLogsFor, projectMoney } from '@/lib/projects';
import { filesFor } from '@/lib/files';
import { isUuid } from '@/lib/forms';
import { formatCents, formatDate, formatMoney, today } from '@/lib/format';
import { cents, payBlocker, type CodeMoney } from '@/lib/budget';
import { projectStages, projectStageLabel } from '@/lib/project-stages';
import { HOLDING_KINDS } from '@/lib/cost-codes';
import { lineKinds } from '@/lib/bill-lines';
import { scheduleFor } from '@/lib/schedule-data';
import { responsibleLabel } from '@/lib/schedule';
import { BudgetStages, ScheduleTab } from '@/components/ProjectSchedule';
import { ProjectReview } from '@/components/ProjectReview';
import { ProjectWebsite } from '@/components/ProjectWebsite';
import { Facts, PageHead, Section, Tabs, Tile, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { HistoryList, TaskForm, TaskRows } from '@/components/contacts';
import {
  addBill, addChangeOrder, addCommitment, addDailyLog, addHoldingCost, addItem, approveBill, markBillPaid, priceItem, saveBudget, setLienWaiver, setProjectStage,
} from '../../project-actions';

type Money = NonNullable<Awaited<ReturnType<typeof projectMoney>>>;

const m = (c: number) => formatCents(c);
const signed = (c: number) => (c < 0 ? <span className="red">−{m(-c)}</span> : m(c));

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; edit?: string }> }) {
  const user = await requirePage('projects.view');
  const { id } = await params;
  const { tab = 'overview', edit: editParam } = await searchParams;
  const data = isUuid(id) ? await projectMoney(id) : null;
  if (!data || data.project.archived) notFound();
  const { project: p } = data;
  const editProject = can(user.role, 'projects.edit');
  const seeMoney = can(user.role, 'money.view');
  const base = `/projects/${id}`;
  const openItems = data.items.filter((i) => i.status === 'unpriced');
  const sched = await scheduleFor(id);
  const missed = sched.assignments.filter((a) => a.state === 'missed');
  const tabs = [
    { key: 'overview', label: 'Overview' },
    ...(seeMoney ? [{ key: 'budget', label: 'Budget' }, { key: 'commitments', label: 'Commitments', count: data.commitments.length }, { key: 'bills', label: 'Bills', count: data.bills.length }, { key: 'holding', label: 'Holding Costs' }] : []),
    { key: 'schedule', label: 'Schedule' },
    ...(seeMoney ? [{ key: 'review', label: 'Post-Project Review' }] : []),
    { key: 'utilities', label: 'Utilities' }, { key: 'website', label: 'Website' }, { key: 'log', label: 'Daily Log' }, { key: 'tasks', label: 'Tasks' }, { key: 'history', label: 'History' },
  ];
  return (
    <>
      <PageHead eyebrow="Project" title={p.name} sub={<><span className="chip blue">{projectStageLabel(p.stage)}</span> {[p.address !== p.name ? p.address : null, p.neighborhood, p.city, p.state, p.zip].filter(Boolean).join(', ')}</>}
        actions={editProject ? <Link className="btn secondary" href={`${base}/edit`}>Edit</Link> : null} />
      <div className="record">
        <div className="card-side">
          <Section title="The House" kind="aqua">
            <Facts items={[
              ['Plan', p.plan], ['Heated SF', p.heatedSf ? p.heatedSf.toLocaleString() : null],
              ['Lot', p.lotSf ? `${p.lotSf.toLocaleString()} sf${p.lotAcres ? ` (${Number(p.lotAcres)} ac)` : ''}` : null], ['Zoning', p.zoning],
              ['Lot Cost', formatMoney(p.lotCost)], ['Lot Value', p.lotValue ? formatMoney(p.lotValue) : null],
              ['Sale Price', p.actualSalePrice ? `${formatMoney(p.actualSalePrice)} (actual)` : p.proformaSalePrice ? `${formatMoney(p.proformaSalePrice)} (pro forma)` : null],
              ['From Watchlist', p.propertyId ? <Link href={`/watchlist/${p.propertyId}`}>Open the lead</Link> : null],
            ]} />
          </Section>
          {editProject ? (
            <Section title="Stage" kind="grey">
              <div className="chips">{projectStages.map((s) => (
                <form key={s.key} action={setProjectStage.bind(null, id, s.key)}>
                  <button type="submit" className={`btn small ${p.stage === s.key ? '' : 'secondary'}`} aria-pressed={p.stage === s.key}>{s.label}</button>
                </form>
              ))}</div>
            </Section>
          ) : null}
        </div>
        <div>
          <Tabs base={base} current={tab} tabs={tabs} />
          {missed.length && tab !== 'schedule' ? <div className="notice error"><strong>{missed.length} missed {missed.length === 1 ? 'commitment' : 'commitments'}</strong>: {missed.map((a) => `${a.description} (${a.who ?? responsibleLabel(a.responsible)})`).join('; ')}. <Link href={`${base}?tab=schedule`}>Schedule</Link></div> : null}
          {tab === 'overview' ? <Overview data={data} seeMoney={seeMoney} openItems={openItems.length} edit={editProject} /> : null}
          {tab === 'budget' && seeMoney ? <><BudgetStages projectId={id} codes={data.codes} current={new Map(data.codes.map((c) => [c.id, data.money.get(c.id)?.budget ?? 0]))} sched={sched} canEdit={editProject} canApprove={can(user.role, 'users.manage')} /><Budget data={data} edit={editProject && editParam === '1'} canEdit={editProject} /></> : null}
          {tab === 'commitments' && seeMoney ? <Commitments data={data} edit={editProject} /> : null}
          {tab === 'bills' && seeMoney ? <Bills data={data} role={user.role} /> : null}
          {tab === 'holding' && seeMoney ? <Holding data={data} edit={can(user.role, 'bills.edit')} /> : null}
          {tab === 'schedule' ? <ScheduleTab projectId={id} sched={sched} codes={data.codes} companies={await companyOptions()} people={await peopleOptions()} canEdit={editProject} /> : null}
          {tab === 'review' && seeMoney ? <ProjectReview data={data} canEdit={editProject} /> : null}
          {tab === 'utilities' ? <Utilities projectId={id} rows={await utilitiesFor(id)} companies={await utilityCompanyOptions()} people={await peopleOptions()} canEdit={editProject} /> : null}
          {tab === 'website' ? <ProjectWebsite p={p} canEdit={editProject} /> : null}
          {tab === 'log' ? <DailyLog id={id} edit={editProject} /> : null}
          {tab === 'tasks' ? (
            <div className="stack">
              <Section title="Tasks" kind="energy"><TaskRows items={await tasksForRecord('projectId', id)} /></Section>
              {editProject ? <Section title="Add a Task" kind="energy"><TaskForm projectId={id} staff={await activeStaff()} me={user.id} /></Section> : null}
            </div>
          ) : null}
          {tab === 'history' ? <Section title="History" kind="grey"><HistoryList rows={await historyFor('project', id)} /></Section> : null}
        </div>
      </div>
    </>
  );
}

function Overview({ data, seeMoney, openItems, edit }: { data: Money; seeMoney: boolean; openItems: number; edit: boolean }) {
  const { pnl, all, project: p } = data;
  if (!seeMoney) return <Section title="Project" kind="blue"><p className="muted">Money is visible to the owner, staff and the accountant.</p></Section>;
  const usedPct = all.budget ? Math.min(100, Math.round((Math.max(all.committed, all.billed) / all.budget) * 100)) : 0;
  return (
    <div className="stack">
      <div className="tiles">
        <Tile k="Build Budget" v={m(all.budget)} s={p.heatedSf ? `${formatCents(Math.round(all.budget / p.heatedSf), { cents: true })} / heated sf` : undefined} />
        <Tile k="Committed" v={m(all.committed)} s={<div className="bar" aria-hidden="true"><span className={all.over ? 'over' : ''} style={{ width: `${usedPct}%` }} /></div>} />
        <Tile k="Billed / Paid" v={`${m(all.billed)}`} s={`${m(all.paid)} paid`} />
        {all.budget ? <Tile k="Left in Budget" v={signed(all.left)} color={all.left < 0 ? 'var(--red)' : undefined} /> : <Tile k="Budget" v="—" s="No budget set (costs are from the bills)" />}
        {pnl.projected.sale ? (
          <Tile k="Projected Profit" v={signed(pnl.projected.profit)} s={pnl.projected.margin !== null ? `${pnl.projected.margin}% of sale` : undefined} color={pnl.projected.profit < 0 ? 'var(--red)' : 'var(--aqua)'} />
        ) : pnl.market ? (
          <Tile k="At Market Value" v={signed(pnl.market.profit)} s={`If sold at ${m(pnl.market.value)}`} color={pnl.market.profit < 0 ? 'var(--red)' : 'var(--aqua)'} />
        ) : <Tile k="Projected Profit" v="—" s="Set a sale price or market value" />}
      </div>
      {pnl.market ? (
        <div className={`notice ${pnl.market.overbuilt ? 'error' : ''}`}>
          <strong>Market check:</strong> worth about {m(pnl.market.value)} today{p.marketValueOn ? ` (${formatDate(p.marketValueOn)}${p.marketValueSource ? `, ${p.marketValueSource}` : ''})` : ''}; after commissions that nets {m(pnl.market.net)} against an all-in cost of {m(pnl.market.allIn)}.{' '}
          {pnl.market.overbuilt ? <strong>Over-built: {signed(pnl.market.profit)} at today's value.</strong> : <>That leaves {m(pnl.market.profit)}.</>}
        </div>
      ) : <div className="notice warn">No market value yet: add what the finished house would sell for today (Edit → Market Check) to catch over-building.</div>}
      {openItems ? <div className="notice warn">{openItems} {openItems === 1 ? 'item isn’t' : 'items aren’t'} priced yet (see Budget → Not Priced Yet). They’re not in the numbers.</div> : null}
      <Section title="Profit and Loss" kind="blue" hint="Pro forma vs what it's tracking to now">
        <div className="table-wrap"><table className="t">
          <thead><tr><th></th><th className="num">Pro Forma</th><th className="num">Projected</th><th className="num">Actual to Date</th></tr></thead>
          <tbody>
            <tr><td>Sale price</td><td className="num">{m(pnl.proforma.sale)}</td><td className="num">{m(pnl.projected.sale)}</td><td className="num">{p.actualSalePrice ? formatMoney(p.actualSalePrice) : '—'}</td></tr>
            <tr><td>Selling costs ({Number(p.sellingCostPct ?? 0)}%)</td><td className="num">−{m(pnl.proforma.selling)}</td><td className="num">−{m(pnl.projected.selling)}</td><td className="num">—</td></tr>
            <tr><td>Staging, listing and marketing</td><td className="num">−{m(pnl.proforma.staging)}</td><td className="num">−{m(pnl.projected.staging)}</td><td className="num">{m(pnl.projected.staging)}</td></tr>
            <tr><td>Lot (with closing costs)</td><td className="num">−{m(pnl.proforma.lot)}</td><td className="num">−{m(pnl.projected.lot)}</td><td className="num">{m(pnl.actualToDate.lot)}</td></tr>
            <tr><td>Build</td><td className="num">−{m(pnl.proforma.build)}</td><td className="num">−{m(pnl.projected.build)}</td><td className="num">{m(pnl.actualToDate.build)} billed</td></tr>
            <tr><td>Holding costs</td><td className="num">—</td><td className="num">−{m(pnl.projected.holding)}</td><td className="num">{m(pnl.actualToDate.holding)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td>Profit</td><td className="num">{signed(pnl.proforma.profit)}</td><td className="num">{signed(pnl.projected.profit)}</td><td className="num">Spent {m(pnl.actualToDate.total)}</td></tr>
            <tr><td>All-in per heated sf</td><td className="num">{pnl.proforma.perSf !== null ? formatCents(pnl.proforma.perSf, { cents: true }) : '—'}</td><td className="num">{pnl.projected.perSf !== null ? formatCents(pnl.projected.perSf, { cents: true }) : '—'}</td><td className="num">{pnl.actualToDate.buildPerSf !== null ? `${formatCents(pnl.actualToDate.buildPerSf, { cents: true })} build` : '—'}</td></tr>
          </tfoot>
        </table></div>
        <p className="small muted" style={{ marginBottom: 0 }}>Projected uses, for each cost code, the largest of its budget, what's committed and what's billed. {edit ? <Link href={`/projects/${p.id}/edit`}>Change the sale price or selling costs</Link> : null}</p>
      </Section>
      {data.scenarios.length ? (
        <Section title="Sale Scenarios" kind="blue" hint="High / Mid / Low, as in your project sheets">
          <div className="table-wrap"><table className="t">
            <thead><tr><th></th>{data.scenarios.map((x) => <th key={x.label} className="num">{x.label}</th>)}</tr></thead>
            <tbody>
              <tr><td>Sale price</td>{data.scenarios.map((x) => <td key={x.label} className="num">{m(x.sale)}</td>)}</tr>
              <tr><td>Commissions ({Number(p.sellingCostPct ?? 0)}%)</td>{data.scenarios.map((x) => <td key={x.label} className="num">−{m(x.commissions)}</td>)}</tr>
              <tr><td>Closing cost at sale</td>{data.scenarios.map((x) => <td key={x.label} className="num">−{m(x.closing)}</td>)}</tr>
              <tr><td>All-in cost{p.keptAssetsValue ? ` (less ${formatMoney(p.keptAssetsValue)} we keep)` : ''}</td>{data.scenarios.map((x) => <td key={x.label} className="num">−{m(x.allIn)}</td>)}</tr>
            </tbody>
            <tfoot>
              <tr><td>Profit before tax</td>{data.scenarios.map((x) => <td key={x.label} className="num">{signed(x.profit)}{x.profitPct !== null ? <div className="small">{x.profitPct}%</div> : null}</td>)}</tr>
              {data.scenarios[0].afterTax !== null ? <tr><td>After tax ({Number(p.taxRatePct)}%)</td>{data.scenarios.map((x) => <td key={x.label} className="num">{signed(x.afterTax ?? 0)}</td>)}</tr> : null}
            </tfoot>
          </table></div>
          <p className="small muted" style={{ marginBottom: 0 }}>All-in = lot, closing and due diligence costs, the build (largest of budget, committed and billed per code), holding costs and staging.</p>
        </Section>
      ) : null}
      {p.notes ? <Section title="Notes" kind="energy"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.notes}</p></Section> : null}
    </div>
  );
}

function Budget({ data, edit, canEdit }: { data: Money; edit: boolean; canEdit: boolean }) {
  const { codes, money, lines, all, construction, items } = data;
  const row = (c: (typeof codes)[number], r: CodeMoney) => {
    const l = lines.get(c.id);
    return (
      <tr key={c.id} className={r.over ? 'over' : undefined}>
        <td>{c.code} {c.name}{l?.notes ? <div className="small muted">{l.notes}</div> : null}</td>
        <td className="num">{edit ? (
          <span className="inline-form">
            <input aria-label={`${c.name} budget`} name={`amount.${c.id}`} defaultValue={l?.amount ?? ''} inputMode="decimal" style={{ width: 110, textAlign: 'right' }} disabled={!!l?.percentOfConstruction} />
            <input aria-label={`${c.name} percent of construction`} name={`pct.${c.id}`} defaultValue={l?.percentOfConstruction ?? ''} inputMode="decimal" placeholder="%" style={{ width: 64, textAlign: 'right' }} />
            <input type="hidden" name={`notes.${c.id}`} value={l?.notes ?? ''} />
          </span>
        ) : null}
          <div>{m(r.budget)}{l?.percentOfConstruction ? <span className="small muted"> ({Number(l.percentOfConstruction)}%)</span> : null}</div>
        </td>
        <td className="num">{m(r.committed)}</td>
        <td className="num">{m(r.billed)}</td>
        <td className="num">{m(r.paid)}</td>
        <td className="num">{signed(r.left)}</td>
      </tr>
    );
  };
  const table = (
    <div className="table-wrap"><table className="t">
      <thead><tr><th>Cost Code</th><th className="num">Budget</th><th className="num">Committed</th><th className="num">Billed</th><th className="num">Paid</th><th className="num">Left</th></tr></thead>
      <tbody>
        {codes.filter((c) => c.kind === 'construction').map((c) => row(c, money.get(c.id)!))}
        <tr><td><strong>Construction subtotal</strong></td><td className="num"><strong>{m(construction.budget)}</strong></td><td className="num">{m(construction.committed)}</td><td className="num">{m(construction.billed)}</td><td className="num">{m(construction.paid)}</td><td className="num">{signed(construction.left)}</td></tr>
        {codes.filter((c) => c.kind === 'soft').map((c) => row(c, money.get(c.id)!))}
      </tbody>
      <tfoot><tr><td>Total build</td><td className="num">{m(all.budget)}</td><td className="num">{m(all.committed)}</td><td className="num">{m(all.billed)}</td><td className="num">{m(all.paid)}</td><td className="num">{signed(all.left)}</td></tr></tfoot>
      <tbody>
        <tr><td colSpan={6} className="small muted"><strong>Outside the build:</strong> due diligence and closing costs count with the lot; staging and listing with selling.</td></tr>
        {codes.filter((c) => c.kind === 'acquisition' || c.kind === 'selling').map((c) => row(c, money.get(c.id)!))}
      </tbody>
    </table></div>
  );
  return (
    <div className="stack">
      <Section title="Budget by Cost Code" kind="blue" hint="Red rows are over budget. A percent line is that percent of the construction subtotal."
        actions={canEdit ? (edit ? <Link className="btn small secondary" href={`/projects/${data.project.id}?tab=budget`}>Done Editing</Link> : <Link className="btn small" href={`/projects/${data.project.id}?tab=budget&edit=1`}>Edit Budget</Link>) : null}>
        {edit ? (
          <ActionForm action={saveBudget} submit="Save Budget" className="">
            <input type="hidden" name="projectId" value={data.project.id} />
            {table}
          </ActionForm>
        ) : table}
      </Section>
      <Section title="Not Priced Yet" kind="energy" hint="On the plans, not in the budget">
        {items.length ? (
          <ul className="rows">{items.map((it) => (
            <li key={it.id}>
              <strong>{it.description}</strong>{' '}
              {it.status === 'unpriced' ? <span className="chip red">Not priced</span> : it.status === 'not_doing' ? <span className="chip">Not doing</span> : <span className="chip aqua">{formatMoney(it.estimate)}</span>}
              {canEdit ? (
                <details className="fold"><summary>Price It</summary>
                  <ActionForm action={priceItem} submit="Save" className="inline-form">
                    <input type="hidden" name="id" value={it.id} />
                    <input name="estimate" defaultValue={it.estimate ?? ''} placeholder="Estimate" inputMode="decimal" aria-label="Estimate" />
                    <label className="check"><input type="checkbox" name="notDoing" defaultChecked={it.status === 'not_doing'} /> Not doing it</label>
                  </ActionForm>
                </details>
              ) : null}
            </li>
          ))}</ul>
        ) : <Empty>Nothing waiting to be priced.</Empty>}
        {canEdit ? (
          <details className="fold" style={{ marginTop: 8 }}><summary>Add an Item</summary>
            <ActionForm action={addItem} submit="Add" resetOnOk>
              <input type="hidden" name="projectId" value={data.project.id} />
              <div className="fields">
                <label className="f">What<input name="description" required /></label>
                <label className="f">Cost Code<select name="costCodeId" defaultValue=""><option value="">—</option>{codes.map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}</select></label>
                <label className="f">Estimate<span className="h">Blank = not priced yet</span><input name="estimate" inputMode="decimal" /></label>
              </div>
            </ActionForm>
          </details>
        ) : null}
        <p className="small muted" style={{ marginBottom: 0 }}>Priced items show here for the decision; add them into a cost code's budget when you commit to them.</p>
      </Section>
    </div>
  );
}

async function Commitments({ data, edit }: { data: Money; edit: boolean }) {
  const { codes, commitments, changeOrders } = data;
  const [companies, people] = edit ? await Promise.all([companyOptions(), peopleOptions()]) : [[], []];
  const codeName = (id: string) => { const c = codes.find((x) => x.id === id); return c ? `${c.code} ${c.name}` : ''; };
  return (
    <div className="stack">
      <Section title="Vendor Commitments" kind="blue" hint="Contracts and accepted bids, with their change orders">
        {commitments.length ? (
          <ul className="rows">{commitments.map((c) => {
            const orders = changeOrders.filter((o) => o.commitmentId === c.id);
            const total = cents(c.amount) + orders.reduce((s, o) => s + cents(o.amount), 0);
            const billed = data.bills.filter((b) => b.commitmentId === c.id).reduce((s, b) => s + cents(b.amount), 0);
            return (
              <li key={c.id}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <strong style={{ flex: 1 }}>{c.vendorCompanyId ? <Link href={`/companies/${c.vendorCompanyId}`}>{c.vendor}</Link> : c.vendorPersonId ? <Link href={`/people/${c.vendorPersonId}`}>{c.vendor}</Link> : c.vendor}</strong>
                  <span className="small muted">{codeName(c.costCodeId)}</span>
                  <span className="num"><strong>{m(total)}</strong>{orders.length ? <span className="small muted"> ({m(cents(c.amount))} + {orders.length} change order{orders.length === 1 ? '' : 's'})</span> : null}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }} className="small">{c.scope}</div>
                <div className="small muted">Billed {m(billed)} of {m(total)}{c.retainagePct ? ` · ${Number(c.retainagePct)}% retainage` : ''}{c.signedOn ? ` · signed ${formatDate(c.signedOn)}` : ''}</div>
                {orders.length ? <ul className="small">{orders.map((o) => <li key={o.id}>{o.description}: {signed(cents(o.amount))}{o.approvedOn ? ` (${formatDate(o.approvedOn)})` : ''}</li>)}</ul> : null}
                {edit ? (
                  <details className="fold"><summary>Add a Change Order</summary>
                    <ActionForm action={addChangeOrder} submit="Add Change Order" resetOnOk>
                      <input type="hidden" name="commitmentId" value={c.id} />
                      <div className="fields">
                        <label className="f">What Changed<input name="description" required /></label>
                        <label className="f">Amount<span className="h">Negative for a credit</span><input name="amount" required inputMode="decimal" /></label>
                        <label className="f">Approved On<input type="date" name="approvedOn" defaultValue={today()} /></label>
                      </div>
                    </ActionForm>
                  </details>
                ) : null}
              </li>
            );
          })}</ul>
        ) : <Empty>No commitments yet.</Empty>}
      </Section>
      {edit ? (
        <Section title="Add a Commitment" kind="blue">
          <ActionForm action={addCommitment} submit="Add Commitment" resetOnOk>
            <input type="hidden" name="projectId" value={data.project.id} />
            <div className="fields">
              <label className="f">Cost Code<select name="costCodeId" required defaultValue=""><option value="" disabled>Pick one</option>{codes.map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}</select></label>
              <label className="f">Vendor (Company)<select name="vendorCompanyId" defaultValue=""><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="f">Or Vendor (Person)<select name="vendorPersonId" defaultValue=""><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label className="f">Amount<input name="amount" required inputMode="decimal" /></label>
              <label className="f">Retainage %<input name="retainagePct" inputMode="decimal" placeholder="10" /></label>
              <label className="f">Signed On<input type="date" name="signedOn" /></label>
            </div>
            <label className="f">Scope of Work<textarea name="scope" required placeholder="What's included, what isn't, materials or labor only" /></label>
            <p className="small muted">Vendor not on file? <Link href="/companies/new?role=sub">Add the company</Link> first.</p>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}

const BILL_ROWS = 25;
const kindChip = (k: string) => k === 'receipt' ? <span className="chip">Receipt</span> : k === 'credit' ? <span className="chip energy">Credit</span> : null;

async function Bills({ data, role }: { data: Money; role: Parameters<typeof can>[0] }) {
  const { codes, bills, commitments, billLines } = data;
  const canAdd = can(role, 'bills.edit');
  const [companies] = canAdd ? await Promise.all([companyOptions()]) : [[]];
  const codeName = (id: string | null) => { const c = codes.find((x) => x.id === id); return c ? `${c.code} ${c.name}` : ''; };
  const statusChip = (s: string) => s === 'paid' ? <span className="chip aqua">Paid</span> : s === 'approved' ? <span className="chip blue">Approved</span> : <span className="chip">Entered</span>;
  const main = bills.filter((b) => !b.includedInBillId);
  const backupFor = (id: string) => bills.filter((b) => b.includedInBillId === id);
  const lineLabel = (l: (typeof billLines)[number]) =>
    l.kind === 'holding' ? `Holding: ${l.holdingKind}` : l.kind === 'not_project' ? 'Not for this project' : `${codeName(l.costCodeId)}${l.kind === 'fee' ? ' (GC fee)' : ''}`;
  const rowsFor = (id: string) => billLines.filter((l) => l.billId === id);
  return (
    <div className="stack">
      <Section title="Bills" kind="blue" hint="Paid needs an approval, and a lien waiver from subs and GCs. Vendor invoices behind a GC's bill are backup: shown, never counted twice.">
        {main.length ? (
          <ul className="rows">{main.map((b) => {
            const blocker = payBlocker(b);
            const lines = rowsFor(b.id);
            const backups = backupFor(b.id);
            return (
              <li key={b.id}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <strong style={{ flex: 1 }}>{b.vendor ?? 'Unknown vendor'}{b.invoiceNumber ? ` #${b.invoiceNumber}` : ''}</strong>
                  {kindChip(b.kind)}{statusChip(b.status)}
                  {b.lienWaiverRequired ? <span className={`chip ${b.lienWaiverReceived ? 'aqua' : 'red'}`}>{b.lienWaiverReceived ? 'Lien waiver in' : 'No lien waiver'}</span> : <span className="chip">No waiver needed</span>}
                  <strong className="num">{formatMoney(b.amount, { cents: true })}</strong>
                </div>
                <div className="small muted">{formatDate(b.invoiceOn)}{b.dueOn ? ` · due ${formatDate(b.dueOn)}` : ''}{b.billedTo ? ` · billed to ${b.billedTo}` : ''}{b.retainage ? ` · ${formatMoney(b.retainage, { cents: true })} retainage held` : ''}{b.approvedByName ? ` · approved by ${b.approvedByName}` : ''}{b.paidOn ? ` · paid ${formatDate(b.paidOn)}${b.paidHow ? ` (${b.paidHow})` : ''}` : ''}</div>
                {lines.length > 1 || lines[0]?.kind !== 'build' || lines[0]?.description ? (
                  <table className="t small" style={{ marginTop: 6 }}><tbody>{lines.map((l) => (
                    <tr key={l.id}><td>{l.description ?? ''}</td><td>{lineLabel(l)}</td><td className="num">{formatMoney(l.amount, { cents: true })}</td></tr>
                  ))}</tbody></table>
                ) : <div className="small">{lineLabel(lines[0])}</div>}
                {backups.length ? (
                  <details className="fold"><summary>Backup: {backups.length} vendor {backups.length === 1 ? 'invoice' : 'invoices'} ({formatMoney(backups.reduce((s, x) => s + Number(x.amount), 0), { cents: true })})</summary>
                    <ul className="small">{backups.map((x) => <li key={x.id}>{x.vendor}{x.invoiceNumber ? ` #${x.invoiceNumber}` : ''}, {formatDate(x.invoiceOn)}: {formatMoney(x.amount, { cents: true })}{x.fileId ? <> · <a href={`/files/${x.fileId}?inline=1`} target="_blank" rel="noreferrer">open</a></> : null}</li>)}</ul>
                  </details>
                ) : null}
                {b.notes ? <div className="small">{b.notes}</div> : null}
                <div className="form-actions" style={{ marginTop: 6 }}>
                  {b.fileId ? <a className="btn small secondary" href={`/files/${b.fileId}?inline=1`} target="_blank" rel="noreferrer">Open the Bill</a> : null}
                  {b.status === 'entered' && can(role, 'bills.approve') ? <form action={approveBill.bind(null, b.id)}><button className="btn small" type="submit">Approve</button></form> : null}
                  {b.status !== 'paid' && b.lienWaiverRequired && canAdd ? <form action={setLienWaiver.bind(null, b.id, !b.lienWaiverReceived)}><button className="btn small secondary" type="submit">{b.lienWaiverReceived ? 'Lien Waiver Not In' : 'Lien Waiver Received'}</button></form> : null}
                </div>
                {b.status !== 'paid' && can(role, 'bills.pay') ? (
                  blocker ? <p className="small amber" style={{ margin: '6px 0 0' }}>{blocker}</p> : (
                    <ActionForm action={markBillPaid} submit={b.kind === 'credit' ? 'Mark Applied' : 'Mark Paid'} className="inline-form" submitClass="btn small">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="date" name="paidOn" defaultValue={today()} aria-label="Paid on" />
                      <input name="paidHow" placeholder="Check 1042, ACH, AmEx…" aria-label="How it was paid" />
                    </ActionForm>
                  )
                ) : null}
              </li>
            );
          })}</ul>
        ) : <Empty>No bills yet.</Empty>}
      </Section>
      {canAdd ? (
        <Section title="Enter a Bill" kind="blue" hint="Split it across cost codes. Reading invoices for you comes in phase 2.">
          <ActionForm action={addBill} submit="Save Bill" resetOnOk>
            <input type="hidden" name="projectId" value={data.project.id} />
            <div className="fields">
              <label className="f">What It Is<select name="kind" defaultValue="invoice"><option value="invoice">Invoice (to pay)</option><option value="receipt">Receipt (already paid)</option><option value="credit">Credit / Return</option></select></label>
              <label className="f">Vendor (Company)<select name="vendorCompanyId" defaultValue=""><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="f">Or Vendor Name<input name="vendorName" placeholder="Lowe's, Home Depot…" /></label>
              <label className="f">Invoice #<input name="invoiceNumber" /></label>
              <label className="f">Invoice Date<input type="date" name="invoiceOn" defaultValue={today()} required /></label>
              <label className="f">Due<input type="date" name="dueOn" /></label>
              <label className="f">Billed To<span className="h">If not us (e.g. the GC)</span><input name="billedTo" /></label>
              <label className="f">Against a Commitment<select name="commitmentId" defaultValue=""><option value="">None</option>{commitments.map((c) => <option key={c.id} value={c.id}>{c.vendor}: {c.scope.slice(0, 40)}</option>)}</select></label>
              <label className="f">Backup For (a GC Bill)<span className="h">Shown with it, not counted again</span><select name="includedInBillId" defaultValue=""><option value="">No: count this bill</option>{main.filter((b) => b.kind === 'invoice').map((b) => <option key={b.id} value={b.id}>{b.vendor}{b.invoiceNumber ? ` #${b.invoiceNumber}` : ''} ({formatMoney(b.amount)})</option>)}</select></label>
              <label className="f">Retainage Held<input name="retainage" inputMode="decimal" /></label>
              <label className="f">Paid How<span className="h">For receipts</span><input name="paidHow" placeholder="AmEx, Check 1042" /></label>
              <label className="f">The Bill (PDF or Photo)<input type="file" name="file" accept="application/pdf,image/*" /></label>
            </div>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>#</th><th>Description</th><th>Kind</th><th>Cost Code</th><th>Holding</th><th className="num">Amount</th></tr></thead>
              <tbody>{Array.from({ length: BILL_ROWS }, (_, i) => (
                <tr key={i} className={i >= 3 ? 'extra-line' : undefined}>
                  <td className="small muted">{i + 1}</td>
                  <td><input name={`line.${i}.description`} aria-label={`Line ${i + 1} description`} /></td>
                  <td><select name={`line.${i}.kind`} defaultValue="build" aria-label={`Line ${i + 1} kind`}>{lineKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></td>
                  <td><select name={`line.${i}.costCodeId`} defaultValue="" aria-label={`Line ${i + 1} cost code`}><option value="">—</option>{codes.map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}</select></td>
                  <td><select name={`line.${i}.holdingKind`} defaultValue="" aria-label={`Line ${i + 1} holding kind`}><option value="">—</option>{HOLDING_KINDS.map((k) => <option key={k}>{k}</option>)}</select></td>
                  <td><input name={`line.${i}.amount`} inputMode="decimal" aria-label={`Line ${i + 1} amount`} style={{ width: 110, textAlign: 'right' }} /></td>
                </tr>
              ))}</tbody>
            </table></div>
            <p className="small muted">Blank lines are skipped. A credit's amounts are typed positive. Utilities go in as Holding; a TV or anything personal as Not for This Project.</p>
            <label className="check"><input type="checkbox" name="noLienWaiver" /> No lien waiver needed (a store or supplier, not a sub or GC)</label>
            <label className="check"><input type="checkbox" name="lienWaiverReceived" /> Lien waiver received</label>
            <label className="f">Notes<input name="notes" /></label>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}

function Holding({ data, edit }: { data: Money; edit: boolean }) {
  return (
    <div className="stack">
      <Section title="Holding Costs" kind="blue" hint={`${m(data.holdingToDate)} so far: interest, taxes, insurance, utilities`}>
        {data.holding.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Date</th><th>What</th><th>Notes</th><th className="num">Amount</th></tr></thead>
            <tbody>{data.holding.map((h) => <tr key={h.id}><td>{formatDate(h.incurredOn)}</td><td>{h.kind}</td><td>{h.notes}</td><td className="num">{formatMoney(h.amount, { cents: true })}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}>Total</td><td className="num">{formatCents(data.holdingToDate, { cents: true })}</td></tr></tfoot>
          </table></div>
        ) : <Empty>No holding costs yet.</Empty>}
      </Section>
      {edit ? (
        <Section title="Add a Holding Cost" kind="blue">
          <ActionForm action={addHoldingCost} submit="Add" resetOnOk>
            <input type="hidden" name="projectId" value={data.project.id} />
            <div className="fields">
              <label className="f">What<select name="kind" defaultValue="Interest">{HOLDING_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
              <label className="f">Date<input type="date" name="incurredOn" defaultValue={today()} required /></label>
              <label className="f">Amount<input name="amount" required inputMode="decimal" /></label>
              <label className="f">Notes<input name="notes" /></label>
            </div>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}

async function DailyLog({ id, edit }: { id: string; edit: boolean }) {
  const logs = await dailyLogsFor(id);
  const photos = await Promise.all(logs.map((l) => filesFor('daily_log', l.id)));
  return (
    <div className="stack">
      {edit ? (
        <Section title="Log Today" kind="energy">
          <ActionForm action={addDailyLog} submit="Save Log" resetOnOk>
            <input type="hidden" name="projectId" value={id} />
            <div className="fields">
              <label className="f">Date<input type="date" name="loggedOn" defaultValue={today()} max={today()} /></label>
              <label className="f">Who Was on Site<input name="onSite" placeholder="Framing crew (4), plumber" /></label>
              <label className="f">Weather<input name="weather" /></label>
            </div>
            <label className="f">What Got Done<textarea name="work" required /></label>
            <label className="f">Photos<span className="h">Up to 6, 4 MB each</span><input type="file" name="photos" accept="image/*" multiple /></label>
          </ActionForm>
        </Section>
      ) : null}
      <Section title="Daily Log" kind="grey" hint={`${logs.length}`}>
        {logs.length ? (
          <ul className="rows">{logs.map((l, i) => (
            <li key={l.id}>
              <div><strong>{formatDate(l.loggedOn)}</strong> <span className="small muted">{l.userName}{l.weather ? ` · ${l.weather}` : ''}</span></div>
              {l.onSite ? <div className="small">On site: {l.onSite}</div> : null}
              <div style={{ whiteSpace: 'pre-wrap' }}>{l.work}</div>
              {photos[i].length ? <div className="photos" style={{ marginTop: 8 }}>{photos[i].map((f) => <a key={f.id} href={`/files/${f.id}`}><img src={`/files/${f.id}`} alt={f.name} loading="lazy" /></a>)}</div> : null}
            </li>
          ))}</ul>
        ) : <Empty>Nothing logged yet.</Empty>}
      </Section>
    </div>
  );
}
