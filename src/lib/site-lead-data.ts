import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { people, properties, siteLeadNotes, siteLeads, sitePageViews, users } from '@/db/schema';
import { addDays, today } from './format';
import { isLeadKind, isLeadStatus, sourceName } from './site-leads';
import { ref } from './sql-ref';

export const LEADS_PAGE = 50;

/** Website leads, newest first, by status and kind, with the count for each status. */
export async function listLeads(opts: { status?: string | null; kind?: string | null; page?: number }) {
  const where: SQL[] = [isNull(siteLeads.archived)];
  if (isLeadKind(opts.kind)) where.push(eq(siteLeads.kind, opts.kind));
  const counts = await db.select({ status: siteLeads.status, n: sql<number>`count(*)`.mapWith(Number) }).from(siteLeads).where(and(...where)).groupBy(siteLeads.status);
  if (isLeadStatus(opts.status)) where.push(eq(siteLeads.status, opts.status));
  const page = Math.max(1, opts.page ?? 1);
  const rows = await db.select({
    id: siteLeads.id, kind: siteLeads.kind, status: siteLeads.status, name: siteLeads.name, email: siteLeads.email, phone: siteLeads.phone,
    topic: siteLeads.topic, message: siteLeads.message, propertyAddress: siteLeads.propertyAddress, propertyCity: siteLeads.propertyCity,
    utmSource: siteLeads.utmSource, referrer: siteLeads.referrer, created: siteLeads.created, personId: siteLeads.personId,
    handledByName: sql<string | null>`(select u.name from ${users} u where u.id = ${ref(siteLeads.handledBy)})`,
    total: sql<number>`count(*) over ()`.mapWith(Number),
  }).from(siteLeads).where(and(...where)).orderBy(desc(siteLeads.created)).limit(LEADS_PAGE).offset((page - 1) * LEADS_PAGE);
  return { rows, total: rows[0]?.total ?? 0, page, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number> };
}

export async function getLead(id: string) {
  const [lead] = await db.select().from(siteLeads).where(eq(siteLeads.id, id));
  if (!lead) return null;
  const [handler] = lead.handledBy ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, lead.handledBy)) : [];
  const [person] = lead.personId ? await db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName }).from(people).where(eq(people.id, lead.personId)) : [];
  const [property] = lead.propertyId ? await db.select({ id: properties.id, address: properties.address }).from(properties).where(eq(properties.id, lead.propertyId)) : [];
  const notes = await db.select({ id: siteLeadNotes.id, text: siteLeadNotes.text, created: siteLeadNotes.created, userName: users.name })
    .from(siteLeadNotes).leftJoin(users, eq(users.id, siteLeadNotes.userId)).where(eq(siteLeadNotes.leadId, id)).orderBy(desc(siteLeadNotes.created));
  return { lead, handler: handler ?? null, person: person ?? null, property: property ?? null, notes };
}

/** People on file with the lead's email or phone: probably the same person. */
export function sameOnFile(lead: { email: string | null; phone: string | null }) {
  if (!lead.email && !lead.phone) return Promise.resolve([]);
  return db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email, phone: people.phone }).from(people)
    .where(and(isNull(people.archived), or(lead.email ? eq(people.email, lead.email) : sql`false`, lead.phone ? eq(people.phone, lead.phone) : sql`false`))).limit(5);
}

/** Staff who can work a lead (anyone signed in with a staff role). */
export function leadHandlers() {
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users)
    .where(and(eq(users.active, true), inArray(users.role, ['owner', 'admin', 'staff', 'partner']))).orderBy(asc(users.name));
}

/** Visits counted on our own server: per page and per day, the last `days` days. */
export async function websiteVisits(days = 30) {
  const from = addDays(today(), -(days - 1));
  const byPage = await db.select({ path: sitePageViews.path, views: sql<number>`sum(${sitePageViews.views})`.mapWith(Number) })
    .from(sitePageViews).where(gte(sitePageViews.day, from)).groupBy(sitePageViews.path).orderBy(desc(sql`sum(${sitePageViews.views})`)).limit(25);
  const byDay = await db.select({ day: sitePageViews.day, views: sql<number>`sum(${sitePageViews.views})`.mapWith(Number) })
    .from(sitePageViews).where(gte(sitePageViews.day, from)).groupBy(sitePageViews.day).orderBy(asc(sitePageViews.day));
  // Every day in the range, with 0 where nobody came, so the bars read as a calendar.
  const seen = new Map(byDay.map((d) => [d.day, d.views]));
  const series = Array.from({ length: days }, (_, i) => { const day = addDays(from, i); return { day, views: seen.get(day) ?? 0 }; });
  return { from, byPage, byDay: series, total: byDay.reduce((a, d) => a + d.views, 0) };
}

/** Leads in the last `days` days by where they came from, with how many became qualified or closed. */
export async function leadsBySource(days = 90) {
  const rows = await db.select({ utmSource: siteLeads.utmSource, referrer: siteLeads.referrer, kind: siteLeads.kind, status: siteLeads.status })
    .from(siteLeads).where(and(isNull(siteLeads.archived), gte(siteLeads.created, new Date(Date.now() - days * 86400_000))));
  const m = new Map<string, { source: string; leads: number; contact: number; sell: number; won: number }>();
  for (const r of rows) {
    const k = sourceName(r);
    const e = m.get(k) ?? { source: k, leads: 0, contact: 0, sell: 0, won: 0 };
    e.leads++; if (r.kind === 'sell') e.sell++; else e.contact++;
    if (r.status === 'qualified' || r.status === 'closed') e.won++;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source));
}
