import 'server-only';
import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { appSettings, entities, overheadExpenses, projects, properties, trips, vehicleOdometers, vehicles } from '@/db/schema';
import { rateFor, yearCompare } from './trip-rules';

// Reads for the Trip Log (/trips) and its year-end report.

export const MILEAGE_KEY = 'mileage';
export type MileageSettings = { rates: Record<string, number>; home: { lat: number; lng: number; label: string } | null };

export async function readMileageSettings(): Promise<MileageSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, MILEAGE_KEY));
  const v = (row?.value ?? {}) as Partial<MileageSettings>;
  const rates: Record<string, number> = {};
  for (const [y, r] of Object.entries(v.rates ?? {})) if (/^\d{4}$/.test(y) && typeof r === 'number') rates[y] = r;
  const h = v.home;
  return { rates, home: h && typeof h.lat === 'number' && typeof h.lng === 'number' ? { lat: h.lat, lng: h.lng, label: String(h.label ?? 'Start point') } : null };
}

export async function vehicleList() {
  return db.select({ id: vehicles.id, name: vehicles.name, entityId: vehicles.entityId, placedInService: vehicles.placedInService, notes: vehicles.notes, entityName: entities.name })
    .from(vehicles).leftJoin(entities, eq(entities.id, vehicles.entityId)).where(isNull(vehicles.archived)).orderBy(asc(vehicles.name));
}

/** The trips in a year, newest first, with where they went. */
export async function tripsIn(year: number, vehicleId: string | null = null) {
  return db.select({
    id: trips.id, on: trips.on, kind: trips.kind, purpose: trips.purpose, miles: trips.miles, milesHow: trips.milesHow, roundTrip: trips.roundTrip,
    startOdometer: trips.startOdometer, endOdometer: trips.endOdometer, notes: trips.notes, place: trips.place, stops: trips.stops,
    projectId: trips.projectId, propertyId: trips.propertyId, vehicleId: trips.vehicleId, entityId: trips.entityId,
    projectName: projects.name, propertyName: properties.address, vehicleName: vehicles.name, entityName: entities.name,
  }).from(trips)
    .leftJoin(projects, eq(projects.id, trips.projectId)).leftJoin(properties, eq(properties.id, trips.propertyId))
    .leftJoin(vehicles, eq(vehicles.id, trips.vehicleId)).leftJoin(entities, eq(entities.id, trips.entityId))
    .where(and(isNull(trips.archived), gte(trips.on, `${year}-01-01`), lt(trips.on, `${year + 1}-01-01`), vehicleId ? eq(trips.vehicleId, vehicleId) : undefined))
    .orderBy(desc(trips.on), desc(trips.created));
}
export type TripRow = Awaited<ReturnType<typeof tripsIn>>[number];
export const destinationOf = (t: Pick<TripRow, 'projectName' | 'propertyName' | 'place' | 'stops'>) =>
  [t.projectName ?? t.propertyName ?? t.place ?? '—', ...(t.stops ?? []).map((s) => s.label)].join(' → ');

/** The year both ways, per vehicle (and the trips with no vehicle named). */
export async function yearReport(year: number) {
  const [vs, ts, odos, costs, s] = await Promise.all([
    vehicleList(), tripsIn(year),
    db.select().from(vehicleOdometers).where(eq(vehicleOdometers.year, year)),
    db.select({ vehicleId: overheadExpenses.vehicleId, total: sql<string>`sum(${overheadExpenses.amount})` }).from(overheadExpenses)
      .where(and(isNull(overheadExpenses.archived), gte(overheadExpenses.spentOn, `${year}-01-01`), lt(overheadExpenses.spentOn, `${year + 1}-01-01`), sql`${overheadExpenses.vehicleId} is not null`))
      .groupBy(overheadExpenses.vehicleId),
    readMileageSettings(),
  ]);
  const rate = rateFor(year, s.rates);
  const lite = ts.map((t) => ({ on: t.on, miles: Number(t.miles), vehicleId: t.vehicleId }));
  const perVehicle = vs.map((v) => {
    const o = odos.find((x) => x.vehicleId === v.id);
    const carCosts = Number(costs.find((c) => c.vehicleId === v.id)?.total ?? 0);
    return { vehicle: v, odometer: o ?? null, carCosts, ...yearCompare({ year, trips: lite.filter((t) => t.vehicleId === v.id), startMiles: o?.startMiles ?? null, endMiles: o?.endMiles ?? null, rate, carCosts }) };
  });
  const unassigned = lite.filter((t) => !t.vehicleId);
  const by = <K extends string>(key: (t: TripRow) => K | null, label: (t: TripRow) => string) => {
    const m = new Map<string, { label: string; trips: number; miles: number }>();
    for (const t of ts) { const k = key(t) ?? 'none'; const o = m.get(k) ?? { label: key(t) ? label(t) : 'Not named', trips: 0, miles: 0 }; o.trips += 1; o.miles += Number(t.miles); m.set(k, o); }
    return [...m.values()].map((x) => ({ ...x, miles: Math.round(x.miles * 10) / 10 })).sort((a, b) => b.miles - a.miles);
  };
  return {
    year, rate, trips: ts, perVehicle,
    unassignedMiles: Math.round(unassigned.reduce((a, t) => a + t.miles, 0) * 10) / 10,
    totalMiles: Math.round(lite.reduce((a, t) => a + t.miles, 0) * 10) / 10,
    byBusiness: by((t) => t.entityId, (t) => t.entityName ?? '—'),
    byProperty: by((t) => t.projectId ?? t.propertyId ?? (t.place ? `place:${t.place}` : null), (t) => t.projectName ?? t.propertyName ?? t.place ?? '—'),
  };
}

/** A project's trips, for its Timeline. */
export async function projectTrips(projectId: string) {
  return db.select({ id: trips.id, on: trips.on, kind: trips.kind, purpose: trips.purpose, miles: trips.miles, createdBy: trips.createdBy })
    .from(trips).where(and(isNull(trips.archived), sql`(${trips.projectId} = ${projectId} or ${trips.stops} @> ${JSON.stringify([{ id: projectId }])}::jsonb)`));
}
