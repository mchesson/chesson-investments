'use server';

import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { appSettings, entities, projects, properties, trips, vehicleOdometers, vehicles } from '@/db/schema';
import type { FormResult } from '@/components/ActionForm';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { isDay, today } from '@/lib/format';
import { str, uuidOrNull } from '@/lib/forms';
import { estimateMiles, isTripKind, nearestPlaces, odometerMiles, tripKindLabel } from '@/lib/trip-rules';
import { MILEAGE_KEY, readMileageSettings } from '@/lib/trip-data';

// The Trip Log's saves. Every change in History: a trip on its property (and the
// Trip Log's own History), vehicles and settings on the Trip Log.

const num = (v: FormDataEntryValue | null) => { const s = String(v ?? '').replace(/[, ]/g, '').trim(); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };

/** Where a trip went, read from the form: `where` is project:<id>, property:<id> or blank with a place typed. */
async function whereFrom(d: FormData) {
  const where = str(d, 'where') ?? '';
  const [kind, id] = where.split(':');
  if (kind === 'project' && id) {
    const [p] = await db.select({ id: projects.id, name: projects.name, lat: projects.lat, lng: projects.lng }).from(projects).where(and(eq(projects.id, id), isNull(projects.archived)));
    if (p) return { projectId: p.id, propertyId: null, place: null, label: p.name, lat: p.lat, lng: p.lng };
  }
  if (kind === 'property' && id) {
    const [p] = await db.select({ id: properties.id, name: properties.address, lat: properties.lat, lng: properties.lng }).from(properties).where(and(eq(properties.id, id), isNull(properties.archived)));
    if (p) return { projectId: null, propertyId: p.id, place: null, label: p.name, lat: p.lat, lng: p.lng };
  }
  const place = str(d, 'place');
  return place ? { projectId: null, propertyId: null, place: place.slice(0, 200), label: place.slice(0, 200), lat: null, lng: null } : null;
}

/** One trip: when, where, why, and the miles (typed, from the odometer, or estimated from home and marked so). */
export async function saveTrip(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const on = str(d, 'on') ?? today();
  if (!isDay(on) || on > today()) return { error: 'Date: a real day, not in the future.' };
  const purpose = str(d, 'purpose');
  if (!purpose || purpose.length < 3) return { error: 'Why: the business reason for the trip (the IRS asks for it).' };
  const w = await whereFrom(d);
  if (!w) return { error: 'Where: pick the property, or type the place.' };
  const kindIn = str(d, 'kind');
  const kind = isTripKind(kindIn) ? kindIn : 'site_visit';
  const roundTrip = d.get('roundTrip') !== 'no';
  const startOdo = num(d.get('startOdometer')), endOdo = num(d.get('endOdometer')), typed = num(d.get('miles'));
  if (Number.isNaN(startOdo) || Number.isNaN(endOdo) || Number.isNaN(typed)) return { error: 'Miles and the odometer: numbers only.' };
  let miles: number | null = null, milesHow = 'typed';
  const fromOdo = odometerMiles(startOdo, endOdo);
  if (startOdo !== null || endOdo !== null) {
    if (fromOdo === null) return { error: 'Odometer: the end reading must be more than the start (and under 2,000 miles for one trip).' };
    miles = fromOdo; milesHow = 'odometer';
  } else if (typed !== null) {
    if (typed <= 0 || typed > 2000) return { error: 'Miles: between 0 and 2,000.' };
    miles = Math.round(typed * 10) / 10;
  } else {
    const s = await readMileageSettings();
    const est = s.home && w.lat && w.lng ? estimateMiles(s.home, [{ lat: Number(w.lat), lng: Number(w.lng) }], roundTrip) : null;
    if (est === null) return { error: 'Miles: type them, or the odometer at the start and end (an estimate needs your start point on Trip Log settings and a property on the map).' };
    miles = est; milesHow = 'estimate';
  }
  const vehicleId = uuidOrNull(d, 'vehicleId'), entityId = uuidOrNull(d, 'entityId');
  const lat = num(d.get('lat')), lng = num(d.get('lng'));
  const f = {
    on, kind, purpose: purpose.slice(0, 500), projectId: w.projectId, propertyId: w.propertyId, place: w.place, miles: String(miles), milesHow,
    startOdometer: milesHow === 'odometer' ? startOdo : null, endOdometer: milesHow === 'odometer' ? endOdo : null, roundTrip,
    vehicleId: vehicleId && (await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId))).length ? vehicleId : null,
    entityId: entityId && (await db.select({ id: entities.id }).from(entities).where(eq(entities.id, entityId))).length ? entityId : null,
    lat: lat !== null && !Number.isNaN(lat) && Math.abs(lat) <= 90 ? String(lat) : null, lng: lng !== null && !Number.isNaN(lng) && Math.abs(lng) <= 180 ? String(lng) : null,
    notes: str(d, 'notes'),
  };
  const id = uuidOrNull(d, 'id');
  const summary = `${tripKindLabel(kind).toLowerCase()} to ${w.label}: ${f.purpose} (${miles} mi${milesHow === 'estimate' ? ', estimated' : milesHow === 'odometer' ? ', odometer' : ''})`;
  await db.transaction(async (tx) => {
    if (!id) {
      const [t] = await tx.insert(trips).values({ ...f, createdBy: user.id }).returning({ id: trips.id });
      await audit({ userId: user.id, entity: 'trip', entityId: t.id, action: 'create', via: 'Trip Log', summary: `logged a ${summary}`, after: f }, tx);
      if (f.projectId) await audit({ userId: user.id, entity: 'project', entityId: f.projectId, action: 'trip', via: 'Trip Log', summary: `logged a ${summary}`, after: { tripId: t.id } }, tx);
      if (f.propertyId) await audit({ userId: user.id, entity: 'property', entityId: f.propertyId, action: 'trip', via: 'Trip Log', summary: `logged a ${summary}`, after: { tripId: t.id } }, tx);
      return;
    }
    const [old] = await tx.select().from(trips).where(and(eq(trips.id, id), isNull(trips.archived)));
    if (!old) return;
    await tx.update(trips).set(f).where(eq(trips.id, id));
    const ch = diff(old as Record<string, unknown>, f);
    if (ch) await audit({ userId: user.id, entity: 'trip', entityId: id, action: 'update', via: 'Trip Log', summary: `changed the trip on ${on}: ${Object.keys(ch.after).join(', ')}`, ...ch }, tx);
  });
  revalidatePath('/trips');
  if (f.projectId) revalidatePath(`/projects/${f.projectId}`);
  return { ok: id ? 'Saved.' : `Logged: ${miles} miles${milesHow === 'estimate' ? ' (estimated: the odometer is better)' : ''}.` };
}

/** Takes a trip off the log (kept, marked taken off; History says who). */
export async function removeTrip(id: string): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const [t] = await db.select().from(trips).where(and(eq(trips.id, id), isNull(trips.archived)));
  if (!t) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.update(trips).set({ archived: new Date() }).where(eq(trips.id, id));
    await audit({ userId: user.id, entity: 'trip', entityId: id, action: 'archive', via: 'Trip Log', summary: `took the trip on ${t.on} off the log (${t.purpose})`, before: t }, tx);
  });
  revalidatePath('/trips');
  return { ok: 'Taken off.' };
}

/** A vehicle: its name, the business it belongs to and when it went into service. */
export async function saveVehicle(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const name = str(d, 'name');
  if (!name) return { error: 'Name the vehicle (e.g. 2022 Tahoe).' };
  const placed = str(d, 'placedInService');
  if (placed && !isDay(placed)) return { error: 'In service since: a real date.' };
  const entityId = uuidOrNull(d, 'entityId');
  const f = { name: name.slice(0, 80), entityId, placedInService: placed ?? null, notes: str(d, 'notes') };
  const id = uuidOrNull(d, 'id');
  await db.transaction(async (tx) => {
    if (!id) {
      const [v] = await tx.insert(vehicles).values({ ...f, createdBy: user.id }).returning({ id: vehicles.id });
      await audit({ userId: user.id, entity: 'vehicle', entityId: v.id, action: 'create', via: 'Trip Log', summary: `added the vehicle ${f.name}`, after: f }, tx);
      return;
    }
    const [old] = await tx.select().from(vehicles).where(eq(vehicles.id, id));
    if (!old) return;
    await tx.update(vehicles).set(f).where(eq(vehicles.id, id));
    const ch = diff(old as Record<string, unknown>, f);
    if (ch) await audit({ userId: user.id, entity: 'vehicle', entityId: id, action: 'update', via: 'Trip Log', summary: `changed the vehicle ${f.name}: ${Object.keys(ch.after).join(', ')}`, ...ch }, tx);
  });
  revalidatePath('/trips');
  return { ok: 'Saved.' };
}

/** The odometer at the start and end of a year (for the business-use share). */
export async function saveOdometer(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('bills.edit');
  const vehicleId = uuidOrNull(d, 'vehicleId');
  const year = Number(str(d, 'year'));
  const [v] = vehicleId ? await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)) : [];
  if (!v || !(year >= 2000 && year <= Number(today().slice(0, 4)) + 1)) return { error: 'Pick the vehicle and year.' };
  const start = num(d.get('startMiles')), end = num(d.get('endMiles'));
  if (Number.isNaN(start) || Number.isNaN(end)) return { error: 'Odometer: numbers only.' };
  if (start !== null && end !== null && end <= start) return { error: 'The end of the year must be more than the start.' };
  const f = { startMiles: start === null ? null : Math.round(start), endMiles: end === null ? null : Math.round(end) };
  await db.transaction(async (tx) => {
    const [old] = await tx.select().from(vehicleOdometers).where(and(eq(vehicleOdometers.vehicleId, v.id), eq(vehicleOdometers.year, year)));
    if (old) await tx.update(vehicleOdometers).set({ ...f, updated: new Date() }).where(eq(vehicleOdometers.id, old.id));
    else await tx.insert(vehicleOdometers).values({ vehicleId: v.id, year, ...f });
    await audit({ userId: user.id, entity: 'vehicle', entityId: v.id, action: 'odometer', via: 'Trip Log', summary: `set ${v.name}'s ${year} odometer: ${f.startMiles ?? '—'} to ${f.endMiles ?? '—'}`, before: old ? { startMiles: old.startMiles, endMiles: old.endMiles } : undefined, after: f }, tx);
  });
  revalidatePath('/trips');
  return { ok: 'Saved.' };
}

/** Trip Log settings: the standard rate for a year (from the IRS each December) and where trips usually start. */
export async function saveMileageSettings(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('money.view');
  const cur = await readMileageSettings();
  const year = str(d, 'rateYear'), rateIn = num(d.get('rate'));
  const rates = { ...cur.rates };
  if (year) {
    if (!/^\d{4}$/.test(year) || rateIn === null || Number.isNaN(rateIn)) return { error: 'The rate: a year and dollars a mile (e.g. 2026 and 0.70).' };
    const rate = rateIn >= 5 ? rateIn / 100 : rateIn; // 70 (cents) or 0.70 (dollars)
    if (!(rate > 0.2 && rate < 2)) return { error: 'The rate looks wrong: dollars a mile, like 0.70.' };
    rates[year] = Math.round(rate * 1000) / 1000;
  }
  const lat = num(d.get('homeLat')), lng = num(d.get('homeLng'));
  const home = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng, label: str(d, 'homeLabel') ?? 'Start point' } : d.get('clearHome') === 'yes' ? null : cur.home;
  const next = { rates, home };
  await db.insert(appSettings).values({ key: MILEAGE_KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updated: new Date() } });
  await audit({ userId: user.id, entity: 'trip-settings', entityId: null, action: 'update', via: 'Trip Log', summary: `changed the Trip Log settings${year ? `: ${year} rate $${rates[year]} a mile` : ''}${home !== cur.home ? '; the start point' : ''}`, before: cur, after: next });
  revalidatePath('/trips');
  return { ok: 'Saved.' };
}

/** "I'm Here": our places within half a mile of the phone, and the miles from the start point. Read only. */
export async function placesNear(lat: number, lng: number) {
  await requireAction('bills.edit');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { near: [], estimate: null };
  const [ps, ws, s] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, lat: projects.lat, lng: projects.lng }).from(projects).where(and(isNull(projects.archived), isNotNull(projects.lat))),
    db.select({ id: properties.id, name: properties.address, lat: properties.lat, lng: properties.lng }).from(properties).where(and(isNull(properties.archived), isNotNull(properties.lat))),
    readMileageSettings(),
  ]);
  const all = [...ps.map((p) => ({ key: `project:${p.id}`, name: p.name, lat: Number(p.lat), lng: Number(p.lng) })), ...ws.map((p) => ({ key: `property:${p.id}`, name: p.name, lat: Number(p.lat), lng: Number(p.lng) }))];
  const near = nearestPlaces({ lat, lng }, all).slice(0, 5).map((p) => ({ key: p.key, name: p.name, miles: p.miles }));
  return { near, estimate: s.home ? estimateMiles(s.home, [{ lat, lng }], true) : null };
}
