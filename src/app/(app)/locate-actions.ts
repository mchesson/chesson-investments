'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { placeAndZoneAll } from '@/lib/locate';
import type { FormResult } from '@/components/ActionForm';

/** "Find Locations and Zoning": every project and watched property, from the county records. */
export async function findLocationsAndZoning(): Promise<FormResult> {
  const user = await requireAction('properties.edit');
  const r = await placeAndZoneAll(user.id);
  await audit({ userId: user.id, entity: 'market', entityId: user.id, action: 'locate', summary: `placed ${r.placed} on the map and found the zoning for ${r.zoned}`, via: 'county records' });
  revalidatePath('/projects');
  revalidatePath('/watchlist');
  revalidatePath('/market');
  const missed = r.missed.length ? ` Not found (outside Wake and Durham, or the address didn’t match the county’s): ${r.missed.slice(0, 6).join(', ')}${r.missed.length > 6 ? ` and ${r.missed.length - 6} more` : ''}.` : '';
  return { ok: `Done: placed ${r.placed} on the map and found the zoning for ${r.zoned}.${missed}` };
}
