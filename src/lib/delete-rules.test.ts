import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { confirmMatches, deleteRules } from './delete-rules';

/** Every column in schema.ts that points at people or companies (with or without a foreign key). */
function pointers() {
  const s = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');
  const out: { table: string; column: string; to: 'person' | 'company' }[] = [];
  for (const m of s.matchAll(/export const \w+ = pgTable\('(\w+)', \{([\s\S]*?)\n\}/g)) {
    for (const f of m[2].matchAll(/uuid\('(\w+)'\)[^\n]*?\.references\(\(\) => (people|companies)\.id\)/g)) out.push({ table: m[1], column: f[1], to: f[2] === 'people' ? 'person' : 'company' });
    for (const f of m[2].matchAll(/uuid\('(introduced_by_id|hired_through_company_id)'\)/g)) out.push({ table: m[1], column: f[1], to: f[1] === 'introduced_by_id' ? 'person' : 'company' });
  }
  return out;
}

test('every column pointing at a person or company has a delete rule', () => {
  for (const p of pointers()) {
    assert.ok(deleteRules[p.to].some((r) => r.table === p.table && r.column === p.column), `${p.table}.${p.column} → ${p.to} needs a rule in delete-rules.ts`);
  }
});

test('money history always blocks a delete', () => {
  for (const kind of ['person', 'company'] as const) {
    assert.ok(deleteRules[kind].filter((r) => r.table === 'bills' || r.table === 'commitments').every((r) => r.does === 'block'));
  }
});

test('the typed name confirms the delete', () => {
  assert.ok(confirmMatches('  baggett   brothers ', 'Baggett Brothers'));
  assert.ok(!confirmMatches('Baggett', 'Baggett Brothers'));
});
