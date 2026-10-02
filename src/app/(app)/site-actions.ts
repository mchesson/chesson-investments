'use server';

import { and, eq, isNull, ne } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { SITE_TAG } from '@/lib/site-data';
import { db } from '@/db';
import { files, projects } from '@/db/schema';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { bool, str, uuidOrNull } from '@/lib/forms';
import { parseMoney } from '@/lib/format';
import { isPhotoKind, isSiteStatus, photoKindLabel, siteStatusLabel, slugify } from '@/lib/site';
import { saveFile } from '@/lib/files';
import type { FormResult } from '@/components/ActionForm';

const VIA = 'Website tab';
const refresh = (id: string) => { revalidatePath(`/projects/${id}`); revalidatePath('/site', 'layout'); revalidateTag(SITE_TAG, 'max'); };
const decimal = (v: string | null) => (v === null ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 100 ? Number(v).toFixed(1) : undefined);

/** The project's website words: status, price, description, specs, finishes, team. */
export async function saveSite(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('website.edit');
  const id = uuidOrNull(d, 'projectId');
  if (!id) return { error: 'Not found.' };
  const [old] = await db.select().from(projects).where(eq(projects.id, id));
  if (!old) return { error: 'Not found.' };
  const status = str(d, 'siteStatus');
  if (status && !isSiteStatus(status)) return { error: 'Pick a website status.' };
  const slug = slugify(str(d, 'siteSlug') ?? old.name);
  if (!slug) return { error: 'The web address needs some letters or numbers.' };
  const [taken] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.siteSlug, slug), ne(projects.id, id)));
  if (taken) return { error: `Another project already uses the web address “${slug}”.` };
  const price = parseMoney(d.get('sitePrice'));
  if (price === undefined) return { error: 'Price: type a dollar amount, like 569,900.' };
  const beds = decimal(str(d, 'siteBeds')), baths = decimal(str(d, 'siteBaths'));
  if (beds === undefined || baths === undefined) return { error: 'Bedrooms and bathrooms: type a number, like 3 or 2.5.' };
  const description = str(d, 'siteDescription');
  if (status && !description) return { error: 'Add a description before it goes on the website.' };
  const f = {
    siteStatus: status, siteSlug: slug, sitePrice: price, siteTagline: str(d, 'siteTagline'), siteDescription: description,
    siteBeds: beds, siteBaths: baths, siteDetails: str(d, 'siteDetails'), siteTeam: str(d, 'siteTeam'),
    siteFeatured: bool(d, 'siteFeatured'), siteSort: Math.max(0, Math.min(999, Number(str(d, 'siteSort') ?? 0) || 0)),
  };
  const ch = diff(old as unknown as Record<string, unknown>, f);
  if (!ch) return { ok: 'Nothing changed.' };
  await db.transaction(async (tx) => {
    await tx.update(projects).set({ ...f, siteUpdatedAt: new Date(), updated: new Date() }).where(eq(projects.id, id));
    const what = old.siteStatus !== f.siteStatus
      ? (f.siteStatus ? `set its website status to ${siteStatusLabel(f.siteStatus)}${old.siteStatus ? ` (was ${siteStatusLabel(old.siteStatus)})` : ''}` : 'took it off the website')
      : `changed its website page (${Object.keys(ch.after).map((k) => k.replace(/^site/, '').toLowerCase()).join(', ')})`;
    await audit({ userId: user.id, entity: 'project', entityId: id, action: 'site', summary: what, via: VIA, ...ch }, tx);
  });
  refresh(id);
  return { ok: f.siteStatus ? 'Saved.' : 'Saved. It isn’t on the website.' };
}

/** One photo at a time (each request stays under the 4 MB limit). */
export async function uploadSitePhoto(d: FormData): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireAction('website.edit');
  const id = uuidOrNull(d, 'projectId');
  const kind = str(d, 'kind');
  const f = d.get('file');
  if (!id || !(f instanceof File)) return { error: 'Pick a photo.' };
  if (!isPhotoKind(kind)) return { error: 'Pick before, after, progress or floor plan.' };
  const [p] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, id), isNull(projects.archived)));
  if (!p) return { error: 'Not found.' };
  const r = await db.transaction(async (tx) => {
    const saved = await saveFile(f, { entity: 'project', entityId: id }, user.id, { imagesOnly: true, caption: str(d, 'caption') }, tx);
    if ('error' in saved) return { error: `${f.name}: ${saved.error}` };
    await tx.update(files).set({ photoKind: kind, onSite: bool(d, 'onSite'), sort: Number(str(d, 'sort') ?? 0) || 0 }).where(eq(files.id, saved.id));
    await audit({ userId: user.id, entity: 'project', entityId: id, action: 'photo-add', summary: `added a ${photoKindLabel(kind).toLowerCase()} photo (${f.name})${bool(d, 'onSite') ? ', shown on the website' : ''}`, via: VIA }, tx);
    return { ok: true };
  });
  refresh(id);
  return r;
}

export async function updatePhoto(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('website.edit');
  const id = uuidOrNull(d, 'fileId');
  if (!id) return { error: 'Not found.' };
  const [f] = await db.select().from(files).where(and(eq(files.id, id), eq(files.entity, 'project'), isNull(files.archived)));
  if (!f) return { error: 'Not found.' };
  const kind = str(d, 'kind');
  if (!isPhotoKind(kind)) return { error: 'Pick before, after, progress or floor plan.' };
  const next = { photoKind: kind, caption: str(d, 'caption'), onSite: bool(d, 'onSite'), sort: Math.max(0, Math.min(999, Number(str(d, 'sort') ?? 0) || 0)) };
  const ch = diff(f as unknown as Record<string, unknown>, next);
  if (!ch) return { ok: 'Nothing changed.' };
  await db.transaction(async (tx) => {
    await tx.update(files).set(next).where(eq(files.id, id));
    const summary = f.onSite !== next.onSite ? `${next.onSite ? 'put' : 'took'} the photo ${f.name} ${next.onSite ? 'on' : 'off'} the website` : `changed the photo ${f.name}`;
    await audit({ userId: user.id, entity: 'project', entityId: f.entityId, action: 'photo', summary, via: VIA, ...ch }, tx);
  });
  refresh(f.entityId);
  return { ok: 'Saved.' };
}

export async function archivePhoto(fileId: string) {
  const user = await requireAction('website.edit');
  const [f] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.entity, 'project'), isNull(files.archived)));
  if (!f) return;
  await db.transaction(async (tx) => {
    await tx.update(files).set({ archived: new Date(), onSite: false }).where(eq(files.id, fileId));
    await audit({ userId: user.id, entity: 'project', entityId: f.entityId, action: 'photo-archive', summary: `took away the photo ${f.name}${f.onSite ? ' (it was on the website)' : ''}`, via: VIA }, tx);
  });
  refresh(f.entityId);
}
