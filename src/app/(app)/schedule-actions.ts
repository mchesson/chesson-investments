'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { assignments, budgetVersions, milestones } from '@/db/schema';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { str, uuidOrNull } from '@/lib/forms';
import { isDay, parseMoney, today } from '@/lib/format';
import { isResponsible, isVersionKind, responsibleLabel, versionLabel } from '@/lib/schedule';
import { projectMoney } from '@/lib/projects';
import type { FormResult } from '@/components/ActionForm';

const done = (projectId: string, ok: string) => { revalidatePath(`/projects/${projectId}`); return { ok }; };

/** Saves today's budget as a stage. Approved needs the owner, and becomes the baseline. */
export async function saveBudgetVersion(_: FormResult, d: FormData): Promise<FormResult> {
  const kind = str(d, 'kind');
  const user = await requireAction(kind === 'approved' ? 'users.manage' : 'projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  if (!projectId || !isVersionKind(kind)) return { error: 'Pick the stage.' };
  const m = await projectMoney(projectId);
  if (!m) return { error: 'Not found.' };
  const lines = m.codes.map((c) => ({ costCodeId: c.id, cents: m.money.get(c.id)?.budget ?? 0 }));
  const total = m.all.budget;
  await db.transaction(async (tx) => {
    const [v] = await tx.insert(budgetVersions).values({
      projectId, kind, label: str(d, 'label'), preparedBy: str(d, 'preparedBy'), lines, totalCents: total, notes: str(d, 'notes'), createdBy: user.id,
      ...(kind === 'approved' ? { approvedBy: user.id, approvedAt: new Date() } : {}),
    }).returning();
    await audit({ userId: user.id, entity: 'project', entityId: projectId, action: kind === 'approved' ? 'budget-approve' : 'budget-version', summary: `${kind === 'approved' ? 'approved the budget' : `saved the budget as the ${versionLabel(kind)}`} at $${(total / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, after: { versionId: v.id } }, tx);
  });
  return done(projectId, kind === 'approved' ? 'Approved: this is now the baseline.' : `Saved as the ${versionLabel(kind)}.`);
}

export async function saveMilestone(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const id = uuidOrNull(d, 'id');
  const name = str(d, 'name');
  if (!projectId || !name) return { error: 'Name the milestone.' };
  const day = (k: string) => { const v = str(d, k); return isDay(v) ? v : null; };
  const f = { name, plannedStart: day('plannedStart'), plannedEnd: day('plannedEnd'), actualStart: day('actualStart'), actualEnd: day('actualEnd'), source: str(d, 'source'), sort: Number(str(d, 'sort') ?? 0) || 0 };
  if (f.plannedStart && f.plannedEnd && f.plannedEnd < f.plannedStart) return { error: 'The end is before the start.' };
  await db.transaction(async (tx) => {
    if (!id) {
      const [m] = await tx.insert(milestones).values({ projectId, ...f }).returning();
      await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'milestone-add', summary: `added the milestone ${name}${f.plannedStart ? ` (${f.plannedStart})` : ''}`, after: { milestoneId: m.id } }, tx);
      return;
    }
    const [old] = await tx.select().from(milestones).where(and(eq(milestones.id, id), eq(milestones.projectId, projectId)));
    if (!old) return;
    await tx.update(milestones).set(f).where(eq(milestones.id, id));
    const ch = diff(old as Record<string, unknown>, f);
    if (ch) await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'milestone-update', summary: `changed the milestone ${name} (${Object.keys(ch.after).join(', ')}); commitments tied to it move with it`, ...ch }, tx);
  });
  return done(projectId, 'Saved.');
}

export async function saveAssignment(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const description = str(d, 'description');
  const responsible = str(d, 'responsible');
  if (!projectId || !description) return { error: 'Describe what’s owed.' };
  if (!isResponsible(responsible)) return { error: 'Pick who is responsible.' };
  const gcAllowance = parseMoney(d.get('gcAllowance'));
  const ourCost = parseMoney(d.get('ourCost'));
  if (gcAllowance === undefined || ourCost === undefined) return { error: 'Type dollar amounts, like 47,000.' };
  const milestoneId = uuidOrNull(d, 'milestoneId');
  const offsetRaw = str(d, 'offsetDays');
  const offsetDays = offsetRaw === null ? null : Number(offsetRaw);
  if (offsetRaw !== null && !Number.isInteger(offsetDays)) return { error: 'Days before or after: a whole number (negative = before).' };
  const dueOn = str(d, 'dueOn');
  if (!milestoneId && !isDay(dueOn)) return { error: 'Pick a due date, or tie it to a milestone.' };
  await db.transaction(async (tx) => {
    const [a] = await tx.insert(assignments).values({
      projectId, description, responsible, costCodeId: uuidOrNull(d, 'costCodeId'), personId: uuidOrNull(d, 'personId'), companyId: uuidOrNull(d, 'companyId'),
      userId: responsible === 'owner' ? user.id : null, gcAllowance, ourCost, milestoneId, offsetDays, dueOn: isDay(dueOn) ? dueOn : null, notes: str(d, 'notes'), createdBy: user.id,
    }).returning();
    await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'assignment-add', summary: `assigned “${description}” to ${responsibleLabel(responsible)}`, after: { assignmentId: a.id } }, tx);
  });
  return done(projectId, 'Added.');
}

export async function setAssignmentDone(id: string, isDone: boolean) {
  const user = await requireAction('projects.edit');
  const [a] = await db.select().from(assignments).where(eq(assignments.id, id));
  if (!a) return;
  await db.transaction(async (tx) => {
    await tx.update(assignments).set({ status: isDone ? 'done' : 'open', doneOn: isDone ? today() : null }).where(eq(assignments.id, id));
    await audit({ userId: user.id, entity: 'project', entityId: a.projectId, action: isDone ? 'assignment-done' : 'assignment-reopen', summary: `${isDone ? 'marked done' : 'reopened'} “${a.description}”` }, tx);
  });
  revalidatePath(`/projects/${a.projectId}`);
}
