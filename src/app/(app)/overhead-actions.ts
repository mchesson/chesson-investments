'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { entities, overheadExpenses, vehicles } from '@/db/schema';
import type { FormResult } from '@/components/ActionForm';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { isDay, parseMoney } from '@/lib/format';
import { str, uuidOrNull } from '@/lib/forms';
import { isOverheadCategory, overheadLabel } from '@/lib/overhead';

/** One overhead expense, typed by hand or corrected (amount, date, vendor, category). */
export async function saveOverhead(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const entityId = uuidOrNull(d, 'entityId');
  const [e] = entityId ? await db.select({ name: entities.name }).from(entities).where(eq(entities.id, entityId)) : [];
  if (!e) return { error: 'Pick which business it was for.' };
  const amount = parseMoney(d.get('amount'));
  if (amount === undefined) return { error: 'Amount: a dollar amount.' };
  const spentOn = str(d, 'spentOn');
  if (spentOn && !isDay(spentOn)) return { error: 'Date: a real date.' };
  const category = str(d, 'category');
  const vehicleIn = uuidOrNull(d, 'vehicleId');
  const [veh] = vehicleIn ? await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleIn)) : [];
  const f = { entityId: entityId!, vendor: str(d, 'vendor'), amount, spentOn: spentOn ?? null, category: isOverheadCategory(category) ? category : 'other', notes: str(d, 'notes'), vehicleId: veh?.id ?? null };
  const id = uuidOrNull(d, 'id');
  await db.transaction(async (tx) => {
    if (!id) {
      const [row] = await tx.insert(overheadExpenses).values({ ...f, createdBy: user.id }).returning({ id: overheadExpenses.id });
      await audit({ userId: user.id, entity: 'entity', entityId: f.entityId, action: 'overhead-add', summary: `added overhead: ${f.vendor ?? overheadLabel(f.category)}${amount ? ` $${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''} (${overheadLabel(f.category)})`, after: { overheadId: row.id, ...f } }, tx);
      return;
    }
    const [old] = await tx.select().from(overheadExpenses).where(and(eq(overheadExpenses.id, id), isNull(overheadExpenses.archived)));
    if (!old) return;
    await tx.update(overheadExpenses).set(f).where(eq(overheadExpenses.id, id));
    const ch = diff(old as Record<string, unknown>, f);
    if (ch) await audit({ userId: user.id, entity: 'entity', entityId: f.entityId, action: 'overhead-update', summary: `changed overhead from ${old.vendor ?? overheadLabel(old.category)}: ${Object.keys(ch.after).join(', ')}`, ...ch }, tx);
  });
  revalidatePath('/overhead');
  return { ok: id ? 'Saved.' : 'Added.' };
}

export async function removeOverhead(id: string): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const [o] = await db.select().from(overheadExpenses).where(and(eq(overheadExpenses.id, id), isNull(overheadExpenses.archived)));
  if (!o) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.update(overheadExpenses).set({ archived: new Date() }).where(eq(overheadExpenses.id, id));
    await audit({ userId: user.id, entity: 'entity', entityId: o.entityId, action: 'overhead-remove', summary: `took off overhead from ${o.vendor ?? overheadLabel(o.category)}`, before: o }, tx);
  });
  revalidatePath('/overhead');
  return { ok: 'Taken off.' };
}
