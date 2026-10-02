import { and, ilike, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { marketParcels, projects, properties } from '@/db/schema';
import { currentUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { guestHasMarket } from '@/lib/guest-data';
import { countyAddressSearch } from '@/lib/market-sync';
import { normalizeAddress } from '@/lib/market-sources';

// "Go to an address" on the Market Map: our projects and watchlist (staff), sales on file, then the county parcels.
export async function GET(req: Request) {
  const user = await currentUser();
  const staff = !!user && can(user, 'properties.view');
  if (!user || !(staff || (user.role === 'guest' && await guestHasMarket(user.id)))) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 3) return Response.json({ results: [] });
  const like = `%${q}%`;
  const ours = staff ? [
    ...(await db.select({ label: projects.name, lat: projects.lat, lng: projects.lng }).from(projects).where(and(isNull(projects.archived), isNotNull(projects.lat), sql`(${projects.name} ilike ${like} or ${projects.address} ilike ${like})`)).limit(5)).map((r) => ({ ...r, kind: 'Our project' })),
    ...(await db.select({ label: properties.address, lat: properties.lat, lng: properties.lng }).from(properties).where(and(isNull(properties.archived), isNotNull(properties.lat), ilike(properties.address, like))).limit(5)).map((r) => ({ ...r, kind: 'Watchlist' })),
  ] : [];
  const norm = normalizeAddress(q) ?? q.toUpperCase();
  const sales = await db.select({ address: marketParcels.address, city: marketParcels.city, lat: marketParcels.lat, lng: marketParcels.lng }).from(marketParcels)
    .where(and(isNotNull(marketParcels.lat), ilike(marketParcels.address, `${norm}%`))).limit(6);
  let results = [...ours.map((r) => ({ label: r.label, kind: r.kind, lat: Number(r.lat), lng: Number(r.lng) })), ...sales.map((r) => ({ label: `${r.address}${r.city ? `, ${r.city}` : ''}`, kind: 'Sold', lat: Number(r.lat), lng: Number(r.lng) }))];
  if (results.length < 3) results = [...results, ...(await countyAddressSearch(q)).map((r) => ({ ...r, kind: 'Parcel' }))];
  return Response.json({ results: results.slice(0, 10) });
}
