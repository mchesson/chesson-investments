import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { formatMoney } from './format';
import { onTime, vendorSummary, type Link, type TimelineEvent } from './timeline-rules';

// Timelines built from what's already recorded (timeline-rules.ts has the rules).
// Read-only: nothing here writes.

type Row = Record<string, string | number | boolean | null>;
const rows = async (q: ReturnType<typeof sql>) => (await db.execute<Row>(q)).rows;
const s = (v: unknown) => (v == null ? null : String(v));
const day = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));
const money = (v: unknown) => (v == null ? '' : formatMoney(String(v)));
const vendorLink = (r: Row): Link | null =>
  r.vendor_company_id ? { name: String(r.vendor_name ?? 'Vendor'), href: `/companies/${r.vendor_company_id}` }
    : r.vendor_person_id ? { name: String(r.vendor_name ?? 'Vendor'), href: `/people/${r.vendor_person_id}` }
      : r.vendor_name ? { name: String(r.vendor_name), href: '' } : null;
const linkOrNull = (l: Link | null) => (l && l.href ? l : l ? { ...l, href: '' } : null);
// The vendor's name, whoever it is (a company, a person, or a name typed on a bill).
const vendorName = (companyCol: string, personCol: string, typedCol?: string) => sql.raw(`coalesce((select vc.name from companies vc where vc.id = ${companyCol}), (select vp.first_name || ' ' || vp.last_name from people vp where vp.id = ${personCol})${typedCol ? `, ${typedCol}` : ''})`);

/** Everything that happened at a property, and who did it. */
export async function projectTimeline(projectId: string): Promise<TimelineEvent[]> {
  const base = `/projects/${projectId}`;
  const out: TimelineEvent[] = [];
  const [p] = await rows(sql`select name, purchased_on, completed_on, actual_sale_price, lot_cost from projects where id = ${projectId}`);
  if (!p) return [];
  if (p.purchased_on) out.push({ on: day(p.purchased_on), kind: 'deal', title: `Bought it${p.lot_cost ? ` (lot ${money(p.lot_cost)})` : ''}` });
  if (p.completed_on) out.push({ on: day(p.completed_on), kind: 'work', title: 'Finished the build', flag: 'good' });

  // Stage changes, as History recorded them, with who.
  for (const r of await rows(sql`select a.at, a.summary, u.name as who from audit_log a left join users u on u.id = a.user_id
      where a.entity = 'project' and a.entity_id = ${projectId} and a.action in ('stage', 'stage-state', 'sub-stage') order by a.at`)) {
    out.push({ on: day(r.at), kind: 'deal', title: `${String(r.summary).replace(/^moved /, 'Moved ').replace(/^marked /, 'Marked ')}`, detail: r.who ? `by ${r.who}` : null, href: `${base}?tab=history` });
  }
  // The schedule: milestones started and finished, work done (on time or late) and by whom.
  for (const r of await rows(sql`select name, actual_start, actual_end, planned_end from milestones where project_id = ${projectId} and archived_at is null`)) {
    if (r.actual_start) out.push({ on: day(r.actual_start), kind: 'work', title: `Started ${r.name}`, href: `${base}?tab=schedule` });
    if (r.actual_end) out.push({ on: day(r.actual_end), kind: 'work', title: `Finished ${r.name}`, href: `${base}?tab=schedule`, flag: onTime(day(r.actual_end), s(r.planned_end)) === false ? 'late' : null });
  }
  for (const r of await rows(sql`select description, status, done_on, due_on, company_id as vendor_company_id, person_id as vendor_person_id,
      ${vendorName('assignments.company_id', 'assignments.person_id')} as vendor_name from assignments where project_id = ${projectId} and archived_at is null and (done_on is not null or status = 'missed')`)) {
    const late = onTime(s(r.done_on), s(r.due_on)) === false || r.status === 'missed';
    out.push({ on: day(r.done_on ?? r.due_on), kind: 'work', title: r.status === 'missed' ? `Missed: ${r.description}` : `Done: ${r.description}`, who: linkOrNull(vendorLink(r)),
      detail: r.due_on ? `due ${day(r.due_on)}` : null, href: `${base}?tab=schedule`, flag: late ? 'late' : 'good' });
  }
  for (const r of await rows(sql`select d.logged_on, d.work, d.on_site, u.name as who from daily_logs d left join users u on u.id = d.user_id where d.project_id = ${projectId} and d.archived_at is null`)) {
    out.push({ on: day(r.logged_on), kind: 'work', title: `Daily log: ${String(r.work ?? '').slice(0, 140)}`, detail: [r.on_site ? `on site: ${r.on_site}` : null, r.who ? `by ${r.who}` : null].filter(Boolean).join(' · ') || null, href: `${base}?tab=log` });
  }
  // Trips here (the Trip Log): who went, why, the miles.
  for (const r of await rows(sql`select t.trip_on, t.purpose, t.miles, u.name as who from trips t left join users u on u.id = t.created_by
      where t.archived_at is null and (t.project_id = ${projectId} or t.stops @> ${JSON.stringify([{ id: projectId }])}::jsonb)`)) {
    out.push({ on: day(r.trip_on), kind: 'work', title: `Trip here: ${String(r.purpose).slice(0, 140)}`, detail: [`${Number(r.miles)} mi`, r.who ? `by ${r.who}` : null].filter(Boolean).join(' · '), href: '/trips' });
  }
  // Bids and who won, commitments and change orders.
  for (const r of await rows(sql`select label, kind, total_cents, submitted_on, created_at, status, decided_at, company_id as vendor_company_id, person_id as vendor_person_id,
      ${vendorName('budget_versions.company_id', 'budget_versions.person_id')} as vendor_name from budget_versions where project_id = ${projectId}`)) {
    const who = linkOrNull(vendorLink(r));
    out.push({ on: day(r.submitted_on ?? r.created_at), kind: 'money', title: `${r.kind === 'ours' ? 'Our estimate' : 'Bid'}: ${r.label ?? 'Budget'}${r.total_cents ? ` (${formatMoney(Number(r.total_cents) / 100)})` : ''}`, who, href: `${base}?tab=budget` });
    if (r.decided_at && (r.status === 'selected' || r.status === 'declined')) out.push({ on: day(r.decided_at), kind: 'money', title: r.status === 'selected' ? `Chose ${r.label ?? 'this budget'}` : `Passed on ${r.label ?? 'this bid'}`, who, href: `${base}?tab=budget`, flag: r.status === 'selected' ? 'good' : null });
  }
  for (const r of await rows(sql`select c.scope, c.amount, c.signed_on, c.created_at, c.vendor_company_id, c.vendor_person_id, ${vendorName('c.vendor_company_id', 'c.vendor_person_id')} as vendor_name
      from commitments c where c.project_id = ${projectId} and c.archived_at is null`)) {
    out.push({ on: day(r.signed_on ?? r.created_at), kind: 'money', title: `Committed: ${r.scope ?? 'work'} (${money(r.amount)})`, who: linkOrNull(vendorLink(r)), href: `${base}?tab=commitments` });
  }
  for (const r of await rows(sql`select o.description, o.amount, o.approved_on, c.vendor_company_id, c.vendor_person_id, ${vendorName('c.vendor_company_id', 'c.vendor_person_id')} as vendor_name
      from change_orders o join commitments c on c.id = o.commitment_id where c.project_id = ${projectId} and o.archived_at is null`)) {
    out.push({ on: day(r.approved_on), kind: 'money', title: `Change order: ${r.description} (${money(r.amount)})`, who: linkOrNull(vendorLink(r)), href: `${base}?tab=commitments` });
  }
  // Bills and payments.
  for (const r of await rows(sql`select b.invoice_number, b.amount, b.invoice_on, b.paid_on, b.kind, b.vendor_company_id, b.vendor_person_id, ${vendorName('b.vendor_company_id', 'b.vendor_person_id', 'b.vendor_name')} as vendor_name
      from bills b where b.project_id = ${projectId} and b.archived_at is null`)) {
    const who = linkOrNull(vendorLink(r));
    out.push({ on: day(r.invoice_on), kind: 'money', title: `${r.kind === 'receipt' ? 'Receipt' : r.kind === 'credit' ? 'Credit' : 'Bill'}${r.invoice_number ? ` #${r.invoice_number}` : ''}: ${money(r.amount)}`, who, href: `${base}?tab=bills` });
    if (r.paid_on && r.kind !== 'receipt') out.push({ on: day(r.paid_on), kind: 'money', title: `Paid ${money(r.amount)}${r.invoice_number ? ` (bill #${r.invoice_number})` : ''}`, who, href: `${base}?tab=bills` });
  }
  for (const r of await rows(sql`select kind, amount, incurred_on, notes from holding_costs where project_id = ${projectId} and archived_at is null and bill_line_id is null`)) {
    out.push({ on: day(r.incurred_on), kind: 'money', title: `Holding cost: ${String(r.kind).replace(/_/g, ' ')} ${money(r.amount)}`, detail: s(r.notes), href: `${base}?tab=holding` });
  }
  // Issues, grades and visits.
  for (const r of await rows(sql`select i.number, i.title, i.reported_on, i.resolved_on, i.status, i.company_id as vendor_company_id, i.person_id as vendor_person_id,
      ${vendorName('i.company_id', 'i.person_id')} as vendor_name from vendor_issues i where i.project_id = ${projectId} and i.archived_at is null`)) {
    const who = linkOrNull(vendorLink(r));
    out.push({ on: day(r.reported_on), kind: 'people', title: `Issue #${r.number} opened: ${r.title}`, who, href: `${base}?tab=vendors`, flag: 'bad' });
    if (r.resolved_on) out.push({ on: day(r.resolved_on), kind: 'people', title: `Issue #${r.number} ${r.status === 'resolved' ? 'fixed' : 'closed'}: ${r.title}`, who, href: `${base}?tab=vendors`, flag: r.status === 'resolved' ? 'good' : null });
  }
  for (const r of await rows(sql`select g.grade, g.justification, g.graded_on, g.company_id as vendor_company_id, g.person_id as vendor_person_id, ${vendorName('g.company_id', 'g.person_id')} as vendor_name
      from grades g where g.project_id = ${projectId} and g.archived_at is null`)) {
    out.push({ on: day(r.graded_on), kind: 'people', title: `Graded ${r.grade}`, who: linkOrNull(vendorLink(r)), detail: String(r.justification ?? '').slice(0, 160), flag: ['D', 'F'].includes(String(r.grade)) ? 'bad' : String(r.grade).startsWith('A') ? 'good' : null });
  }
  for (const r of await rows(sql`select t.kind, t.happened_on, t.notes, t.person_id, (select p.first_name || ' ' || p.last_name from people p where p.id = t.person_id) as name, u.name as who
      from touches t left join users u on u.id = t.user_id where t.project_id = ${projectId} and t.archived_at is null`)) {
    out.push({ on: day(r.happened_on), kind: 'people', title: `${r.kind === 'site_walk' ? 'Site walk' : String(r.kind).replace(/^./, (c) => c.toUpperCase())} with ${r.name ?? 'someone'}`, who: r.person_id ? { name: String(r.name), href: `/people/${r.person_id}` } : null, detail: [s(r.notes)?.slice(0, 140), r.who ? `by ${r.who}` : null].filter(Boolean).join(' · ') || null });
  }
  // Documents added.
  for (const r of await rows(sql`select f.id, f.name, f.caption, f.created_at, u.name as who from files f left join users u on u.id = f.uploaded_by
      where f.entity = 'project' and f.entity_id = ${projectId} and f.archived_at is null and f.photo_kind is null`)) {
    out.push({ on: day(r.created_at), kind: 'docs', title: `Document: ${r.caption ? docCaptionLabel(String(r.caption)) : r.name}`, detail: r.who ? `added by ${r.who}` : null, href: `/documents/${r.id}` });
  }
  // Renting: leases, rent and the loan.
  for (const r of await rows(sql`select tenants, rent, starts_on, ended_on from leases where project_id = ${projectId}`)) {
    out.push({ on: day(r.starts_on), kind: 'deal', title: `Lease started: ${r.tenants} at ${money(r.rent)}/month`, href: `${base}?tab=rental` });
    if (r.ended_on) out.push({ on: day(r.ended_on), kind: 'deal', title: `Lease ended: ${r.tenants}`, href: `${base}?tab=rental` });
  }
  for (const r of await rows(sql`select lender_name, original_amount, started_on, (select c.name from companies c where c.id = loans.lender_company_id) as lender from loans where project_id = ${projectId} and archived_at is null and started_on is not null`)) {
    out.push({ on: day(r.started_on), kind: 'money', title: `Loan: ${money(r.original_amount)} from ${r.lender ?? r.lender_name ?? 'the lender'}`, href: `${base}?tab=rental` });
  }
  if (p.actual_sale_price) {
    const [sold] = await rows(sql`select min(a.at) as at from audit_log a where a.entity = 'project' and a.entity_id = ${projectId} and a.summary ilike '%sale%' and a.after::text ilike '%actualSalePrice%'`);
    if (sold?.at) out.push({ on: day(sold.at), kind: 'deal', title: `Sold for ${money(p.actual_sale_price)}`, flag: 'good' });
  }
  return out;
}
/** "Deed · Recorded deed for 109 Plainview" → "Deed: Recorded deed for 109 Plainview". */
const docCaptionLabel = (caption: string) => caption.split(' · ').slice(0, 2).join(': ').slice(0, 140);

/** What a vendor (a company or a person) did for us, across every property, and a summary. */
export async function vendorTimeline(who: { personId?: string; companyId?: string }) {
  const col = (c: string, p: string) => sql.raw(who.companyId ? c : p);
  const id = (who.companyId ?? who.personId)!;
  const out: TimelineEvent[] = [];
  const where = (r: Row): Link | null => (r.project_id ? { name: String(r.project_name ?? 'A project'), href: `/projects/${r.project_id}` } : null);
  const projectName = sql.raw('(select pr.name from projects pr where pr.id = x.project_id)');
  const bids = await rows(sql`select x.project_id, ${projectName} as project_name, x.label, x.total_cents, x.submitted_on, x.created_at, x.status, x.decided_at from budget_versions x where ${col('x.company_id', 'x.person_id')} = ${id}`);
  for (const r of bids) {
    out.push({ on: day(r.submitted_on ?? r.created_at), kind: 'money', title: `Bid: ${r.label ?? 'a bid'}${r.total_cents ? ` (${formatMoney(Number(r.total_cents) / 100)})` : ''}`, where: where(r) });
    if (r.decided_at && (r.status === 'selected' || r.status === 'declined')) out.push({ on: day(r.decided_at), kind: 'money', title: r.status === 'selected' ? 'Won the bid' : 'Lost the bid', where: where(r), flag: r.status === 'selected' ? 'good' : null });
  }
  const commits = await rows(sql`select x.id, x.project_id, ${projectName} as project_name, x.scope, x.amount, x.signed_on, x.created_at from commitments x where ${col('x.vendor_company_id', 'x.vendor_person_id')} = ${id} and x.archived_at is null`);
  for (const r of commits) out.push({ on: day(r.signed_on ?? r.created_at), kind: 'money', title: `Committed: ${r.scope ?? 'work'} (${money(r.amount)})`, where: where(r) });
  const bills = await rows(sql`select x.project_id, ${projectName} as project_name, x.invoice_number, x.amount, x.invoice_on, x.paid_on, x.kind from bills x where ${col('x.vendor_company_id', 'x.vendor_person_id')} = ${id} and x.archived_at is null`);
  for (const r of bills) {
    out.push({ on: day(r.invoice_on), kind: 'money', title: `Billed ${money(r.amount)}${r.invoice_number ? ` (#${r.invoice_number})` : ''}`, where: where(r) });
    if (r.paid_on) out.push({ on: day(r.paid_on), kind: 'money', title: `Paid ${money(r.amount)}`, where: where(r) });
  }
  const work = await rows(sql`select x.project_id, ${projectName} as project_name, x.description, x.status, x.done_on, x.due_on from assignments x where ${col('x.company_id', 'x.person_id')} = ${id} and x.archived_at is null`);
  for (const r of work.filter((r) => r.done_on || r.status === 'missed')) {
    const late = onTime(s(r.done_on), s(r.due_on)) === false || r.status === 'missed';
    out.push({ on: day(r.done_on ?? r.due_on), kind: 'work', title: r.status === 'missed' ? `Missed: ${r.description}` : `Done: ${r.description}`, detail: r.due_on ? `due ${day(r.due_on)}` : null, where: where(r), flag: late ? 'late' : 'good' });
  }
  const issues = await rows(sql`select x.project_id, ${projectName} as project_name, x.number, x.title, x.status, x.reported_on, x.resolved_on from vendor_issues x where ${col('x.company_id', 'x.person_id')} = ${id} and x.archived_at is null`);
  for (const r of issues) {
    out.push({ on: day(r.reported_on), kind: 'people', title: `Issue #${r.number} opened: ${r.title}`, where: where(r), flag: 'bad' });
    if (r.resolved_on) out.push({ on: day(r.resolved_on), kind: 'people', title: `Issue #${r.number} ${r.status === 'resolved' ? 'fixed' : 'closed'}`, where: where(r), flag: r.status === 'resolved' ? 'good' : null });
  }
  const grades = await rows(sql`select x.project_id, ${projectName} as project_name, x.grade, x.justification, x.graded_on from grades x where ${col('x.company_id', 'x.person_id')} = ${id} and x.archived_at is null`);
  for (const r of grades) out.push({ on: day(r.graded_on), kind: 'people', title: `Graded ${r.grade}`, detail: String(r.justification ?? '').slice(0, 160), where: where(r), flag: ['D', 'F'].includes(String(r.grade)) ? 'bad' : String(r.grade).startsWith('A') ? 'good' : null });
  if (who.personId) {
    for (const r of await rows(sql`select x.project_id, ${projectName} as project_name, x.kind, x.happened_on, x.notes from touches x where x.person_id = ${id} and x.archived_at is null`)) {
      out.push({ on: day(r.happened_on), kind: 'people', title: r.kind === 'site_walk' ? 'Site walk' : String(r.kind).replace(/^./, (c) => c.toUpperCase()), detail: s(r.notes)?.slice(0, 140) ?? null, where: where(r) });
    }
  }
  const summary = vendorSummary({
    projects: [...commits, ...bills, ...work, ...bids].map((r) => String(r.project_id ?? '')).filter(Boolean),
    paidCents: bills.filter((b) => b.paid_on).map((b) => Math.round(Number(b.amount) * 100)),
    assignments: work.map((w) => ({ done: s(w.done_on), due: s(w.due_on) })),
    issues: issues.map((i) => ({ status: String(i.status) })), grades: grades.map((g) => String(g.grade)),
  });
  return { events: out, summary };
}
