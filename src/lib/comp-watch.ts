import 'server-only';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { comps } from '@/db/schema';
import { audit } from './audit';
import { addDays, formatDate, formatMoney } from './format';
import { addressKey, arcText } from './locate-rules';
import { looksLikeTheClose, offBy, sameAddress, WATCHED_STATUSES } from './comps';

// Presales and pending sales we were told about (owner, Oct 3, 2026: "have the
// system keep an eye out for when it closes"). Run with the twice-daily update,
// after the county sales come in: when the county records the sale, the comp
// gets what it actually sold for and when, and History says how close the
// number we were given was.

export async function watchPresales(userId: string | null, via: string) {
  const watched = await db.select().from(comps)
    .where(and(isNull(comps.archived), isNull(comps.actualPrice), inArray(comps.status, [...WATCHED_STATUSES])));
  let found = 0;
  for (const c of watched) {
    const k = addressKey(c.address);
    if (!k) continue;
    // Recorded after we heard about it (a month's slack for a contract date typed late).
    const since = addDays((c.soldOn ?? c.created.toISOString().slice(0, 10)), -30);
    const r = await db.execute<{ sale_id: string; address: string; sold_on: string; price: string }>(sql`
      select s.id as sale_id, pa.address, s.sold_on, s.price from market_sales s join market_parcels pa on pa.id = s.parcel_id
      where pa.address ilike ${`${k.number} %`} and pa.address ilike ${`%${arcText(k.street)}%`} and s.sold_on >= ${since} and s.price >= 1000
      order by s.sold_on desc limit 10`);
    // The lot selling to the builder isn't the house closing.
    const hit = r.rows.find((x) => sameAddress(x.address, c.address, addressKey) && looksLikeTheClose(c.price == null ? null : Number(c.price), Number(x.price)));
    if (!hit) continue;
    const price = Number(hit.price), day = String(hit.sold_on).slice(0, 10);
    const off = offBy(c.price == null ? null : Number(c.price), price);
    await db.transaction(async (tx) => {
      await tx.update(comps).set({ actualPrice: String(price), actualSoldOn: day, closeFoundAt: new Date(), marketSaleId: hit.sale_id, status: 'sold', updated: new Date() }).where(eq(comps.id, c.id));
      const entity = c.projectId ? 'project' : 'property';
      await audit({
        userId, entity, entityId: c.projectId ?? c.propertyId, action: 'comp-closed', via,
        summary: `found that the ${c.status === 'presale' ? 'presale' : c.status === 'appraised' ? 'appraised house' : 'pending sale'} at ${c.address} closed: ${formatMoney(price)} on ${formatDate(day)}${off != null ? ` (${c.status === 'appraised' ? 'appraised at' : 'we were told'} ${formatMoney(c.price)}: ${off === 0 ? 'exactly' : `${off > 0 ? '+' : ''}${off}%`})` : ''}`,
        before: { compId: c.id, status: c.status, price: c.price }, after: { compId: c.id, actualPrice: price, actualSoldOn: day, offPct: off },
      }, tx);
    });
    found++;
  }
  return { watched: watched.length, found };
}
