import 'server-only';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { budgetVersions, companies, files } from '@/db/schema';
import type { BidLine } from './bids';

/** A project's GC bids and our estimates, newest first, with who sent each and its file. */
export async function bidsFor(projectId: string) {
  const rows = await db.select({
    id: budgetVersions.id, kind: budgetVersions.kind, label: budgetVersions.label, preparedBy: budgetVersions.preparedBy,
    lines: budgetVersions.lines, totalCents: budgetVersions.totalCents, notes: budgetVersions.notes, created: budgetVersions.created,
    companyId: budgetVersions.companyId, companyName: companies.name, submittedOn: budgetVersions.submittedOn,
    contractType: budgetVersions.contractType, feePct: budgetVersions.feePct, validUntil: budgetVersions.validUntil,
    status: budgetVersions.status, decidedAt: budgetVersions.decidedAt, decidedReason: budgetVersions.decidedReason,
  }).from(budgetVersions).leftJoin(companies, eq(companies.id, budgetVersions.companyId))
    .where(and(eq(budgetVersions.projectId, projectId), inArray(budgetVersions.kind, ['bid', 'ours']))).orderBy(desc(budgetVersions.created));
  const fileRows = rows.length ? await db.select({ id: files.id, entityId: files.entityId, name: files.name }).from(files)
    .where(and(eq(files.entity, 'bid'), inArray(files.entityId, rows.map((r) => r.id)), isNull(files.archived))) : [];
  return rows.map((r) => ({ ...r, lines: r.lines as BidLine[], who: r.kind === 'ours' ? (r.label ?? 'Our Estimate') : (r.companyName ?? 'A GC'), files: fileRows.filter((f) => f.entityId === r.id) }));
}

/** Every bid a company has sent, on any project (their page). */
export function bidsFromCompany(companyId: string) {
  return db.select({ id: budgetVersions.id, projectId: budgetVersions.projectId, projectName: sql<string>`(select p.name from projects p where p.id = ${budgetVersions.projectId})`,
    totalCents: budgetVersions.totalCents, submittedOn: budgetVersions.submittedOn, status: budgetVersions.status })
    .from(budgetVersions).where(and(eq(budgetVersions.companyId, companyId), eq(budgetVersions.kind, 'bid'))).orderBy(desc(budgetVersions.created));
}
