import 'server-only';
import { sql } from 'drizzle-orm';
import { db, type Reader } from '@/db';
import { audit } from './audit';
import { deleteRules, type Rule } from './delete-rules';

export type Kind = 'person' | 'company';
const main = { person: 'people', company: 'companies' } as const;
const ident = (s: string) => sql.raw(`"${s.replace(/[^a-z_]/g, '')}"`); // names come only from deleteRules

/** What a delete would do: rows per rule, and whether anything blocks it. */
export async function deletePlan(kind: Kind, id: string, x: Reader = db) {
  const rows: (Rule & { count: number })[] = [];
  for (const r of deleteRules[kind]) {
    const res = await x.execute<{ n: number }>(sql`select count(*)::int as n from ${ident(r.table)} where ${ident(r.column)} = ${id}`);
    rows.push({ ...r, count: Number(res.rows[0]?.n ?? 0) });
  }
  return { rows, blocked: rows.filter((r) => r.does === 'block' && r.count > 0) };
}

/** Deletes in one transaction; one History row keeps the record and every row removed or cleared. */
export async function performDelete(kind: Kind, id: string, userId: string, name: string) {
  return db.transaction(async (tx) => {
    const plan = await deletePlan(kind, id, tx);
    if (plan.blocked.length) return { error: `Can’t delete: ${plan.blocked.map((b) => `${b.count} ${b.label}`).join(', ')}. Archive it instead, so the money history stays whole.` };
    const record = (await tx.execute(sql`select * from ${ident(main[kind])} where id = ${id}`)).rows[0];
    if (!record) return { error: 'Not found.' };
    const removed: Record<string, unknown[]> = {}, cleared: Record<string, unknown[]> = {};
    for (const r of plan.rows) {
      if (!r.count) continue;
      const key = `${r.table}.${r.column}`;
      if (r.does === 'delete') removed[key] = (await tx.execute(sql`delete from ${ident(r.table)} where ${ident(r.column)} = ${id} returning *`)).rows;
      else if (r.does === 'clear') cleared[key] = (await tx.execute(sql`update ${ident(r.table)} set ${ident(r.column)} = null where ${ident(r.column)} = ${id} returning id`)).rows;
    }
    await tx.execute(sql`delete from ${ident(main[kind])} where id = ${id}`);
    await audit({ userId, entity: kind, entityId: id, action: 'delete', summary: `deleted ${name} permanently`, via: 'Delete Permanently', before: { record, removed, cleared } }, tx);
    return { ok: true as const };
  });
}
