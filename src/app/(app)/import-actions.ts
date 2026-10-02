'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { SITE_TAG } from '@/lib/site-data';
import { db, type Tx } from '@/db';
import { billLines, bills, budgetLines, companies, costCodes, files, partyRoles, people, personCompanies, projects, projectUtilities, touches } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { importSchema, lineCents, planImport, splitFull, type Existing, type ImportFile, type Plan } from '@/lib/import-plan';
import { formatState, normalizeEmail, storePhone, today } from '@/lib/format';
import { cleanSupplierTypes, firstStage, isStage, isUtilityService, roleDef, roleTag, utilityServiceLabel } from '@/lib/roles';
import { isHowMet } from '@/lib/how-met';
import { isProjectStage } from '@/lib/project-stages';
import { DEFAULT_PERCENTS } from '@/lib/cost-codes';
import { allowedPhotoUrl, isSiteStatus, photoKindLabel, slugify } from '@/lib/site';
import { saveFile } from '@/lib/files';
import { detectFile, MAX_FILE } from '@/lib/file-rules';
import { matchCompany, matchPerson } from '@/lib/vendor-match';

const VIA = 'import from email and folders';

export type Summary = {
  error?: string;
  done?: string;
  counts?: { label: string; add: number; match: number }[];
  people?: { name: string; role: string | null; match: string | null }[];
  bills?: { label: string; total: string; status: string }[];
  photos?: { label: string; status: string }[];
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
  // One read at a time, each timed in the logs (the parallel version never
  // answered in production, Oct 2, 2026).
  const step = async <T,>(label: string, q: PromiseLike<T>): Promise<T> => {
    const t = Date.now();
    const r = await q;
    console.info(`[import] ${label}: ${Date.now() - t} ms`);
    return r;
  };
  const ps = await step('people', x.select({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email, phone: people.phone }).from(people).where(isNull(people.archived)));
  const cs = await step('companies', x.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived)));
  const pj = await step('projects', x.select({ id: projects.id, name: projects.name, address: projects.address }).from(projects).where(isNull(projects.archived)));
  const bs = await step('bills', x.select({ projectId: bills.projectId, vendor: sql<string>`coalesce(${bills.vendorName}, (select c.name from companies c where c.id = ${bills.vendorCompanyId}), '')`, number: bills.invoiceNumber, date: bills.invoiceOn, amount: bills.amount }).from(bills).where(isNull(bills.archived)));
  const codes = await step('cost codes', x.select({ id: costCodes.id, code: costCodes.code }).from(costCodes));
  const ph = await step('photos', x.select({ projectId: files.entityId, sourceUrl: sql<string>`${files.sourceUrl}` }).from(files).where(and(eq(files.entity, 'project'), isNull(files.archived), sql`${files.sourceUrl} is not null`)));
  return { people: ps, companies: cs, projects: pj, bills: bs, costCodes: codes, photos: ph };
}

function summarize(plan: Plan): Summary {
  return {
    counts: [
      { label: 'Companies', add: plan.companies.filter((c) => !c.match).length, match: plan.companies.filter((c) => c.match).length },
      { label: 'People', add: plan.people.filter((p) => !p.match).length, match: plan.people.filter((p) => p.match).length },
      { label: 'Projects', add: plan.projects.filter((p) => !p.match).length, match: plan.projects.filter((p) => p.match).length },
      { label: 'Bills', add: plan.bills.filter((b) => !b.duplicate && !b.problem).length, match: plan.bills.filter((b) => b.duplicate).length },
      ...(plan.photos.length ? [{ label: 'Photos', add: plan.photos.filter((f) => !f.duplicate && !f.problem).length, match: plan.photos.filter((f) => f.duplicate).length }] : []),
    ],
    photos: plan.photos.map((f) => ({ label: f.label, status: f.problem ? `skipped: ${f.problem}` : f.duplicate ? 'already on file' : 'will add' })),
    people: plan.people.map((p) => ({ name: p.name, role: p.row.role ?? null, match: p.match ? `already on file (${p.matchedBy})` : null })),
    bills: plan.bills.map((b) => ({ label: b.label, total: b.total, status: b.problem ? `skipped: ${b.problem}` : b.duplicate ? 'already on file' : 'will add' })),
    problems: plan.problems,
  };
}

export async function previewImport(text: string): Promise<Summary> {
  await requireAction('users.manage');
  console.info('[import] access checked');
  const p = parse(text);
  console.info(`[import] file read: ${'error' in p ? p.error : 'ok'}`);
  if ('error' in p) return { error: p.error };
  const t = Date.now();
  const ex = await existing(db);
  console.info(`[import] read what's on file in ${Date.now() - t} ms`);
  return summarize(planImport(p.file, ex));
}

/** Adds what's new, fills only empty fields on matches, never changes what's typed. One transaction. */
export async function applyImport(text: string): Promise<Summary> {
  const user = await requireAction('users.manage');
  const p = parse(text);
  if ('error' in p) return { error: p.error };
  const file = p.file;
  // Photos are read from our old website first, outside the transaction.
  const before = planImport(file, await existing(db));
  const fetched = new Map<string, File>();
  const photoErrors: string[] = [];
  const wanted = [...new Map(before.photos.filter((f) => !f.duplicate && !f.problem && allowedPhotoUrl(f.row.url)).map((f) => [f.row.url, f])).values()];
  const readOne = async (f: (typeof wanted)[number]) => {
    // GoDaddy sometimes answers with a "please wait" page instead of the photo: try again.
    let got: ArrayBuffer | null = null, why = 'couldn’t be read from the old website';
    for (let attempt = 0; attempt < 3 && !got; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 4_000));
      try {
        const r = await fetch(f.row.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
        const buf = r.ok ? await r.arrayBuffer() : null;
        if (!buf) why = `the old website answered ${r.status}`;
        else if (buf.byteLength > MAX_FILE) { why = 'over 4 MB'; break; }
        else if (!detectFile(new Uint8Array(buf))?.image) why = 'the old website sent a page, not a photo';
        else got = buf;
      } catch { /* try again */ }
    }
    if (got) fetched.set(f.row.url, new File([got], f.row.url.split('/').pop() || 'photo.jpg'));
    else photoErrors.push(`${f.label}: ${why} (import the file again to retry)`);
  };
  // Four at a time keeps a full house (about 30 photos) well under a minute.
  for (let n = 0; n < wanted.length; n += 4) await Promise.all(wanted.slice(n, n + 4).map(readOne));
  const result = await db.transaction(async (tx) => {
    const plan = planImport(file, await existing(tx));
    const log = (entity: string, entityId: string, action: string, summary: string) => audit({ userId: user.id, entity, entityId, action, summary, via: VIA }, tx);
    const companyId = new Map<string, string>();
    const k = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const companyNames = new Map<string, string>();
    for (const c of (await tx.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived)))) { companyId.set(k(c.name), c.id); companyNames.set(c.id, c.name); }
    const addRole = async (target: { personId?: string; companyId?: string }, role: string | null | undefined, trade: string | null | undefined, label: string, through?: string | null, kindsIn?: string[] | null, stageIn?: string | null) => {
      void label;
      const kinds = cleanSupplierTypes(kindsIn ?? []);
      if (!role && kinds.length) role = 'supplier';
      if (!role || !roleDef(role)) return;
      const where = target.personId ? eq(partyRoles.personId, target.personId) : eq(partyRoles.companyId, target.companyId!);
      const [has] = await tx.select({ id: partyRoles.id, supplierTypes: partyRoles.supplierTypes, stage: partyRoles.stage }).from(partyRoles).where(and(where, eq(partyRoles.role, role), isNull(partyRoles.removed)));
      const ent = target.personId ? 'person' : 'company', eid = (target.personId ?? target.companyId)!;
      if (has) {
        const set: Record<string, unknown> = {};
        if (role === 'supplier' && kinds.length && !has.supplierTypes?.length) set.supplierTypes = kinds;
        if (stageIn && isStage(role, stageIn) && stageIn !== has.stage) { set.stage = stageIn; set.stageChangedAt = new Date(); }
        if (Object.keys(set).length) {
          await tx.update(partyRoles).set(set).where(eq(partyRoles.id, has.id));
          await log(ent, eid, 'role-update', `updated the role ${roleTag({ role, supplierTypes: (set.supplierTypes as string[]) ?? has.supplierTypes })} (from the correction file)`);
        }
        return;
      }
      // Through a GC: they've worked for us (Hired), not just met.
      const stage = stageIn && isStage(role, stageIn) ? stageIn : through ? (roleDef(role)!.stages.some((s) => s.key === 'hired') ? 'hired' : firstStage(role)) : firstStage(role);
      await tx.insert(partyRoles).values({ ...target, role, stage, trade: trade ?? null, hiredThroughCompanyId: through ?? null, supplierTypes: role === 'supplier' && kinds.length ? kinds : null });
      await log(ent, eid, 'role-add', `added the role ${roleTag({ role, supplierTypes: kinds })}${trade ? ` (${trade})` : ''}${through ? ', hired through the GC' : ''} (from email and invoices)`);
    };
    const ensureCompany = async (name: string) => {
      const id = companyId.get(k(name));
      if (id) return id;
      const [c] = await tx.insert(companies).values({ name, createdBy: user.id }).returning();
      companyId.set(k(name), c.id); companyNames.set(c.id, name);
      await log('company', c.id, 'create', `added the company ${name}`);
      return c.id;
    };
    let added = { companies: 0, people: 0, projects: 0, bills: 0 };
    for (const c of plan.companies) {
      const through = c.row.hiredThrough ? await ensureCompany(c.row.hiredThrough) : null;
      if (c.match) { await addRole({ companyId: c.match }, c.row.role, c.row.trade, c.name, through, c.row.supplierTypes); continue; }
      const [row] = await tx.insert(companies).values({ name: c.name, phone: storePhone(c.row.phone), email: normalizeEmail(c.row.email), website: c.row.website ?? null, notes: c.row.notes ?? null, createdBy: user.id }).returning();
      companyId.set(k(c.name), row.id); companyNames.set(row.id, c.name);
      await log('company', row.id, 'create', `added the company ${c.name}`);
      await addRole({ companyId: row.id }, c.row.role, c.row.trade, c.name, through, c.row.supplierTypes);
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
      await addRole({ personId: id }, r.role ?? co?.role, r.trade ?? co?.trade, r.name, co?.hiredThrough ? companyId.get(k(co.hiredThrough)) ?? null : null, r.supplierTypes ?? (r.role ? null : co?.supplierTypes), r.stage);
      for (const gone of r.removeRoles ?? []) {
        const [x] = await tx.select({ id: partyRoles.id }).from(partyRoles).where(and(eq(partyRoles.personId, id), eq(partyRoles.role, gone), isNull(partyRoles.removed)));
        if (!x) continue;
        await tx.update(partyRoles).set({ removed: new Date() }).where(eq(partyRoles.id, x.id));
        await log('person', id, 'role-remove', `took off the role ${roleDef(gone)?.label ?? gone} (from the correction file)`);
      }
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
    const fillSite = async (pid: string, r: ImportFile['projects'][number]) => {
      const st = r.site;
      if (!st) return;
      const [old] = await tx.select().from(projects).where(eq(projects.id, pid));
      const slug = slugify(st.slug ?? r.name);
      const [taken] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.siteSlug, slug), sql`${projects.id} <> ${pid}`));
      const f = {
        siteStatus: old.siteStatus ?? (isSiteStatus(st.status) ? st.status : null),
        siteSlug: old.siteSlug ?? (taken ? null : slug), sitePrice: old.sitePrice ?? st.price ?? null, siteTagline: old.siteTagline ?? st.tagline ?? null,
        siteDescription: old.siteDescription ?? st.description ?? null,
        siteBeds: old.siteBeds ?? (st.beds != null ? st.beds.toFixed(1) : null), siteBaths: old.siteBaths ?? (st.baths != null ? st.baths.toFixed(1) : null),
        siteDetails: old.siteDetails ?? st.details ?? null, siteTeam: old.siteTeam ?? st.team ?? null, siteFeatured: old.siteFeatured || !!st.featured,
        lotAcres: old.lotAcres ?? (r.lotAcres != null ? String(r.lotAcres) : null), heatedSf: old.heatedSf ?? r.heatedSf ?? null,
      };
      if (Object.entries(f).every(([k2, v]) => String(v) === String((old as Record<string, unknown>)[k2]))) return;
      await tx.update(projects).set({ ...f, siteUpdatedAt: new Date() }).where(eq(projects.id, pid));
      await log('project', pid, 'site', `filled in its website page from the old website${f.siteStatus && f.siteStatus !== old.siteStatus ? ` (status ${f.siteStatus.replace('_', ' ')})` : ''}`);
    };
    for (const pj of plan.projects) {
      if (pj.match) { await fillSite(pj.match, pj.row); continue; }
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
      await fillSite(row.id, r);
      added.projects++;
    }
    let utilitiesAdded = 0;
    for (const u of file.utilities) {
      const pid = projectId.get(k(u.project));
      if (!pid || !isUtilityService(u.service)) continue;
      const cid = u.company ? companyId.get(k(u.company)) ?? null : null;
      const pidPerson = u.person ? personId.get(k(u.person)) ?? null : null;
      if (!cid && !pidPerson) continue;
      const [has] = await tx.select({ id: projectUtilities.id }).from(projectUtilities).where(and(eq(projectUtilities.projectId, pid), eq(projectUtilities.service, u.service), isNull(projectUtilities.removed),
        cid ? eq(projectUtilities.companyId, cid) : isNull(projectUtilities.companyId)));
      if (has) continue;
      await tx.insert(projectUtilities).values({ projectId: pid, service: u.service, companyId: cid, personId: pidPerson, startedOn: u.startedOn ?? null, notes: u.notes ?? null, createdBy: user.id });
      await log('project', pid, 'utility-add', `added ${utilityServiceLabel(u.service)}: ${[u.company, u.person].filter(Boolean).join(', contact ')}`);
      utilitiesAdded++;
    }
    void utilitiesAdded;
    void DEFAULT_PERCENTS; // imported past projects have no budget percents: their real costs are the bills
    const codeId = new Map(codes.map((c) => [c.code, c.id]));
    const billIdByNumber = new Map<string, string>();
    const backups: { id: string; project: string; backupFor: string }[] = [];
    for (const b of plan.bills) {
      if (b.duplicate || b.problem) continue;
      const r = b.row;
      const pid = projectId.get(b.projectKey);
      if (!pid) continue;
      const vcid = companyId.get(k(r.vendor)) ?? matchCompany(r.vendor, [...companyId.entries()].map(([, id]) => ({ id, name: companyNames.get(id) ?? '' })))?.id ?? null;
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
    let photosAdded = 0;
    const byProject = new Map<string, number>();
    for (const f of plan.photos) {
      if (f.duplicate || f.problem) continue;
      const pid = projectId.get(f.projectKey);
      const got = fetched.get(f.row.url);
      if (!pid || !got) continue;
      const saved = await saveFile(got, { entity: 'project', entityId: pid }, user.id, { imagesOnly: true, caption: f.row.caption ?? null }, tx);
      if ('error' in saved) { photoErrors.push(`${f.label}: ${saved.error}`); continue; }
      await tx.update(files).set({ photoKind: f.row.kind, onSite: f.row.onSite, sort: f.row.sort, sourceUrl: f.row.url }).where(eq(files.id, saved.id));
      byProject.set(pid, (byProject.get(pid) ?? 0) + 1);
      photosAdded++;
    }
    for (const [pid, n] of byProject) await log('project', pid, 'photo-add', `added ${n} ${n === 1 ? 'photo' : 'photos'} from the old website (${[...new Set(plan.photos.filter((f) => projectId.get(f.projectKey) === pid).map((f) => photoKindLabel(f.row.kind).toLowerCase()))].join(', ')})`);
    await audit({ userId: user.id, entity: 'import', entityId: null, action: 'apply', summary: `imported ${added.people} people, ${added.companies} companies, ${added.projects} projects, ${added.bills} bills and ${photosAdded} photos (${file.source ?? 'file'})`, via: VIA }, tx);
    return { plan, added, photosAdded };
  });
  revalidatePath('/', 'layout');
  revalidateTag(SITE_TAG, 'max');
  console.info('[import] apply saved');
  const sum = summarize(result.plan);
  return { ...sum, problems: [...(sum.problems ?? []), ...photoErrors], done: `Imported ${result.added.people} people, ${result.added.companies} companies, ${result.added.projects} projects, ${result.added.bills} bills and ${result.photosAdded} photos.` };
}

export type BillMatch = { vendor: string; to: string | null; kind: 'company' | 'person' | null; how: string | null; count: number; total: string };

/** Bills with a vendor name but no company or person linked, and what each name would link to. */
async function billMatches(x: Tx | typeof db) {
  const open = await x.select({ id: bills.id, projectId: bills.projectId, vendor: bills.vendorName, amount: bills.amount }).from(bills)
    .where(and(isNull(bills.archived), isNull(bills.vendorCompanyId), isNull(bills.vendorPersonId), sql`${bills.vendorName} is not null`));
  const cos = await x.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived));
  const ps = await x.select({ id: people.id, firstName: people.firstName, lastName: people.lastName }).from(people).where(isNull(people.archived));
  const byName = new Map<string, { ids: { id: string; projectId: string }[]; total: number; company: ReturnType<typeof matchCompany>; person: ReturnType<typeof matchPerson> }>();
  for (const b of open) {
    const v = b.vendor!;
    const e = byName.get(v) ?? { ids: [], total: 0, company: matchCompany(v, cos), person: null as ReturnType<typeof matchPerson> };
    if (!e.company && !e.person && !e.ids.length) e.person = matchPerson(v, ps);
    e.ids.push({ id: b.id, projectId: b.projectId }); e.total += Math.round(Number(b.amount) * 100);
    byName.set(v, e);
  }
  return byName;
}

const toRows = (m: Awaited<ReturnType<typeof billMatches>>): BillMatch[] => [...m.entries()].map(([vendor, e]) => ({
  vendor, to: e.company?.name ?? e.person?.name ?? null, kind: e.company ? 'company' as const : e.person ? 'person' as const : null,
  how: e.company?.how ?? e.person?.how ?? null, count: e.ids.length, total: (e.total / 100).toFixed(2),
})).sort((a, b) => Number(!!b.to) - Number(!!a.to) || a.vendor.localeCompare(b.vendor));

export async function previewBillMatches(): Promise<{ rows: BillMatch[] }> {
  await requireAction('users.manage');
  return { rows: toRows(await billMatches(db)) };
}

/** Links every bill whose vendor name matches a company or person (one step, in History). */
export async function applyBillMatches(): Promise<{ rows: BillMatch[]; done: string }> {
  const user = await requireAction('users.manage');
  const r = await db.transaction(async (tx) => {
    const m = await billMatches(tx);
    let linked = 0;
    for (const [vendor, e] of m) {
      const target = e.company ? { vendorCompanyId: e.company.id } : e.person ? { vendorPersonId: e.person.id } : null;
      if (!target) continue;
      for (const b of e.ids) await tx.update(bills).set(target).where(eq(bills.id, b.id));
      linked += e.ids.length;
      const who = e.company ?? e.person!;
      await audit({ userId: user.id, entity: e.company ? 'company' : 'person', entityId: who.id, action: 'bills-linked', summary: `linked ${e.ids.length} ${e.ids.length === 1 ? 'bill' : 'bills'} named “${vendor}” ($${(e.total / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })})`, via: 'Match Bills to Companies' }, tx);
      for (const pid of new Set(e.ids.map((b) => b.projectId))) await audit({ userId: user.id, entity: 'project', entityId: pid, action: 'bills-linked', summary: `linked the bills from “${vendor}” to ${who.name}`, via: 'Match Bills to Companies' }, tx);
    }
    return { linked };
  });
  revalidatePath('/', 'layout');
  return { rows: toRows(await billMatches(db)), done: `Linked ${r.linked} bills.` };
}
