'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { comps, files, marketParcels, marketSales, projects } from '@/db/schema';
import type { FormResult } from '@/components/ActionForm';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { formatMoney, isDay, parseMoney } from '@/lib/format';
import { str, uuidOrNull } from '@/lib/forms';
import { adjustmentsText, compSourceLabel, finishFromQuality, finishLabel, isCompSource, isCompStatus, isFinishLevel, parseAdjustments, summarize } from '@/lib/comps';
import { compsFor } from '@/lib/comp-data';
import { readComps } from '@/lib/comps-ai';
import { readingToRows } from '@/lib/comp-reading';
import { getObject } from '@/lib/storage';

const done = (projectId: string, ok: string) => { revalidatePath(`/projects/${projectId}`); return { ok }; };
const num = (v: string | null, max: number) => { if (v == null) return null; const x = Number(v.replace(/[,$\s]/g, '')); return Number.isFinite(x) && x > 0 && x < max ? x : undefined; };

async function liveProject(id: string | null) {
  if (!id) return null;
  const [p] = await db.select({ id: projects.id, name: projects.name, address: projects.address, heatedSf: projects.heatedSf, finishLevel: projects.finishLevel, marketValue: projects.marketValue, marketValueOn: projects.marketValueOn, marketValueSource: projects.marketValueSource })
    .from(projects).where(and(eq(projects.id, id), isNull(projects.archived)));
  return p ?? null;
}

/** Add or change one comp, typed by hand. */
export async function saveComp(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const p = await liveProject(uuidOrNull(d, 'projectId'));
  if (!p) return { error: 'That project isn’t here.' };
  const address = str(d, 'address');
  if (!address) return { error: 'Address: where the comp is.' };
  const source = str(d, 'source'), status = str(d, 'status') ?? 'sold', finish = str(d, 'finishLevel');
  if (!isCompSource(source)) return { error: 'Source: where the comp came from.' };
  if (!isCompStatus(status)) return { error: 'Status: sold, pending, for sale or presale.' };
  const soldOn = str(d, 'soldOn');
  if (soldOn && !isDay(soldOn)) return { error: 'Date: a real date.' };
  const price = parseMoney(d.get('price')), adjustedPrice = parseMoney(d.get('adjustedPrice'));
  if (price === undefined) return { error: 'Price: a dollar amount.' };
  if (adjustedPrice === undefined) return { error: 'Adjusted price: a dollar amount.' };
  const heatedSf = num(str(d, 'heatedSf'), 100_000), beds = num(str(d, 'beds'), 50), baths = num(str(d, 'baths'), 50);
  const yearBuilt = num(str(d, 'yearBuilt'), 2100), lotAcres = num(str(d, 'lotAcres'), 10_000), distanceMi = num(str(d, 'distanceMi'), 500);
  if ([heatedSf, beds, baths, yearBuilt, lotAcres, distanceMi].includes(undefined)) return { error: 'Square feet, beds, baths, year built, acres and miles: numbers.' };
  const quality = str(d, 'quality');
  const expectedCloseOn = str(d, 'expectedCloseOn');
  if (expectedCloseOn && !isDay(expectedCloseOn)) return { error: 'Expected closing: a real date.' };
  // Who gave it to us: "p:<id>" a person or "c:<id>" a company, picked by typing.
  const from = str(d, 'provider')?.match(/^([cp]):([0-9a-f-]{36})$/i);
  const fileId = uuidOrNull(d, 'fileId');
  if (fileId) {
    const [doc] = await db.select({ id: files.id }).from(files).where(and(eq(files.id, fileId), eq(files.entity, 'project'), eq(files.entityId, p.id), isNull(files.archived)));
    if (!doc) return { error: 'That document isn’t on this project.' };
  }
  const customBuild = d.get('customBuild') === 'on';
  const f = {
    source, status, address: address.slice(0, 200), city: str(d, 'city'), neighborhood: str(d, 'neighborhood'), soldOn: soldOn ?? null,
    price: price ?? null, heatedSf: heatedSf == null ? null : Math.round(heatedSf), beds: beds == null ? null : String(beds), baths: baths == null ? null : String(baths),
    yearBuilt: yearBuilt == null ? null : Math.round(yearBuilt), lotAcres: lotAcres == null ? null : String(lotAcres), distanceMi: distanceMi == null ? null : String(distanceMi),
    finishLevel: isFinishLevel(finish) ? finish : finishFromQuality(quality), quality, adjustments: parseAdjustments(str(d, 'adjustments')),
    adjustedPrice: adjustedPrice ?? null, notes: str(d, 'notes'),
    expectedCloseOn: expectedCloseOn ?? null, builderName: str(d, 'builderName'), customBuild,
    providedByPersonId: from && from[1].toLowerCase() === 'p' ? from[2] : null, providedByCompanyId: from && from[1].toLowerCase() === 'c' ? from[2] : null,
    ...(fileId ? { fileId } : {}),
  };
  const id = uuidOrNull(d, 'id');
  await db.transaction(async (tx) => {
    if (!id) {
      // A custom build for an owner isn't a market sale: left out of the value until someone counts it.
      const [row] = await tx.insert(comps).values({ ...f, counted: !customBuild, projectId: p.id, createdBy: user.id }).returning({ id: comps.id });
      await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'comp-add', summary: `added a comp: ${f.address} (${compSourceLabel(source)}${f.price ? `, ${formatMoney(f.price)}` : ''}${customBuild ? ', a custom build' : ''})`, after: { compId: row.id, ...f } }, tx);
      return;
    }
    const [old] = await tx.select().from(comps).where(and(eq(comps.id, id), eq(comps.projectId, p.id), isNull(comps.archived)));
    if (!old) return;
    await tx.update(comps).set({ ...f, checked: true, updated: new Date() }).where(eq(comps.id, id));
    const ch = diff({ ...old, adjustments: adjustmentsText(old.adjustments ?? []) } as Record<string, unknown>, { ...f, adjustments: adjustmentsText(f.adjustments) });
    if (ch) await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'comp-update', summary: `changed the comp ${old.address}: ${Object.keys(ch.after).join(', ')}`, ...ch, after: { compId: id, ...ch.after } }, tx);
  });
  return done(p.id, id ? 'Comp saved.' : 'Comp added.');
}

/** A county sale offered under Suggested From Public Records, added as a comp. */
export async function addPublicComp(projectId: string, saleId: string): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const p = await liveProject(projectId);
  if (!p) return { error: 'That project isn’t here.' };
  const [s] = await db.select({ soldOn: marketSales.soldOn, price: marketSales.price, sf: marketSales.heatedSf, address: marketParcels.address, city: marketParcels.city, neighborhood: marketParcels.neighborhood, psf: marketParcels.heatedSf, year: marketParcels.yearBuilt, acres: marketParcels.acres })
    .from(marketSales).innerJoin(marketParcels, eq(marketParcels.id, marketSales.parcelId)).where(eq(marketSales.id, saleId));
  if (!s || !s.address) return { error: 'That sale isn’t in the county records any more.' };
  const [has] = await db.select({ id: comps.id }).from(comps).where(and(eq(comps.projectId, p.id), eq(comps.marketSaleId, saleId), isNull(comps.archived)));
  if (has) return { ok: 'Already a comp.' };
  await db.transaction(async (tx) => {
    const f = { source: 'public_record', status: 'sold', address: s.address!, city: s.city, neighborhood: s.neighborhood, soldOn: s.soldOn, price: s.price, heatedSf: s.sf ?? s.psf, yearBuilt: s.year, lotAcres: s.acres, marketSaleId: saleId };
    const [row] = await tx.insert(comps).values({ ...f, projectId: p.id, createdBy: user.id }).returning({ id: comps.id });
    await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'comp-add', summary: `added a comp from the county records: ${f.address}, sold ${formatMoney(f.price)}`, after: { compId: row.id, ...f } }, tx);
  });
  return done(p.id, 'Comp added.');
}

/** Counted in the value or not; looked at (a comp Claude read). */
export async function setCompFlag(compId: string, flag: 'counted' | 'checked', value: boolean): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const [c] = await db.select().from(comps).where(and(eq(comps.id, compId), isNull(comps.archived)));
  if (!c || !c.projectId) return { error: 'That comp isn’t here.' };
  await db.transaction(async (tx) => {
    await tx.update(comps).set(flag === 'counted' ? { counted: value, updated: new Date() } : { checked: value, updated: new Date() }).where(eq(comps.id, compId));
    const summary = flag === 'counted' ? `${value ? 'counted' : 'stopped counting'} the comp ${c.address} in the value` : `checked the comp ${c.address} that Claude read`;
    await audit({ userId: user.id, entity: 'project', entityId: c.projectId, action: 'comp-update', summary, before: { compId, [flag]: c[flag] }, after: { compId, [flag]: value } }, tx);
  });
  return done(c.projectId, flag === 'counted' ? (value ? 'Counted.' : 'Not counted.') : 'Marked checked.');
}

export async function removeComp(compId: string): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const [c] = await db.select().from(comps).where(and(eq(comps.id, compId), isNull(comps.archived)));
  if (!c || !c.projectId) return { error: 'That comp isn’t here.' };
  await db.transaction(async (tx) => {
    await tx.update(comps).set({ archived: new Date() }).where(eq(comps.id, compId));
    await audit({ userId: user.id, entity: 'project', entityId: c.projectId, action: 'comp-remove', summary: `took off the comp ${c.address}`, before: c }, tx);
  });
  return done(c.projectId, 'Comp taken off.');
}

/** Our finish level, so comps at the same level stand out. */
export async function setFinishLevel(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const p = await liveProject(uuidOrNull(d, 'projectId'));
  if (!p) return { error: 'That project isn’t here.' };
  const v = str(d, 'finishLevel');
  const next = isFinishLevel(v) ? v : null;
  if (next === p.finishLevel) return { ok: 'No change.' };
  await db.transaction(async (tx) => {
    await tx.update(projects).set({ finishLevel: next, updated: new Date() }).where(eq(projects.id, p.id));
    await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'update', summary: `set our finish level to ${finishLabel(next)}`, before: { finishLevel: p.finishLevel }, after: { finishLevel: next } }, tx);
  });
  return done(p.id, 'Finish level saved.');
}

/** The comps' value becomes the project's market value (the check against over-building). */
export async function useCompValue(projectId: string): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const p = await liveProject(projectId);
  if (!p) return { error: 'That project isn’t here.' };
  const s = summarize(await compsFor(p.id), { heatedSf: p.heatedSf, finishLevel: p.finishLevel });
  const value = s.sameFinishValue ?? s.value;
  if (!value) return { error: 'The comps don’t give a value yet: they need prices and square feet, and the house needs its heated square feet.' };
  const source = `Comps: ${s.counted} counted${s.sameFinishValue ? ` (${finishLabel(p.finishLevel)} finish)` : ''}`;
  const day = new Date().toISOString().slice(0, 10);
  await db.transaction(async (tx) => {
    await tx.update(projects).set({ marketValue: String(value), marketValueOn: day, marketValueSource: source, updated: new Date() }).where(eq(projects.id, p.id));
    await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'update', summary: `set the market value to ${formatMoney(value)} from the comps`, before: { marketValue: p.marketValue, marketValueOn: p.marketValueOn, marketValueSource: p.marketValueSource }, after: { marketValue: value, marketValueOn: day, marketValueSource: source } }, tx);
  });
  return done(p.id, `Market value set to ${formatMoney(value)}.`);
}

/** Claude reads the comps out of one of the project's documents (an appraisal, a CMA). They wait to be checked. */
export async function readCompsFromDocument(projectId: string, fileId: string): Promise<FormResult> {
  const user = await requireAction('projects.edit');
  const p = await liveProject(projectId);
  if (!p) return { error: 'That project isn’t here.' };
  const [f] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.entity, 'project'), eq(files.entityId, p.id), isNull(files.archived)));
  if (!f) return { error: 'That document isn’t on this project.' };
  let bytes: Buffer | null = null;
  try { bytes = f.data ? Buffer.from(f.data) : f.storagePath ? await getObject(f.storagePath) : null; } catch { bytes = null; }
  if (!bytes) return { error: 'The file couldn’t be opened.' };
  const { reading, why } = await readComps({ name: f.name, type: f.contentType, bytes });
  if (!reading) return { error: why ?? 'Claude couldn’t read comps from it.' };
  const rows = readingToRows(reading, p.address);
  if (!rows.length) return { error: `No comparable sales found in ${f.name}.` };
  const have = new Set((await compsFor(p.id)).filter((c) => c.fileId === f.id).map((c) => c.address.toLowerCase()));
  const fresh = rows.filter((r) => !have.has(r.address.toLowerCase()));
  if (!fresh.length) return { ok: 'Every comp in it is already here.' };
  await db.transaction(async (tx) => {
    for (const r of fresh) {
      await tx.insert(comps).values({
        ...r, projectId: p.id, price: r.price == null ? null : String(r.price), adjustedPrice: r.adjustedPrice == null ? null : String(r.adjustedPrice),
        beds: r.beds == null ? null : String(r.beds), baths: r.baths == null ? null : String(r.baths), lotAcres: r.lotAcres == null ? null : String(r.lotAcres),
        distanceMi: r.distanceMi == null ? null : String(r.distanceMi), checked: false, fileId: f.id, createdBy: user.id,
      });
    }
    await audit({ userId: user.id, entity: 'project', entityId: p.id, action: 'comp-read', via: 'Claude (comps reading)',
      summary: `had Claude read ${fresh.length} comps from ${f.name}${reading.subject.appraisedValue ? ` (its value: ${formatMoney(reading.subject.appraisedValue)})` : ''}`,
      after: { fileId: f.id, count: fresh.length, appraisedValue: reading.subject.appraisedValue, addresses: fresh.map((r) => r.address) } }, tx);
  });
  return done(p.id, `Read ${fresh.length} comps from ${f.name}${reading.subject.appraisedValue ? `; its value: ${formatMoney(reading.subject.appraisedValue)}` : ''}. Check each one.`);
}
