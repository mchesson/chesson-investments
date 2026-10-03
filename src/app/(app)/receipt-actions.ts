'use server';

import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { billLines, bills, costCodes, entities, files, overheadExpenses, projects } from '@/db/schema';
import type { FormResult } from '@/components/ActionForm';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { detectFile } from '@/lib/file-rules';
import { putObject, storageOn } from '@/lib/storage';
import { classify } from '@/lib/doc-filing-ai';
import { targetsFor } from '@/lib/doc-targets';
import { scrubTitle } from '@/lib/doc-filing';
import { docCaption } from '@/lib/doc-types';
import { formatMoney, isDay, parseMoney, today } from '@/lib/format';
import { str, uuidOrNull } from '@/lib/forms';
import { isOverheadCategory, overheadLabel } from '@/lib/overhead';
import { HOLDING_KINDS } from '@/lib/cost-codes';

// Snap a Receipt (owner, Oct 3, 2026: "take a pic and send"): the photo is read,
// what was read is shown to confirm, and it becomes a paid receipt on the
// property (a bill, so it counts in the budget) or a business overhead expense,
// with the photo attached. Reading is long work: it runs through /api/work.

export type ReceiptReading = {
  fileId: string; vendor: string | null; amount: number | null; spentOn: string | null;
  where: { kind: 'project' | 'overhead'; id: string } | null; category: string | null; read: boolean;
};

const MAX = 4 * 1024 * 1024;

/** Keeps the photo (waiting in the inbox until it's saved) and reads it. */
export async function readReceipt(form: FormData): Promise<ReceiptReading | { error: string }> {
  const user = await requireAction('bills.edit');
  const f = form.get('file');
  if (!(f instanceof File) || !f.size) return { error: 'Take a photo of the receipt first.' };
  if (f.size > MAX) return { error: 'That file is over 4 MB: take the photo again, or use Drop Documents for big files.' };
  const bytes = Buffer.from(await f.arrayBuffer());
  const kind = detectFile(bytes);
  if (!kind) return { error: 'A receipt must be a photo (JPEG, PNG, WebP, HEIC) or a PDF.' };
  const targets = await targetsFor(user);
  const { filing } = await classify({ name: f.name || 'receipt', type: kind.type, bytes }, targets);
  const projectHint = uuidOrNull(form, 'projectId');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const caption = docCaption('Receipt', filing?.vendor ? scrubTitle(filing.vendor) : null);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(files).values({
      entity: 'inbox', entityId: user.id, name: (f.name || `receipt.${kind.ext}`).slice(0, 200), contentType: kind.type, size: bytes.length, sha256,
      data: storageOn() ? null : bytes, caption, uploadedBy: user.id,
    }).returning({ id: files.id });
    if (storageOn()) {
      const path = `inbox/${row.id}.${kind.ext}`;
      await putObject(path, bytes, kind.type);
      await tx.update(files).set({ storagePath: path }).where(eq(files.id, row.id));
    }
    await audit({ userId: user.id, entity: 'user', entityId: user.id, action: 'doc-add', via: 'Snap a Receipt', summary: `took a photo of a receipt${filing?.vendor ? ` from ${scrubTitle(filing.vendor)}` : ''} (waiting to be saved)`, after: { fileId: row.id } }, tx);
    return row.id;
  });
  const t = filing && filing.targetId ? targets.find((x) => x.id === filing.targetId) : null;
  const where = projectHint ? { kind: 'project' as const, id: projectHint }
    : t && filing?.targetKind === 'project' ? { kind: 'project' as const, id: t.id }
      : t && filing?.targetKind === 'overhead' ? { kind: 'overhead' as const, id: t.id } : null;
  const amount = typeof filing?.amount === 'number' && filing.amount >= 0 && filing.amount < 10_000_000 ? Math.round(filing.amount * 100) / 100 : null;
  return {
    fileId: id, vendor: filing?.vendor ? scrubTitle(filing.vendor).slice(0, 100) : null, amount,
    spentOn: filing?.documentDate && isDay(filing.documentDate) ? filing.documentDate : null,
    where, category: filing?.overheadCategory ?? null, read: !!filing,
  };
}

/** Saves the confirmed receipt: a paid receipt on the property, or overhead for a business. */
export async function saveReceipt(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const fileId = uuidOrNull(d, 'fileId');
  const [file] = fileId ? await db.select().from(files).where(and(eq(files.id, fileId), eq(files.entity, 'inbox'), isNull(files.archived))) : [];
  if (!file) return { error: 'The photo isn’t waiting any more: take it again.' };
  const amount = parseMoney(d.get('amount'));
  if (!amount) return { error: 'Amount: what the receipt totals.' };
  const spentOn = str(d, 'spentOn') ?? today();
  if (!isDay(spentOn)) return { error: 'Date: a real date.' };
  const vendor = str(d, 'vendor');
  if (!vendor) return { error: 'Who was it paid to?' };
  const where = str(d, 'where') ?? '';
  const [kind, id] = where.split(':');
  const notes = str(d, 'notes');
  if (kind === 'project' && id) {
    const [p] = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.id, id), isNull(projects.archived)));
    if (!p) return { error: 'Pick the property it was for.' };
    const lineKind = str(d, 'lineKind') === 'holding' ? 'holding' : 'build';
    const costCodeId = uuidOrNull(d, 'costCodeId');
    if (lineKind === 'build') {
      if (!costCodeId) return { error: 'Pick the cost code it goes against.' };
      const [c] = await db.select({ id: costCodes.id }).from(costCodes).where(eq(costCodes.id, costCodeId));
      if (!c) return { error: 'Pick the cost code it goes against.' };
    }
    const typed = str(d, 'holdingKind');
    const holdingKind = lineKind === 'holding' ? (HOLDING_KINDS as readonly string[]).includes(typed ?? '') ? typed : 'Other' : null;
    await db.transaction(async (tx) => {
      const [b] = await tx.insert(bills).values({
        projectId: p.id, costCodeId: lineKind === 'build' ? costCodeId : null, vendorName: vendor, kind: 'receipt', invoiceOn: spentOn, amount,
        lienWaiverRequired: false, notes, createdBy: user.id, status: 'paid', approvedBy: user.id, approvedAt: new Date(), paidOn: spentOn, paidHow: str(d, 'paidHow'),
      }).returning();
      await tx.insert(billLines).values({ billId: b.id, kind: lineKind, costCodeId: lineKind === 'build' ? costCodeId : null, holdingKind, description: vendor, amount, sort: 0 });
      await tx.update(files).set({ entity: 'bill', entityId: b.id, caption: docCaption('Receipt', vendor) }).where(eq(files.id, file.id));
      await tx.update(bills).set({ fileId: file.id }).where(eq(bills.id, b.id));
      await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'bill-add', via: 'Snap a Receipt', summary: `added a receipt from ${vendor} for ${formatMoney(amount, { cents: true })} (paid ${spentOn})`, after: { billId: b.id, vendor, amount, spentOn, lineKind, costCodeId, fileId: file.id } }, tx);
    });
    revalidatePath(`/projects/${p.id}`);
    return { ok: `Saved on ${p.name}: ${vendor}, ${formatMoney(amount, { cents: true })}.` };
  }
  if (kind === 'overhead' && id) {
    const [e] = await db.select({ id: entities.id, name: entities.name }).from(entities).where(and(eq(entities.id, id), isNull(entities.archived)));
    if (!e) return { error: 'Pick the business it was for.' };
    const category = str(d, 'category');
    const cat = isOverheadCategory(category) ? category : 'other';
    await db.transaction(async (tx) => {
      const [o] = await tx.insert(overheadExpenses).values({ entityId: e.id, fileId: file.id, vendor, amount, spentOn, category: cat, notes, createdBy: user.id }).returning({ id: overheadExpenses.id });
      await tx.update(files).set({ entity: 'overhead', entityId: e.id, caption: docCaption('Receipt', vendor) }).where(eq(files.id, file.id));
      await audit({ userId: user.id, entity: 'entity', entityId: e.id, action: 'overhead-add', via: 'Snap a Receipt', summary: `added overhead: ${vendor} ${formatMoney(amount, { cents: true })} (${overheadLabel(cat)})`, after: { overheadId: o.id, vendor, amount, spentOn, category: cat, fileId: file.id } }, tx);
    });
    revalidatePath('/overhead');
    return { ok: `Saved as ${e.name} overhead: ${vendor}, ${formatMoney(amount, { cents: true })}.` };
  }
  return { error: 'Pick where it goes: a property, or business overhead.' };
}
