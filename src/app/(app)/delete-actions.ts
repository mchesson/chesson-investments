'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { companies, people } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { str, uuidOrNull } from '@/lib/forms';
import { confirmMatches } from '@/lib/delete-rules';
import { performDelete, type Kind } from '@/lib/delete';
import type { FormResult } from '@/components/ActionForm';

const isKind = (k: string | null): k is Kind => k === 'person' || k === 'company';
async function nameOf(kind: Kind, id: string) {
  if (kind === 'person') { const [p] = await db.select({ f: people.firstName, l: people.lastName, a: people.archived }).from(people).where(eq(people.id, id)); return p ? { name: `${p.f} ${p.l}`.trim(), archived: p.a } : null; }
  const [c] = await db.select({ n: companies.name, a: companies.archived }).from(companies).where(eq(companies.id, id));
  return c ? { name: c.n, archived: c.a } : null;
}

/** Archive hides a person or company everywhere; Restore brings it back. Both in History. */
export async function setArchived(kind: string, id: string, archived: boolean) {
  const user = await requireAction('contacts.edit');
  if (!isKind(kind)) return;
  const rec = await nameOf(kind, id);
  if (!rec) return;
  const table = kind === 'person' ? people : companies;
  await db.transaction(async (tx) => {
    await tx.update(table).set({ archived: archived ? new Date() : null }).where(eq(table.id, id));
    await audit({ userId: user.id, entity: kind, entityId: id, action: archived ? 'archive' : 'restore', summary: archived ? `archived ${rec.name}` : `restored ${rec.name}`, via: archived ? 'Archive' : 'Archived Records' }, tx);
  });
  revalidatePath('/', 'layout');
  if (archived) redirect(kind === 'person' ? '/people' : '/companies');
}

/** The owner only, after typing the name. */
export async function deleteRecord(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('records.delete');
  const kind = str(d, 'kind');
  const id = uuidOrNull(d, 'id');
  if (!isKind(kind) || !id) return { error: 'Not found.' };
  const rec = await nameOf(kind, id);
  if (!rec) return { error: 'Not found.' };
  if (!confirmMatches(str(d, 'confirm') ?? '', rec.name)) return { error: `Type the name exactly: ${rec.name}` };
  const r = await performDelete(kind, id, user.id, rec.name);
  if ('error' in r) return { error: r.error };
  revalidatePath('/', 'layout');
  redirect(`/admin/archived?deleted=${encodeURIComponent(rec.name)}`);
}
