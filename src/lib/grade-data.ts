import 'server-only';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bills, budgetVersions, commitments, companies, grades, issuePeople, people, projects, users, vendorIssues } from '@/db/schema';
import { overallGrade } from './grades';

export type Who = { personId?: string | null; companyId?: string | null };
const whoGrades = (w: Who) => (w.personId ? eq(grades.personId, w.personId) : eq(grades.companyId, w.companyId!));
const whoIssues = (w: Who) => (w.personId ? eq(vendorIssues.personId, w.personId) : eq(vendorIssues.companyId, w.companyId!));

/** Every grade for a company or person, newest first, with the job and who graded it. */
export async function gradesFor(w: Who) {
  const rows = await db.select({
    id: grades.id, grade: grades.grade, quality: grades.quality, schedule: grades.schedule, budget: grades.budget, communication: grades.communication,
    justification: grades.justification, gradedOn: grades.gradedOn, projectId: grades.projectId, projectName: projects.name, gradedBy: users.name,
  }).from(grades).leftJoin(projects, eq(projects.id, grades.projectId)).leftJoin(users, eq(users.id, grades.gradedBy))
    .where(and(whoGrades(w), isNull(grades.archived))).orderBy(desc(grades.gradedOn), desc(grades.created));
  return { rows, overall: overallGrade(rows) };
}

/** Issues for a company, a person or a project, with who was involved. */
export async function issuesFor(w: Who & { projectId?: string | null }) {
  const where = w.projectId ? eq(vendorIssues.projectId, w.projectId) : whoIssues(w);
  const rows = await db.select({
    id: vendorIssues.id, number: vendorIssues.number, title: vendorIssues.title, details: vendorIssues.details, severity: vendorIssues.severity,
    status: vendorIssues.status, reportedOn: vendorIssues.reportedOn, dueOn: vendorIssues.dueOn, resolvedOn: vendorIssues.resolvedOn,
    resolution: vendorIssues.resolution, costToFix: vendorIssues.costToFix, vendorNote: vendorIssues.vendorNote, vendorNoteAt: vendorIssues.vendorNoteAt, projectId: vendorIssues.projectId, projectName: projects.name,
    personId: vendorIssues.personId, companyId: vendorIssues.companyId, reportedBy: users.name,
    vendorName: sql<string | null>`coalesce((select c.name from companies c where c.id = "vendor_issues"."company_id"), (select p.first_name || ' ' || p.last_name from people p where p.id = "vendor_issues"."person_id"))`,
  }).from(vendorIssues).leftJoin(projects, eq(projects.id, vendorIssues.projectId)).leftJoin(users, eq(users.id, vendorIssues.reportedBy))
    .where(and(where, isNull(vendorIssues.archived))).orderBy(desc(vendorIssues.reportedOn), desc(vendorIssues.number));
  const ids = rows.map((r) => r.id);
  const inv = ids.length ? await db.select({
    issueId: issuePeople.issueId, personId: issuePeople.personId, userId: issuePeople.userId, role: issuePeople.role,
    personName: sql<string | null>`${people.firstName} || ' ' || ${people.lastName}`, companyName: companies.name, userName: users.name,
  }).from(issuePeople).leftJoin(people, eq(people.id, issuePeople.personId)).leftJoin(companies, eq(companies.id, people.companyId))
    .leftJoin(users, eq(users.id, issuePeople.userId)).where(inArray(issuePeople.issueId, ids)).orderBy(asc(issuePeople.created)) : [];
  return rows.map((r) => ({ ...r, involved: inv.filter((i) => i.issueId === r.id) }));
}
export type IssueRow = Awaited<ReturnType<typeof issuesFor>>[number];

/** The vendors on a job: whoever billed it, has a commitment on it, or sent a bid; with their grade on this job. */
export async function vendorsOnProject(projectId: string) {
  const rows = await db.execute<{ company_id: string | null; person_id: string | null; name: string }>(sql`
    select distinct v.company_id, v.person_id, coalesce(c.name, p.first_name || ' ' || p.last_name) as name from (
      select vendor_company_id as company_id, vendor_person_id as person_id from ${bills} where project_id = ${projectId} and archived_at is null
      union select vendor_company_id, vendor_person_id from ${commitments} where project_id = ${projectId}
      union select company_id, person_id from ${budgetVersions} where project_id = ${projectId} and (company_id is not null or person_id is not null)
      union select company_id, person_id from ${grades} where project_id = ${projectId} and archived_at is null
      union select company_id, person_id from ${vendorIssues} where project_id = ${projectId} and archived_at is null
    ) v left join ${companies} c on c.id = v.company_id left join ${people} p on p.id = v.person_id
    where v.company_id is not null or v.person_id is not null order by name`);
  const vs = rows.rows.filter((v) => v.name);
  const gs = vs.length ? await db.select({ companyId: grades.companyId, personId: grades.personId, grade: grades.grade, justification: grades.justification, gradedOn: grades.gradedOn })
    .from(grades).where(and(eq(grades.projectId, projectId), isNull(grades.archived), or(
      vs.some((v) => v.company_id) ? inArray(grades.companyId, vs.flatMap((v) => (v.company_id ? [v.company_id] : []))) : sql`false`,
      vs.some((v) => v.person_id) ? inArray(grades.personId, vs.flatMap((v) => (v.person_id ? [v.person_id] : []))) : sql`false`,
    ))) : [];
  return vs.map((v) => ({ companyId: v.company_id, personId: v.person_id, name: v.name,
    grades: gs.filter((g) => (v.company_id ? g.companyId === v.company_id : g.personId === v.person_id)) }));
}
