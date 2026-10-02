'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { performMerge } from '@/lib/merge';
import { isUuid } from '@/lib/forms';
import type { FormResult } from '@/components/ActionForm';
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

/** Merge two records: everything moves to the one kept; the other is archived. */
export async function mergeRecords(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('records.delete');
  const kind = d.get('kind') === 'company' ? 'company' : d.get('kind') === 'person' ? 'person' : null;
  const keep = String(d.get('keep') ?? ''), a = String(d.get('a') ?? ''), b = String(d.get('b') ?? '');
  if (!kind || !isUuid(a) || !isUuid(b) || (keep !== a && keep !== b)) return { error: 'Pick which one to keep.' };
  const gone = keep === a ? b : a;
  // History: performMerge writes it on both records (merge-in, merge-out).
  const r = await performMerge(kind, keep, gone, user.id);
  if ('error' in r) return { error: r.error };
  revalidatePath('/', 'layout');
  redirect(`/${kind === 'person' ? 'people' : 'companies'}/${keep}?merged=${encodeURIComponent(r.goneName)}`);
}
