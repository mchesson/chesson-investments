'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  billLines, bills, budgetLines, changeOrders, commitments, costCodes, dailyLogs, holdingCosts, projectItems, projects,
} from '@/db/schema';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { bool, str, uuidOrNull } from '@/lib/forms';
import { formatState, isDay, parseIntOrNull, parseMoney, parsePercent, today } from '@/lib/format';
import { payBlocker, retainageFor, dollars } from '@/lib/budget';
import { checkLines } from '@/lib/bill-lines';
import { isProjectStage, projectStageLabel } from '@/lib/project-stages';
import { DEFAULT_PERCENTS } from '@/lib/cost-codes';
import { saveFile } from '@/lib/files';
import type { FormResult } from '@/components/ActionForm';

class FieldError extends Error {}
const money = (d: FormData, k: string, label: string) => {
  const v = parseMoney(d.get(k));
  if (v === undefined) throw new FieldError(`${label}: type a dollar amount, like 12,500.`);
  return v;
};
const pct = (d: FormData, k: string, label: string) => {
  const v = parsePercent(d.get(k));
  if (v === undefined) throw new FieldError(`${label}: type a percent, like 6.`);
  return v;
};
async function guard<T>(fn: () => Promise<T>): Promise<T | FormResult> {
  try { return await fn(); } catch (e) { if (e instanceof FieldError) return { error: e.message }; throw e; }
}
const done = (projectId: string, ok: string) => { revalidatePath(`/projects/${projectId}`); return { ok }; };

function projectFields(d: FormData) {
  const heatedSf = parseIntOrNull(d.get('heatedSf'));
  const lotSf = parseIntOrNull(d.get('lotSf'));
  if (heatedSf === undefined || lotSf === undefined) throw new FieldError('Square feet: type a whole number.');
  return {
    name: str(d, 'name') ?? str(d, 'address') ?? '',
    address: str(d, 'address') ?? '',
    city: str(d, 'city'), state: formatState(str(d, 'state')) ?? 'NC', zip: str(d, 'zip'), neighborhood: str(d, 'neighborhood'),
    lotSf, zoning: str(d, 'zoning')?.toUpperCase() ?? null,
    lotCost: money(d, 'lotCost', 'Lot cost'), lotValue: money(d, 'lotValue', 'Lot value'),
    heatedSf, plan: str(d, 'plan'),
    ownedBy: str(d, 'ownedBy'),
    saleLow: money(d, 'saleLow', 'Low sale price'),
    proformaSalePrice: money(d, 'proformaSalePrice', 'Pro forma sale price'),
    saleHigh: money(d, 'saleHigh', 'High sale price'),
    closingCostAtSale: money(d, 'closingCostAtSale', 'Closing cost at sale'),
    keptAssetsValue: money(d, 'keptAssetsValue', 'What we keep'),
    taxRatePct: pct(d, 'taxRatePct', 'Tax rate'),
    marketValue: money(d, 'marketValue', 'Market value'),
    marketValueOn: isDay(str(d, 'marketValueOn')) ? str(d, 'marketValueOn') : null,
    marketValueSource: str(d, 'marketValueSource'),
    sellingCostPct: pct(d, 'sellingCostPct', 'Selling costs'),
    actualSalePrice: money(d, 'actualSalePrice', 'Actual sale price'),
    notes: str(d, 'notes'),
  };
}

export async function saveProject(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const r = await guard(async () => {
    const f = projectFields(d);
    if (!f.address) return { error: 'An address is needed.' };
    const id = uuidOrNull(d, 'id');
    const stage = str(d, 'stage');
    if (stage && !isProjectStage(stage)) return { error: 'Pick a stage.' };
    const savedId = await db.transaction(async (tx) => {
      if (!id) {
        const [p] = await tx.insert(projects).values({ ...f, stage: (stage ?? 'under_contract') as never, createdBy: user.id }).returning();
        const codes = await tx.select().from(costCodes).where(isNull(costCodes.archived));
        if (codes.length) await tx.insert(budgetLines).values(codes.map((c) => ({ projectId: p.id, costCodeId: c.id, percentOfConstruction: DEFAULT_PERCENTS[c.code] ?? null })));
        await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'create', summary: `added the project ${p.name}`, after: f }, tx);
        return p.id;
      }
      const [old] = await tx.select().from(projects).where(eq(projects.id, id));
      const next = { ...f, ...(stage ? { stage: stage as typeof old.stage } : {}) };
      await tx.update(projects).set({ ...next, updated: new Date() }).where(eq(projects.id, id));
      const ch = diff(old as Record<string, unknown>, next);
      if (ch) {
        const summary = ch.after.stage ? `moved it to ${projectStageLabel(String(ch.after.stage))}` : `edited ${Object.keys(ch.after).join(', ')}`;
        await audit({ userId: user.id, entity: 'project', entityId: id, action: 'update', summary, ...ch }, tx);
      }
      return id;
    });
    redirect(`/projects/${savedId}`);
  });
  return r as FormResult;
}

export async function setProjectStage(projectId: string, stage: string) {
  const user = await requireAction('projects.edit');
  if (!isProjectStage(stage)) return;
  const [old] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!old || old.stage === stage) return;
  await db.transaction(async (tx) => {
    await tx.update(projects).set({ stage, updated: new Date() }).where(eq(projects.id, projectId));
    await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'stage', summary: `moved it from ${projectStageLabel(old.stage)} to ${projectStageLabel(stage)}` }, tx);
  });
  revalidatePath(`/projects/${projectId}`);
}

/** The whole budget in one save: each line an amount or a percent of construction. */
export async function saveBudget(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  if (!projectId) return { error: 'Not found.' };
  const codes = await db.select().from(costCodes).where(isNull(costCodes.archived));
  const existing = await db.select().from(budgetLines).where(eq(budgetLines.projectId, projectId));
  const byCode = new Map(existing.map((l) => [l.costCodeId, l]));
  const changes: { code: string; before: unknown; after: unknown }[] = [];
  const next: { costCodeId: string; amount: string | null; percentOfConstruction: string | null; notes: string | null }[] = [];
  for (const c of codes) {
    const amount = parseMoney(d.get(`amount.${c.id}`));
    const percent = parsePercent(d.get(`pct.${c.id}`));
    if (amount === undefined) return { error: `${c.name}: type a dollar amount.` };
    if (percent === undefined) return { error: `${c.name}: type a percent.` };
    const notes = str(d, `notes.${c.id}`);
    const old = byCode.get(c.id);
    const changed = !old || String(old.amount ?? '') !== String(amount ?? '') || String(old.percentOfConstruction ?? '') !== String(percent ?? '') || (old.notes ?? null) !== notes;
    if (changed) {
      changes.push({ code: `${c.code} ${c.name}`, before: old ? { amount: old.amount, percent: old.percentOfConstruction } : null, after: { amount, percent } });
      next.push({ costCodeId: c.id, amount, percentOfConstruction: percent, notes });
    }
  }
  if (!next.length) return { ok: 'No changes.' };
  await db.transaction(async (tx) => {
    for (const n of next) {
      await tx.insert(budgetLines).values({ projectId, ...n })
        .onConflictDoUpdate({ target: [budgetLines.projectId, budgetLines.costCodeId], set: { amount: n.amount, percentOfConstruction: n.percentOfConstruction, notes: n.notes, updated: new Date() } });
    }
    await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'budget', summary: `changed the budget (${changes.map((c) => c.code).join(', ')})`, before: changes.map((c) => ({ code: c.code, ...(c.before as object) })), after: changes.map((c) => ({ code: c.code, ...(c.after as object) })) }, tx);
  });
  return done(projectId, `Saved ${next.length} ${next.length === 1 ? 'line' : 'lines'}.`);
}

export async function addItem(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const description = str(d, 'description');
  if (!projectId || !description) return { error: 'Describe the item.' };
  const r = await guard(async () => {
    const estimate = money(d, 'estimate', 'Estimate');
    await db.transaction(async (tx) => {
      await tx.insert(projectItems).values({ projectId, description, costCodeId: uuidOrNull(d, 'costCodeId'), estimate, status: estimate ? 'priced' : 'unpriced' });
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'item-add', summary: `added the item “${description}”${estimate ? ` at $${Number(estimate).toLocaleString('en-US')}` : ' (not priced yet)'}` }, tx);
    });
    return done(projectId, 'Added.');
  });
  return r as FormResult;
}

export async function priceItem(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const id = uuidOrNull(d, 'id');
  if (!id) return { error: 'Not found.' };
  const r = await guard(async () => {
    const estimate = money(d, 'estimate', 'Estimate');
    const [it] = await db.select().from(projectItems).where(eq(projectItems.id, id));
    if (!it) return { error: 'Not found.' };
    const status = bool(d, 'notDoing') ? 'not_doing' : estimate ? 'priced' : 'unpriced';
    await db.transaction(async (tx) => {
      await tx.update(projectItems).set({ estimate, status, costCodeId: uuidOrNull(d, 'costCodeId') ?? it.costCodeId }).where(eq(projectItems.id, id));
      await audit({ userId: user.id, entity: 'project', entityId: it.projectId, action: 'item-price', summary: status === 'not_doing' ? `decided not to do “${it.description}”` : `priced “${it.description}” at $${Number(estimate ?? 0).toLocaleString('en-US')}`, before: { estimate: it.estimate, status: it.status }, after: { estimate, status } }, tx);
    });
    return done(it.projectId, 'Saved.');
  });
  return r as FormResult;
}

export async function addCommitment(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const costCodeId = uuidOrNull(d, 'costCodeId');
  const scope = str(d, 'scope');
  if (!projectId || !costCodeId) return { error: 'Pick the cost code.' };
  if (!scope) return { error: 'Write the scope of work.' };
  const vendorCompanyId = uuidOrNull(d, 'vendorCompanyId');
  const vendorPersonId = uuidOrNull(d, 'vendorPersonId');
  if (!vendorCompanyId && !vendorPersonId) return { error: 'Pick the vendor (a company or a person on file).' };
  const r = await guard(async () => {
    const amount = money(d, 'amount', 'Amount');
    if (!amount) return { error: 'Enter the amount.' };
    const retainagePct = pct(d, 'retainagePct', 'Retainage');
    const signedOn = str(d, 'signedOn');
    await db.transaction(async (tx) => {
      const [c] = await tx.insert(commitments).values({ projectId, costCodeId, scope, amount, retainagePct, signedOn: isDay(signedOn) ? signedOn : null, vendorCompanyId, vendorPersonId }).returning();
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'commitment-add', summary: `committed $${Number(amount).toLocaleString('en-US')} for ${scope}`, after: { commitmentId: c.id } }, tx);
    });
    return done(projectId, 'Commitment added.');
  });
  return r as FormResult;
}

export async function addChangeOrder(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const commitmentId = uuidOrNull(d, 'commitmentId');
  const description = str(d, 'description');
  if (!commitmentId || !description) return { error: 'Describe the change.' };
  const r = await guard(async () => {
    const amount = money(d, 'amount', 'Amount');
    if (!amount) return { error: 'Enter the amount (negative for a credit).' };
    const [c] = await db.select().from(commitments).where(eq(commitments.id, commitmentId));
    if (!c) return { error: 'Not found.' };
    const approvedOn = str(d, 'approvedOn');
    await db.transaction(async (tx) => {
      await tx.insert(changeOrders).values({ commitmentId, description, amount, approvedOn: isDay(approvedOn) ? approvedOn : today() });
      await audit({ userId: user.id, entity: 'project', entityId: c.projectId, action: 'change-order', summary: `added a change order of $${Number(amount).toLocaleString('en-US')} to “${c.scope}”: ${description}` }, tx);
    });
    return done(c.projectId, 'Change order added.');
  });
  return r as FormResult;
}

const LINE_ROWS = 25;

export async function addBill(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const commitmentId = uuidOrNull(d, 'commitmentId');
  const invoiceOn = str(d, 'invoiceOn');
  const kind = (str(d, 'kind') ?? 'invoice') as 'invoice' | 'receipt' | 'credit';
  if (!projectId) return { error: 'Not found.' };
  if (!['invoice', 'receipt', 'credit'].includes(kind)) return { error: 'Pick what kind of bill it is.' };
  if (!isDay(invoiceOn)) return { error: 'Enter the invoice date.' };
  const r = await guard(async () => {
    const raw = [];
    for (let i = 0; i < LINE_ROWS; i++) {
      const amount = parseMoney(d.get(`line.${i}.amount`));
      if (amount === undefined) return { error: `Line ${i + 1}: type a dollar amount.` };
      if (amount === null) continue;
      raw.push({ kind: str(d, `line.${i}.kind`) ?? 'build', costCodeId: uuidOrNull(d, `line.${i}.costCodeId`), holdingKind: str(d, `line.${i}.holdingKind`), description: str(d, `line.${i}.description`), amount });
    }
    let vendorCompanyId = uuidOrNull(d, 'vendorCompanyId');
    let vendorPersonId = uuidOrNull(d, 'vendorPersonId');
    let pctHeld: string | null = null;
    if (commitmentId) {
      const [c] = await db.select().from(commitments).where(and(eq(commitments.id, commitmentId), eq(commitments.projectId, projectId)));
      if (!c) return { error: 'That commitment isn’t on this project.' };
      vendorCompanyId = vendorCompanyId ?? c.vendorCompanyId;
      vendorPersonId = vendorPersonId ?? c.vendorPersonId;
      pctHeld = c.retainagePct;
      for (const l of raw) if (!l.costCodeId && (l.kind === 'build' || l.kind === 'fee')) l.costCodeId = c.costCodeId;
    }
    const checked = checkLines(raw, kind);
    if ('error' in checked) return { error: checked.error };
    const vendorName = str(d, 'vendorName');
    if (!vendorCompanyId && !vendorPersonId && !vendorName) return { error: 'Who is the bill from?' };
    const includedInBillId = uuidOrNull(d, 'includedInBillId');
    if (includedInBillId) {
      const [gc] = await db.select({ id: bills.id }).from(bills).where(and(eq(bills.id, includedInBillId), eq(bills.projectId, projectId)));
      if (!gc) return { error: 'The bill it’s backup for isn’t on this project.' };
    }
    const typedRetainage = parseMoney(d.get('retainage'));
    if (typedRetainage === undefined) return { error: 'Retainage: type a dollar amount.' };
    const retainage = dollars(retainageFor(checked.total, typedRetainage, pctHeld));
    const dueOn = str(d, 'dueOn');
    // A store or supplier needs no lien waiver; subs and GCs do (the vendor's role decides the default).
    const lienWaiverRequired = kind === 'invoice' && !bool(d, 'noLienWaiver');
    const isReceipt = kind === 'receipt';
    const file = d.get('file');
    await db.transaction(async (tx) => {
      const [b] = await tx.insert(bills).values({
        projectId, costCodeId: checked.lines.find((l) => l.costCodeId)?.costCodeId ?? null, commitmentId, vendorCompanyId, vendorPersonId, vendorName,
        kind, billedTo: str(d, 'billedTo'), invoiceNumber: str(d, 'invoiceNumber'), invoiceOn, dueOn: isDay(dueOn) ? dueOn : null,
        amount: checked.total, retainage: Number(retainage) ? retainage : null, includedInBillId, lienWaiverRequired,
        lienWaiverReceived: bool(d, 'lienWaiverReceived'), notes: str(d, 'notes'), createdBy: user.id,
        // A receipt was paid at the counter: recorded as approved and paid by whoever enters it.
        ...(isReceipt ? { status: 'paid' as const, approvedBy: user.id, approvedAt: new Date(), paidOn: invoiceOn, paidHow: str(d, 'paidHow') } : {}),
      }).returning();
      await tx.insert(billLines).values(checked.lines.map((l, i) => ({ billId: b.id, kind: l.kind, costCodeId: l.kind === 'holding' || l.kind === 'not_project' ? null : l.costCodeId, holdingKind: l.kind === 'holding' ? l.holdingKind : null, description: l.description, amount: l.amount, sort: i })));
      if (file instanceof File && file.size > 0) {
        const saved = await saveFile(file, { entity: 'bill', entityId: b.id }, user.id, {}, tx);
        if ('error' in saved) throw new FieldError(saved.error);
        await tx.update(bills).set({ fileId: saved.id }).where(eq(bills.id, b.id));
      }
      const what = kind === 'credit' ? 'a credit' : kind === 'receipt' ? 'a receipt' : 'a bill';
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'bill-add', summary: `entered ${what} for $${Math.abs(Number(checked.total)).toLocaleString('en-US')}${b.invoiceNumber ? ` (#${b.invoiceNumber})` : ''}${checked.lines.length > 1 ? ` in ${checked.lines.length} lines` : ''}${includedInBillId ? ', as backup for a GC bill (not counted twice)' : ''}`, after: { billId: b.id } }, tx);
    });
    return done(projectId, 'Saved.');
  });
  return r as FormResult;
}

export async function approveBill(id: string) {
  const user = await requireAction('bills.approve');
  const [b] = await db.select().from(bills).where(eq(bills.id, id));
  if (!b || b.status !== 'entered') return;
  await db.transaction(async (tx) => {
    await tx.update(bills).set({ status: 'approved', approvedBy: user.id, approvedAt: new Date() }).where(eq(bills.id, id));
    await audit({ userId: user.id, entity: 'project', entityId: b.projectId, action: 'bill-approve', summary: `approved the bill for $${Number(b.amount).toLocaleString('en-US')}${b.invoiceNumber ? ` (#${b.invoiceNumber})` : ''}` }, tx);
  });
  revalidatePath(`/projects/${b.projectId}`);
}

export async function setLienWaiver(id: string, received: boolean) {
  const user = await requireAction('bills.edit');
  const [b] = await db.select().from(bills).where(eq(bills.id, id));
  if (!b) return;
  await db.transaction(async (tx) => {
    await tx.update(bills).set({ lienWaiverReceived: received }).where(eq(bills.id, id));
    await audit({ userId: user.id, entity: 'project', entityId: b.projectId, action: 'lien-waiver', summary: `${received ? 'recorded the lien waiver' : 'took off the lien waiver'} for the bill${b.invoiceNumber ? ` #${b.invoiceNumber}` : ''}` }, tx);
  });
  revalidatePath(`/projects/${b.projectId}`);
}

export async function markBillPaid(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.pay');
  const id = uuidOrNull(d, 'id');
  const paidOn = str(d, 'paidOn') ?? today();
  if (!id) return { error: 'Not found.' };
  const [b] = await db.select().from(bills).where(eq(bills.id, id));
  if (!b) return { error: 'Not found.' };
  const blocker = payBlocker(b);
  if (blocker) return { error: blocker };
  if (!isDay(paidOn)) return { error: 'Enter the date it was paid.' };
  await db.transaction(async (tx) => {
    await tx.update(bills).set({ status: 'paid', paidOn, paidHow: str(d, 'paidHow') }).where(eq(bills.id, id));
    await audit({ userId: user.id, entity: 'project', entityId: b.projectId, action: 'bill-paid', summary: `marked the bill for $${Number(b.amount).toLocaleString('en-US')}${b.invoiceNumber ? ` (#${b.invoiceNumber})` : ''} paid on ${paidOn}` }, tx);
  });
  return done(b.projectId, 'Marked paid.');
}

export async function addDailyLog(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const loggedOn = str(d, 'loggedOn') ?? today();
  const work = str(d, 'work');
  if (!projectId) return { error: 'Not found.' };
  if (!isDay(loggedOn) || loggedOn > today()) return { error: 'Pick a date, today or earlier.' };
  if (!work) return { error: 'What was done today?' };
  const photos = d.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > 6) return { error: 'Up to 6 photos at a time.' };
  const r = await guard(async () => {
    await db.transaction(async (tx) => {
      const [l] = await tx.insert(dailyLogs).values({ projectId, loggedOn, onSite: str(d, 'onSite'), work, weather: str(d, 'weather'), userId: user.id }).returning();
      for (const f of photos) {
        const saved = await saveFile(f, { entity: 'daily_log', entityId: l.id }, user.id, { imagesOnly: true }, tx);
        if ('error' in saved) throw new FieldError(`${f.name}: ${saved.error}`);
      }
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'daily-log', summary: `logged the day (${loggedOn})${photos.length ? ` with ${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''}` }, tx);
    });
    return done(projectId, 'Logged.');
  });
  return r as FormResult;
}

export async function addHoldingCost(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const kind = str(d, 'kind');
  const incurredOn = str(d, 'incurredOn');
  if (!projectId || !kind) return { error: 'Pick what it was.' };
  if (!isDay(incurredOn)) return { error: 'Enter the date.' };
  const r = await guard(async () => {
    const amount = money(d, 'amount', 'Amount');
    if (!amount) return { error: 'Enter the amount.' };
    await db.transaction(async (tx) => {
      await tx.insert(holdingCosts).values({ projectId, kind, incurredOn, amount, notes: str(d, 'notes') });
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'holding-add', summary: `added a holding cost: ${kind}, $${Number(amount).toLocaleString('en-US')} (${incurredOn})` }, tx);
    });
    return done(projectId, 'Added.');
  });
  return r as FormResult;
}
