import Link from 'next/link';
import { Empty, Section } from './ui';
import { spendByProject, type SpendBill } from '@/lib/vendor-spend';
import { formatCents, formatDate } from '@/lib/format';

const kindLabel: Record<string, string> = { invoice: 'Invoice', receipt: 'Receipt', credit: 'Credit' };
const statusLabel: Record<string, string> = { entered: 'Entered', approved: 'Approved', paid: 'Paid' };

/** Projects they worked on, what we spent on each, the total, and every invoice. */
export function VendorSpend({ bills }: { bills: SpendBill[] }) {
  const s = spendByProject(bills);
  return (
    <Section title="What We’ve Spent With Them" kind="blue" hint={s.count ? `${formatCents(s.cents, { cents: true })} in all · ${s.projects.length} ${s.projects.length === 1 ? 'project' : 'projects'} · ${s.count} ${s.count === 1 ? 'invoice' : 'invoices'}` : undefined}>
      {s.projects.length ? (
        <div className="stack">
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Project</th><th>Dates</th><th className="num">Invoices</th><th className="num">Spent</th></tr></thead>
              <tbody>
                {s.projects.map((p) => (
                  <tr key={p.projectId}>
                    <td><Link href={`/projects/${p.projectId}?tab=bills`}>{p.projectName}</Link>{p.through ? <div className="small muted">{formatCents(p.through, { cents: true })} came through the GC’s bills</div> : null}</td>
                    <td className="small">{formatDate(p.first)}{p.last !== p.first ? ` – ${formatDate(p.last)}` : ''}</td>
                    <td className="num">{p.bills.length}</td>
                    <td className="num">{formatCents(p.cents, { cents: true })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th colSpan={3}>Total</th><th className="num">{formatCents(s.cents, { cents: true })}</th></tr></tfoot>
            </table>
          </div>
          {s.projects.map((p) => (
            <details key={p.projectId} className="fold">
              <summary>{p.projectName}: {p.bills.length} {p.bills.length === 1 ? 'invoice' : 'invoices'}, {formatCents(p.cents, { cents: true })}</summary>
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>Date</th><th>Number</th><th>Kind</th><th>Status</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {p.bills.map((b) => (
                      <tr key={b.id}>
                        <td>{formatDate(b.date)}</td>
                        <td>{b.number ?? '—'}{b.throughBillId ? <div className="small muted">backup in {b.throughVendor ?? 'the GC'}’s bill</div> : null}</td>
                        <td>{kindLabel[b.kind] ?? b.kind}</td>
                        <td>{statusLabel[b.status] ?? b.status}</td>
                        <td className="num">{formatCents(Math.round(Number(b.amount) * 100), { cents: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><th colSpan={4}>{p.projectName}</th><th className="num">{formatCents(p.cents, { cents: true })}</th></tr></tfoot>
                </table>
              </div>
            </details>
          ))}
        </div>
      ) : <Empty>No invoices from them yet.</Empty>}
    </Section>
  );
}
