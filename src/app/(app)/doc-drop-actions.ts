'use server';

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { entities, entityTaxIds, files, overheadExpenses, projects } from '@/db/schema';
import { isOverheadCategory, overheadLabel } from '@/lib/overhead';
import { parseMoney, isDay } from '@/lib/format';
import type { FormResult } from '@/components/ActionForm';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { can } from '@/lib/permissions';
import { detectDropFile } from '@/lib/file-rules';
import { getObject, putObject, removeObject, signedUpload, storageOn } from '@/lib/storage';
import { decide, propertyKey } from '@/lib/doc-filing';
import { targetsFor } from '@/lib/doc-targets';
import { placeAndZoneQuickly } from '@/lib/locate';
import { redirect } from 'next/navigation';
import { projectStages } from '@/lib/project-stages';
import { formatState } from '@/lib/format';
import { classify } from '@/lib/doc-filing-ai';
import { docCaption, isProjectDocType } from '@/lib/doc-types';
import { last4Of, masked, seal } from '@/lib/secret-box';
import { str } from '@/lib/forms';

// Dropping many documents at once (owner, Oct 3, 2026): each file goes straight
// to private storage, Claude reads its first pages, and it's filed on the right
// project or business entity, or waits in the inbox for a person.

const MAX_DROP = 50 * 1024 * 1024;
const VIA = 'document drop';
const sign = (path: string, userId: string) => createHmac('sha256', process.env.AUTH_SECRET ?? 'dev').update(`drop|${path}|${userId}`).digest('base64url');

export type DropResult = { name: string; status: 'filed' | 'inbox' | 'refused' | 'duplicate' | 'error'; message: string; href?: string };

/** Step 1: where the browser sends the file (straight to storage; small files go through the app when storage is off). */
export async function startDrop(name: string, size: number): Promise<{ url: string; path: string; token: string } | { direct: true } | { error: string }> {
  const user = await requireAction('projects.edit');
  if (size > MAX_DROP) return { error: 'Files can be up to 50 MB.' };
  if (!storageOn()) return size <= 4 * 1024 * 1024 ? { direct: true } : { error: 'Files over 4 MB need the app’s file storage, which isn’t set up here.' };
  const path = `drop/${randomUUID()}`;
  try { return { url: await signedUpload(path), path, token: sign(path, user.id) }; } catch (e) { return { error: e instanceof Error ? e.message : 'Storage refused.' }; }
}

/** Step 2 (big files): read what was uploaded and file it. */
export async function finishDrop(path: string, token: string, name: string): Promise<DropResult> {
  const user = await requireAction('projects.edit');
  const want = Buffer.from(sign(path, user.id)), got = Buffer.from(token ?? '');
  if (!/^drop\/[0-9a-f-]{36}$/.test(path) || want.length !== got.length || !timingSafeEqual(want, got)) return { name, status: 'error', message: 'That upload wasn’t started here.' };
  let bytes: Buffer;
  try { bytes = await getObject(path); } catch { return { name, status: 'error', message: 'The upload didn’t arrive: try that file again.' }; }
  return processDrop(bytes, name, path, user);
}

/** Small files when there's no storage (and in tests). */
export async function dropSmall(d: FormData): Promise<DropResult> {
  const user = await requireAction('projects.edit');
  const f = d.get('file') as File | null;
  if (!f || !f.size) return { name: 'file', status: 'error', message: 'Pick a file.' };
  return processDrop(Buffer.from(await f.arrayBuffer()), f.name, null, user);
}


async function processDrop(bytes: Buffer, rawName: string, path: string | null, user: Awaited<ReturnType<typeof requireAction>>): Promise<DropResult> {
  const name = rawName.slice(0, 200) || 'document';
  const kind = detectDropFile(bytes, name);
  const drop = async () => { if (path) await removeObject(path); };
  if (!kind) { await drop(); return { name, status: 'refused', message: 'Only PDFs, photos, Word and Excel files are taken.' }; }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const [dup] = await db.select({ id: files.id }).from(files).where(and(eq(files.sha256, sha256), isNull(files.archived))).limit(1);
  if (dup) { await drop(); return { name, status: 'duplicate', message: 'Already in the app (the same file).', href: `/documents/${dup.id}` }; }
  const targets = await targetsFor(user);
  const { filing } = await classify({ name, type: kind.type, bytes }, targets);
  const d = decide(filing, targets, can(user, 'sensitive.view'), can(user, 'money.view'));
  if (d.action === 'refuse') { await drop(); return { name, status: 'refused', message: d.why }; }
  const owner = d.action === 'file' ? { entity: d.kind, entityId: d.id } : { entity: 'inbox', entityId: user.id };
  const caption = docCaption(d.type, d.title || null);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(files).values({
      ...owner, name, contentType: kind.type, size: bytes.length, sha256, data: path ? null : bytes, storagePath: path, caption, uploadedBy: user.id,
      proposedProperty: d.action === 'inbox' ? d.proposal ?? null : null,
    }).returning({ id: files.id });
    if (!path && storageOn()) { // a small file sent through the app: into storage like the rest
      const p = `${owner.entity}/${row.id}.${kind.ext}`;
      await putObject(p, bytes, kind.type);
      await tx.update(files).set({ storagePath: p, data: null }).where(eq(files.id, row.id));
    }
    if (d.action === 'file' && d.kind === 'overhead') {
      const e = d.expense;
      await tx.insert(overheadExpenses).values({ entityId: d.id, fileId: row.id, vendor: e.vendor, amount: e.amount === null ? null : String(e.amount), spentOn: e.spentOn, category: e.category, createdBy: user.id });
      await audit({ userId: user.id, entity: 'entity', entityId: d.id, action: 'overhead-add', summary: `added overhead: ${e.vendor ?? caption}${e.amount !== null ? ` $${e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''} (${overheadLabel(e.category)})`, after: { fileId: row.id, ...e }, via: VIA }, tx);
    } else if (d.action === 'file') {
      await audit({ userId: user.id, entity: d.kind, entityId: d.id, action: 'doc-add', summary: `added a document: ${caption}`, after: { fileId: row.id }, via: VIA }, tx);
      // An EIN letter: its number goes into the entity's Tax IDs, sealed (History shows the last 4 only).
      if (d.ein && d.kind === 'entity') {
        const [has] = await tx.select({ id: entityTaxIds.id }).from(entityTaxIds).where(and(eq(entityTaxIds.entityId, d.id), eq(entityTaxIds.kind, 'ein'), isNull(entityTaxIds.archived)));
        if (!has) {
          let cipher: string | null = null;
          try { cipher = seal(`${d.ein.slice(0, 2)}-${d.ein.slice(2)}`); } catch { cipher = null; }
          if (cipher) {
            const last4 = last4Of(d.ein);
            await tx.insert(entityTaxIds).values({ entityId: d.id, kind: 'ein', label: 'From the EIN letter', cipher, last4, createdBy: user.id });
            await audit({ userId: user.id, entity: 'entity', entityId: d.id, action: 'tax-id-add', summary: `added the Federal EIN (${masked(last4)}) from the EIN letter`, after: { kind: 'ein', last4 }, via: VIA }, tx);
          }
        }
      }
    } else {
      await audit({ userId: user.id, entity: 'file', entityId: row.id, action: 'drop', summary: `dropped ${name}; waiting to be filed (${d.why})`, via: VIA }, tx);
    }
    return row.id;
  });
  revalidatePath('/documents/drop');
  if (d.action === 'inbox') return { name, status: 'inbox', message: `${d.type}: ${d.why}`, href: `/documents/${id}` };
  const t = targets.find((x) => x.id === d.id)!;
  if (d.kind === 'overhead') return { name, status: 'filed', message: `${caption} → Overhead, ${t.name} (${overheadLabel(d.expense.category)}${d.expense.amount !== null ? `, $${d.expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''})`, href: '/overhead' };
  return { name, status: 'filed', message: `${caption} → ${t.name}${d.ein ? ' (EIN saved, encrypted)' : ''}`, href: `/${d.kind === 'project' ? 'projects' : 'entities'}/${d.id}?tab=documents` };
}

/** Filing one from the inbox by hand. */
export async function fileFromInbox(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const id = str(d, 'id');
  const [f] = id ? await db.select().from(files).where(and(eq(files.id, id), eq(files.entity, 'inbox'), isNull(files.archived))) : [];
  if (!f) return { error: 'Not found.' };
  const t = str(d, 'target')?.match(/^([peo]):([0-9a-f-]{36})$/i);
  if (!t) return { error: 'Pick where it goes: type the property, entity or overhead and choose it.' };
  if (t[1] === 'o') return fileAsOverhead(f, t[2], d, user);
  const kind = t[1] === 'p' ? 'project' : 'entity';
  if (kind === 'entity' && !can(user, 'sensitive.view')) return { error: 'Business documents are filed by the owner.' };
  const type = str(d, 'type') ?? 'Other';
  const caption = docCaption(isProjectDocType(type) || kind === 'entity' ? type : 'Other', str(d, 'title'));
  const [target] = kind === 'project' ? await db.select({ name: projects.name }).from(projects).where(eq(projects.id, t[2])) : await db.select({ name: entities.name }).from(entities).where(eq(entities.id, t[2]));
  if (!target) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.update(files).set({ entity: kind, entityId: t[2], caption }).where(eq(files.id, f.id));
    await audit({ userId: user.id, entity: kind, entityId: t[2], action: 'doc-add', summary: `filed a document: ${caption}`, after: { fileId: f.id }, via: VIA }, tx);
  });
  revalidatePath('/documents/drop');
  return { ok: `Filed on ${target.name}.` };
}

/** A dropped file that isn't wanted after all. */
export async function discardDropped(id: string): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const [f] = await db.select().from(files).where(and(eq(files.id, id), eq(files.entity, 'inbox'), isNull(files.archived)));
  if (!f) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.update(files).set({ archived: new Date() }).where(eq(files.id, f.id));
    await audit({ userId: user.id, entity: 'file', entityId: f.id, action: 'archive', summary: `took ${f.name} out of the inbox`, via: VIA }, tx);
  });
  revalidatePath('/documents/drop');
  return { ok: 'Removed from the inbox.' };
}

async function fileAsOverhead(f: typeof files.$inferSelect, entityId: string, d: FormData, user: Awaited<ReturnType<typeof requireAction>>): Promise<FormResult> {
  if (!can(user, 'money.view')) return { error: 'Overhead is filed by someone who sees the money.' };
  const [e] = await db.select({ name: entities.name }).from(entities).where(eq(entities.id, entityId));
  if (!e) return { error: 'Not found.' };
  const amount = parseMoney(d.get('amount'));
  if (amount === undefined) return { error: 'Amount: a dollar amount.' };
  const spentOn = str(d, 'spentOn');
  if (spentOn && !isDay(spentOn)) return { error: 'Date: a real date.' };
  const category = str(d, 'category');
  const cat = isOverheadCategory(category) ? category : 'other';
  const type = str(d, 'type') ?? 'Receipt';
  const caption = docCaption(isProjectDocType(type) ? type : 'Receipt', str(d, 'title'));
  await db.transaction(async (tx) => {
    await tx.update(files).set({ entity: 'overhead', entityId, caption }).where(eq(files.id, f.id));
    await tx.insert(overheadExpenses).values({ entityId, fileId: f.id, vendor: str(d, 'vendor'), amount, spentOn: spentOn ?? null, category: cat, createdBy: user.id });
    await audit({ userId: user.id, entity: 'entity', entityId, action: 'overhead-add', summary: `added overhead: ${str(d, 'vendor') ?? caption}${amount ? ` $${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''} (${overheadLabel(cat)})`, after: { fileId: f.id }, via: VIA }, tx);
  });
  revalidatePath('/documents/drop');
  revalidatePath('/overhead');
  return { ok: `Filed as overhead for ${e.name}.` };
}

/** Creates the project the dropped documents are about, filled in from them, and files them all on it. */
export async function createProjectFromDocs(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const key = str(d, 'key');
  const address = str(d, 'address');
  if (!key || !address) return { error: 'An address is needed.' };
  const waiting = (await db.select().from(files).where(and(eq(files.entity, 'inbox'), isNull(files.archived))))
    .filter((f) => f.proposedProperty && propertyKey(f.proposedProperty) === key);
  if (!waiting.length) return { error: 'Those documents were already filed.' };
  const lotCost = parseMoney(d.get('lotCost'));
  if (lotCost === undefined) return { error: 'Purchase price: a dollar amount.' };
  const heated = str(d, 'heatedSf')?.replace(/[,\s]/g, '') ?? null;
  if (heated && !/^\d+$/.test(heated)) return { error: 'Heated SF: a whole number.' };
  const purchasedOn = str(d, 'purchasedOn');
  if (purchasedOn && !isDay(purchasedOn)) return { error: 'Bought On: a real date.' };
  const stageKey = str(d, 'stage') ?? 'under_contract';
  const stage = projectStages.some((s) => s.key === stageKey) ? stageKey : 'under_contract';
  const f = {
    name: str(d, 'name') ?? address, address, city: str(d, 'city'), state: formatState(str(d, 'state')) ?? 'NC', zip: str(d, 'zip'), neighborhood: str(d, 'neighborhood'),
    lotCost, heatedSf: heated ? Number(heated) : null, purchasedOn: purchasedOn ?? null,
  };
  const projectId = await db.transaction(async (tx) => {
    const [p] = await tx.insert(projects).values({ ...f, stage: stage as never, sellingCostPct: '5', createdBy: user.id }).returning({ id: projects.id });
    await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'create', summary: `added ${f.name} from ${waiting.length} dropped ${waiting.length === 1 ? 'document' : 'documents'}`, after: f, via: VIA }, tx);
    for (const w of waiting) {
      await tx.update(files).set({ entity: 'project', entityId: p.id, proposedProperty: null }).where(eq(files.id, w.id));
      await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'doc-add', summary: `added a document: ${w.caption ?? w.name}`, after: { fileId: w.id }, via: VIA }, tx);
    }
    return p.id;
  });
  await placeAndZoneQuickly('project', projectId, user.id);
  revalidatePath('/projects');
  redirect(`/projects/${projectId}?tab=documents`);
}

/** Reads waiting files again (after a new project or entity exists, or for files dropped before this step). */
export async function readAgain(): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const waiting = await db.select().from(files).where(and(eq(files.entity, 'inbox'), isNull(files.archived))).limit(200);
  const targets = await targetsFor(user);
  const deadline = Date.now() + 240_000;
  let filed = 0, proposed = 0, read = 0;
  for (const w of waiting) {
    if (Date.now() > deadline) break;
    let bytes: Buffer | null = null;
    try { bytes = w.storagePath ? await getObject(w.storagePath) : w.data ? Buffer.from(w.data) : null; } catch { bytes = null; }
    if (!bytes) continue;
    read++;
    const { filing } = await classify({ name: w.name, type: w.contentType, bytes }, targets);
    if (!filing) continue;
    const dd = decide(filing, targets, can(user, 'sensitive.view'), can(user, 'money.view'));
    if (dd.action === 'refuse') continue; // left for a person to remove
    const caption = docCaption(dd.type, dd.title || null);
    await db.transaction(async (tx) => {
      if (dd.action === 'inbox') {
        await tx.update(files).set({ caption, proposedProperty: dd.proposal ?? null }).where(eq(files.id, w.id));
        if (dd.proposal) proposed++;
        return;
      }
      if (dd.kind === 'overhead') {
        await tx.update(files).set({ entity: 'overhead', entityId: dd.id, caption, proposedProperty: null }).where(eq(files.id, w.id));
        const e = dd.expense;
        await tx.insert(overheadExpenses).values({ entityId: dd.id, fileId: w.id, vendor: e.vendor, amount: e.amount === null ? null : String(e.amount), spentOn: e.spentOn, category: e.category, createdBy: user.id });
        await audit({ userId: user.id, entity: 'entity', entityId: dd.id, action: 'overhead-add', summary: `added overhead: ${e.vendor ?? caption} (${overheadLabel(e.category)})`, after: { fileId: w.id }, via: VIA }, tx);
      } else {
        await tx.update(files).set({ entity: dd.kind, entityId: dd.id, caption, proposedProperty: null }).where(eq(files.id, w.id));
        await audit({ userId: user.id, entity: dd.kind, entityId: dd.id, action: 'doc-add', summary: `added a document: ${caption}`, after: { fileId: w.id }, via: VIA }, tx);
      }
      filed++;
    });
  }
  revalidatePath('/documents/drop');
  const left = waiting.length - read;
  return { ok: `Read ${read}: filed ${filed}${proposed ? `, ${proposed} about new properties (see New Properties Found)` : ''}.${left > 0 ? ` ${left} more: press Read Again to carry on.` : ''}` };
}
