import Link from 'next/link';
import { and, asc, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { db } from '@/db';
import { entities, overheadExpenses } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { formatCents, formatDate, formatMoney, today } from '@/lib/format';
import { overheadCategories, overheadLabel, overheadTotals } from '@/lib/overhead';
import { PageHead, Section, Empty, Tile } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { ActionButton } from '@/components/ActionButton';
import { removeOverhead, saveOverhead } from '../overhead-actions';

export const metadata = { title: 'Overhead' };

// Business overhead (owner, Oct 3, 2026): what running the business costs,
// apart from any one property. Receipts come in through Drop Documents.
export default async function OverheadPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('money.view');
  const sp = await searchParams;
  const year = /^\d{4}$/.test(sp.year ?? '') ? Number(sp.year) : Number(today().slice(0, 4));
  const ents = await db.select({ id: entities.id, name: entities.name }).from(entities).where(isNull(entities.archived)).orderBy(asc(entities.name));
  const entityId = ents.find((e) => e.id === sp.entity)?.id ?? null;
  const rows = await db.select({
    id: overheadExpenses.id, entityId: overheadExpenses.entityId, fileId: overheadExpenses.fileId, vendor: overheadExpenses.vendor, amount: overheadExpenses.amount,
    spentOn: overheadExpenses.spentOn, category: overheadExpenses.category, notes: overheadExpenses.notes, entityName: entities.name,
  }).from(overheadExpenses).innerJoin(entities, eq(entities.id, overheadExpenses.entityId))
    .where(and(isNull(overheadExpenses.archived), gte(overheadExpenses.spentOn, `${year}-01-01`), lt(overheadExpenses.spentOn, `${year + 1}-01-01`), entityId ? eq(overheadExpenses.entityId, entityId) : undefined))
    .orderBy(desc(overheadExpenses.spentOn));
  const undated = await db.select({ id: overheadExpenses.id, vendor: overheadExpenses.vendor, amount: overheadExpenses.amount, fileId: overheadExpenses.fileId, entityId: overheadExpenses.entityId, category: overheadExpenses.category, notes: overheadExpenses.notes, spentOn: overheadExpenses.spentOn })
    .from(overheadExpenses).where(and(isNull(overheadExpenses.archived), isNull(overheadExpenses.spentOn)));
  const t = overheadTotals(rows);
  const edit = can(user, 'bills.edit');
  const href = (o: Record<string, string | null>) => { const q = new URLSearchParams(Object.entries({ year: String(year), entity: entityId, ...o }).filter(([, v]) => v) as [string, string][]).toString(); return `/overhead?${q}`; };
  const form = (r?: (typeof rows)[number] | (typeof undated)[number]) => (
    <ActionForm action={saveOverhead} submit={r ? 'Save' : 'Add'} resetOnOk={!r}>
      {r ? <input type="hidden" name="id" value={r.id} /> : null}
      <div className="fields">
        <label className="f">For<select name="entityId" defaultValue={r?.entityId ?? entityId ?? ents[0]?.id}>{ents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label className="f">Paid To<input name="vendor" defaultValue={r?.vendor ?? ''} /></label>
        <label className="f">Amount<input name="amount" inputMode="decimal" defaultValue={r?.amount ?? ''} required /></label>
        <label className="f">Date<input type="date" name="spentOn" defaultValue={r?.spentOn ?? today()} /></label>
        <label className="f">Category<select name="category" defaultValue={r?.category ?? 'other'}>{overheadCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
        <label className="f">Notes<input name="notes" defaultValue={r?.notes ?? ''} /></label>
      </div>
    </ActionForm>
  );
  return (
    <>
      <PageHead title="Overhead" sub="What running the business costs, apart from any one property. Drop receipts in Drop Documents: they're read and filed here." actions={<><Link className="btn" href="/receipts/snap">Snap a Receipt</Link> <Link className="btn secondary" href="/documents/drop">Drop Receipts</Link></>} />
      <Section title="Find" kind="grey">
        <nav className="role-pick" aria-label="Year"><span className="filter-label">Year</span>
          {[0, 1, 2].map((k) => year - 1 + k).filter((y) => y <= Number(today().slice(0, 4))).map((y) => <Link key={y} className="role-btn" aria-pressed={y === year} href={href({ year: String(y) })}>{y}</Link>)}
        </nav>
        {ents.length > 1 ? <nav className="role-pick" aria-label="Business"><span className="filter-label">For</span>
          <Link className="role-btn" aria-pressed={!entityId} href={href({ entity: null })}>Every Business</Link>
          {ents.map((e) => <Link key={e.id} className="role-btn" aria-pressed={entityId === e.id} href={href({ entity: e.id })}>{e.name}</Link>)}
        </nav> : null}
      </Section>
      <div className="tiles">
        <Tile k={`Overhead ${year}`} v={formatCents(t.total)} s={`${rows.length} ${rows.length === 1 ? 'expense' : 'expenses'}`} />
        {t.byCategory.slice(0, 3).map((c) => <Tile key={c.key} k={c.label} v={formatCents(c.cents)} />)}
      </div>
      <div className="stack">
        {t.byCategory.length ? (
          <div className="grid-2">
            <Section title="By Category" kind="blue"><table className="t"><tbody>{t.byCategory.map((c) => <tr key={c.key}><td>{c.label}</td><td className="num">{formatCents(c.cents)}</td></tr>)}</tbody></table></Section>
            <Section title="By Month" kind="aqua"><table className="t"><tbody>{t.byMonth.map((m) => <tr key={m.month}><td>{m.month}</td><td className="num">{formatCents(m.cents)}</td></tr>)}</tbody></table></Section>
          </div>
        ) : null}
        <Section title="Expenses" kind="energy" hint={`${rows.length}`}>
          {rows.length ? <div className="table-wrap"><table className="t">
            <thead><tr><th>Date</th><th>Paid To</th><th>Category</th><th>For</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.spentOn)}</td>
                <td>{r.vendor ?? '—'}{r.notes ? <div className="small muted">{r.notes}</div> : null}</td>
                <td>{overheadLabel(r.category)}</td>
                <td className="small">{r.entityName}</td>
                <td className="num">{formatMoney(r.amount, { cents: true })}</td>
                <td>{r.fileId ? <Link className="small" href={`/documents/${r.fileId}`}>Receipt</Link> : null}
                  {edit ? <details className="fold"><summary>Edit</summary>{form(r)}<ActionButton action={removeOverhead.bind(null, r.id)} className="link-btn small" label="Take Off" done="Taken off." confirm="Take this expense off?" /></details> : null}</td>
              </tr>
            ))}</tbody>
          </table></div> : <Empty>No overhead for {year} yet.</Empty>}
        </Section>
        {undated.length ? <Section title="No Date Yet" kind="grey" hint="The receipt didn't show a date: add one">
          <ul className="rows">{undated.map((r) => <li key={r.id}>{r.vendor ?? 'Receipt'} {formatMoney(r.amount, { cents: true })} {r.fileId ? <Link className="small" href={`/documents/${r.fileId}`}>Receipt</Link> : null}{edit ? <details className="fold"><summary>Edit</summary>{form(r)}</details> : null}</li>)}</ul>
        </Section> : null}
        {edit && ents.length ? <Section title="Add One by Hand" kind="grey">{form()}</Section> : null}
        {!ents.length ? <p className="notice warn">Add the business under Business Entities first: overhead is kept per business.</p> : null}
      </div>
    </>
  );
}
