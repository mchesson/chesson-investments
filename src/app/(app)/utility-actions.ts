'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { companies, people, projectUtilities } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { str, uuidOrNull } from '@/lib/forms';
import { isDay } from '@/lib/format';
import { isUtilityService, utilityServiceLabel } from '@/lib/roles';
import type { FormResult } from '@/components/ActionForm';

/** Who supplies a utility at a property, and the person we deal with there. */
export async function addUtility(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const projectId = uuidOrNull(d, 'projectId');
  const service = str(d, 'service');
  const companyId = uuidOrNull(d, 'companyId');
  const personId = uuidOrNull(d, 'personId');
  if (!projectId) return { error: 'Not found.' };
  if (!isUtilityService(service)) return { error: 'Pick the service.' };
  if (!companyId && !personId) return { error: 'Pick the company or the person.' };
  const startedOn = str(d, 'startedOn');
  if (startedOn && !isDay(startedOn)) return { error: 'Started: pick a date.' };
  await db.transaction(async (tx) => {
    const [co] = companyId ? await tx.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)) : [];
    const [pe] = personId ? await tx.select({ f: people.firstName, l: people.lastName }).from(people).where(eq(people.id, personId)) : [];
    await tx.insert(projectUtilities).values({ projectId, service: service!, companyId, personId, startedOn, notes: str(d, 'notes'), createdBy: user.id });
    const who = [co?.name, pe ? `${pe.f} ${pe.l}` : null].filter(Boolean).join(', contact ');
    await audit({ userId: user.id, entity: 'project', entityId: projectId, action: 'utility-add', summary: `added ${utilityServiceLabel(service!)}: ${who}` }, tx);
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: 'Added.' };
}

export async function removeUtility(id: string) {
  const user = await requireAction('projects.edit');
  const [u] = await db.select().from(projectUtilities).where(and(eq(projectUtilities.id, id), isNull(projectUtilities.removed)));
  if (!u) return;
  await db.transaction(async (tx) => {
    await tx.update(projectUtilities).set({ removed: new Date() }).where(eq(projectUtilities.id, id));
    await audit({ userId: user.id, entity: 'project', entityId: u.projectId, action: 'utility-remove', summary: `took off ${utilityServiceLabel(u.service)}` }, tx);
  });
  revalidatePath(`/projects/${u.projectId}`);
}
