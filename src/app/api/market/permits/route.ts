import { currentUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { guestHasMarket } from '@/lib/guest-data';
import { permitsIn } from '@/lib/market-feeds-data';

// New-home permits and teardowns in the map's view (public records; staff, or an agent given the Market Map).
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !(can(user, 'properties.view') || (user.role === 'guest' && await guestHasMarket(user.id)))) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const b = (sp.get('bbox') ?? '').split(',').map(Number);
  if (b.length !== 4 || b.some((x) => !Number.isFinite(x))) return Response.json({ error: 'bbox needed' }, { status: 400 });
  const kinds = (sp.get('kinds') ?? '').split(',').filter((k) => k === 'new_home' || k === 'demolition');
  return Response.json({ permits: await permitsIn(b as [number, number, number, number], kinds) }, { headers: { 'cache-control': 'private, max-age=300' } });
}
