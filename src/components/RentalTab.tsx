import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Empty, Facts, Section, Tile } from './ui';
import { Phone } from './Phone';
import { addLease, addRentReceipt, endLease, saveLoan, saveRental } from '@/app/(app)/rental-actions';
import { breakEvenRent, leaseAlerts, monthly, rentByMonth, rentalStatusLabel, rentalStatuses, verdict, yearly } from '@/lib/rentals';
import { cents } from '@/lib/budget';
import { formatCents, formatDate, today } from '@/lib/format';
import type { rentalFor } from '@/lib/rental-data';

type Data = Awaited<ReturnType<typeof rentalFor>>;
type Opt = { id: string; name: string };
const m = (c: number) => formatCents(c);
const pctText = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`);
const num = (v: string | null | undefined) => (v == null ? '' : String(Number(v)));

/** A rented property: status, lease, manager, loan, rent in, and whether it makes money. */
export function RentalTab({ projectId, data, allIn, marketValue, companies, people, canEdit, canMoney }: {
  projectId: string; data: Data; allIn: number; marketValue: number | null; companies: Opt[]; people: (Opt & { companyName: string | null })[]; canEdit: boolean; canMoney: boolean;
}) {
  const r = data.rental?.r ?? null;
  const lease = data.leases.find((l) => l.status === 'active') ?? null;
  const rent = lease ? cents(lease.rent) : cents(r?.askingRent ?? null);
  const inputs = {
    rent, managementFeePct: Number(r?.managementFeePct ?? 0), repairsReservePct: Number(r?.repairsReservePct ?? 0), vacancyPct: Number(r?.vacancyPct ?? 0),
    taxes: cents(r?.taxesMonthly ?? null), insurance: cents(r?.insuranceMonthly ?? null), hoa: cents(r?.hoaMonthly ?? null), utilities: cents(r?.utilitiesMonthly ?? null),
    loanPayment: data.loans.reduce((s, l) => s + cents(l.monthlyPayment), 0), escrowIncluded: data.loans.some((l) => l.escrowIncluded),
  };
  const mo = monthly(inputs);
  const loanOriginal = data.loans.reduce((s, l) => s + cents(l.originalAmount), 0);
  const yr = yearly(mo, allIn, loanOriginal, marketValue);
  const v = verdict(mo.cashFlow, yr.dscr);
  const be = breakEvenRent(inputs);
  const months = lease ? rentByMonth({ rent: cents(lease.rent), startsOn: lease.startsOn, endsOn: lease.endsOn }, data.receipts.map((x) => ({ forMonth: x.forMonth, receivedOn: x.receivedOn, kind: x.kind, amount: cents(x.amount) })), today()) : [];
  const short = months.filter((x) => x.received < x.expected);
  const alerts = lease ? leaseAlerts(lease, today()) : [];
  const workTotal = data.whileRented.reduce((s, b) => s + cents(b.amount), 0);
  const companyOpts = (name: string, value: string | null) => (
    <select name={name} defaultValue={value ?? ''}><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
  );
  return (
    <div className="stack">
      {canMoney ? (
        <Section title="Is It Making Money?" kind="blue" hint={lease ? `On the lease’s rent of ${m(rent)}` : r?.askingRent ? `On the asking rent of ${m(rent)}` : 'Enter the rent to see it'}>
          {rent ? (
            <>
              <div className={`notice ${v.tone === 'bad' ? 'error' : v.tone === 'warn' ? 'warn' : ''}`}><strong>{v.text}:</strong> {mo.cashFlow < 0 ? '−' : ''}{m(Math.abs(mo.cashFlow))} a month, {mo.cashFlow < 0 ? '−' : ''}{m(Math.abs(yr.cashFlow))} a year.{be ? ` Break-even rent: ${m(be)} a month.` : ''}</div>
              <div className="tiles">
                <Tile k="Cash Flow / Month" v={m(mo.cashFlow)} color={mo.cashFlow < 0 ? 'var(--red)' : undefined} />
                <Tile k="NOI / Year" v={m(yr.noi)} s="before the loan" />
                <Tile k="Cap Rate" v={pctText(yr.capRate)} s={yr.capRateOnValue !== null ? `${pctText(yr.capRateOnValue)} on market value` : 'on what we put in'} />
                <Tile k="Cash-on-Cash" v={pctText(yr.cashOnCash)} s="cash flow ÷ cash we put in" />
                <Tile k="DSCR" v={yr.dscr === null ? 'No loan' : `${yr.dscr.toFixed(2)}×`} s="banks want 1.2× or more" />
              </div>
              <table className="t" style={{ marginTop: 10 }}>
                <tbody>
                  <tr><td>Rent</td><td className="num">{m(mo.rent)}</td></tr>
                  <tr><td>Vacancy ({inputs.vacancyPct}%)</td><td className="num">−{m(mo.vacancy)}</td></tr>
                  <tr><td>Management ({inputs.managementFeePct}%)</td><td className="num">−{m(mo.management)}</td></tr>
                  <tr><td>Repairs reserve ({inputs.repairsReservePct}%)</td><td className="num">−{m(mo.repairs)}</td></tr>
                  <tr><td>Taxes, insurance, HOA, utilities</td><td className="num">−{m(mo.taxes + mo.insurance + mo.hoa + mo.utilities)}</td></tr>
                  <tr><th>NOI</th><th className="num">{m(mo.noi)}</th></tr>
                  <tr><td>Loan payment{inputs.escrowIncluded ? ' (taxes and insurance in escrow, counted above)' : ''}</td><td className="num">−{m(mo.debt)}</td></tr>
                  <tr><th>Cash flow</th><th className={`num ${mo.cashFlow < 0 ? 'red' : ''}`}>{m(mo.cashFlow)}</th></tr>
                </tbody>
              </table>
              <p className="small muted">All-in cost {m(allIn)}{loanOriginal ? `, loan ${m(loanOriginal)}, so ${m(Math.max(0, allIn - loanOriginal))} of our cash` : ''}. Costs are the monthly estimates below until actuals replace them.</p>
            </>
          ) : <Empty>No rent yet: add the lease, or an asking rent below.</Empty>}
        </Section>
      ) : null}

      <Section title="Status and Property Manager" kind="aqua" hint={r ? rentalStatusLabel(r.status) : 'Not set up yet'}>
        {r ? (
          <Facts items={[
            ['Status', rentalStatusLabel(r.status)],
            ['Asking Rent', r.askingRent ? m(cents(r.askingRent)) : null],
            ['Listed', r.listedOn ? `${formatDate(r.listedOn)}${r.listedWhere ? `, ${r.listedWhere}` : ''}` : r.listedWhere],
            ['Manager', data.rental?.managerCompany ? <Link key="m" href={`/companies/${r.managerCompanyId}`}>{data.rental.managerCompany}</Link> : null],
            ['Contact', data.rental?.managerPerson ? <span key="p"><Link href={`/people/${r.managerPersonId}`}>{data.rental.managerPerson}</Link>{data.rental.managerPhone ? <> · <Phone value={data.rental.managerPhone} /></> : null}{data.rental.managerEmail ? <> · <a href={`mailto:${data.rental.managerEmail}`}>{data.rental.managerEmail}</a></> : null}</span> : null],
            ['Their Fee', [r.managementFeePct ? `${Number(r.managementFeePct)}% of rent` : null, r.leasingFee ? `${m(cents(r.leasingFee))} leasing fee` : null].filter(Boolean).join(', ') || null],
            ['Their Terms', r.managementTerms],
          ]} />
        ) : null}
        {canEdit ? (
          <details className="fold" open={!r}><summary>{r ? 'Change' : 'Set It Up'}</summary>
            <ActionForm action={saveRental} submit="Save">
              <input type="hidden" name="projectId" value={projectId} />
              <div className="fields">
                <label className="f">Status<select name="status" defaultValue={r?.status ?? 'getting_ready'}>{rentalStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
                <label className="f">Asking Rent<input name="askingRent" defaultValue={num(r?.askingRent)} placeholder="2,450" /></label>
                <label className="f">Listed On<input type="date" name="listedOn" defaultValue={r?.listedOn ?? ''} /></label>
                <label className="f">Listed Where<input name="listedWhere" defaultValue={r?.listedWhere ?? ''} placeholder="Zillow, the manager's site" /></label>
                <label className="f">Property Manager{companyOpts('managerCompanyId', r?.managerCompanyId ?? null)}</label>
                <label className="f">Contact There<select name="managerPersonId" defaultValue={r?.managerPersonId ?? ''}><option value="">None</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.companyName ? ` (${p.companyName})` : ''}</option>)}</select></label>
                <label className="f">Management Fee %<input name="managementFeePct" defaultValue={num(r?.managementFeePct)} placeholder="8" /></label>
                <label className="f">Leasing Fee<input name="leasingFee" defaultValue={num(r?.leasingFee)} /></label>
              </div>
              <label className="f">Their Terms<input name="managementTerms" defaultValue={r?.managementTerms ?? ''} placeholder="12-month agreement, 30 days' notice to cancel" /></label>
              <p className="small muted">Monthly costs we expect (until the manager’s statements give actuals):</p>
              <div className="fields">
                <label className="f">Property Taxes / Month<input name="taxesMonthly" defaultValue={num(r?.taxesMonthly)} /></label>
                <label className="f">Insurance / Month<input name="insuranceMonthly" defaultValue={num(r?.insuranceMonthly)} /></label>
                <label className="f">HOA / Month<input name="hoaMonthly" defaultValue={num(r?.hoaMonthly)} /></label>
                <label className="f">Utilities We Pay / Month<input name="utilitiesMonthly" defaultValue={num(r?.utilitiesMonthly)} /></label>
                <label className="f">Repairs Reserve %<input name="repairsReservePct" defaultValue={num(r?.repairsReservePct) || '5'} /></label>
                <label className="f">Vacancy %<input name="vacancyPct" defaultValue={num(r?.vacancyPct) || '5'} /></label>
              </div>
              <label className="f">Notes<input name="notes" defaultValue={r?.notes ?? ''} /></label>
            </ActionForm>
          </details>
        ) : null}
      </Section>

      <Section title="Lease" kind="aqua" hint={lease ? `${lease.tenants}` : 'No active lease'}>
        {alerts.length ? <div className="notice warn">{alerts.join(' · ')}</div> : null}
        {lease ? (
          <>
            <Facts items={[
              ['Tenants', lease.tenants], ['Rent', `${m(cents(lease.rent))} a month${lease.dueDay ? `, due the ${lease.dueDay}${['th', 'st', 'nd', 'rd'][lease.dueDay % 10 > 3 || Math.floor(lease.dueDay / 10) === 1 ? 0 : lease.dueDay % 10]}` : ''}`],
              ['Term', `${formatDate(lease.startsOn)} – ${lease.endsOn ? formatDate(lease.endsOn) : 'month to month'}`],
              ['Renewal', [lease.renewalTerms, lease.decideBy ? `decide by ${formatDate(lease.decideBy)}` : null].filter(Boolean).join('; ') || null],
              ['Deposit', lease.deposit ? `${m(cents(lease.deposit))}${lease.depositHeldBy ? `, held by ${lease.depositHeldBy}` : ''}` : null],
              ['Pets', lease.pets], ['Utilities Paid By', lease.utilitiesPaidBy], ['Terms', lease.terms],
              ['Signed Lease', lease.files.length ? <span key="f">{lease.files.map((f) => <Link key={f.id} href={`/documents/${f.id}`}>{f.name}</Link>)}</span> : null],
            ]} />
            {canEdit ? (
              <details className="fold"><summary>End This Lease</summary>
                <ActionForm action={endLease} submit="End the Lease">
                  <input type="hidden" name="leaseId" value={lease.id} />
                  <div className="fields"><label className="f">Ended On<input type="date" name="endedOn" required /></label><label className="f">Deposit Returned<input name="depositReturned" /></label></div>
                  <label className="check"><input type="checkbox" name="relisting" defaultChecked /> Back on the market</label>
                </ActionForm>
              </details>
            ) : null}
          </>
        ) : <Empty>No active lease.</Empty>}
        {data.leases.filter((l) => l.status !== 'active').length ? (
          <details className="fold"><summary>Past leases ({data.leases.filter((l) => l.status !== 'active').length})</summary>
            <ul className="small">{data.leases.filter((l) => l.status !== 'active').map((l) => <li key={l.id}>{l.tenants}: {m(cents(l.rent))}/month, {formatDate(l.startsOn)} – {formatDate(l.endedOn ?? l.endsOn)}{l.depositReturned ? `, returned ${m(cents(l.depositReturned))}` : ''}</li>)}</ul>
          </details>
        ) : null}
        {canEdit ? (
          <details className="fold"><summary>{lease ? 'Add the Next Lease' : 'Add the Lease'}</summary>
            <ActionForm action={addLease} submit="Add the Lease" resetOnOk>
              <input type="hidden" name="projectId" value={projectId} />
              <div className="fields">
                <label className="f">Tenants<input name="tenants" required /></label>
                <label className="f">Rent / Month<input name="rent" required /></label>
                <label className="f">Due Day<input name="dueDay" inputMode="numeric" placeholder="1" /></label>
                <label className="f">Starts<input type="date" name="startsOn" required /></label>
                <label className="f">Ends<span className="h">Blank for month to month</span><input type="date" name="endsOn" /></label>
                <label className="f">Decide on Renewal By<input type="date" name="decideBy" /></label>
                <label className="f">Deposit<input name="deposit" /></label>
                <label className="f">Deposit Held By<input name="depositHeldBy" placeholder="AMG Realty trust account" /></label>
                <label className="f">Pets<input name="pets" /></label>
                <label className="f">Utilities Paid By<input name="utilitiesPaidBy" placeholder="Tenant: electric, water" /></label>
              </div>
              <label className="f">Renewal Terms<input name="renewalTerms" placeholder="Renews yearly unless 60 days' notice; rent up to 3%" /></label>
              <label className="f">Other Terms<textarea name="terms" rows={2} /></label>
              <label className="f">The Signed Lease (PDF)<input type="file" name="file" accept="application/pdf,image/*" /></label>
            </ActionForm>
          </details>
        ) : null}
      </Section>

      {canMoney ? (
        <Section title="Rent In" kind="energy" hint={months.length ? `${short.length ? `${short.length} ${short.length === 1 ? 'month' : 'months'} short` : 'All paid'} on this lease` : undefined}>
          {months.length ? (
            <table className="t"><thead><tr><th>Month</th><th className="num">Expected</th><th className="num">Received</th><th className="num">Short</th></tr></thead>
              <tbody>{[...months].reverse().map((x) => <tr key={x.month}><td>{x.month}</td><td className="num">{m(x.expected)}</td><td className="num">{m(x.received)}</td><td className={`num ${x.received < x.expected ? 'red' : ''}`}>{x.received < x.expected ? m(x.expected - x.received) : ''}</td></tr>)}</tbody></table>
          ) : <Empty>No lease to compare against yet.</Empty>}
          {data.receipts.length ? <details className="fold"><summary>Everything received ({data.receipts.length})</summary><ul className="small">{data.receipts.map((x) => <li key={x.id}>{formatDate(x.receivedOn)}: {m(cents(x.amount))} {x.kind.replace('_', ' ')}{x.forMonth ? ` for ${x.forMonth.slice(0, 7)}` : ''}{x.notes ? ` · ${x.notes}` : ''}</li>)}</ul></details> : null}
          <details className="fold"><summary>Record Money Received</summary>
            <ActionForm action={addRentReceipt} submit="Record It" resetOnOk>
              <input type="hidden" name="projectId" value={projectId} />{lease ? <input type="hidden" name="leaseId" value={lease.id} /> : null}
              <div className="fields">
                <label className="f">Received<input type="date" name="receivedOn" required /></label>
                <label className="f">Amount<input name="amount" required /></label>
                <label className="f">What<select name="kind" defaultValue="rent"><option value="rent">Rent</option><option value="late_fee">Late Fee</option><option value="deposit">Deposit</option><option value="other">Other</option></select></label>
                <label className="f">For Month<input type="month" name="forMonth" /></label>
              </div>
              <label className="f">Notes<input name="notes" placeholder="From the manager's September statement, net of their fee" /></label>
            </ActionForm>
          </details>
        </Section>
      ) : null}

      {canMoney ? (
        <Section title="Loan" kind="blue" hint={data.loans.length ? `${data.loans.length}` : 'None recorded'}>
          {data.loans.map((l) => (
            <div key={l.id} style={{ marginBottom: 10 }}>
              <Facts items={[
                ['Lender', l.lender], ['Original', l.originalAmount ? m(cents(l.originalAmount)) : null],
                ['Balance', l.balance ? `${m(cents(l.balance))}${l.balanceOn ? ` (as of ${formatDate(l.balanceOn)})` : ''}` : null],
                ['Rate', l.ratePct ? `${Number(l.ratePct)}%` : null], ['Payment', l.monthlyPayment ? `${m(cents(l.monthlyPayment))} a month${l.escrowIncluded ? ' with taxes and insurance in escrow' : ''}` : null],
                ['Term', [l.startedOn ? `from ${formatDate(l.startedOn)}` : null, l.maturesOn ? `matures ${formatDate(l.maturesOn)}` : null].filter(Boolean).join(', ') || null], ['Notes', l.notes],
              ]} />
            </div>
          ))}
          <details className="fold"><summary>{data.loans.length ? 'Update the Loan' : 'Add the Loan'}</summary>
            <ActionForm action={saveLoan} submit="Save">
              <input type="hidden" name="projectId" value={projectId} />{data.loans[0] ? <input type="hidden" name="loanId" value={data.loans[0].id} /> : null}
              <div className="fields">
                <label className="f">Lender{companyOpts('lenderCompanyId', data.loans[0]?.lenderCompanyId ?? null)}</label>
                <label className="f">Or Lender Name<input name="lenderName" defaultValue={data.loans[0]?.lenderName ?? ''} /></label>
                <label className="f">Original Amount<input name="originalAmount" defaultValue={num(data.loans[0]?.originalAmount)} /></label>
                <label className="f">Balance<input name="balance" defaultValue={num(data.loans[0]?.balance)} /></label>
                <label className="f">Balance As Of<input type="date" name="balanceOn" defaultValue={data.loans[0]?.balanceOn ?? ''} /></label>
                <label className="f">Rate %<input name="ratePct" defaultValue={num(data.loans[0]?.ratePct)} /></label>
                <label className="f">Monthly Payment<input name="monthlyPayment" defaultValue={num(data.loans[0]?.monthlyPayment)} /></label>
                <label className="f">Started<input type="date" name="startedOn" defaultValue={data.loans[0]?.startedOn ?? ''} /></label>
                <label className="f">Matures<input type="date" name="maturesOn" defaultValue={data.loans[0]?.maturesOn ?? ''} /></label>
              </div>
              <label className="check"><input type="checkbox" name="escrowIncluded" defaultChecked={data.loans[0]?.escrowIncluded ?? false} /> Taxes and insurance are paid through the loan (escrow)</label>
              <label className="f">Notes<input name="notes" defaultValue={data.loans[0]?.notes ?? ''} placeholder="Never an account number" /></label>
            </ActionForm>
          </details>
        </Section>
      ) : null}

      {canMoney ? (
        <Section title="Work Done While Rented" kind="grey" hint={data.whileRented.length ? `${data.whileRented.length} · ${m(workTotal)}` : undefined}>
          {data.whileRented.length ? (
            <ul className="rows">{data.whileRented.map((b) => <li key={b.id}>{formatDate(b.date)} · {b.vendorCompanyId ? <Link href={`/companies/${b.vendorCompanyId}`}>{b.vendor}</Link> : b.vendor}{b.number ? ` #${b.number}` : ''} · {formatCents(cents(b.amount), { cents: true })}</li>)}</ul>
          ) : <Empty>No bills since the lease started. Enter repairs as bills on the Bills tab; they show here.</Empty>}
        </Section>
      ) : null}
    </div>
  );
}
