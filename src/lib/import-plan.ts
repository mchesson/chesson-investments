// The import file Claude prepares from the owner's email and folders, and the
// plan of what it adds. Pure (no database), tested in import-plan.test.ts.
import { z } from 'zod';
import { formatName, normalizeEmail, storePhone } from './format';
import { roleDef } from './roles';
import { isHowMet } from './how-met';
import { likeCompanies, likePeople } from './duplicates';
import { allowedPhotoUrl, isPhotoKind, isSiteStatus } from './site';

const money = z.union([z.number(), z.string()]).transform((v) => String(v).replace(/[$,\s]/g, ''));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const importSchema = z.object({
  source: z.string().max(200).optional(),
  companies: z.array(z.object({
    name: z.string().min(1).max(200),
    phone: z.string().max(40).nullish(),
    email: z.string().max(200).nullish(),
    website: z.string().max(200).nullish(),
    role: z.string().nullish(),
    trade: z.string().max(200).nullish(),
    hiredThrough: z.string().max(200).nullish(), // the GC's company name
    supplierTypes: z.array(z.string()).nullish(),
    notes: z.string().max(4000).nullish(),
  })).default([]),
  people: z.array(z.object({
    name: z.string().min(1).max(200),
    email: z.string().max(200).nullish(),
    phone: z.string().max(40).nullish(),
    company: z.string().max(200).nullish(),
    title: z.string().max(200).nullish(),
    role: z.string().nullish(),
    trade: z.string().max(200).nullish(),
    howMet: z.string().nullish(),
    introducedBy: z.string().max(200).nullish(),
    introNote: z.string().max(2000).nullish(),
    notes: z.string().max(4000).nullish(),
    lastContactOn: day.nullish(),
    supplierTypes: z.array(z.string()).nullish(),
    stage: z.string().nullish(), // the role's stage when it isn't the first
    removeRoles: z.array(z.string()).nullish(), // a correction: roles to take off
  })).default([]),
  // GC bids and our own estimates, by cost code ("08"), on a project.
  bids: z.array(z.object({
    project: z.string().min(1), kind: z.enum(['bid', 'ours']).default('bid'), company: z.string().max(200).nullish(),
    label: z.string().max(200).nullish(), submittedOn: day.nullish(), contractType: z.enum(['fixed', 'cost_plus']).nullish(),
    feePct: z.union([z.number(), z.string()]).nullish(), validUntil: day.nullish(), preparedBy: z.string().max(200).nullish(),
    notes: z.string().max(4000).nullish(),
    lines: z.array(z.object({ costCode: z.string(), amount: money, note: z.string().max(300).nullish() })).min(1),
  })).default([]),
  // Who supplies each utility at a property, and the contact there.
  utilities: z.array(z.object({
    project: z.string().min(1), service: z.string(), company: z.string().nullish(), person: z.string().nullish(),
    startedOn: day.nullish(), notes: z.string().max(500).nullish(),
  })).default([]),
  projects: z.array(z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(200),
    city: z.string().nullish(), state: z.string().nullish(), zip: z.string().nullish(),
    stage: z.string().nullish(), ownedBy: z.string().nullish(), heatedSf: z.number().nullish(),
    lotCost: money.nullish(), marketValue: money.nullish(), notes: z.string().max(4000).nullish(),
    purchasedOn: day.nullish(), completedOn: day.nullish(), originalEstimate: money.nullish(), plannedExit: z.string().max(200).nullish(), actualExit: z.string().max(200).nullish(),
    closingCostAtSale: money.nullish(), sellingCostPct: z.string().nullish(), reviewNotes: z.string().max(8000).nullish(),
    lotAcres: z.number().nullish(),
    // The website page (filled only where the project's own is empty).
    site: z.object({
      status: z.string().nullish(), slug: z.string().max(80).nullish(), price: money.nullish(), tagline: z.string().max(160).nullish(),
      description: z.string().max(8000).nullish(), beds: z.number().nullish(), baths: z.number().nullish(),
      details: z.string().max(20000).nullish(), team: z.string().max(8000).nullish(), featured: z.boolean().nullish(),
    }).nullish(),
  })).default([]),
  // Photos copied from our old website (https://chessoninvestments.com only).
  photos: z.array(z.object({
    project: z.string().min(1),
    url: z.string().max(500),
    kind: z.string(),
    caption: z.string().max(120).nullish(),
    onSite: z.boolean().default(true),
    sort: z.number().int().min(0).max(999).default(0),
  })).default([]),
  bills: z.array(z.object({
    project: z.string().min(1),
    vendor: z.string().min(1).max(200),
    number: z.string().max(100).nullish(),
    date: day,
    kind: z.enum(['invoice', 'receipt', 'credit']).default('invoice'),
    billedTo: z.string().max(200).nullish(),
    backupFor: z.string().max(100).nullish(), // the GC invoice number it's backup for
    paid: z.boolean().default(false),
    paidHow: z.string().max(100).nullish(),
    lienWaiverRequired: z.boolean().default(false),
    notes: z.string().max(2000).nullish(),
    lines: z.array(z.object({
      kind: z.enum(['build', 'fee', 'holding', 'not_project']).default('build'),
      costCode: z.string().nullish(), // "08"
      holdingKind: z.string().nullish(),
      description: z.string().max(300).nullish(),
      amount: money,
    })).min(1),
  })).default([]),
});
export type ImportFile = z.infer<typeof importSchema>;

export type Existing = {
  people: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null }[];
  companies: { id: string; name: string }[];
  projects: { id: string; name: string; address: string }[];
  bills: { projectId: string; vendor: string; number: string | null; date: string; amount: string }[];
  costCodes: { id: string; code: string }[];
  photos?: { projectId: string; sourceUrl: string }[];
};

/** A credit's lines are stored negative whatever sign was typed; other bills keep their sign (credits inside a GC invoice). */
export function lineCents(amount: string, kind: string): number {
  const c = Math.round(Number(amount) * 100);
  return kind === 'credit' ? -Math.abs(c) : c;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function splitFull(name: string) {
  const parts = name.trim().replace(/\s+/g, ' ').split(' ');
  if (parts.length === 1) return { firstName: formatName(parts[0]), lastName: '' };
  return { firstName: formatName(parts.slice(0, -1).join(' ')), lastName: formatName(parts[parts.length - 1]) };
}

export type Plan = {
  companies: { name: string; match: string | null; row: ImportFile['companies'][number] }[];
  people: { name: string; match: string | null; matchedBy: string | null; row: ImportFile['people'][number] }[];
  projects: { name: string; match: string | null; row: ImportFile['projects'][number] }[];
  bills: { label: string; projectKey: string; duplicate: boolean; total: string; problem: string | null; row: ImportFile['bills'][number] }[];
  photos: { label: string; projectKey: string; duplicate: boolean; problem: string | null; row: ImportFile['photos'][number] }[];
  problems: string[];
};

/** What the file would add, and what it matches (by email, phone, then exact name). */
export function planImport(file: ImportFile, ex: Existing): Plan {
  const problems: string[] = [];
  const companyKeys = new Map(ex.companies.map((c) => [key(c.name), c.id]));
  const companies = file.companies.map((c) => {
    if (c.role && !roleDef(c.role)) problems.push(`${c.name}: unknown role "${c.role}"`);
    return { name: c.name, match: companyKeys.get(key(c.name)) ?? null, row: c };
  });
  const byEmail = new Map(ex.people.filter((p) => p.email).map((p) => [p.email!, p.id]));
  const byPhone = new Map(ex.people.filter((p) => p.phone).map((p) => [p.phone!, p.id]));
  const byName = new Map(ex.people.map((p) => [key(`${p.firstName}${p.lastName}`), p.id]));
  const seen = new Set<string>();
  const people = file.people.flatMap((p) => {
    const k = key(p.name);
    if (seen.has(k)) { problems.push(`${p.name}: listed twice in the file (kept the first)`); return []; }
    seen.add(k);
    if (p.role && !roleDef(p.role)) problems.push(`${p.name}: unknown role "${p.role}"`);
    if (p.howMet && !isHowMet(p.howMet)) problems.push(`${p.name}: unknown "how met" "${p.howMet}"`);
    const email = normalizeEmail(p.email);
    const phone = storePhone(p.phone);
    const m = (email && byEmail.get(email)) ? ['email', byEmail.get(email)!] : (phone && byPhone.get(phone)) ? ['phone', byPhone.get(phone)!] : byName.get(k) ? ['name', byName.get(k)!] : [null, null];
    return [{ name: p.name, match: m[1], matchedBy: m[0], row: p }];
  });
  const projKeys = new Map(ex.projects.flatMap((p) => [[key(p.name), p.id], [key(p.address), p.id]] as [string, string][]));
  const projects = file.projects.map((p) => ({ name: p.name, match: projKeys.get(key(p.address)) ?? projKeys.get(key(p.name)) ?? null, row: p }));
  const fileProjects = new Set(file.projects.flatMap((p) => [key(p.name), key(p.address)]));
  const codes = new Set(ex.costCodes.map((c) => c.code));
  const billKeys = new Set(ex.bills.map((b) => `${b.projectId}|${key(b.vendor)}|${b.number ?? ''}|${b.date}|${Number(b.amount).toFixed(2)}`));
  const inFile = new Set<string>();
  const bills = file.bills.map((b) => {
    const pk = key(b.project);
    const projectId = projKeys.get(pk) ?? null;
    let problem: string | null = null;
    if (!projectId && !fileProjects.has(pk)) problem = `project "${b.project}" isn't in the app or the file`;
    for (const l of b.lines) {
      if ((l.kind === 'build' || l.kind === 'fee') && (!l.costCode || !codes.has(l.costCode))) problem ??= `a line needs a known cost code (got "${l.costCode ?? ''}")`;
      if (l.kind === 'holding' && !l.holdingKind) problem ??= 'a holding line needs its kind';
      if (!Number.isFinite(Number(l.amount))) problem ??= 'a line amount isn’t a number';
    }
    const total = b.lines.reduce((s, l) => s + lineCents(l.amount, b.kind), 0);
    const totalStr = (total / 100).toFixed(2);
    const k = `${projectId}|${key(b.vendor)}|${b.number ?? ''}|${b.date}|${totalStr}`;
    const duplicate = (projectId !== null && billKeys.has(k)) || inFile.has(k);
    inFile.add(k);
    return { label: `${b.vendor}${b.number ? ` #${b.number}` : ''} (${b.date})`, projectKey: pk, duplicate, total: totalStr, problem, row: b };
  });
  // Like names (owner, Oct 2, 2026): a new one that looks like someone on file is flagged before it's added.
  for (const c of companies) if (!c.match) {
    const like = likeCompanies(c.name, ex.companies);
    if (like.length) problems.push(`${c.name}: looks like ${like.map((x) => x.name).join(', ')} on file. It will be added as a new company; use the name on file in the file if it's the same one.`);
  }
  for (const p of people) if (!p.match) {
    const like = likePeople(splitFull(p.name), ex.people);
    if (like.length) problems.push(`${p.name}: looks like ${like.map((x) => `${x.firstName} ${x.lastName}`).join(', ')} on file. They'll be added as a new person; use the name on file if it's the same person.`);
  }
  for (const pj of file.projects) if (pj.site?.status && !isSiteStatus(pj.site.status)) problems.push(`${pj.name}: unknown website status "${pj.site.status}"`);
  const photoKeys = new Set((ex.photos ?? []).map((f) => `${f.projectId}|${f.sourceUrl}`));
  const photoSeen = new Set<string>();
  const photos = file.photos.map((f) => {
    const pk = key(f.project);
    const projectId = projKeys.get(pk) ?? null;
    let problem: string | null = null;
    if (!projectId && !fileProjects.has(pk)) problem = `project "${f.project}" isn't in the app or the file`;
    else if (!allowedPhotoUrl(f.url)) problem = 'photos are copied only from https://chessoninvestments.com';
    else if (!isPhotoKind(f.kind)) problem = `unknown kind "${f.kind}"`;
    const k = `${projectId ?? pk}|${f.url}`;
    const duplicate = (projectId !== null && photoKeys.has(`${projectId}|${f.url}`)) || photoSeen.has(k);
    photoSeen.add(k);
    return { label: f.url.replace(/^https:\/\/[^/]+/, ''), projectKey: pk, duplicate, problem, row: f };
  });
  return { companies, people, projects, bills, photos, problems };
}
