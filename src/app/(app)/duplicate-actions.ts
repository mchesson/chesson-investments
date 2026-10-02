'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { duplicateDismissals } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';

/** "Not the same": the pair stops showing on Possible Duplicates. History on both records. */
export async function notTheSame(kind: 'person' | 'company', a: string, b: string, aName: string, bName: string) {
  const user = await requireAction('records.delete');
  const [x, y] = a < b ? [a, b] : [b, a];
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(duplicateDismissals).values({ kind, aId: x, bId: y, dismissedBy: user.id }).onConflictDoNothing().returning();
    if (!row) return;
    await audit({ userId: user.id, entity: kind, entityId: a, action: 'not-duplicate', summary: `said ${aName} and ${bName} are not the same ${kind === 'person' ? 'person' : 'company'}`, via: 'Possible Duplicates' }, tx);
    await audit({ userId: user.id, entity: kind, entityId: b, action: 'not-duplicate', summary: `said ${bName} and ${aName} are not the same ${kind === 'person' ? 'person' : 'company'}`, via: 'Possible Duplicates' }, tx);
  });
  revalidatePath('/admin/duplicates');
}
