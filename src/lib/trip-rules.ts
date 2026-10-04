// The Trip Log's rules (owner, Oct 3, 2026: "track when I go to a property and why
// ... to justify writing off a car"; "track both ways so we can compare"). Pure,
// tested in trip-rules.test.ts. Not tax advice: the year-end page says to confirm
// the method with the accountant.

export const tripKinds = [
  { key: 'site_visit', label: 'Site Visit' },
  { key: 'showing', label: 'Showing or Open House' },
  { key: 'inspection', label: 'Inspection or Walk-Through' },
  { key: 'meeting', label: 'Meeting (Builder, Agent, Lender)' },
  { key: 'closing', label: 'Closing or Attorney' },
  { key: 'supplies', label: 'Supplies and Materials' },
  { key: 'bank', label: 'Bank or Government Office' },
  { key: 'looking', label: 'Looking at a Property to Buy' },
  { key: 'other', label: 'Other Business' },
] as const;
export type TripKind = (typeof tripKinds)[number]['key'];
export const isTripKind = (v: unknown): v is TripKind => tripKinds.some((k) => k.key === v);
export const tripKindLabel = (v: string | null | undefined) => tripKinds.find((k) => k.key === v)?.label ?? 'Other Business';

/** The IRS standard mileage rate by year (dollars a mile). Only the years known for sure; the owner adds the rest on Trip Log settings. */
export const KNOWN_RATES: Record<number, number> = { 2023: 0.655, 2024: 0.67, 2025: 0.7 };
export function rateFor(year: number, saved: Record<string, number> = {}): number | null {
  const v = saved[String(year)] ?? KNOWN_RATES[year];
  return typeof v === 'number' && v > 0 && v < 5 ? v : null;
}

/** Miles from the odometer readings, when both are there and make sense. */
export function odometerMiles(start: number | null | undefined, end: number | null | undefined): number | null {
  if (start === null || start === undefined || end === null || end === undefined) return null;
  const m = end - start;
  return m > 0 && m < 2000 ? m : null;
}

/** Straight-line miles between two points. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Roads wind: about 1.3 times the straight line in the Triangle. An estimate, marked as one; the odometer is better. */
export const ROAD_FACTOR = 1.3;
export function estimateMiles(from: { lat: number; lng: number }, stops: { lat: number; lng: number }[], roundTrip: boolean) {
  if (!stops.length) return null;
  let total = 0, at = from;
  for (const s of stops) { total += milesBetween(at, s); at = s; }
  if (roundTrip) total += milesBetween(at, from);
  return Math.round(total * ROAD_FACTOR * 10) / 10;
}

/** "I'm Here": the nearest of our places within half a mile of where the phone is, closest first. */
export function nearestPlaces<T extends { lat: number | null; lng: number | null }>(here: { lat: number; lng: number }, places: T[], within = 0.5) {
  return places.filter((p) => p.lat !== null && p.lng !== null)
    .map((p) => ({ ...p, miles: Math.round(milesBetween(here, { lat: p.lat!, lng: p.lng! }) * 100) / 100 }))
    .filter((p) => p.miles <= within).sort((a, b) => a.miles - b.miles);
}

export type TripLite = { on: string; miles: number; vehicleId: string | null };

/**
 * The year compared both ways, for one vehicle (or all trips with none named):
 * business miles; total miles from the odometer; the business share; the
 * standard mileage deduction; and the actual car costs times the business share.
 */
export function yearCompare(o: { year: number; trips: TripLite[]; startMiles: number | null; endMiles: number | null; rate: number | null; carCosts: number }) {
  const business = Math.round(o.trips.filter((t) => t.on.startsWith(String(o.year))).reduce((a, t) => a + t.miles, 0) * 10) / 10;
  const total = o.startMiles !== null && o.endMiles !== null && o.endMiles > o.startMiles ? o.endMiles - o.startMiles : null;
  const share = total ? Math.min(1, business / total) : null;
  const standard = o.rate !== null ? Math.round(business * o.rate * 100) / 100 : null;
  const actual = share !== null ? Math.round(o.carCosts * share * 100) / 100 : null;
  const better = standard === null || actual === null ? null : standard >= actual ? 'standard' as const : 'actual' as const;
  return { business, total, sharePct: share === null ? null : Math.round(share * 1000) / 10, standard, actual, better, overTotal: total !== null && business > total };
}

/** The year-end log, one row per trip (the columns an IRS mileage log keeps), as CSV. Values quoted; formulas neutralised. */
export function tripLogCsv(rows: { on: string; vehicle: string | null; business: string | null; destination: string; purpose: string; miles: number; how: string }[]) {
  const q = (v: string | number | null) => { let s = v === null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  const head = ['Date', 'Vehicle', 'Business', 'Where', 'Business Purpose', 'Miles', 'Miles From'];
  return [head.map(q).join(','), ...rows.map((r) => [r.on, r.vehicle, r.business, r.destination, r.purpose, r.miles, r.how].map(q).join(','))].join('\r\n') + '\r\n';
}
