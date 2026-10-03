'use server';

import { placeAndZoneQuickly } from '@/lib/locate';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { budgetLines, costCodes, projects, properties, partyRoles, siteLeads } from '@/db/schema';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { bool, str, uuidOrNull } from '@/lib/forms';
import { formatState, isDay, parseIntOrNull, parseMoney, today } from '@/lib/format';
import { acresFromSf, isPropertyStage, pickableStages, propertyStageLabel, stageProblem, type PropertyStage } from '@/lib/properties';
import { DEFAULT_PERCENTS } from '@/lib/cost-codes';
import { bigDealChecklist, commercialUses, entitlements, isDealType, isSourceKind, utilities } from '@/lib/deal-sources';
import { saveFile } from '@/lib/files';
import type { FormResult } from '@/components/ActionForm';
import { and, isNull } from 'drizzle-orm';
import { splitAddress } from '@/lib/locate-rules';

function moneyField(d: FormData, k: string, label: string): string | null {
  const v = parseMoney(d.get(k));
  if (v === undefined) throw new FieldError(`${label}: type a dollar amount, like 450,000 or 450k.`);
  return v;
}
class FieldError extends Error {}

function propertyFields(d: FormData) {
  const lotSf = parseIntOrNull(d.get('lotSf'));
  if (lotSf === undefined) throw new FieldError('Lot size: type square feet as a number.');
  const acresTyped = str(d, 'lotAcres');
  if (acresTyped && !/^\d+(\.\d+)?$/.test(acresTyped)) throw new FieldError('Acres: type a number, like 0.21.');
  // One address field (owner, Oct 3, 2026): split into the parts the county lookups use.
  const where = splitAddress(str(d, 'address'));
  return {
    address: where.street,
    city: where.city ?? str(d, 'city'), state: formatState(where.state ?? str(d, 'state')) ?? 'NC', zip: where.zip ?? str(d, 'zip'), neighborhood: str(d, 'neighborhood'),
    sourcePersonId: uuidOrNull(d, 'sourcePersonId'),
    askingPrice: moneyField(d, 'askingPrice', 'Asking price'),
    lotSf, lotAcres: acresTyped ?? acresFromSf(lotSf), zoning: str(d, 'zoning')?.toUpperCase() ?? null,
    metBuyBox: d.get('metBuyBox') === 'yes' ? true : d.get('metBuyBox') === 'no' ? false : null,
    referralFee: moneyField(d, 'referralFee', 'Referral fee'),
    notes: str(d, 'notes'),
    ...dealFields(d),
  };
}

/** The kind of deal, where it came from and the land and commercial facts. */
function dealFields(d: FormData) {
  const pick = (k: string, list: readonly { key: string }[]) => { const v = str(d, k); return v && list.some((x) => x.key === v) ? v : null; };
  const lotsPossible = parseIntOrNull(d.get('lotsPossible'));
  if (lotsPossible === undefined || (lotsPossible !== null && (lotsPossible < 0 || lotsPossible > 100_000))) throw new FieldError('Lots or units: type a whole number.');
  const type = str(d, 'dealType');
  const kind = str(d, 'sourceKind');
  return {
    dealType: isDealType(type) ? type : 'lot',
    sourceKind: isSourceKind(kind) ? kind : null,
    sourceCompanyId: uuidOrNull(d, 'sourceCompanyId'),
    sourceAccurate: d.get('sourceAccurate') === 'yes' ? true : d.get('sourceAccurate') === 'no' ? false : null,
    sourceNote: str(d, 'sourceNote'),
    lotsPossible, utilities: pick('utilities', utilities), entitlement: pick('entitlement', entitlements), commercialUse: pick('commercialUse', commercialUses),
  };
}

/** Ticks one step of a land or commercial deal's checklist. */
export async function setChecklistItem(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('properties.edit');
  const id = uuidOrNull(d, 'id');
  const key = str(d, 'key') ?? '';
  const [p] = id ? await db.select().from(properties).where(eq(properties.id, id)) : [];
  if (!p) return { error: 'Not found.' };
  const item = (p.dealType === 'land' || p.dealType === 'commercial') ? bigDealChecklist[p.dealType].find((i) => i.key === key) : undefined;
  if (!item) return { error: 'Pick a step.' };
  const done = d.get('done') === 'yes';
  const next = { ...(p.checklist as Record<string, boolean>), [key]: done };
  await db.transaction(async (tx) => {
    await tx.update(properties).set({ checklist: next, updated: new Date() }).where(eq(properties.id, p.id));
    await audit({ userId: user.id, entity: 'property', entityId: p.id, action: 'checklist', summary: `${done ? 'checked off' : 'unchecked'} “${item.label}”`, before: { [key]: !!(p.checklist as Record<string, boolean>)[key] }, after: { [key]: done } }, tx);
  });
  revalidatePath(`/watchlist/${p.id}`);
  return { ok: done ? 'Checked off.' : 'Unchecked.' };
}

export async function saveProperty(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('properties.edit');
  let f;
  try { f = propertyFields(d); } catch (e) { if (e instanceof FieldError) return { error: e.message }; throw e; }
  if (!f.address) return { error: 'An address is needed.' };
  const id = uuidOrNull(d, 'id');
  const savedId = await db.transaction(async (tx) => {
    if (!id) {
      const [p] = await tx.insert(properties).values({ ...f, createdBy: user.id }).returning();
      await audit({ userId: user.id, entity: 'property', entityId: p.id, action: 'create', summary: `added ${p.address} to the watchlist`, after: f }, tx);
      // Added from a website lead (Leads → Add to Watchlist): the lead points at it now.
      const leadId = uuidOrNull(d, 'siteLeadId');
      if (leadId) {
        const [lead] = await tx.update(siteLeads).set({ propertyId: p.id, updated: new Date() }).where(and(eq(siteLeads.id, leadId), isNull(siteLeads.propertyId))).returning({ id: siteLeads.id });
        if (lead) {
          await audit({ userId: user.id, entity: 'site_lead', entityId: lead.id, action: 'property', summary: `added ${p.address} to the watchlist from this lead`, via: 'Leads', after: { propertyId: p.id } }, tx);
          await audit({ userId: user.id, entity: 'property', entityId: p.id, action: 'site-lead', summary: 'came in through Sell Us Your Property on the website', via: 'Leads' }, tx);
        }
      }
      if (f.sourceCompanyId) await audit({ userId: user.id, entity: 'company', entityId: f.sourceCompanyId, action: 'deal-sent', summary: `sent us ${p.address}` }, tx);
      if (f.sourcePersonId) {
        await audit({ userId: user.id, entity: 'person', entityId: f.sourcePersonId, action: 'deal-sent', summary: `sent us ${p.address}` }, tx);
        // A deal sent moves an agent or wholesaler to "Sent a Deal" (never backwards).
        const rs = await tx.select().from(partyRoles).where(and(eq(partyRoles.personId, f.sourcePersonId), isNull(partyRoles.removed)));
        for (const r of rs) {
          if ((r.role === 'agent' || r.role === 'wholesaler') && (r.stage === 'met' || r.stage === 'talking')) {
            await tx.update(partyRoles).set({ stage: 'sent_deal', stageChangedAt: new Date() }).where(eq(partyRoles.id, r.id));
            await audit({ userId: user.id, entity: 'person', entityId: f.sourcePersonId, action: 'role-update', summary: `moved ${r.role === 'agent' ? 'Real Estate Agent / Broker' : 'Wholesaler / Deal Source'} to Sent a Deal`, via: 'watchlist' }, tx);
          }
        }
      }
      return p.id;
    }
    const [old] = await tx.select().from(properties).where(eq(properties.id, id));
    await tx.update(properties).set({ ...f, updated: new Date() }).where(eq(properties.id, id));
    const ch = diff(old as Record<string, unknown>, f);
    if (ch) await audit({ userId: user.id, entity: 'property', entityId: id, action: 'update', summary: `edited ${Object.keys(ch.after).join(', ')}`, ...ch }, tx);
    return id;
  });
  // Where it is and its zoning, from the county records (a few seconds at most).
  await placeAndZoneQuickly('property', savedId, user.id);
  redirect(`/watchlist/${savedId}`);
}

export async function setPropertyStage(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('properties.edit');
  const id = uuidOrNull(d, 'id');
  const stage = str(d, 'stage') ?? '';
  if (!id || !isPropertyStage(stage) || !pickableStages.includes(stage)) return { error: 'Pick a stage.' };
  let f;
  try {
    f = { ourOffer: moneyField(d, 'ourOffer', 'Our offer'), winningPrice: moneyField(d, 'winningPrice', 'Winning price'), winningBuyer: str(d, 'winningBuyer') };
  } catch (e) { if (e instanceof FieldError) return { error: e.message }; throw e; }
  const [old] = await db.select().from(properties).where(eq(properties.id, id));
  if (!old) return { error: 'Not found.' };
  const merged = { ourOffer: f.ourOffer ?? old.ourOffer, winningPrice: f.winningPrice ?? old.winningPrice, winningBuyer: f.winningBuyer ?? old.winningBuyer };
  const problem = stageProblem(stage as PropertyStage, merged);
  if (problem) return { error: problem };
  const offerOn = str(d, 'offerOn');
  await db.transaction(async (tx) => {
    const next = { stage: stage as PropertyStage, ...merged, offerOn: offerOn && isDay(offerOn) ? offerOn : old.offerOn ?? (stage === 'offer_made' ? today() : null) };
    await tx.update(properties).set({ ...next, updated: new Date() }).where(eq(properties.id, id));
    const ch = diff(old as Record<string, unknown>, next);
    await audit({ userId: user.id, entity: 'property', entityId: id, action: 'stage', summary: `moved it from ${propertyStageLabel(old.stage)} to ${propertyStageLabel(stage)}`, ...(ch ?? {}) }, tx);
  });
  revalidatePath(`/watchlist/${id}`);
  return { ok: 'Saved.' };
}

/** Sold to someone else (or after we passed): off the active watchlist, kept as a comparable. */
export async function markSold(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('properties.edit');
  const id = uuidOrNull(d, 'id');
  let soldPrice;
  try { soldPrice = moneyField(d, 'soldPrice', 'Sale price'); } catch (e) { if (e instanceof FieldError) return { error: e.message }; throw e; }
  const soldOn = str(d, 'soldOn');
  if (!id) return { error: 'Not found.' };
  if (!soldPrice) return { error: 'Enter what it sold for.' };
  if (!isDay(soldOn)) return { error: 'Enter when it sold.' };
  const [old] = await db.select().from(properties).where(eq(properties.id, id));
  if (!old) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    const next = { stage: 'sold' as const, stageBeforeSold: old.stage, soldPrice, soldOn, soldBuyer: str(d, 'soldBuyer') };
    await tx.update(properties).set({ ...next, updated: new Date() }).where(eq(properties.id, id));
    await audit({ userId: user.id, entity: 'property', entityId: id, action: 'sold', summary: `marked it sold for $${Number(soldPrice).toLocaleString('en-US')} on ${soldOn} (kept as a comparable)`, after: next }, tx);
  });
  revalidatePath(`/watchlist/${id}`);
  return { ok: 'Marked sold. It stays searchable as a comparable.' };
}

/** Under Contract: the property becomes a project, with the standard budget lines. */
export async function convertToProject(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const id = uuidOrNull(d, 'id');
  if (!id) return { error: 'Not found.' };
  const [p] = await db.select().from(properties).where(eq(properties.id, id));
  if (!p) return { error: 'Not found.' };
  const [existing] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.propertyId, id), isNull(projects.archived)));
  if (existing) redirect(`/projects/${existing.id}`);
  let lotCost;
  try { lotCost = moneyField(d, 'lotCost', 'Contract price'); } catch (e) { if (e instanceof FieldError) return { error: e.message }; throw e; }
  const projectId = await db.transaction(async (tx) => {
    const [pj] = await tx.insert(projects).values({
      name: p.address, address: p.address, city: p.city, state: p.state, zip: p.zip, neighborhood: p.neighborhood,
      propertyId: p.id, stage: 'under_contract', lotSf: p.lotSf, lotAcres: p.lotAcres, zoning: p.zoning,
      lotCost: lotCost ?? p.ourOffer ?? p.askingPrice, sellingCostPct: '6', createdBy: user.id,
    }).returning();
    const codes = await tx.select().from(costCodes).where(isNull(costCodes.archived));
    if (codes.length) {
      await tx.insert(budgetLines).values(codes.map((c) => ({
        projectId: pj.id, costCodeId: c.id, amount: null, percentOfConstruction: DEFAULT_PERCENTS[c.code] ?? null,
      })));
    }
    await tx.update(properties).set({ stage: 'under_contract', updated: new Date() }).where(eq(properties.id, id));
    await audit({ userId: user.id, entity: 'property', entityId: id, action: 'convert', summary: 'put it under contract and made it a project', after: { projectId: pj.id } }, tx);
    await audit({ userId: user.id, entity: 'project', entityId: pj.id, action: 'create', summary: `made the project from the watchlist (${p.address})` }, tx);
    if (p.sourcePersonId) {
      const rs = await tx.select().from(partyRoles).where(and(eq(partyRoles.personId, p.sourcePersonId), isNull(partyRoles.removed)));
      for (const r of rs) {
        if ((r.role === 'agent' || r.role === 'wholesaler') && r.stage !== 'closed_deal') {
          await tx.update(partyRoles).set({ stage: 'closed_deal', stageChangedAt: new Date() }).where(eq(partyRoles.id, r.id));
          await audit({ userId: user.id, entity: 'person', entityId: p.sourcePersonId, action: 'role-update', summary: `moved to Closed a Deal (${p.address})`, via: 'watchlist' }, tx);
        }
      }
    }
    return pj.id;
  });
  redirect(`/projects/${projectId}`);
}

export async function addPropertyPhoto(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('properties.edit');
  const id = uuidOrNull(d, 'id');
  const f = d.get('file');
  if (!id || !(f instanceof File)) return { error: 'Pick a photo.' };
  const r = await db.transaction(async (tx) => {
    const saved = await saveFile(f, { entity: 'property', entityId: id }, user.id, { caption: str(d, 'caption'), imagesOnly: !bool(d, 'anyFile') }, tx);
    if ('id' in saved) await audit({ userId: user.id, entity: 'property', entityId: id, action: 'photo-add', summary: `added the photo ${f.name}` }, tx);
    return saved;
  });
  if ('error' in r) return { error: r.error };
  revalidatePath(`/watchlist/${id}`);
  return { ok: 'Photo added.' };
}
