import 'server-only';
import { sql } from 'drizzle-orm';
import { db, type Reader } from '@/db';
import { audit } from './audit';
import { deleteRules } from './delete-rules';

// Merging two records that are the same person or company (owner, Oct 2, 2026:
// "you didn't give me a way to do anything with the duplicates"). Everything
// pointing at the extra one moves to the one kept (every column in
// delete-rules.ts, whose test makes sure none is forgotten); empty fields on the
// kept one are filled from the extra; the extra is archived, never deleted.

export type Kind = 'person' | 'company';
const main = { person: 'people', company: 'companies' } as const;
const ident = (s: string) => sql.raw(`"${s.replace(/[^a-z_]/g, '')}"`); // names come only from deleteRules and the lists below

/** Fields copied from the extra record when the kept one has none. */
export const fillFields = {
  person: ['email', 'phone', 'title', 'company_id', 'city', 'state', 'how_met', 'introduced_by_id', 'intro_note', 'met_at_event_id'],
  company: ['website', 'phone', 'email', 'city', 'state'],
} as const;

/** What would move: rows per kind of link. */
export async function mergePlan(kind: Kind, goneId: string, x: Reader = db) {
  const rows: { label: string; count: number }[] = [];
  for (const r of deleteRules[kind]) {
    const res = await x.execute<{ n: number }>(sql`select count(*)::int as n from ${ident(r.table)} where ${ident(r.column)} = ${goneId}`);
    const n = Number(res.rows[0]?.n ?? 0);
    if (n) rows.push({ label: r.label, count: n });
  }
  return rows;
}

export async function performMerge(kind: Kind, keepId: string, goneId: string, userId: string) {
  if (keepId === goneId) return { error: 'Pick two different records.' };
  return db.transaction(async (tx) => {
    const t = ident(main[kind]);
    const [keep] = (await tx.execute(sql`select * from ${t} where id = ${keepId} and archived_at is null`)).rows as Record<string, unknown>[];
    const [gone] = (await tx.execute(sql`select * from ${t} where id = ${goneId} and archived_at is null`)).rows as Record<string, unknown>[];
    if (!keep || !gone) return { error: 'One of them is gone or archived already.' };
    const name = (r: Record<string, unknown>) => (kind === 'person' ? `${r.first_name} ${r.last_name}` : String(r.name));
    const moved: Record<string, number> = {};

    // Places that may hold each record only once: the extra's copy goes where the kept one is already there.
    const col = kind === 'person' ? 'person_id' : 'company_id';
    if (kind === 'person') {
      await tx.execute(sql`delete from event_people where person_id = ${goneId} and event_id in (select event_id from event_people where person_id = ${keepId})`);
      await tx.execute(sql`delete from rental_contacts where person_id = ${goneId} and project_id in (select project_id from rental_contacts where person_id = ${keepId})`);
      await tx.execute(sql`delete from saved_list_members where person_id = ${goneId} and list_id in (select list_id from saved_list_members where person_id = ${keepId})`);
    }
    // The same role twice: the extra's is taken off (its history stays).
    await tx.execute(sql`update party_roles set removed_at = now() where ${ident(col)} = ${goneId} and removed_at is null
      and role in (select role from party_roles where ${ident(col)} = ${keepId} and removed_at is null)`);

    for (const r of deleteRules[kind]) {
      const res = await tx.execute(sql`update ${ident(r.table)} set ${ident(r.column)} = ${keepId} where ${ident(r.column)} = ${goneId} returning id`);
      if (res.rows.length) moved[r.label] = res.rows.length;
    }
    // Nobody introduces themselves.
    if (kind === 'person') await tx.execute(sql`update people set introduced_by_id = null where id = ${keepId} and introduced_by_id = ${keepId}`);
    await tx.execute(sql`delete from duplicate_dismissals where kind = ${kind} and (a_id = ${goneId} or b_id = ${goneId})`);

    // Empty fields on the kept one come from the extra; notes are kept together.
    const filled: Record<string, unknown> = {};
    for (const f of fillFields[kind]) if ((keep[f] === null || keep[f] === '') && gone[f] !== null && gone[f] !== '') filled[f] = gone[f];
    if (kind === 'person' && filled.introduced_by_id === keepId) delete filled.introduced_by_id;
    for (const [f, v] of Object.entries(filled)) await tx.execute(sql`update ${t} set ${ident(f)} = ${v as string} where id = ${keepId}`);
    if (gone.notes) await tx.execute(sql`update ${t} set notes = concat_ws(E'\n\n', notes, ${`From ${name(gone)} (merged in): ${gone.notes}`}::text) where id = ${keepId}`);
    if (gone.do_not_use && !keep.do_not_use) {
      await tx.execute(sql`update ${t} set do_not_use = true, do_not_use_reason = ${`${gone.do_not_use_reason ?? 'Do Not Use'} (from ${name(gone)}, merged in)`}, do_not_use_at = now() where id = ${keepId}`);
      filled.do_not_use = true;
    }
    await tx.execute(sql`update ${t} set archived_at = now(), notes = concat_ws(E'\n\n', ${`Merged into ${name(keep)} on ${new Date().toISOString().slice(0, 10)}.`}::text, notes) where id = ${goneId}`);

    const what = Object.entries(moved).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing linked';
    await audit({ userId, entity: kind, entityId: keepId, action: 'merge-in', summary: `merged ${name(gone)} into this record (moved: ${what}${Object.keys(filled).length ? `; filled in ${Object.keys(filled).join(', ')}` : ''})`, before: { kept: keep, merged: gone }, after: { moved, filled }, via: 'Possible Duplicates' }, tx);
    await audit({ userId, entity: kind, entityId: goneId, action: 'merge-out', summary: `merged this record into ${name(keep)} and archived it (moved: ${what})`, before: gone, after: { into: keepId, moved }, via: 'Possible Duplicates' }, tx);
    return { ok: true as const, keepName: name(keep), goneName: name(gone), moved };
  });
}
