'use server';

import { createHash } from 'node:crypto';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { siteLeads, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { linkEmail, mailReady, sendMail } from '@/lib/mail';
import { appUrl } from '@/lib/sign-in-links';
import { storePhone } from '@/lib/format';
import { PUBLIC_HOSTS } from '@/lib/site';
import {
  allowSubmit, checkLead, conditionLabel, isBot, leadKindLabel, parseSource, propertyKindLabel, timelineLabel, topicLabel,
} from '@/lib/site-leads';

const VIA = 'website form';
export type LeadFormState = { ok?: string; error?: string } | null;

const field = (d: FormData) => (k: string) => {
  const v = d.get(k);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};

/** A salted hash of the sender's address that changes every day: enough to slow repeat sending, never the address. */
function ipHash(ip: string | null) {
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${process.env.AUTH_SECRET ?? 'site'}|${day}|${ip}`).digest('hex').slice(0, 32);
}

/** Contact Us and Sell Us Your Property, from anyone on the website (no sign-in). */
export async function submitLead(_: LeadFormState, d: FormData): Promise<LeadFormState> {
  const get = field(d);
  const thanks = get('kind') === 'sell'
    ? 'Thank you. We have the details of your property and will look it over.'
    : 'Thank you. Your message reached us and we’ll be in touch.';
  // A bot filled in the field people never see: say thanks, keep nothing.
  if (isBot(get)) return { ok: thanks };
  const checked = checkLead(get('kind'), get);
  if ('error' in checked) return { error: checked.error };
  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || null;
  const hash = ipHash(ip);
  if (hash) {
    const earlier = await db.select({ at: siteLeads.created }).from(siteLeads)
      .where(and(eq(siteLeads.ipHash, hash), gte(siteLeads.created, new Date(Date.now() - 24 * 3600_000))));
    if (!allowSubmit(earlier.map((e) => e.at))) return { error: 'We’ve had several messages from you already. Please call us, or try again a little later.' };
  }
  const host = h.get('host');
  const src = parseSource(get('src'), get('page'), [...PUBLIC_HOSTS, ...(host ? [host] : [])]);
  const l = { ...checked.lead, phone: storePhone(checked.lead.phone) };
  const [row] = await db.transaction(async (tx) => {
    const r = await tx.insert(siteLeads).values({ ...l, ...src, ipHash: hash }).returning();
    const what = l.kind === 'sell' ? `sent a property through the website: ${l.propertyAddress}` : 'sent a message through the website’s Contact Us form';
    await audit({ userId: null, entity: 'site_lead', entityId: r[0].id, action: 'create', summary: `${l.name} ${what}${src.utmSource ? ` (from ${src.utmSource})` : ''}`, via: VIA, after: { kind: l.kind, ...src } }, tx);
    return r;
  });
  revalidatePath('/leads');

  // The alert to the owner and admins, after the visitor has their answer; a failed email never fails the form.
  after(async () => {
    try {
      if (!mailReady()) return;
      const to = await db.select({ email: users.email }).from(users).where(and(eq(users.active, true), inArray(users.role, ['owner', 'admin'])));
      if (!to.length) return;
      const facts = [
        ['From', l.name], ['Email', l.email], ['Phone', l.phone], ['About', topicLabel(l.topic)],
        ['Property', [l.propertyAddress, l.propertyCity].filter(Boolean).join(', ') || null], ['Kind', propertyKindLabel(l.propertyKind)],
        ['Condition', conditionLabel(l.condition)], ['Timeline', timelineLabel(l.timeline)], ['Asking', l.askingPrice],
        ['Came From', src.utmSource ?? src.referrer ?? 'Direct'],
      ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
      const mail = linkEmail({
        title: `New website lead: ${l.name}`,
        intro: `${leadKindLabel(l.kind)} form.\n${facts}${l.message ? `\n\n${l.message.slice(0, 1500)}` : ''}`,
        button: 'Open the Lead', url: `${appUrl()}/leads/${row.id}`,
        note: 'Sent by the Chesson Investments app when someone fills in a form on the website.',
      });
      const results = await Promise.all(to.map((u) => sendMail({ to: u.email, subject: `New website lead: ${l.name} (${leadKindLabel(l.kind)})`, ...mail })));
      const sent = results.filter((r) => r.sent).length;
      await db.update(siteLeads).set({ alertSent: sent > 0 }).where(eq(siteLeads.id, row.id));
      await audit({ userId: null, entity: 'site_lead', entityId: row.id, action: 'alert', summary: sent ? `emailed the new-lead alert to ${sent} of ${to.length}` : `couldn’t email the new-lead alert (${results.map((r) => (r.sent ? '' : r.reason)).filter(Boolean)[0]})`, via: VIA });
    } catch (e) {
      console.error('lead alert not sent:', e instanceof Error ? e.message : e);
    }
  });
  return { ok: thanks };
}
