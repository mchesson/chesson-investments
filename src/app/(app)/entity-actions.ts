'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { entities, entityMembers, entityTaxIds } from '@/db/schema';
import type { FormResult } from '@/components/ActionForm';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { str, uuidOrNull } from '@/lib/forms';
import { formatState, isDay, parseMoney } from '@/lib/format';
import { saveFile } from '@/lib/files';
import { entityDocTypes, entityKinds, memberRoles } from '@/lib/entities';
import { cleanTaxId, isTaxIdKind, last4Of, masked, open, seal, taxIdKindLabel } from '@/lib/secret-box';

// Business entities (owner, Oct 3, 2026). Everything here needs the
// restricted-records permission; History records every change and every time a
// tax ID is shown.
const NEED = 'sensitive.view' as const;
const pick = (v: string | null, list: readonly { key: string }[]) => (v && list.some((x) => x.key === v) ? v : null);
const day = (d: FormData, k: string) => { const v = str(d, k); return v && isDay(v) ? v : null; };

export async function saveEntity(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction(NEED);
  const name = str(d, 'name');
  if (!name) return { error: 'A name is needed.' };
  const f = {
    name, kind: pick(str(d, 'kind'), entityKinds) ?? 'llc', state: formatState(str(d, 'state')), formedOn: day(d, 'formedOn'),
    status: str(d, 'status') === 'dissolved' ? 'dissolved' : 'active', taxForm: str(d, 'taxForm'), fiscalYearEnd: str(d, 'fiscalYearEnd'),
    address: str(d, 'address'), registeredAgent: str(d, 'registeredAgent'), website: str(d, 'website'), companyId: uuidOrNull(d, 'companyId'), notes: str(d, 'notes'),
  };
  const id = uuidOrNull(d, 'id');
  const saved = await db.transaction(async (tx) => {
    if (!id) {
      const [e] = await tx.insert(entities).values({ ...f, createdBy: user.id }).returning();
      await audit({ userId: user.id, entity: 'entity', entityId: e.id, action: 'create', summary: `added the business entity ${e.name}`, after: f }, tx);
      return e.id;
    }
    const [old] = await tx.select().from(entities).where(eq(entities.id, id));
    if (!old) return null;
    await tx.update(entities).set({ ...f, updated: new Date() }).where(eq(entities.id, id));
    const ch = diff(old as Record<string, unknown>, f);
    if (ch) await audit({ userId: user.id, entity: 'entity', entityId: id, action: 'update', summary: `edited ${Object.keys(ch.after).join(', ')}`, ...ch }, tx);
    return id;
  });
  if (!saved) return { error: 'Not found.' };
  redirect(`/entities/${saved}`);
}

export async function saveMember(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction(NEED);
  const entityId = uuidOrNull(d, 'entityId');
  const memberEntityId = uuidOrNull(d, 'memberEntityId');
  if (!entityId) return { error: 'Not found.' };
  if (memberEntityId === entityId) return { error: 'An entity can’t be its own member.' };
  const [owner] = memberEntityId ? await db.select({ name: entities.name }).from(entities).where(eq(entities.id, memberEntityId)) : [];
  const name = str(d, 'name') ?? owner?.name ?? null;
  if (!name) return { error: 'Type the member’s name, or pick one of our entities.' };
  const pctRaw = str(d, 'percent')?.replace(/%/g, '') ?? null;
  const percent = pctRaw === null ? null : Number(pctRaw);
  if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) return { error: 'Percent: a number from 0 to 100.' };
  const capital = parseMoney(d.get('capital'));
  if (capital === undefined) return { error: 'Capital contribution: a dollar amount.' };
  const f = { name, personId: uuidOrNull(d, 'personId'), memberEntityId, percent: percent === null ? null : String(percent), capital, role: pick(str(d, 'role'), memberRoles), since: day(d, 'since'), notes: str(d, 'notes') };
  const id = uuidOrNull(d, 'id');
  await db.transaction(async (tx) => {
    if (!id) {
      await tx.insert(entityMembers).values({ entityId, ...f });
      await audit({ userId: user.id, entity: 'entity', entityId, action: 'member-add', summary: `added ${name} as a member${percent !== null ? ` (${percent}%)` : ''}`, after: f }, tx);
      return;
    }
    const [old] = await tx.select().from(entityMembers).where(and(eq(entityMembers.id, id), eq(entityMembers.entityId, entityId)));
    if (!old) return;
    await tx.update(entityMembers).set(f).where(eq(entityMembers.id, id));
    const ch = diff(old as Record<string, unknown>, f);
    if (ch) await audit({ userId: user.id, entity: 'entity', entityId, action: 'member-update', summary: `changed ${name}: ${Object.keys(ch.after).join(', ')}`, ...ch }, tx);
  });
  revalidatePath(`/entities/${entityId}`);
  return { ok: 'Saved.' };
}

export async function removeMember(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction(NEED);
  const id = uuidOrNull(d, 'id');
  const [m] = id ? await db.select().from(entityMembers).where(and(eq(entityMembers.id, id), isNull(entityMembers.removed))) : [];
  if (!m) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.update(entityMembers).set({ removed: new Date() }).where(eq(entityMembers.id, m.id));
    await audit({ userId: user.id, entity: 'entity', entityId: m.entityId, action: 'member-remove', summary: `took ${m.name} off the members`, before: m }, tx);
  });
  revalidatePath(`/entities/${m.entityId}`);
  return { ok: 'Removed.' };
}

export async function addTaxId(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction(NEED);
  const entityId = uuidOrNull(d, 'entityId');
  const kind = str(d, 'kind') ?? '';
  if (!entityId || !isTaxIdKind(kind)) return { error: 'Pick what kind of number it is.' };
  const c = cleanTaxId(kind, String(d.get('value') ?? ''));
  if ('error' in c) return c;
  let cipher: string;
  try { cipher = seal(c.value); } catch { return { error: 'The app has no encryption key set, so the number wasn’t saved. Ask Claude to set TAX_ID_KEY.' }; }
  const last4 = last4Of(c.value);
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(entityTaxIds).values({ entityId, kind, label: str(d, 'label'), cipher, last4, issuedOn: day(d, 'issuedOn'), createdBy: user.id }).returning({ id: entityTaxIds.id });
    // History names the kind and the last 4 only, never the number.
    await audit({ userId: user.id, entity: 'entity', entityId, action: 'tax-id-add', summary: `added the ${taxIdKindLabel(kind)} (${masked(last4)})`, after: { taxIdId: row.id, kind, last4 } }, tx);
  });
  revalidatePath(`/entities/${entityId}`);
  return { ok: `Saved: ${masked(last4)}.` };
}

/** Shows one tax ID to the signed-in person, and writes that to History. */
export async function revealTaxId(id: string): Promise<{ value?: string; error?: string }> {
  const user = await requireAction(NEED);
  const [t] = await db.select().from(entityTaxIds).where(and(eq(entityTaxIds.id, id), isNull(entityTaxIds.archived)));
  if (!t) return { error: 'Not found.' };
  let value: string;
  try { value = open(t.cipher); } catch { return { error: 'It can’t be opened with the app’s current key.' }; }
  await audit({ userId: user.id, entity: 'entity', entityId: t.entityId, action: 'tax-id-view', summary: `viewed the ${taxIdKindLabel(t.kind)} (${masked(t.last4)})`, after: { taxIdId: t.id } });
  return { value };
}

export async function removeTaxId(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction(NEED);
  const id = uuidOrNull(d, 'id');
  const [t] = id ? await db.select().from(entityTaxIds).where(and(eq(entityTaxIds.id, id), isNull(entityTaxIds.archived))) : [];
  if (!t) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.update(entityTaxIds).set({ archived: new Date() }).where(eq(entityTaxIds.id, t.id));
    await audit({ userId: user.id, entity: 'entity', entityId: t.entityId, action: 'tax-id-remove', summary: `removed the ${taxIdKindLabel(t.kind)} (${masked(t.last4)})`, before: { kind: t.kind, last4: t.last4 } }, tx);
  });
  revalidatePath(`/entities/${t.entityId}`);
  return { ok: 'Removed.' };
}

export async function addEntityDoc(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction(NEED);
  const entityId = uuidOrNull(d, 'entityId');
  const [e] = entityId ? await db.select({ id: entities.id }).from(entities).where(eq(entities.id, entityId)) : [];
  if (!e) return { error: 'Not found.' };
  const type = str(d, 'docType');
  if (!type || !(entityDocTypes as readonly string[]).includes(type)) return { error: 'Pick the kind of document.' };
  const note = str(d, 'note');
  const caption = note ? `${type} · ${note}`.slice(0, 200) : type;
  const r = await saveFile(d.get('file') as File, { entity: 'entity', entityId: e.id }, user.id, { caption });
  if ('error' in r) return r;
  await audit({ userId: user.id, entity: 'entity', entityId: e.id, action: 'doc-add', summary: `added a document: ${caption}`, after: { fileId: r.id } });
  revalidatePath(`/entities/${e.id}`);
  return { ok: 'Uploaded.' };
}
