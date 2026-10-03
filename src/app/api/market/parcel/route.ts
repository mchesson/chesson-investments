import { currentUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { parcelAt } from '@/lib/market-sync';
import { zoningAt } from '@/lib/zoning-data';
import { zoningFamilyLabel } from '@/lib/zoning';

// The parcel under a click on the Market Map: address, owner, size, last sale (staff only).
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !can(user, 'properties.view')) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get('lat')), lng = Number(sp.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat - 35.9) > 1 || Math.abs(lng + 78.8) > 1) return Response.json({ error: 'Outside Wake and Durham.' }, { status: 400 });
  const [parcel, z] = await Promise.all([parcelAt(lat, lng), zoningAt(lat, lng)]);
  const zoning = z ? { code: z.code, label: z.label, place: z.place, family: zoningFamilyLabel(z.family), detail: z.detail, overlays: z.overlays, ordinance: z.ordinance } : null;
  return Response.json({ parcel, zoning }, { headers: { 'cache-control': 'private, max-age=300' } });
}
