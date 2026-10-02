'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { companies, grades, issuePeople, people, projects, vendorIssues } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { str, uuidOrNull } from '@/lib/forms';
import { isDay, parseMoney, today } from '@/lib/format';
import { doNotUseFromGrade, gradeParts, gradeProblem, overallGrade } from '@/lib/grades';
import { isClosed, isIssueStatus, isSeverity, issueStatusLabel, nextResolvedOn } from '@/lib/issues';
import type { FormResult } from '@/components/ActionForm';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Who = { personId: string | null; companyId: string | null };

function who(d: FormData): Who | null {
  const personId = uuidOrNull(d, 'personId');
  const companyId = uuidOrNull(d, 'companyId');
  return !personId === !companyId ? null : { personId, companyId };
}
const entityOf = (w: Who) => (w.personId ? 'person' : 'company') as 'person' | 'company';
const idOf = (w: Who) => (w.personId ?? w.companyId)!;
const forWho = (t: typeof grades | typeof vendorIssues, w: Who) => (w.personId ? eq(t.personId, w.personId) : eq(t.companyId, w.companyId!));

async function projectName(tx: Tx, id: string | null) {
  if (!id) return null;
  const [p] = await tx.select({ name: projects.name }).from(projects).where(eq(projects.id, id));
  return p?.name ?? null;
}

/** After any grade change: a D or F overall marks them Do Not Use (unless overridden); back up clears what the grade set. */
async function applyGradeRule(tx: Tx, w: Who, userId: string) {
  const gs = await tx.select({ grade: grades.grade }).from(grades).where(and(forWho(grades, w), isNull(grades.archived)));
  const o = overallGrade(gs);
  const table = w.personId ? people : companies;
  const [cur] = await tx.select({ doNotUse: table.doNotUse, reason: table.doNotUseReason, override: table.gradeOverride }).from(table).where(eq(table.id, idOf(w)));
  if (!cur) return;
  const next = doNotUseFromGrade(o, cur);
  if (!next) return;
  await tx.update(table).set(next.doNotUse
    ? { doNotUse: true, doNotUseReason: next.reason, doNotUseAt: new Date(), doNotUseBy: null }
    : { doNotUse: false, doNotUseReason: null, doNotUseAt: null, doNotUseBy: null }).where(eq(table.id, idOf(w)));
  await audit({ userId, entity: entityOf(w), entityId: idOf(w), action: next.doNotUse ? 'do-not-use' : 'do-not-use-clear',
    summary: next.doNotUse ? `marked them Do Not Use: ${next.reason} (the grade rule)` : `took off Do Not Use: their overall grade is ${o?.letter} now (the grade rule)`,
    before: cur, after: next, via: 'grade rule' }, tx);
}

/** A grade for one job (or their work in general), always with a justification. */
export async function saveGrade(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('vendors.grade');
  const w = who(d);
  if (!w) return { error: 'Not found.' };
  const id = uuidOrNull(d, 'id');
  const parts = Object.fromEntries(gradeParts.map((p) => [p.key, str(d, p.key)])) as Record<(typeof gradeParts)[number]['key'], string | null>;
  const f = { grade: str(d, 'grade'), justification: str(d, 'justification'), projectId: uuidOrNull(d, 'projectId'), gradedOn: str(d, 'gradedOn') ?? today(), ...parts };
  const problem = gradeProblem({ grade: f.grade, justification: f.justification, parts });
  if (problem) return { error: problem };
  if (!isDay(f.gradedOn)) return { error: 'Graded on needs a date.' };
  await db.transaction(async (tx) => {
    const job = await projectName(tx, f.projectId);
    const row = { ...f, grade: f.grade!, justification: f.justification! };
    if (!id) {
      const [g] = await tx.insert(grades).values({ ...row, personId: w.personId, companyId: w.companyId, gradedBy: user.id }).returning();
      await audit({ userId: user.id, entity: entityOf(w), entityId: idOf(w), action: 'grade', summary: `graded them ${g.grade}${job ? ` on ${job}` : ''}: ${g.justification}`, after: row }, tx);
      if (f.projectId) await audit({ userId: user.id, entity: 'project', entityId: f.projectId, action: 'grade', summary: `graded a vendor ${g.grade}: ${g.justification}`, after: { ...row, gradeId: g.id } }, tx);
    } else {
      const [old] = await tx.select().from(grades).where(and(eq(grades.id, id), forWho(grades, w)));
      if (!old) throw new Error('Not found');
      await tx.update(grades).set(row).where(eq(grades.id, id));
      await audit({ userId: user.id, entity: entityOf(w), entityId: idOf(w), action: 'grade-edit', summary: `changed a grade${job ? ` on ${job}` : ''} from ${old.grade} to ${row.grade}: ${row.justification}`, before: old, after: row }, tx);
    }
    await applyGradeRule(tx, w, user.id);
  });
  revalidatePath('/', 'layout');
  return { ok: 'Grade saved.' };
}

export async function archiveGrade(personId: string | null, companyId: string | null, gradeId: string) {
  const user = await requireAction('vendors.grade');
  const w = { personId, companyId };
  if (!personId === !companyId) return;
  await db.transaction(async (tx) => {
    const [g] = await tx.update(grades).set({ archived: new Date() }).where(and(eq(grades.id, gradeId), forWho(grades, w), isNull(grades.archived))).returning();
    if (!g) return;
    await audit({ userId: user.id, entity: entityOf(w), entityId: idOf(w), action: 'grade-remove', summary: `took off a ${g.grade} grade (${g.justification})`, before: g }, tx);
    await applyGradeRule(tx, w, user.id);
  });
  revalidatePath('/', 'layout');
}

/** Keep using them although their grade is D or below, with why (or take the override off). */
export async function setGradeOverride(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('vendors.grade');
  const w = who(d);
  if (!w) return { error: 'Not found.' };
  const on = d.get('on') === '1';
  const reason = str(d, 'reason');
  if (on && (reason ?? '').length < 10) return { error: 'Say why they stay usable despite the grade.' };
  const table = w.personId ? people : companies;
  await db.transaction(async (tx) => {
    await tx.update(table).set({ gradeOverride: on, gradeOverrideReason: on ? reason : null }).where(eq(table.id, idOf(w)));
    await audit({ userId: user.id, entity: entityOf(w), entityId: idOf(w), action: on ? 'grade-override' : 'grade-override-clear',
      summary: on ? `kept them usable despite their grade: ${reason}` : 'took off the grade override', after: { gradeOverride: on, reason } }, tx);
    if (on) {
      // The override lifts a Do Not Use the grade set (one set by hand stays).
      const [cur] = await tx.select({ reason: table.doNotUseReason, on: table.doNotUse }).from(table).where(eq(table.id, idOf(w)));
      if (cur?.on && (cur.reason ?? '').startsWith('Overall grade')) {
        await tx.update(table).set({ doNotUse: false, doNotUseReason: null, doNotUseAt: null, doNotUseBy: null }).where(eq(table.id, idOf(w)));
        await audit({ userId: user.id, entity: entityOf(w), entityId: idOf(w), action: 'do-not-use-clear', summary: `took off Do Not Use (the grade override): ${reason}`, before: cur }, tx);
      }
    } else {
      await applyGradeRule(tx, w, user.id);
    }
  });
  revalidatePath('/', 'layout');
  return { ok: on ? 'They stay usable.' : 'Override taken off.' };
}

/** Who was involved: people on file (`people`) and our staff (`staff`), each with what they did. */
async function saveInvolved(tx: Tx, issueId: string, d: FormData) {
  const ps = d.getAll('involvedPeople').map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const us = d.getAll('involvedStaff').map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  await tx.delete(issuePeople).where(eq(issuePeople.issueId, issueId));
  const rows = [...ps.map((personId) => ({ issueId, personId, role: str(d, `role.${personId}`) ?? 'involved' })), ...us.map((userId) => ({ issueId, userId, role: str(d, `role.${userId}`) ?? 'involved' }))];
  if (rows.length) await tx.insert(issuePeople).values(rows);
  return rows.length;
}

/** A new issue, or edits to one. */
export async function saveIssue(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('vendors.grade');
  const w = who(d);
  if (!w) return { error: 'Not found.' };
  const id = uuidOrNull(d, 'id');
  const title = str(d, 'title');
  if (!title) return { error: 'Say what the issue is.' };
  const severity = str(d, 'severity') ?? 'medium';
  if (!isSeverity(severity)) return { error: 'Pick how serious it is.' };
  const reportedOn = str(d, 'reportedOn') ?? today();
  const dueOn = str(d, 'dueOn');
  if (!isDay(reportedOn) || (dueOn && !isDay(dueOn))) return { error: 'Dates need to be real dates.' };
  const costToFix = parseMoney(str(d, 'costToFix'));
  if (costToFix === undefined) return { error: 'Cost to fix needs to be an amount.' };
  const f = { title, details: str(d, 'details'), severity, reportedOn, dueOn, projectId: uuidOrNull(d, 'projectId'), costToFix };
  await db.transaction(async (tx) => {
    const job = await projectName(tx, f.projectId);
    if (!id) {
      const [i] = await tx.insert(vendorIssues).values({ ...f, personId: w.personId, companyId: w.companyId, reportedBy: user.id }).returning();
      const n = await saveInvolved(tx, i.id, d);
      await audit({ userId: user.id, entity: entityOf(w), entityId: idOf(w), action: 'issue', summary: `opened issue #${i.number}${job ? ` on ${job}` : ''}: ${title}${n ? ` (${n} involved)` : ''}`, after: f }, tx);
      await audit({ userId: user.id, entity: 'issue', entityId: i.id, action: 'create', summary: `opened it: ${title}`, after: f }, tx);
      if (f.projectId) await audit({ userId: user.id, entity: 'project', entityId: f.projectId, action: 'issue', summary: `opened a vendor issue #${i.number}: ${title}`, after: { issueId: i.id } }, tx);
    } else {
      const [old] = await tx.select().from(vendorIssues).where(and(eq(vendorIssues.id, id), forWho(vendorIssues, w)));
      if (!old) throw new Error('Not found');
      await tx.update(vendorIssues).set(f).where(eq(vendorIssues.id, id));
      await saveInvolved(tx, id, d);
      await audit({ userId: user.id, entity: 'issue', entityId: id, action: 'update', summary: 'edited it', before: old, after: f }, tx);
      await audit({ userId: user.id, entity: entityOf(w), entityId: idOf(w), action: 'issue-edit', summary: `edited issue #${old.number}: ${title}`, after: f }, tx);
    }
  });
  revalidatePath('/', 'layout');
  return { ok: 'Issue saved.' };
}

/** Move an issue to another status; closing it records when it was fixed and how. */
export async function setIssueStatus(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('vendors.grade');
  const id = uuidOrNull(d, 'id');
  const to = str(d, 'status');
  if (!id || !isIssueStatus(to)) return { error: 'Pick a status.' };
  const resolvedGiven = str(d, 'resolvedOn');
  if (resolvedGiven && !isDay(resolvedGiven)) return { error: 'Fixed on needs a date.' };
  const resolution = str(d, 'resolution');
  if (isClosed(to) && !resolution) return { error: 'Say how it was fixed (or why it was closed).' };
  await db.transaction(async (tx) => {
    const [old] = await tx.select().from(vendorIssues).where(eq(vendorIssues.id, id));
    if (!old) throw new Error('Not found');
    const resolvedOn = nextResolvedOn(to, resolvedGiven, old.resolvedOn, today());
    await tx.update(vendorIssues).set({ status: to, resolvedOn, resolution: resolution ?? old.resolution, statusChangedAt: new Date() }).where(eq(vendorIssues.id, id));
    const summary = `moved issue #${old.number} from ${issueStatusLabel(old.status)} to ${issueStatusLabel(to)}${resolution ? `: ${resolution}` : ''}`;
    const w = { personId: old.personId, companyId: old.companyId };
    await audit({ userId: user.id, entity: 'issue', entityId: id, action: 'status', summary, before: { status: old.status, resolvedOn: old.resolvedOn }, after: { status: to, resolvedOn, resolution } }, tx);
    await audit({ userId: user.id, entity: entityOf(w), entityId: idOf(w), action: 'issue-status', summary }, tx);
  });
  revalidatePath('/', 'layout');
  return { ok: 'Moved.' };
}
