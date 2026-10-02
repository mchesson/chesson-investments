import 'server-only';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { dailyLogs, guestAccess, leases, milestones, projects, properties, rentals, users, vendorIssues } from '@/db/schema';
import { isLive, mayGuest, type GuestAbility } from './guests';
import { scheduleFor } from './schedule-data';
import { today } from './format';
import type { SessionUser } from './session';

// Everything a guest sees goes through here: always their own live access to
// the project, and only the fields a vendor may see (never money, never other
// vendors, never contacts).

export async function guestProjects(u: SessionUser) {
  const rows = await db.select({ a: guestAccess, name: projects.name, number: projects.projectNumber, address: projects.address, city: projects.city })
    .from(guestAccess).innerJoin(projects, eq(projects.id, guestAccess.projectId))
    .where(and(eq(guestAccess.userId, u.id), isNull(guestAccess.removed), isNull(projects.archived))).orderBy(asc(projects.name));
  const t = today();
  return rows.filter((r) => isLive(r.a, t));
}

/** The guest's access to one project, or null (not theirs, ended or taken off). */
export async function guestAccessTo(u: SessionUser, projectId: string) {
  const [a] = await db.select().from(guestAccess).where(and(eq(guestAccess.userId, u.id), eq(guestAccess.projectId, projectId), isNull(guestAccess.removed)));
  return a && isLive(a, today()) ? a : null;
}
export const guestMay = (a: Awaited<ReturnType<typeof guestAccessTo>>, x: GuestAbility) => !!a && mayGuest(a, x, today());

const theirs = (u: SessionUser) => (r: { companyId: string | null; personId: string | null }) =>
  (!!u.companyId && r.companyId === u.companyId) || (!!u.personId && r.personId === u.personId);

export async function guestProject(u: SessionUser, projectId: string) {
  const a = await guestAccessTo(u, projectId);
  if (!a) return null;
  const [p] = await db.select({ id: projects.id, name: projects.name, number: projects.projectNumber, address: projects.address, city: projects.city,
    state: projects.state, stage: projects.stage, stageStates: projects.stageStates, subStages: projects.subStages }).from(projects).where(eq(projects.id, projectId));
  if (!p) return null;
  const [rental] = await db.select({ status: rentals.status }).from(rentals).where(eq(rentals.projectId, projectId));
  const sched = guestMay(a, 'schedule') ? await scheduleFor(projectId) : null;
  const mine = theirs(u);
  return {
    access: a, project: { ...p, rentalStatus: rental?.status ?? null },
    milestones: sched ? sched.milestones.map((m) => ({ id: m.id, name: m.name, plannedStart: m.plannedStart, plannedEnd: m.plannedEnd, actualStart: m.actualStart, actualEnd: m.actualEnd })) : [],
    // Only their own commitments, without any amounts.
    commitments: sched ? sched.assignments.filter(mine).map((x) => ({ id: x.id, description: x.description, due: x.due, state: x.state, milestoneName: x.milestoneName, doneOn: x.doneOn })) : [],
    logs: guestMay(a, 'daily_log') ? await db.select({ id: dailyLogs.id, loggedOn: dailyLogs.loggedOn, onSite: dailyLogs.onSite, work: dailyLogs.work, weather: dailyLogs.weather, by: users.name })
      .from(dailyLogs).leftJoin(users, eq(users.id, dailyLogs.userId)).where(and(eq(dailyLogs.projectId, projectId), isNull(dailyLogs.archived))).orderBy(desc(dailyLogs.loggedOn)).limit(60) : [],
    issues: guestMay(a, 'issues') && (u.companyId || u.personId) ? await db.select({
      id: vendorIssues.id, number: vendorIssues.number, title: vendorIssues.title, details: vendorIssues.details, severity: vendorIssues.severity, status: vendorIssues.status,
      reportedOn: vendorIssues.reportedOn, dueOn: vendorIssues.dueOn, resolvedOn: vendorIssues.resolvedOn, vendorNote: vendorIssues.vendorNote,
    }).from(vendorIssues).where(and(eq(vendorIssues.projectId, projectId), isNull(vendorIssues.archived),
      or(u.companyId ? eq(vendorIssues.companyId, u.companyId) : sql`false`, u.personId ? eq(vendorIssues.personId, u.personId) : sql`false`)))
      .orderBy(desc(vendorIssues.reportedOn)) : [],
    // A property manager's view of the rental: where it stands and the lease's dates (no money).
    rental: guestMay(a, 'rental') ? {
      status: rental?.status ?? null,
      leases: await db.select({ id: leases.id, startsOn: leases.startsOn, endsOn: leases.endsOn, decideBy: leases.decideBy, renewalTerms: leases.renewalTerms, status: leases.status })
        .from(leases).where(eq(leases.projectId, projectId)).orderBy(desc(leases.startsOn)).limit(5),
    } : null,
    milestoneCount: (await db.select({ n: sql<number>`count(*)::int` }).from(milestones).where(eq(milestones.projectId, projectId)))[0]?.n ?? 0,
  };
}

/** The watchlist leads an agent or wholesaler sent us (address and where it stands only: never our offer or notes). */
export async function guestDeals(u: SessionUser & { guestExtras?: string[] | null }) {
  if (!u.personId) return [];
  const [me] = await db.select({ extras: users.guestExtras }).from(users).where(eq(users.id, u.id));
  if (!me?.extras?.includes('deals')) return [];
  return db.select({ id: properties.id, address: properties.address, city: properties.city, stage: properties.stage, created: properties.created })
    .from(properties).where(and(eq(properties.sourcePersonId, u.personId), isNull(properties.archived))).orderBy(desc(properties.created)).limit(200);
}

/** An outside partner given the Market Map (county sales only). */
export async function guestHasMarket(userId: string) {
  const [me] = await db.select({ extras: users.guestExtras, role: users.role }).from(users).where(eq(users.id, userId));
  return me?.role === 'guest' && !!me.extras?.includes('market');
}
