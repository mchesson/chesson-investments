import { currentUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { today } from '@/lib/format';
import { destinationOf, tripsIn } from '@/lib/trip-data';
import { tripLogCsv } from '@/lib/trip-rules';

/** The year's mileage log as a spreadsheet file (for the accountant). */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !can(user, 'money.view')) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  const y = new URL(req.url).searchParams.get('year');
  const year = /^\d{4}$/.test(y ?? '') ? Number(y) : Number(today().slice(0, 4));
  const ts = (await tripsIn(year)).reverse();
  const csv = tripLogCsv(ts.map((t) => ({ on: t.on, vehicle: t.vehicleName, business: t.entityName, destination: destinationOf(t), purpose: t.purpose, miles: Number(t.miles), how: t.milesHow })));
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="mileage-log-${year}.csv"`, 'cache-control': 'private, no-store' } });
}
