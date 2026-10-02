'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, type Tx } from '@/db';
import { billLines, bills, budgetLines, companies, costCodes, partyRoles, people, personCompanies, projects, touches } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { importSchema, lineCents, planImport, splitFull, type Existing, type ImportFile, type Plan } from '@/lib/import-plan';
import { formatState, normalizeEmail, storePhone, today } from '@/lib/format';
import { firstStage, roleDef } from '@/lib/roles';
import { isHowMet } from '@/lib/how-met';
import { isProjectStage } from '@/lib/project-stages';
import { DEFAULT_PERCENTS } from '@/lib/cost-codes';

const VIA = 'import from email and folders';

export type Summary = {
  error?: string;
  done?: string;
  counts?: { label: string; add: number; match: number }[];
  people?: { name: string; role: string | null; match: string | null }[];
  bills?: { label: string; total: string; status: string }[];
  problems?: string[];
};

function parse(text: string): { file: ImportFile } | { error: string } {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { error: 'That file isn’t valid JSON.' }; }
  const r = importSchema.safeParse(json);
  if (!r.success) return { error: `The file doesn’t have the expected shape: ${r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
  return { file: r.data };
}

async function existing(x: Tx | typeof db): Promise<Existing> {
  const [ps, cs, pj, bs, codes] = await Promise.all([
    x.select({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email, phone: people.phone }).from(people).where(isNull(people.archived)),
    x.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived)),
    x.select({ id: projects.id, name: projects.name, address: projects.address }).from(projects).where(isNull(projects.archived)),
    x.select({ projectId: bills.projectId, vendor: sql<string>`coalesce(${bills.vendorName}, (select c.name from companies c where c.id = ${bills.vendorCompanyId}), '')`, number: bills.invoiceNumber, date: bills.invoiceOn, amount: bills.amount }).from(bills).where(isNull(bills.archived)),
    x.select({ id: costCodes.id, code: costCodes.code }).from(costCodes),
  ]);
  return { people: ps, companies: cs, projects: pj, bills: bs, costCodes: codes };
}

function summarize(plan: Plan): Summary {
  return {
    counts: [
      { label: 'Companies', add: plan.companies.filter((c) => !c.match).length, match: plan.companies.filter((c) => c.match).length },
      { label: 'People', add: plan.people.filter((p) => !p.match).length, match: plan.people.filter((p) => p.match).length },
      { label: 'Projects', add: plan.projects.filter((p) => !p.match).length, match: plan.projects.filter((p) => p.match).length },
      { label: 'Bills', add: plan.bills.filter((b) => !b.duplicate && !b.problem).length, match: plan.bills.filter((b) => b.duplicate).length },
    ],
    people: plan.people.map((p) => ({ name: p.name, role: p.row.role ?? null, match: p.match ? `already on file (${p.matchedBy})` : null })),
    bills: plan.bills.map((b) => ({ label: b.label, total: b.total, status: b.problem ? `skipped: ${b.problem}` : b.duplicate ? 'already on file' : 'will add' })),
    problems: plan.problems,
  };
}

export async function previewImport(text: string): Promise<Summary> {
  await requireAction('users.manage');
  const p = parse(text);
  if ('error' in p) return { error: p.error };
  return summarize(planImport(p.file, await existing(db)));
}

/** Adds what's new, fills only empty fields on matches, never changes what's typed. One transaction. */
export async function applyImport(text: string): Promise<Summary> {
  const user = await requireAction('users.manage');
  const p = parse(text);
  if ('error' in p) return { error: p.error };
  const file = p.file;
  const result = await db.transaction(async (tx) => {
    const plan = planImport(file, await existing(tx));
    const log = (entity: string, entityId: string, action: string, summary: string) => audit({ userId: user.id, entity, entityId, action, summary, via: VIA }, tx);
    const companyId = new Map<string, string>();
    const k = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const c of (await tx.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived)))) companyId.set(k(c.name), c.id);
    const addRole = async (target: { personId?: string; companyId?: string }, role: string | null | undefined, trade: string | null | undefined, label: string, through?: string | null) => {
      if (!role || !roleDef(role)) return;
      void label;
      const where = target.personId ? eq(partyRoles.personId, target.personId) : eq(partyRoles.companyId, target.companyId!);
      const [has] = await tx.select({ id: partyRoles.id }).from(partyRoles).where(and(where, eq(partyRoles.role, role), isNull(partyRoles.removed)));
      if (has) return;
      // Through a GC: they've worked for us (Hired), not just met.
      const stage = through ? (roleDef(role)!.stages.some((s) => s.key === 'hired') ? 'hired' : firstStage(role)) : firstStage(role);
      await tx.insert(partyRoles).values({ ...target, role, stage, trade: trade ?? null, hiredThroughCompanyId: through ?? null });
      await log(target.personId ? 'person' : 'company', (target.personId ?? target.companyId)!, 'role-add', `added the role ${roleDef(role)!.label}${trade ? ` (${trade})` : ''}${through ? ', hired through the GC' : ''} (from email and invoices)`);
    };
    const ensureCompany = async (name: string) => {
      const id = companyId.get(k(name));
      if (id) return id;
      const [c] = await tx.insert(companies).values({ name, createdBy: user.id }).returning();
      companyId.set(k(name), c.id);
      await log('company', c.id, 'create', `added the company ${name}`);
      return c.id;
    };
    let added = { companies: 0, people: 0, projects: 0, bills: 0 };
    for (const c of plan.companies) {
      const through = c.row.hiredThrough ? await ensureCompany(c.row.hiredThrough) : null;
      if (c.match) { await addRole({ companyId: c.match }, c.row.role, c.row.trade, c.name, through); continue; }
      const [row] = await tx.insert(companies).values({ name: c.name, phone: storePhone(c.row.phone), email: normalizeEmail(c.row.email), website: c.row.website ?? null, notes: c.row.notes ?? null, createdBy: user.id }).returning();
      companyId.set(k(c.name), row.id);
      await log('company', row.id, 'create', `added the company ${c.name}`);
      await addRole({ companyId: row.id }, c.row.role, c.row.trade, c.name, through);
      added.companies++;
    }
    const personId = new Map<string, string>();
    for (const r of await tx.select({ id: people.id, f: people.firstName, l: people.lastName }).from(people).where(isNull(people.archived))) personId.set(k(`${r.f}${r.l}`), r.id);
    for (const pp of plan.people) {
      const r = pp.row;
      const cid = r.company ? await ensureCompany(r.company) : null;
      let id = pp.match;
      if (id) {
        const [old] = await tx.select().from(people).where(eq(people.id, id));
        const fill = {
          email: old.email ?? normalizeEmail(r.email), phone: old.phone ?? storePhone(r.phone), title: old.title ?? r.title ?? null,
          companyId: old.companyId ?? cid, howMet: old.howMet ?? (isHowMet(r.howMet ?? null) ? r.howMet! : null), introNote: old.introNote ?? r.introNote ?? null,
        };
        await tx.update(people).set(fill).where(eq(people.id, id));
        if (!old.companyId && cid) await tx.insert(personCompanies).values({ personId: id, companyId: cid, title: fill.title });
      } else {
        const n = splitFull(r.name);
        const [row] = await tx.insert(people).values({
          ...n, email: normalizeEmail(r.email), phone: storePhone(r.phone), title: r.title ?? null, companyId: cid,
          howMet: isHowMet(r.howMet ?? null) ? r.howMet! : null, introNote: r.introNote ?? null, notes: r.notes ?? null, createdBy: user.id,
        }).returning();
        id = row.id;
        personId.set(k(r.name), id);
        if (cid) await tx.insert(personCompanies).values({ personId: id, companyId: cid, title: r.title ?? null });
        await log('person', id, 'create', `added ${r.name} from email`);
        added.people++;
      }
      const co = r.company ? file.companies.find((x) => k(x.name) === k(r.company!)) : undefined;
      await addRole({ personId: id }, r.role ?? co?.role, r.trade ?? co?.trade, r.name, co?.hiredThrough ? companyId.get(k(co.hiredThrough)) ?? null : null);
      if (r.lastContactOn && r.lastContactOn <= today()) {
        const [has] = await tx.select({ id: touches.id }).from(touches).where(and(eq(touches.personId, id), eq(touches.happenedOn, r.lastContactOn)));
        if (!has) await tx.insert(touches).values({ personId: id, kind: 'email', happenedOn: r.lastContactOn, notes: 'Last email on file (from the email review).', userId: user.id });
      }
    }
    // Introductions, now that everyone exists.
    for (const pp of plan.people) {
      if (!pp.row.introducedBy) continue;
      const id = personId.get(k(pp.row.name)) ?? pp.match;
      const by = personId.get(k(pp.row.introducedBy));
      if (!id || !by || id === by) continue;
      const [old] = await tx.select({ introducedById: people.introducedById }).from(people).where(eq(people.id, id));
      if (old.introducedById) continue;
      await tx.update(people).set({ introducedById: by, howMet: sql`coalesce(${people.howMet}, 'introduction')` }).where(eq(people.id, id));
      await log('person', by, 'introduced', `introduced us to ${pp.row.name} (from email)`);
    }
    const projectId = new Map<string, string>();
    for (const r of await tx.select({ id: projects.id, name: projects.name, address: projects.address }).from(projects).where(isNull(projects.archived))) { projectId.set(k(r.name), r.id); projectId.set(k(r.address), r.id); }
    const codes = await tx.select().from(costCodes).where(isNull(costCodes.archived));
    for (const pj of plan.projects) {
      if (pj.match) continue;
      const r = pj.row;
      const [row] = await tx.insert(projects).values({
        name: r.name, address: r.address, city: r.city ?? null, state: formatState(r.state) ?? 'NC', zip: r.zip ?? null,
        stage: isProjectStage(r.stage) ? r.stage : 'building', ownedBy: r.ownedBy ?? null, heatedSf: r.heatedSf ?? null,
        lotCost: r.lotCost ?? null, marketValue: r.marketValue ?? null, notes: r.notes ?? null, sellingCostPct: r.sellingCostPct ?? '5', createdBy: user.id,
        purchasedOn: r.purchasedOn ?? null, completedOn: r.completedOn ?? null, originalEstimate: r.originalEstimate ?? null,
        plannedExit: r.plannedExit ?? null, actualExit: r.actualExit ?? null, closingCostAtSale: r.closingCostAtSale ?? null, reviewNotes: r.reviewNotes ?? null,
      }).returning();
      await tx.insert(budgetLines).values(codes.map((c) => ({ projectId: row.id, costCodeId: c.id, percentOfConstruction: null as string | null, amount: null })));
      projectId.set(k(r.name), row.id); projectId.set(k(r.address), row.id);
      await log('project', row.id, 'create', `added the project ${r.name} from the folders`);
      added.projects++;
    }
    void DEFAULT_PERCENTS; // imported past projects have no budget percents: their real costs are the bills
    const codeId = new Map(codes.map((c) => [c.code, c.id]));
    const billIdByNumber = new Map<string, string>();
    const backups: { id: string; project: string; backupFor: string }[] = [];
    for (const b of plan.bills) {
      if (b.duplicate || b.problem) continue;
      const r = b.row;
      const pid = projectId.get(b.projectKey);
      if (!pid) continue;
      const vcid = companyId.get(k(r.vendor)) ?? null;
      const [row] = await tx.insert(bills).values({
        projectId: pid, costCodeId: r.lines.map((l) => (l.costCode ? codeId.get(l.costCode) : undefined)).find(Boolean) ?? null,
        vendorCompanyId: vcid, vendorName: vcid ? null : r.vendor, kind: r.kind, billedTo: r.billedTo ?? null, invoiceNumber: r.number ?? null,
        invoiceOn: r.date, amount: b.total, lienWaiverRequired: r.lienWaiverRequired, notes: r.notes ?? null, createdBy: user.id,
        ...(r.paid ? { status: 'paid' as const, approvedBy: user.id, approvedAt: new Date(), paidOn: r.date, paidHow: r.paidHow ?? null, lienWaiverReceived: r.lienWaiverRequired } : {}),
      }).returning();
      await tx.insert(billLines).values(r.lines.map((l, i) => ({
        billId: row.id, kind: l.kind, costCodeId: l.kind === 'build' || l.kind === 'fee' ? codeId.get(l.costCode ?? '') ?? null : null,
        holdingKind: l.kind === 'holding' ? l.holdingKind ?? 'Other' : null, description: l.description ?? null,
        amount: (lineCents(l.amount, r.kind) / 100).toFixed(2), sort: i,
      })));
      if (r.number) billIdByNumber.set(`${pid}|${k(r.number)}`, row.id);
      if (r.backupFor) backups.push({ id: row.id, project: pid, backupFor: r.backupFor });
      await log('project', pid, 'bill-add', `entered ${r.kind === 'credit' ? 'a credit' : r.kind === 'receipt' ? 'a receipt' : 'a bill'} from ${r.vendor}${r.number ? ` #${r.number}` : ''} for $${Math.abs(Number(b.total)).toLocaleString('en-US')}`);
      added.bills++;
    }
    for (const bk of backups) {
      const gc = billIdByNumber.get(`${bk.project}|${k(bk.backupFor)}`);
      if (gc) await tx.update(bills).set({ includedInBillId: gc }).where(eq(bills.id, bk.id));
    }
    await audit({ userId: user.id, entity: 'import', entityId: null, action: 'apply', summary: `imported ${added.people} people, ${added.companies} companies, ${added.projects} projects and ${added.bills} bills (${file.source ?? 'file'})`, via: VIA }, tx);
    return { plan, added };
  });
  revalidatePath('/', 'layout');
  return { ...summarize(result.plan), done: `Imported ${result.added.people} people, ${result.added.companies} companies, ${result.added.projects} projects and ${result.added.bills} bills.` };
}
