import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Inside a subquery, an outer table's column must go through ref(): drizzle
// writes a single-table query's columns without the table name, so "id" would
// match the subquery's own id (every company showed "No role yet", Oct 3, 2026).
test('subqueries name the outer table: ${ref(table.column)}, never ${table.column}', () => {
  const tables = new Set([...readFileSync('src/db/schema.ts', 'utf8').matchAll(/export const (\w+) = pgTable\(/g)].map((m) => m[1]));
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(p) && !p.endsWith('.test.ts')) files.push(p); } };
  walk('src');
  const bad: string[] = [];
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/[a-z]{1,3}\.[a-z_]+ (?:=|in|<>) \$\{([a-zA-Z]+)\.[a-zA-Z]+\}/g)) if (tables.has(m[1])) bad.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});
