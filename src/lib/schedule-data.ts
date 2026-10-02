import 'server-only';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assignments, budgetVersions, companies, milestones, people, projects, users } from '@/db/schema';
import { commitmentState, dueDate } from './schedule';

export async function scheduleFor(projectId: string) {
  const [ms, as, versions] = await Promise.all([
    db.select().from(milestones).where(and(eq(milestones.projectId, projectId), isNull(milestones.archived))).orderBy(asc(milestones.sort), asc(milestones.plannedStart)),
    db.select({
      a: assignments,
      who: sql<string | null>`coalesce((select c.name from ${companies} c where c.id = ${assignments.companyId}), (select p.first_name || ' ' || p.last_name from ${people} p where p.id = ${assignments.personId}), (select u.name from ${users} u where u.id = ${assignments.userId}))`,
    }).from(assignments).where(and(eq(assignments.projectId, projectId), isNull(assignments.archived))).orderBy(asc(assignments.created)),
    db.select().from(budgetVersions).where(eq(budgetVersions.projectId, projectId)).orderBy(desc(budgetVersions.created)),
  ]);
  const byId = new Map(ms.map((m) => [m.id, m]));
  const items = as.map(({ a, who }) => {
    const due = dueDate(a, byId);
    return { ...a, who, due, state: commitmentState(a, due), milestoneName: a.milestoneId ? byId.get(a.milestoneId)?.name ?? null : null };
  });
  return { milestones: ms, assignments: items, versions };
}

/** Missed commitments across every project (Home). */
export async function missedEverywhere() {
  const rows = await db.select({ id: projects.id, name: projects.name }).from(projects).where(isNull(projects.archived));
  const out: { projectId: string; projectName: string; description: string; who: string | null; responsible: string; due: string }[] = [];
  for (const p of rows) {
    const s = await scheduleFor(p.id);
    for (const a of s.assignments) if (a.state === 'missed') out.push({ projectId: p.id, projectName: p.name, description: a.description, who: a.who, responsible: a.responsible, due: a.due! });
  }
  return out;
}
