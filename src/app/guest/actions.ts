'use server';

import { and, eq, isNull, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { dailyLogs, vendorIssues } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireGuest } from '@/lib/session';
import { str, uuidOrNull } from '@/lib/forms';
import { isDay, today } from '@/lib/format';
import { guestAccessTo, guestMay } from '@/lib/guest-data';
import type { FormResult } from '@/components/ActionForm';

/** A guest adds to the daily log (when ticked for that project). */
export async function guestAddLog(_: FormResult, d: FormData): Promise<FormResult> {
  const u = await requireGuest();
  const projectId = uuidOrNull(d, 'projectId');
  const a = projectId ? await guestAccessTo(u, projectId) : null;
  if (!a || !guestMay(a, 'daily_log.add')) return { error: 'You can’t add to this project’s daily log.' };
  const work = str(d, 'work');
  if (!work) return { error: 'Say what was done.' };
  const loggedOn = str(d, 'loggedOn') ?? today();
  if (!isDay(loggedOn) || loggedOn > today()) return { error: 'Pick the day (today or earlier).' };
  await db.transaction(async (tx) => {
    const [l] = await tx.insert(dailyLogs).values({ projectId: a.projectId, loggedOn, work, onSite: str(d, 'onSite'), weather: str(d, 'weather'), userId: u.id }).returning();
    await audit({ userId: u.id, entity: 'project', entityId: a.projectId, action: 'daily-log', summary: `added to the daily log for ${loggedOn}: ${work.slice(0, 120)}`, after: { logId: l.id }, via: 'guest pages' }, tx);
  });
  revalidatePath(`/guest/projects/${a.projectId}`);
  return { ok: 'Added to the daily log.' };
}

/** A guest answers an issue with them: working on it, or fixed and ready for us to check. They never close it. */
export async function guestUpdateIssue(_: FormResult, d: FormData): Promise<FormResult> {
  const u = await requireGuest();
  const id = uuidOrNull(d, 'id');
  const to = str(d, 'status');
  const note = str(d, 'note');
  if (!id || (to !== 'in_progress' && to !== 'check')) return { error: 'Pick Working On It or Fixed: Please Check.' };
  if (!note) return { error: 'Say what you did or when you’ll do it.' };
  if (!u.companyId && !u.personId) return { error: 'Not found.' };
  const [i] = await db.select().from(vendorIssues).where(and(eq(vendorIssues.id, id), isNull(vendorIssues.archived),
    or(u.companyId ? eq(vendorIssues.companyId, u.companyId) : undefined, u.personId ? eq(vendorIssues.personId, u.personId) : undefined)));
  if (!i || !i.projectId) return { error: 'Not found.' };
  const a = await guestAccessTo(u, i.projectId);
  if (!a || !guestMay(a, 'issues')) return { error: 'Not found.' };
  if (i.status === 'resolved' || i.status === 'wont_fix') return { error: 'That issue is closed.' };
  await db.transaction(async (tx) => {
    await tx.update(vendorIssues).set({ status: to, vendorNote: note, vendorNoteAt: new Date(), vendorNoteBy: u.id, statusChangedAt: new Date() }).where(eq(vendorIssues.id, i.id));
    const summary = `${to === 'check' ? 'says issue' : 'is working on issue'} #${i.number}${to === 'check' ? ' is fixed: please check' : ''}: ${note}`;
    await audit({ userId: u.id, entity: 'issue', entityId: i.id, action: 'vendor-update', summary, before: { status: i.status }, after: { status: to, note }, via: 'guest pages' }, tx);
    await audit({ userId: u.id, entity: i.companyId ? 'company' : 'person', entityId: (i.companyId ?? i.personId)!, action: 'issue-status', summary, via: 'guest pages' }, tx);
  });
  revalidatePath(`/guest/projects/${i.projectId}`);
  return { ok: to === 'check' ? 'Thanks: we’ll check it.' : 'Saved.' };
}
