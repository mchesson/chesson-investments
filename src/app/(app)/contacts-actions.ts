'use server';

import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  companies, eventPeople, events, partyRoles, people, personCompanies, savedListMembers, savedLists, tasks, touches,
} from '@/db/schema';
import { audit, diff } from '@/lib/audit';
import { requireAction } from '@/lib/session';
import { bool, isUuid, str, uuidOrNull } from '@/lib/forms';
import { formatName, formatState, isDay, normalizeEmail, storePhone, today, addDays } from '@/lib/format';
import { firstStage, isStage, roleDef, roleLabel, stageLabel } from '@/lib/roles';
import type { FormResult } from '@/components/ActionForm';
import { howMetProblem, splitName } from '@/lib/how-met';

const touchKinds = ['call', 'email', 'text', 'meeting', 'site_walk', 'event'] as const;
type TouchKind = (typeof touchKinds)[number];
const touchLabel: Record<TouchKind, string> = { call: 'call', email: 'email', text: 'text', meeting: 'meeting', site_walk: 'site walk', event: 'event' };

function personFields(d: FormData) {
  return {
    firstName: formatName(str(d, 'firstName') ?? ''),
    lastName: formatName(str(d, 'lastName') ?? ''),
    email: normalizeEmail(str(d, 'email')),
    phone: storePhone(str(d, 'phone')),
    title: str(d, 'title'),
    city: str(d, 'city'),
    state: formatState(str(d, 'state')),
    howMet: str(d, 'howMet'),
    introducedById: uuidOrNull(d, 'introducedById'),
    introNote: str(d, 'introNote'),
    metAtEventId: uuidOrNull(d, 'metAtEventId'),
    notes: str(d, 'notes'),
  };
}

export async function savePerson(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const id = uuidOrNull(d, 'id');
  const f = personFields(d);
  if (!f.firstName || !f.lastName) return { error: 'First and last name are needed.' };
  const companyId = uuidOrNull(d, 'companyId');
  const newCompany = str(d, 'newCompany');

  // Same email or phone = probably the same person: stop unless they say otherwise.
  if (!bool(d, 'different') && (f.email || f.phone)) {
    const match = await db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName }).from(people)
      .where(and(isNull(people.archived), id ? ne(people.id, id) : undefined,
        or(f.email ? eq(people.email, f.email) : sql`false`, f.phone ? eq(people.phone, f.phone) : sql`false`)))
      .limit(3);
    if (match.length) {
      return { error: `Someone on file has the same email or phone: ${match.map((m) => `${m.firstName} ${m.lastName}`).join(', ')}. Open them instead, or tick "Different person" to save anyway.` };
    }
  }
  const newIntroducer = str(d, 'newIntroducer');
  const problem = howMetProblem({ howMet: f.howMet, introducedById: f.introducedById, newIntroducer, selfId: id });
  if (problem) return { error: problem };
  const introName = newIntroducer ? splitName(newIntroducer) : null;
  if (newIntroducer && !introName) return { error: 'Type the introducer’s first and last name.' };

  const savedId = await db.transaction(async (tx) => {
    let cid = companyId;
    if (!cid && newCompany) {
      const [c] = await tx.insert(companies).values({ name: newCompany, createdBy: user.id }).returning();
      cid = c.id;
      await audit({ userId: user.id, entity: 'company', entityId: c.id, action: 'create', summary: `added the company ${c.name}` }, tx);
    }
    if (introName) {
      // The introducer is always a real record, so it links both ways.
      const [intro] = await tx.insert(people).values({ firstName: formatName(introName.firstName), lastName: formatName(introName.lastName), createdBy: user.id }).returning();
      f.introducedById = intro.id;
      await audit({ userId: user.id, entity: 'person', entityId: intro.id, action: 'create', summary: `added ${intro.firstName} ${intro.lastName} as the person who introduced ${f.firstName} ${f.lastName}` }, tx);
    }
    if (!id) {
      const [p] = await tx.insert(people).values({ ...f, companyId: cid, createdBy: user.id }).returning();
      if (cid) await tx.insert(personCompanies).values({ personId: p.id, companyId: cid, title: f.title, startedOn: today() });
      // Every role ticked (the old single "role" field still works).
      const picked = [...new Set([...d.getAll('roles').map(String), str(d, 'role') ?? ''])].filter((r) => roleDef(r));
      for (const role of picked) {
        await tx.insert(partyRoles).values({ personId: p.id, role, stage: firstStage(role), trade: str(d, 'trade'), areas: str(d, 'areas'), licenseNumber: str(d, 'licenseNumber') });
      }
      await audit({ userId: user.id, entity: 'person', entityId: p.id, action: 'create', summary: `added ${p.firstName} ${p.lastName}${picked.length ? ` as ${picked.map(roleLabel).join(', ')}` : ''}`, after: f }, tx);
      if (f.introducedById) await audit({ userId: user.id, entity: 'person', entityId: f.introducedById, action: 'introduced', summary: `introduced us to ${p.firstName} ${p.lastName}`, after: { personId: p.id, note: f.introNote } }, tx);
      if (bool(d, 'different')) await audit({ userId: user.id, entity: 'person', entityId: p.id, action: 'not-duplicate', summary: 'saved as a different person despite a matching email or phone' }, tx);
      return p.id;
    }
    const [old] = await tx.select().from(people).where(eq(people.id, id));
    if (!old) throw new Error('Not found');
    await tx.update(people).set({ ...f, companyId: cid, updated: new Date() }).where(eq(people.id, id));
    if ((old.companyId ?? null) !== (cid ?? null)) {
      // Work history follows the person: close the old job, open the new one.
      await tx.update(personCompanies).set({ endedOn: today() }).where(and(eq(personCompanies.personId, id), isNull(personCompanies.endedOn)));
      if (cid) await tx.insert(personCompanies).values({ personId: id, companyId: cid, title: f.title, startedOn: today() });
    } else if (cid && old.title !== f.title) {
      await tx.update(personCompanies).set({ title: f.title }).where(and(eq(personCompanies.personId, id), isNull(personCompanies.endedOn)));
    }
    if (f.introducedById && f.introducedById !== old.introducedById) {
      await audit({ userId: user.id, entity: 'person', entityId: f.introducedById, action: 'introduced', summary: `introduced us to ${f.firstName} ${f.lastName}`, after: { personId: id, note: f.introNote } }, tx);
    }
    const ch = diff(old as Record<string, unknown>, { ...f, companyId: cid });
    if (ch) await audit({ userId: user.id, entity: 'person', entityId: id, action: 'update', summary: `edited ${Object.keys(ch.after).join(', ')}`, ...ch }, tx);
    return id;
  });
  redirect(`/people/${savedId}`);
}

export async function archivePerson(id: string) {
  const user = await requireAction('contacts.edit');
  await db.transaction(async (tx) => {
    await tx.update(people).set({ archived: new Date() }).where(eq(people.id, id));
    await audit({ userId: user.id, entity: 'person', entityId: id, action: 'archive', summary: 'archived them' }, tx);
  });
  redirect('/people');
}

export async function saveCompany(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const id = uuidOrNull(d, 'id');
  const f = {
    name: (str(d, 'name') ?? '').replace(/\s+/g, ' '),
    website: str(d, 'website'), phone: storePhone(str(d, 'phone')), email: normalizeEmail(str(d, 'email')),
    city: str(d, 'city'), state: formatState(str(d, 'state')), notes: str(d, 'notes'),
  };
  if (!f.name) return { error: 'A name is needed.' };
  if (!bool(d, 'different')) {
    const [same] = await db.select({ id: companies.id }).from(companies)
      .where(and(isNull(companies.archived), sql`lower(${companies.name}) = lower(${f.name})`, id ? ne(companies.id, id) : undefined));
    if (same) return { error: `A company called ${f.name} is already on file. Tick "Different company" to save anyway.` };
  }
  const savedId = await db.transaction(async (tx) => {
    if (!id) {
      const [c] = await tx.insert(companies).values({ ...f, createdBy: user.id }).returning();
      const role = str(d, 'role');
      if (role && roleDef(role)) await tx.insert(partyRoles).values({ companyId: c.id, role, stage: firstStage(role), trade: str(d, 'trade'), areas: str(d, 'areas'), licenseNumber: str(d, 'licenseNumber') });
      await audit({ userId: user.id, entity: 'company', entityId: c.id, action: 'create', summary: `added the company ${c.name}${role ? ` as ${roleLabel(role)}` : ''}`, after: f }, tx);
      return c.id;
    }
    const [old] = await tx.select().from(companies).where(eq(companies.id, id));
    await tx.update(companies).set({ ...f, updated: new Date() }).where(eq(companies.id, id));
    const ch = diff(old as Record<string, unknown>, f);
    if (ch) await audit({ userId: user.id, entity: 'company', entityId: id, action: 'update', summary: `edited ${Object.keys(ch.after).join(', ')}`, ...ch }, tx);
    return id;
  });
  redirect(`/companies/${savedId}`);
}

/** Roles: on a person or a company; each has its own stage. */
export async function addRole(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const personId = uuidOrNull(d, 'personId');
  const companyId = uuidOrNull(d, 'companyId');
  const role = str(d, 'role') ?? '';
  if (!roleDef(role) || (!personId === !companyId)) return { error: 'Pick a role.' };
  const [exists] = await db.select({ id: partyRoles.id }).from(partyRoles)
    .where(and(isNull(partyRoles.removed), eq(partyRoles.role, role), personId ? eq(partyRoles.personId, personId) : eq(partyRoles.companyId, companyId!)));
  if (exists) return { error: `Already a ${roleLabel(role)}.` };
  await db.transaction(async (tx) => {
    const through = uuidOrNull(d, 'hiredThroughCompanyId');
    await tx.insert(partyRoles).values({ personId, companyId, role, stage: firstStage(role), trade: str(d, 'trade'), areas: str(d, 'areas'), licenseNumber: str(d, 'licenseNumber'), hiredThroughCompanyId: through });
    await audit({ userId: user.id, entity: personId ? 'person' : 'company', entityId: personId ?? companyId, action: 'role-add', summary: `added the role ${roleLabel(role)} (${stageLabel(role, firstStage(role))})${through ? ', through a GC' : ''}` }, tx);
  });
  revalidatePath('/', 'layout');
  return { ok: `Added ${roleLabel(role)}.` };
}

export async function updateRole(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const id = uuidOrNull(d, 'id');
  if (!id) return { error: 'Not found.' };
  const [r] = await db.select().from(partyRoles).where(eq(partyRoles.id, id));
  if (!r) return { error: 'Not found.' };
  const stage = str(d, 'stage') ?? r.stage;
  if (!isStage(r.role, stage)) return { error: 'Pick a stage.' };
  const next = { stage, trade: str(d, 'trade'), areas: str(d, 'areas'), licenseNumber: str(d, 'licenseNumber'), notes: str(d, 'notes') };
  const ch = diff(r as Record<string, unknown>, next);
  if (!ch) return { ok: 'No changes.' };
  await db.transaction(async (tx) => {
    await tx.update(partyRoles).set({ ...next, ...(stage !== r.stage ? { stageChangedAt: new Date() } : {}) }).where(eq(partyRoles.id, id));
    const summary = stage !== r.stage
      ? `moved ${roleLabel(r.role)} from ${stageLabel(r.role, r.stage)} to ${stageLabel(r.role, stage)}`
      : `edited the ${roleLabel(r.role)} role`;
    await audit({ userId: user.id, entity: r.personId ? 'person' : 'company', entityId: r.personId ?? r.companyId, action: 'role-update', summary, ...ch }, tx);
  });
  revalidatePath('/', 'layout');
  return { ok: 'Saved.' };
}

export async function removeRole(id: string) {
  const user = await requireAction('contacts.edit');
  const [r] = await db.select().from(partyRoles).where(eq(partyRoles.id, id));
  if (!r) return;
  await db.transaction(async (tx) => {
    await tx.update(partyRoles).set({ removed: new Date() }).where(eq(partyRoles.id, id));
    await audit({ userId: user.id, entity: r.personId ? 'person' : 'company', entityId: r.personId ?? r.companyId, action: 'role-remove', summary: `took off the role ${roleLabel(r.role)}` }, tx);
  });
  revalidatePath('/', 'layout');
}

export async function logTouch(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const personId = uuidOrNull(d, 'personId');
  const kind = str(d, 'kind') as TouchKind;
  const on = str(d, 'happenedOn') ?? today();
  if (!personId) return { error: 'Pick who it was with.' };
  if (!touchKinds.includes(kind)) return { error: 'Pick what it was.' };
  if (!isDay(on) || on > today()) return { error: 'Pick a date, today or earlier.' };
  const followUp = str(d, 'followUp');
  const followOn = str(d, 'followUpOn') ?? addDays(today(), 7);
  if (followUp && !isDay(followOn)) return { error: 'Pick a date for the follow-up.' };
  await db.transaction(async (tx) => {
    const [t] = await tx.insert(touches).values({
      personId, kind, happenedOn: on, notes: str(d, 'notes'), userId: user.id,
      propertyId: uuidOrNull(d, 'propertyId'), projectId: uuidOrNull(d, 'projectId'),
    }).returning();
    await audit({ userId: user.id, entity: 'person', entityId: personId, action: 'touch', summary: `logged a ${touchLabel[kind]} on ${on}`, after: { touchId: t.id } }, tx);
    if (followUp) {
      const [task] = await tx.insert(tasks).values({ title: followUp, dueOn: followOn, assignedTo: user.id, personId, createdBy: user.id }).returning();
      await audit({ userId: user.id, entity: 'person', entityId: personId, action: 'task-add', summary: `added a follow-up: ${followUp} (due ${followOn})`, after: { taskId: task.id } }, tx);
    }
  });
  revalidatePath('/', 'layout');
  return { ok: followUp ? 'Logged, with a follow-up task.' : 'Logged.' };
}

export async function createTask(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const title = str(d, 'title');
  const dueOn = str(d, 'dueOn');
  if (!title) return { error: 'What needs doing?' };
  if (!isDay(dueOn)) return { error: 'Pick a due date.' };
  const rec = {
    personId: uuidOrNull(d, 'personId'), companyId: uuidOrNull(d, 'companyId'),
    propertyId: uuidOrNull(d, 'propertyId'), projectId: uuidOrNull(d, 'projectId'),
  };
  const assignedTo = uuidOrNull(d, 'assignedTo') ?? user.id;
  await db.transaction(async (tx) => {
    const [t] = await tx.insert(tasks).values({ title, dueOn, assignedTo, notes: str(d, 'notes'), createdBy: user.id, ...rec }).returning();
    await audit({ userId: user.id, entity: 'task', entityId: t.id, action: 'create', summary: `added the task “${title}” due ${dueOn}` }, tx);
  });
  revalidatePath('/', 'layout');
  return { ok: 'Task added.' };
}

export async function setTaskDone(id: string, done: boolean) {
  const user = await requireAction('contacts.edit');
  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: done ? 'done' : 'open', doneAt: done ? new Date() : null }).where(eq(tasks.id, id));
    await audit({ userId: user.id, entity: 'task', entityId: id, action: done ? 'done' : 'reopen', summary: done ? 'marked it done' : 'reopened it' }, tx);
  });
  revalidatePath('/', 'layout');
}

export async function createEvent(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const name = str(d, 'name');
  const on = str(d, 'happenedOn');
  if (!name) return { error: 'Name the event.' };
  if (!isDay(on)) return { error: 'Pick the date.' };
  const id = await db.transaction(async (tx) => {
    const [e] = await tx.insert(events).values({ name, happenedOn: on, location: str(d, 'location'), notes: str(d, 'notes'), createdBy: user.id }).returning();
    await audit({ userId: user.id, entity: 'event', entityId: e.id, action: 'create', summary: `added the event ${name}` }, tx);
    return e.id;
  });
  redirect(`/events/${id}`);
}

/** Someone met at an event: on the event, and a touch on the person. */
export async function addPersonToEvent(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const eventId = uuidOrNull(d, 'eventId');
  const personId = uuidOrNull(d, 'personId');
  if (!eventId || !personId) return { error: 'Pick who you met.' };
  const [e] = await db.select().from(events).where(eq(events.id, eventId));
  if (!e) return { error: 'Not found.' };
  const [already] = await db.select({ id: eventPeople.id }).from(eventPeople).where(and(eq(eventPeople.eventId, eventId), eq(eventPeople.personId, personId)));
  if (already) return { error: 'Already listed.' };
  await db.transaction(async (tx) => {
    await tx.insert(eventPeople).values({ eventId, personId, note: str(d, 'note') });
    await tx.insert(touches).values({ personId, kind: 'event', happenedOn: e.happenedOn > today() ? today() : e.happenedOn, notes: str(d, 'note') ?? `Met at ${e.name}`, eventId, userId: user.id });
    await audit({ userId: user.id, entity: 'person', entityId: personId, action: 'touch', summary: `met them at ${e.name}` }, tx);
    await audit({ userId: user.id, entity: 'event', entityId: eventId, action: 'person-add', summary: 'added someone met there', after: { personId } }, tx);
  });
  revalidatePath(`/events/${eventId}`);
  return { ok: 'Added.' };
}

export async function createList(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const name = str(d, 'name');
  if (!name) return { error: 'Name the list.' };
  const id = await db.transaction(async (tx) => {
    const [l] = await tx.insert(savedLists).values({ name, purpose: str(d, 'purpose'), createdBy: user.id }).returning();
    await audit({ userId: user.id, entity: 'list', entityId: l.id, action: 'create', summary: `made the list ${name}` }, tx);
    return l.id;
  });
  redirect(`/lists/${id}`);
}

export async function addToList(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const listId = uuidOrNull(d, 'listId');
  const ids = d.getAll('personId').map(String).filter(isUuid);
  if (!listId || !ids.length) return { error: 'Pick someone to add.' };
  const live = await db.select({ personId: savedListMembers.personId }).from(savedListMembers).where(and(eq(savedListMembers.listId, listId), isNull(savedListMembers.removed)));
  const have = new Set(live.map((r) => r.personId));
  const fresh = ids.filter((i) => !have.has(i));
  if (!fresh.length) return { error: 'Already on the list.' };
  await db.transaction(async (tx) => {
    await tx.insert(savedListMembers).values(fresh.map((personId) => ({ listId, personId })));
    await audit({ userId: user.id, entity: 'list', entityId: listId, action: 'member-add', summary: `added ${fresh.length} ${fresh.length === 1 ? 'person' : 'people'}` }, tx);
  });
  revalidatePath(`/lists/${listId}`);
  return { ok: `Added ${fresh.length}.` };
}

export async function addRoleToList(_: FormResult, d: FormData): Promise<FormResult> {
  const user = await requireAction('contacts.edit');
  const listId = uuidOrNull(d, 'listId');
  const role = str(d, 'role') ?? '';
  const stage = str(d, 'stage');
  if (!listId || !roleDef(role)) return { error: 'Pick a role.' };
  const n = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`
      insert into saved_list_members (list_id, person_id)
      select ${listId}, r.person_id from party_roles r join people p on p.id = r.person_id
      where r.removed_at is null and p.archived_at is null and r.role = ${role} ${stage ? sql`and r.stage = ${stage}` : sql``}
        and not exists (select 1 from saved_list_members m where m.list_id = ${listId} and m.person_id = r.person_id and m.removed_at is null)
      group by r.person_id returning id`);
    await audit({ userId: user.id, entity: 'list', entityId: listId, action: 'member-add', summary: `added ${rows.rows.length} ${roleDef(role)!.plural}${stage ? ` (${stageLabel(role, stage)})` : ''}` }, tx);
    return rows.rows.length;
  });
  revalidatePath(`/lists/${listId}`);
  return { ok: `Added ${n}.` };
}

export async function setMemberStatus(id: string, status: string) {
  const user = await requireAction('contacts.edit');
  if (!['to_contact', 'contacted', 'interested', 'not_interested'].includes(status)) return;
  const [m] = await db.select().from(savedListMembers).where(eq(savedListMembers.id, id));
  if (!m) return;
  await db.transaction(async (tx) => {
    await tx.update(savedListMembers).set({ status }).where(eq(savedListMembers.id, id));
    await audit({ userId: user.id, entity: 'list', entityId: m.listId, action: 'member-status', summary: `set a person to ${status.replace('_', ' ')}`, after: { personId: m.personId } }, tx);
  });
  revalidatePath(`/lists/${m.listId}`);
}

export async function removeMember(id: string) {
  const user = await requireAction('contacts.edit');
  const [m] = await db.select().from(savedListMembers).where(eq(savedListMembers.id, id));
  if (!m) return;
  await db.transaction(async (tx) => {
    await tx.update(savedListMembers).set({ removed: new Date() }).where(eq(savedListMembers.id, id));
    await audit({ userId: user.id, entity: 'list', entityId: m.listId, action: 'member-remove', summary: 'took someone off the list', after: { personId: m.personId } }, tx);
  });
  revalidatePath(`/lists/${m.listId}`);
}
