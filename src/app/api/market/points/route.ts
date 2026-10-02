import { currentUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { pointsIn, readFilters } from '@/lib/market-data';

// The market map's sales inside the view (signed-in staff only; public county
// records, but only our people see how we slice them).
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !can(user, 'properties.view')) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const b = (sp.bbox ?? '').split(',').map(Number);
  if (b.length !== 4 || b.some((x) => !Number.isFinite(x))) return Response.json({ error: 'bbox needed' }, { status: 400 });
  const r = await pointsIn(b as [number, number, number, number], readFilters(sp));
  return Response.json(r, { headers: { 'cache-control': 'private, max-age=60' } });
}
