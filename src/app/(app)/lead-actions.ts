'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/db';
import { appSettings, people, siteLeadNotes, siteLeads, users } from '@/db/schema';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { str, uuidOrNull } from '@/lib/forms';
import { SITE_TAG } from '@/lib/site-data';
import { isLeadStatus, leadStatusLabel, WEBSITE_SETTINGS_KEY, isGaId, searchConsoleCode, looksLikeEmail } from '@/lib/site-leads';
import { readWebsiteSettings } from '@/lib/site-settings';
import type { FormResult } from '@/components/ActionForm';

const VIA = 'Leads';
const refresh = (id: string) => { revalidatePath(`/leads/${id}`); revalidatePath('/leads'); };

/** Where a lead stands (New, Contacted, Qualified, Closed, Not a Fit) and who's handling it. */
export async function setLeadStatus(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const id = uuidOrNull(d, 'id');
  const status = str(d, 'status');
  if (!id) return { error: 'Not found.' };
  if (!isLeadStatus(status)) return { error: 'Pick where it stands.' };
  const [old] = await db.select().from(siteLeads).where(eq(siteLeads.id, id));
  if (!old) return { error: 'Not found.' };
  const picked = str(d, 'handledBy');
  let handledBy = picked === 'none' ? null : uuidOrNull(d, 'handledBy') ?? old.handledBy;
  // Moving it on from New with nobody named: whoever moved it is handling it.
  if (!handledBy && picked !== 'none' && status !== 'new') handledBy = user.id;
  if (handledBy && handledBy !== old.handledBy) {
    const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, handledBy), eq(users.active, true)));
    if (!u) return { error: 'Pick someone from the list.' };
  }
  const ch = diff(old as unknown as Record<string, unknown>, { status, handledBy });
  if (!ch) return { ok: 'Nothing changed.' };
  const [who] = handledBy ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, handledBy)) : [];
  await db.transaction(async (tx) => {
    await tx.update(siteLeads).set({ status, handledBy, statusChangedAt: status !== old.status ? new Date() : old.statusChangedAt, updated: new Date() }).where(eq(siteLeads.id, id));
    const parts = [
      status !== old.status ? `moved it to ${leadStatusLabel(status)} (was ${leadStatusLabel(old.status)})` : null,
      handledBy !== old.handledBy ? (handledBy ? `gave it to ${who?.name ?? who?.email ?? 'someone'}` : 'took it off whoever had it') : null,
    ].filter(Boolean);
    await audit({ userId: user.id, entity: 'site_lead', entityId: id, action: 'status', summary: parts.join(' and '), via: VIA, ...ch }, tx);
  });
  refresh(id);
  return { ok: `Saved: ${leadStatusLabel(status)}.` };
}

export async function addLeadNote(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const id = uuidOrNull(d, 'id');
  const text = str(d, 'text');
  if (!id) return { error: 'Not found.' };
  if (!text) return { error: 'Type the note first.' };
  const [lead] = await db.select({ id: siteLeads.id }).from(siteLeads).where(eq(siteLeads.id, id));
  if (!lead) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.insert(siteLeadNotes).values({ leadId: id, text: text.slice(0, 5000), userId: user.id });
    await audit({ userId: user.id, entity: 'site_lead', entityId: id, action: 'note', summary: `added a note: ${text.slice(0, 140)}`, via: VIA }, tx);
  });
  refresh(id);
  return { ok: 'Note added.' };
}

/** Links the lead to someone already on file (the same email or phone, usually). */
export async function linkLeadPerson(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const id = uuidOrNull(d, 'id');
  const personId = uuidOrNull(d, 'personId');
  if (!id || !personId) return { error: 'Pick the person.' };
  const [lead] = await db.select().from(siteLeads).where(eq(siteLeads.id, id));
  const [p] = await db.select().from(people).where(and(eq(people.id, personId), isNull(people.archived)));
  if (!lead || !p) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.update(siteLeads).set({ personId, updated: new Date() }).where(eq(siteLeads.id, id));
    await audit({ userId: user.id, entity: 'site_lead', entityId: id, action: 'person', summary: `linked it to ${p.firstName} ${p.lastName}, already on file`, via: VIA, before: { personId: lead.personId }, after: { personId } }, tx);
    await audit({ userId: user.id, entity: 'person', entityId: personId, action: 'site-lead', summary: `linked a website lead (${lead.kind === 'sell' ? 'Sell Us Your Property' : 'Contact Us'}, ${lead.created.toISOString().slice(0, 10)}) to them`, via: VIA }, tx);
  });
  refresh(id);
  return { ok: `Linked to ${p.firstName} ${p.lastName}.` };
}

export async function archiveLead(id: string): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const [lead] = await db.select().from(siteLeads).where(eq(siteLeads.id, id));
  if (!lead) return { error: 'Not found.' };
  await db.transaction(async (tx) => {
    await tx.update(siteLeads).set({ archived: lead.archived ? null : new Date() }).where(eq(siteLeads.id, id));
    await audit({ userId: user.id, entity: 'site_lead', entityId: id, action: lead.archived ? 'restore' : 'archive', summary: lead.archived ? 'put it back on the list' : 'archived it (spam or a duplicate)', via: VIA }, tx);
  });
  refresh(id);
  return { ok: lead.archived ? 'Back on the list.' : 'Archived.' };
}

/** The website's phone, email, area, page words, Google Analytics and Search Console. */
export async function saveWebsiteSettings(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('website.edit');
  const ga = str(d, 'gaId')?.toUpperCase() ?? null;
  if (ga && !isGaId(ga)) return { error: 'Google Analytics: paste the measurement ID, which starts with G- (like G-ABC123DEF4).' };
  const sc = str(d, 'searchConsole');
  if (sc && !searchConsoleCode(sc)) return { error: 'Search Console: paste the HTML tag Google gives you, or just the code inside content="…".' };
  const email = str(d, 'email')?.toLowerCase() ?? null;
  if (email && !looksLikeEmail(email)) return { error: 'That email address doesn’t look right.' };
  const phone = str(d, 'phone');
  if (phone && phone.replace(/\D/g, '').length < 10) return { error: 'Phone: type the full number with the area code, or leave it empty to hide it.' };
  // Text boxes send \r\n; keep \n so an unchanged text compares equal.
  const text = (k: string) => (str(d, k) ?? '').replace(/\r\n?/g, '\n').slice(0, 5000);
  const next = {
    phone, email, area: text('area').slice(0, 200),
    aboutText: text('aboutText'), whatWeDoIntro: text('whatWeDoIntro'), sellIntro: text('sellIntro'), contactIntro: text('contactIntro'),
    gaId: ga, searchConsole: sc ? searchConsoleCode(sc) : null,
  };
  const cur = await readWebsiteSettings();
  const ch = diff(cur as unknown as Record<string, unknown>, next);
  await db.transaction(async (tx) => {
    await tx.insert(appSettings).values({ key: WEBSITE_SETTINGS_KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updated: new Date() } });
    await audit({ userId: user.id, entity: 'website_settings', entityId: null, action: 'update', summary: ch ? `changed the website settings (${Object.keys(ch.after).join(', ')})` : 'saved the website settings (nothing changed)', via: 'Website Settings', ...(ch ?? {}) }, tx);
  });
  revalidateTag(SITE_TAG, 'max');
  revalidatePath('/site', 'layout');
  revalidatePath('/leads/settings');
  return { ok: 'Saved. The website shows it now.' };
}
