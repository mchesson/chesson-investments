'use server';

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { guestAccess, projects, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { effectivePermissions, isPermission, isRole, mayManage, permissionLabel, roleNames } from '@/lib/permissions';
import { cleanAbilities, cleanExtras, guestAbilities, guestTypeLabel, isGuestType } from '@/lib/guests';
import { appUrl, createLink } from '@/lib/sign-in-links';
import { linkEmail, mailReady, sendMail } from '@/lib/mail';
import { isDay, normalizeEmail } from '@/lib/format';
import { str } from '@/lib/forms';
import type { FormResult } from '@/components/ActionForm';

/** Add someone before they sign in (their Microsoft 365 email). */
export async function addUser(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const email = normalizeEmail(str(d, 'email'));
  const role = str(d, 'role') ?? '';
  if (!email || !email.includes('@')) return { error: 'Enter their email.' };
  if (!isRole(role) || role === 'pending') return { error: 'Pick a role.' };
  if (role === 'guest') return { error: 'Invite outside people under Invite an Outside Partner, with the projects they can see.' };
  if ((role === 'owner' || role === 'admin') && me.role !== 'owner') return { error: 'Only the owner can make someone an Owner or an Admin.' };
  // Microsoft sign-in only takes Technical Source accounts (owner, Oct 2, 2026: a contractor got no email and couldn't sign in).
  const outside = !email.endsWith('@technicalsource.com');
  if (outside && role !== 'accountant') return { error: `${email} isn’t a Technical Source account, so they can’t sign in with Microsoft. Use Invite an Outside Partner for a contractor, agent, lender or other partner (they sign in with a link), or pick Accountant for an outside bookkeeper.` };
  const [exists] = await db.select().from(users).where(eq(users.email, email));
  if (exists) return { error: 'They’re already listed.' };
  const id = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, name: str(d, 'name'), role }).returning();
    await audit({ userId: me.id, entity: 'user', entityId: u.id, action: 'create', summary: `added ${email} as ${roleNames[role]}` }, tx);
    return u.id;
  });
  revalidatePath('/admin/users');
  if (!outside) return { ok: 'Added. They sign in with their Technical Source Microsoft account (there’s no invitation email: tell them the app’s address).' };
  const { url, sent } = await inviteLink(id, email, me.id, 'You’ve been given access to Chesson Investments.');
  return sent.sent ? { ok: `Added, and the sign-in link is on its way to ${email}:`, link: url } : { ok: `Added. Email isn’t set up yet: copy this link and send it to ${email}. It works once, for 7 days.`, link: url };
}

export async function setUserRole(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const id = str(d, 'id');
  const role = str(d, 'role') ?? '';
  const active = d.get('active') === 'on';
  if (!id || !isRole(role)) return { error: 'Pick a role.' };
  if (id === me.id && (role !== 'owner' || !active)) return { error: 'You can’t remove your own Owner access.' };
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) return { error: 'Not found.' };
  const guard = mayManage(me, u, role);
  if (guard) return { error: guard };
  if ((u.role === 'guest') !== (role === 'guest')) return { error: 'Outside partners stay outside partners: invite a Technical Source account as staff instead.' };
  if ((role === 'owner' || role === 'admin' || role === 'staff') && !u.email.endsWith('@technicalsource.com')) return { error: `${u.email} can’t sign in with Microsoft, so they can be an Outside Partner or an Accountant only.` };
  if (u.role === role && u.active === active) return { ok: 'No changes.' };
  await db.transaction(async (tx) => {
    await tx.update(users).set({ role, active }).where(eq(users.id, id));
    await audit({ userId: me.id, entity: 'user', entityId: id, action: 'update', summary: `set ${u.email} to ${roleNames[role]}${active ? '' : ' (access off)'}`, before: { role: u.role, active: u.active }, after: { role, active } }, tx);
  });
  revalidatePath('/admin/users');
  return { ok: 'Saved.' };
}

const abilityLabel = (k: string) => guestAbilities.find((a) => a.key === k)?.label.toLowerCase() ?? k;
const MS_DOMAIN = 'technicalsource.com';
const msAccount = (email: string) => email.endsWith(`@${MS_DOMAIN}`);

/** One person's permissions, ticked on the Users page (or back to their role's standard set). */
export async function setUserPermissions(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const id = str(d, 'id');
  if (!id) return { error: 'Not found.' };
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) return { error: 'Not found.' };
  if (u.role === 'owner') return { error: 'An Owner always has everything.' };
  const guard = mayManage(me, u);
  if (guard) return { error: guard };
  const standard = d.get('standard') === '1';
  const picked = standard ? null : d.getAll('perm').map(String).filter(isPermission);
  if (me.role !== 'owner' && picked?.includes('sensitive.view') && !effectivePermissions(u.role, u.permissions).includes('sensitive.view')) return { error: 'Only the owner gives access to restricted records.' };
  const before = effectivePermissions(u.role, u.permissions);
  const after = effectivePermissions(u.role, picked);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ permissions: picked }).where(eq(users.id, id));
    const added = after.filter((p) => !before.includes(p)), taken = before.filter((p) => !after.includes(p));
    await audit({ userId: me.id, entity: 'user', entityId: id, action: 'permissions',
      summary: standard ? `set ${u.email} back to the ${roleNames[u.role]} standard access` : `changed ${u.email}'s access${added.length ? `; added: ${added.map(permissionLabel).join(', ')}` : ''}${taken.length ? `; took off: ${taken.map(permissionLabel).join(', ')}` : ''}`,
      before: { permissions: before }, after: { permissions: after } }, tx);
  });
  revalidatePath('/admin/users');
  return { ok: 'Access saved.' };
}

async function inviteLink(userId: string, email: string, createdBy: string, intro: string) {
  const origin = (await headers()).get('origin');
  const { token } = await db.transaction(async (tx) => {
    const l = await createLink(userId, 'invite', createdBy, tx, mailReady() ? email : null);
    await audit({ userId: createdBy, entity: 'user', entityId: userId, action: 'link', summary: `made a sign-in link for ${email} (works once, for 7 days)` }, tx);
    return l;
  });
  const url = `${appUrl(origin)}/signin/link?t=${token}`;
  const m = linkEmail({ title: 'You’re invited to Chesson Investments', intro, button: 'Open Your Projects', url, note: 'This link works once, for 7 days. Next time, use “Get a sign-in link” on the sign-in page.' });
  const sent = await sendMail({ to: email, subject: 'Your invitation to Chesson Investments', ...m });
  return { url, sent };
}

/** Invite an outside person (a GC, a sub, a partner) to some projects, with what they may do on them. */
export async function inviteGuest(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const email = normalizeEmail(str(d, 'email'));
  if (!email || !email.includes('@')) return { error: 'Enter their email.' };
  if (msAccount(email)) return { error: 'That’s a Technical Source account: add them under People Who Can Sign In instead.' };
  const projectIds = d.getAll('project').map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (!projectIds.length && !d.getAll('extra').length) return { error: 'Pick at least one project they can see.' };
  const can = cleanAbilities(d.getAll('can').map(String));
  if (!can.length) return { error: 'Tick at least one thing they can do.' };
  const endsOn = str(d, 'endsOn');
  if (endsOn && !isDay(endsOn)) return { error: 'The last day needs to be a date.' };
  const guestType = str(d, 'guestType');
  if (!isGuestType(guestType)) return { error: 'Pick what kind of partner they are.' };
  const extras = cleanExtras(d.getAll('extra').map(String));
  const personId = str(d, 'personId');
  const companyId = str(d, 'companyId');
  const [exists] = await db.select().from(users).where(eq(users.email, email));
  // An outside email added earlier as staff could never sign in (Microsoft takes only Technical Source accounts): it becomes a guest.
  if (exists && exists.role !== 'guest' && exists.role !== 'pending' && exists.role !== 'staff') return { error: `${email} already signs in as ${roleNames[exists.role]}.` };
  const names = projectIds.length ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)) : [];
  const userId = await db.transaction(async (tx) => {
    const [u] = exists ? [exists] : await tx.insert(users).values({ email, name: str(d, 'name'), role: 'guest', guestType, guestExtras: extras, personId: personId || null, companyId: companyId || null }).returning();
    if (exists) {
      await tx.update(users).set({ role: 'guest', guestType, guestExtras: extras, permissions: null, active: true, ...(personId ? { personId } : {}), ...(companyId ? { companyId } : {}) }).where(eq(users.id, u.id));
      if (exists.role !== 'guest') await audit({ userId: me.id, entity: 'user', entityId: u.id, action: 'update', summary: `changed ${email} from ${roleNames[exists.role]} to a guest (an outside email can't sign in with Microsoft)`, before: { role: exists.role }, after: { role: 'guest' } }, tx);
    }
    for (const p of names) {
      await tx.update(guestAccess).set({ removed: new Date() }).where(and(eq(guestAccess.userId, u.id), eq(guestAccess.projectId, p.id), isNull(guestAccess.removed)));
      await tx.insert(guestAccess).values({ userId: u.id, projectId: p.id, can, endsOn, createdBy: me.id });
      await audit({ userId: me.id, entity: 'project', entityId: p.id, action: 'guest-add', summary: `let ${email} (guest) see it: ${can.map(abilityLabel).join(', ')}${endsOn ? ` until ${endsOn}` : ''}` }, tx);
    }
    await audit({ userId: me.id, entity: 'user', entityId: u.id, action: exists ? 'guest-update' : 'create', summary: `invited ${email} as ${guestTypeLabel(guestType)}${names.length ? ` to ${names.map((p) => p.name).join(', ')}` : ''}${extras.includes('deals') ? ' (sees the deals they sent)' : ''}` }, tx);
    return u.id;
  });
  const { url, sent } = await inviteLink(userId, email, me.id, names.length ? `Matthew Chesson has invited you to see ${names.map((p) => p.name).join(', ')} in Chesson Investments.` : 'Matthew Chesson has invited you to Chesson Investments, where you can follow the deals you sent us.');
  revalidatePath('/admin/users');
  return sent.sent
    ? { ok: `Invited. The email is on its way to ${email}. You can also send them this link:`, link: url }
    : { ok: `Invited. Email isn’t set up yet, so nothing was sent: copy this link and text or email it to ${email}. It works once, for 7 days.`, link: url };
}

/** A new sign-in link for a guest (or an outside accountant), when theirs expired. */
export async function newGuestLink(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const id = str(d, 'id');
  const [u] = id ? await db.select().from(users).where(eq(users.id, id)) : [];
  if (!u || (u.role !== 'guest' && u.role !== 'accountant') || msAccount(u.email)) return { error: 'Only outside people sign in with a link.' };
  if (!u.active) return { error: 'Turn their access back on first.' };
  const { url, sent } = await inviteLink(u.id, u.email, me.id, 'Here is a new link to sign in to Chesson Investments.');
  return sent.sent ? { ok: `Sent to ${u.email}. The link:`, link: url } : { ok: `Email isn’t set up yet: copy this link and send it to ${u.email}.`, link: url };
}

/** Change what a guest may do on one project, or take the project off them. */
export async function setGuestAccess(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const id = str(d, 'id');
  const [a] = id ? await db.select().from(guestAccess).where(eq(guestAccess.id, id)) : [];
  if (!a || a.removed) return { error: 'Not found.' };
  const remove = d.get('remove') === '1';
  const can = cleanAbilities(d.getAll('can').map(String));
  const endsOn = str(d, 'endsOn');
  if (!remove && !can.length) return { error: 'Tick at least one thing, or take the project off.' };
  if (endsOn && !isDay(endsOn)) return { error: 'The last day needs to be a date.' };
  const [u] = await db.select().from(users).where(eq(users.id, a.userId));
  await db.transaction(async (tx) => {
    await tx.update(guestAccess).set(remove ? { removed: new Date() } : { can, endsOn }).where(eq(guestAccess.id, a.id));
    await audit({ userId: me.id, entity: 'project', entityId: a.projectId, action: remove ? 'guest-remove' : 'guest-change',
      summary: remove ? `took ${u?.email} (guest) off it` : `changed what ${u?.email} (guest) can do: ${can.map(abilityLabel).join(', ')}${endsOn ? ` until ${endsOn}` : ''}`,
      before: { can: a.can, endsOn: a.endsOn }, after: remove ? { removed: true } : { can, endsOn } }, tx);
  });
  revalidatePath('/admin/users');
  return { ok: remove ? 'Taken off.' : 'Saved.' };
}

/** What kind of partner an outside person is, and whether they see the deals they sent. */
export async function setGuestType(_: FormResult, d: FormData): Promise<FormResult> {
  const me = await requireAction('users.manage');
  const id = str(d, 'id');
  const [u] = id ? await db.select().from(users).where(eq(users.id, id)) : [];
  if (!u || u.role !== 'guest') return { error: 'Not found.' };
  const guestType = str(d, 'guestType');
  if (!isGuestType(guestType)) return { error: 'Pick what kind of partner they are.' };
  const extras = cleanExtras(d.getAll('extra').map(String));
  await db.transaction(async (tx) => {
    await tx.update(users).set({ guestType, guestExtras: extras }).where(eq(users.id, u.id));
    await audit({ userId: me.id, entity: 'user', entityId: u.id, action: 'guest-type', summary: `set ${u.email} as ${guestTypeLabel(guestType)}${extras.includes('deals') ? ', seeing the deals they sent' : ''}`, before: { guestType: u.guestType, extras: u.guestExtras }, after: { guestType, extras } }, tx);
  });
  revalidatePath('/admin/users');
  return { ok: 'Saved.' };
}
