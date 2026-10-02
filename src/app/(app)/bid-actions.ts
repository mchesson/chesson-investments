'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { budgetLines, budgetVersions, companies, costCodes } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { bool, str, uuidOrNull } from '@/lib/forms';
import { isDay, parsePercent } from '@/lib/format';
import { contractTypes, isBidKind, linesFrom, totalOf, type BidLine } from '@/lib/bids';
import { saveFile } from '@/lib/files';
import type { FormResult } from '@/components/ActionForm';

const dollars = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

/** A GC's bid or our own estimate: who, when, the terms, amounts by cost code, the proposal file. */
export async function addBid(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const kind = str(d, 'bidKind');
  if (!projectId || !isBidKind(kind)) return { error: 'Pick GC Bid or Our Estimate.' };
  const companyId = uuidOrNull(d, 'companyId');
  if (kind === 'bid' && !companyId) return { error: 'Pick the GC who sent it.' };
  const contractType = str(d, 'contractType');
  if (contractType && !contractTypes.some((c) => c.key === contractType)) return { error: 'Pick fixed price or cost plus.' };
  const feePct = parsePercent(d.get('feePct'));
  if (feePct === undefined) return { error: 'Fee: a percent, like 20.' };
  const day = (k: string) => { const v = str(d, k); return v && !isDay(v) ? undefined : v; };
  const submittedOn = day('submittedOn'), validUntil = day('validUntil');
  if (submittedOn === undefined || validUntil === undefined) return { error: 'Pick real dates.' };
  const codes = await db.select({ id: costCodes.id }).from(costCodes);
  const lines = linesFrom(codes.map((c) => [c.id, String(d.get(`line_${c.id}`) ?? '')]));
  if ('error' in lines) return lines;
  if (!lines.length) return { error: 'Type at least one amount.' };
  const file = d.get('file');
  const total = totalOf(lines);
  const err = await db.transaction(async (tx) => {
    const [co] = companyId ? await tx.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)) : [];
    const [v] = await tx.insert(budgetVersions).values({
      projectId, kind, label: str(d, 'label'), preparedBy: str(d, 'preparedBy'), lines, totalCents: total, notes: str(d, 'notes'), createdBy: user.id,
      companyId, submittedOn, contractType, feePct, validUntil, status: kind === 'bid' ? 'open' : null,
    }).returning();
    if (file instanceof File && file.size > 0) {
      const saved = await saveFile(file, { entity: 'bid', entityId: v.id }, user.id, {}, tx);
      if ('error' in saved) throw new Error(saved.error);
    }
    await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'bid-add', summary: kind === 'bid' ? `added ${co?.name ?? 'a GC'}’s bid${submittedOn ? ` of ${submittedOn}` : ''} at ${dollars(total)}` : `added our estimate at ${dollars(total)}`, after: { versionId: v.id } }, tx);
    return null;
  }).catch((e: Error) => e.message);
  if (err) return { error: err };
  revalidatePath(`/projects/${projectId}`);
  return { ok: kind === 'bid' ? 'Bid added.' : 'Estimate added.' };
}

/**
 * The owner picks the winner: it becomes the approved budget (the baseline),
 * the other open bids are declined, and (when ticked) the working budget takes
 * its numbers. Everything before is kept in History.
 */
export async function selectBid(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('users.manage');
  const id = uuidOrNull(d, 'versionId');
  const reason = str(d, 'reason');
  if (!id) return { error: 'Not found.' };
  if (!reason) return { error: 'Say why this one wins.' };
  const [v] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, id));
  if (!v || !isBidKind(v.kind)) return { error: 'Not found.' };
  const lines = v.lines as BidLine[];
  await db.transaction(async (tx) => {
    const [co] = v.companyId ? await tx.select({ name: companies.name }).from(companies).where(eq(companies.id, v.companyId)) : [];
    const who = v.kind === 'ours' ? 'our estimate' : `${co?.name ?? 'the GC'}’s bid`;
    await tx.update(budgetVersions).set({ status: 'selected', decidedBy: user.id, decidedAt: new Date(), decidedReason: reason }).where(eq(budgetVersions.id, id));
    const others = await tx.select({ id: budgetVersions.id }).from(budgetVersions).where(and(eq(budgetVersions.projectId, v.projectId), eq(budgetVersions.kind, 'bid'), eq(budgetVersions.status, 'open')));
    const otherIds = others.map((o) => o.id).filter((x) => x !== id);
    if (otherIds.length) await tx.update(budgetVersions).set({ status: 'declined', decidedBy: user.id, decidedAt: new Date(), decidedReason: `Went with ${who}` }).where(inArray(budgetVersions.id, otherIds));
    const [approved] = await tx.insert(budgetVersions).values({ projectId: v.projectId, kind: 'approved', label: `From ${who}`, preparedBy: v.preparedBy, lines, totalCents: v.totalCents, notes: reason, approvedBy: user.id, approvedAt: new Date(), createdBy: user.id, companyId: v.companyId }).returning();
    let changed: { code: string; before: unknown; after: number }[] = [];
    if (bool(d, 'setWorking')) {
      const current = await tx.select({ id: budgetLines.id, costCodeId: budgetLines.costCodeId, amount: budgetLines.amount, pct: budgetLines.percentOfConstruction }).from(budgetLines).where(eq(budgetLines.projectId, v.projectId));
      const codeNames = new Map((await tx.select({ id: costCodes.id, code: costCodes.code }).from(costCodes)).map((c) => [c.id, c.code]));
      for (const l of lines) {
        const cur = current.find((c) => c.costCodeId === l.costCodeId);
        const amount = (l.cents / 100).toFixed(2);
        if (cur) await tx.update(budgetLines).set({ amount, percentOfConstruction: null, updated: new Date() }).where(eq(budgetLines.id, cur.id));
        else await tx.insert(budgetLines).values({ projectId: v.projectId, costCodeId: l.costCodeId, amount });
        changed.push({ code: codeNames.get(l.costCodeId) ?? '', before: cur ? (cur.pct ? `${cur.pct}%` : cur.amount) : null, after: l.cents / 100 });
      }
    }
    await audit({ userId: user.id, entity: 'project', entityId: v.projectId, action: 'bid-select',
      summary: `chose ${who} (${dollars(v.totalCents)}) as the winning budget: ${reason}${otherIds.length ? `; declined ${otherIds.length} other ${otherIds.length === 1 ? 'bid' : 'bids'}` : ''}${changed.length ? '; the working budget now uses its numbers' : ''}`,
      before: changed.length ? changed.map((c) => ({ code: c.code, amount: c.before })) : undefined, after: { approvedVersionId: approved.id, lines: changed.map((c) => ({ code: c.code, amount: c.after })) } }, tx);
  });
  revalidatePath(`/projects/${v.projectId}`);
  return { ok: 'Chosen. It’s now the approved budget.' };
}
