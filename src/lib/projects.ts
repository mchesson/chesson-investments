import 'server-only';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  billLines, bills, budgetLines, changeOrders, commitments, companies, costCodes, dailyLogs, holdingCosts, people, projectItems, projects, rentals, users,
} from '@/db/schema';
import { cents, pnl, resolveBudget, rollup, scenarios, totals, type CodeMoney } from './budget';
import { countsTowardBudget, countsTowardHolding } from './bill-lines';

export function listProjects() {
  return db.select({
    id: projects.id, name: projects.name, address: projects.address, city: projects.city, stage: projects.stage,
    projectNumber: projects.projectNumber, heatedSf: projects.heatedSf, proformaSalePrice: projects.proformaSalePrice, lotCost: projects.lotCost,
    stageStates: projects.stageStates, subStages: projects.subStages,
    rentalStatus: sql<string | null>`(select r.status from ${rentals} r where r.project_id = "projects"."id")`,
  }).from(projects).where(isNull(projects.archived)).orderBy(asc(projects.name));
}

export async function getProject(id: string) {
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  return p ?? null;
}

const vendorName = sql<string | null>`coalesce((select c.name from ${companies} c where c.id = vendor_company_id), (select pe.first_name || ' ' || pe.last_name from ${people} pe where pe.id = vendor_person_id))`;

/** Everything the money tabs need, worked out once. */
export async function projectMoney(projectId: string) {
  const [project, codes, budget, comms, bs, holds, items] = await Promise.all([
    getProject(projectId),
    db.select().from(costCodes).where(isNull(costCodes.archived)).orderBy(asc(costCodes.sort)),
    db.select().from(budgetLines).where(eq(budgetLines.projectId, projectId)),
    db.select({
      id: commitments.id, costCodeId: commitments.costCodeId, scope: commitments.scope, amount: commitments.amount, retainagePct: commitments.retainagePct,
      signedOn: commitments.signedOn, vendorCompanyId: commitments.vendorCompanyId, vendorPersonId: commitments.vendorPersonId, vendor: vendorName,
    }).from(commitments).where(and(eq(commitments.projectId, projectId), isNull(commitments.archived))).orderBy(asc(commitments.created)),
    db.select({
      id: bills.id, costCodeId: bills.costCodeId, commitmentId: bills.commitmentId, vendor: sql<string | null>`coalesce(${vendorName}, ${bills.vendorName})`,
      vendorCompanyId: bills.vendorCompanyId, vendorPersonId: bills.vendorPersonId,
      invoiceNumber: bills.invoiceNumber, invoiceOn: bills.invoiceOn, amount: bills.amount, retainage: bills.retainage, status: bills.status,
      lienWaiverReceived: bills.lienWaiverReceived, lienWaiverRequired: bills.lienWaiverRequired, kind: bills.kind, billedTo: bills.billedTo, dueOn: bills.dueOn,
      includedInBillId: bills.includedInBillId, paidOn: bills.paidOn, paidHow: bills.paidHow, fileId: bills.fileId, notes: bills.notes,
      approvedByName: sql<string | null>`(select u.name from ${users} u where u.id = ${bills.approvedBy})`,
    }).from(bills).where(and(eq(bills.projectId, projectId), isNull(bills.archived))).orderBy(desc(bills.invoiceOn)),
    db.select().from(holdingCosts).where(and(eq(holdingCosts.projectId, projectId), isNull(holdingCosts.archived))).orderBy(desc(holdingCosts.incurredOn)),
    db.select().from(projectItems).where(and(eq(projectItems.projectId, projectId), isNull(projectItems.archived))).orderBy(asc(projectItems.created)),
  ]);
  if (!project) return null;
  const lines = bs.length
    ? await db.select().from(billLines).where(inArray(billLines.billId, bs.map((b) => b.id))).orderBy(asc(billLines.sort))
    : [];
  const billById = new Map(bs.map((b) => [b.id, b]));
  const counted = lines.map((l) => {
    const b = billById.get(l.billId)!;
    return { ...l, status: b.status, backup: !!b.includedInBillId, on: b.invoiceOn, billId: l.billId };
  });
  const orders = comms.length
    ? await db.select().from(changeOrders).where(and(inArray(changeOrders.commitmentId, comms.map((c) => c.id)), isNull(changeOrders.archived))).orderBy(asc(changeOrders.created))
    : [];
  const lineByCode = new Map(budget.map((l) => [l.costCodeId, l]));
  const resolved = resolveBudget(codes.map((c) => ({
    costCodeId: c.id, kind: c.kind, amount: lineByCode.get(c.id)?.amount ?? null, percentOfConstruction: lineByCode.get(c.id)?.percentOfConstruction ?? null,
  })));
  const money = rollup(codes, resolved.byCode,
    comms.map((c) => ({ costCodeId: c.costCodeId, amount: c.amount, changeOrders: orders.filter((o) => o.commitmentId === c.id).map((o) => o.amount) })),
    counted.filter(countsTowardBudget).map((l) => ({ costCodeId: l.costCodeId!, amount: l.amount, status: l.status })));
  const kindOf = new Map(codes.map((c) => [c.id, c.kind]));
  const build = totals(codes.filter((c) => c.kind === 'construction' || c.kind === 'soft').map((c) => money.get(c.id)!));
  const acquisition = totals(codes.filter((c) => c.kind === 'acquisition').map((c) => money.get(c.id)!));
  const selling = totals(codes.filter((c) => c.kind === 'selling').map((c) => money.get(c.id)!));
  // Holding costs typed on their own, plus holding lines on bills (utilities on a GC's invoice).
  const holdingLines = counted.filter(countsTowardHolding);
  const holdingToDate = holds.reduce((s, h) => s + cents(h.amount), 0) + holdingLines.reduce((s, l) => s + cents(l.amount), 0);
  const sale = cents(project.actualSalePrice ?? project.proformaSalePrice);
  const report = pnl({
    salePrice: sale, marketValue: project.marketValue ? cents(project.marketValue) : null,
    sellingCostPct: Number(project.sellingCostPct ?? 0), lotCost: cents(project.lotCost), acquisitionCosts: acquisition.projected,
    stagingBudget: selling.budget, stagingProjected: selling.projected,
    buildBudget: build.budget, buildProjected: build.projected, buildBilled: build.billed, holdingToDate, heatedSf: project.heatedSf,
  });
  const allIn = cents(project.lotCost) + acquisition.projected + build.projected + holdingToDate + selling.projected;
  const scen = scenarios({
    low: project.saleLow ? cents(project.saleLow) : null, mid: project.proformaSalePrice ? cents(project.proformaSalePrice) : null,
    high: project.saleHigh ? cents(project.saleHigh) : null, sellingCostPct: Number(project.sellingCostPct ?? 0),
    closingAtSale: cents(project.closingCostAtSale), allIn, keptAssets: cents(project.keptAssetsValue),
    taxRatePct: project.taxRatePct === null ? null : Number(project.taxRatePct), heatedSf: project.heatedSf,
  });
  const construction: CodeMoney = totals(codes.filter((c) => c.kind === 'construction').map((c) => money.get(c.id)!));
  return {
    project, codes, kindOf, lines: lineByCode, money, all: build, construction, acquisition, selling, resolved,
    commitments: comms, changeOrders: orders, bills: bs, billLines: counted, holding: holds, holdingLines, holdingToDate, items,
    pnl: report, scenarios: scen, allIn,
  };
}

export function dailyLogsFor(projectId: string) {
  return db.select({ id: dailyLogs.id, loggedOn: dailyLogs.loggedOn, onSite: dailyLogs.onSite, work: dailyLogs.work, weather: dailyLogs.weather, userName: users.name })
    .from(dailyLogs).leftJoin(users, eq(users.id, dailyLogs.userId))
    .where(and(eq(dailyLogs.projectId, projectId), isNull(dailyLogs.archived))).orderBy(desc(dailyLogs.loggedOn), desc(dailyLogs.created));
}
