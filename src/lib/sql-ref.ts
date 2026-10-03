import { getTableName, sql, type Column } from 'drizzle-orm';

/**
 * A column written with its table's name ("companies"."id"). Drizzle leaves the
 * table off when a query reads one table, so inside a subquery `${companies.id}`
 * became plain "id" and matched the subquery's own id (Oct 3, 2026: every
 * company showed "No role yet"). Use this for the outer column in any subquery.
 */
export const ref = (c: Column) => sql.raw(`"${getTableName(c.table)}"."${c.name}"`);
