import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importSchema, lineCents, planImport, splitFull, type Existing } from './import-plan';

const ex: Existing = {
  people: [{ id: 'p1', firstName: 'Jason', lastName: 'Burnette', email: 'jason@example.com', phone: null }],
  companies: [{ id: 'c1', name: 'Luxury Oaks Custom Builders, LLC' }],
  projects: [{ id: 'pj1', name: '109 Plainview Ave', address: '109 Plainview Ave' }],
  bills: [{ projectId: 'pj1', vendor: 'Test GC', number: '1', date: '2026-09-01', amount: '100.00' }],
  costCodes: [{ id: 'k8', code: '08' }, { id: 'k26', code: '26' }],
};

test('matches people by email, then phone, then name; flags duplicates in the file', () => {
  const f = importSchema.parse({ people: [
    { name: 'J. Burnette', email: 'JASON@example.com', role: 'gc' },
    { name: 'Phillip DeMuth', role: 'agent', introducedBy: 'Jason Burnette' },
    { name: 'Phillip DeMuth', role: 'agent' },
    { name: 'Odd Role', role: 'plumber' },
  ] });
  const p = planImport(f, ex);
  assert.equal(p.people[0].match, 'p1');
  assert.equal(p.people[0].matchedBy, 'email');
  assert.equal(p.people[1].match, null);
  assert.equal(p.people.length, 3);
  assert.ok(p.problems.some((x) => /listed twice/.test(x)));
  assert.ok(p.problems.some((x) => /unknown role "plumber"/.test(x)));
});

test('companies match ignoring punctuation and case', () => {
  const p = planImport(importSchema.parse({ companies: [{ name: 'luxury oaks custom builders llc' }, { name: 'Parks Building Solutions' }] }), ex);
  assert.equal(p.companies[0].match, 'c1');
  assert.equal(p.companies[1].match, null);
});

test('bills: a new project in the file, known cost codes, duplicates skipped, credits negative', () => {
  const f = importSchema.parse({
    projects: [{ name: '420 Peyton Street', address: '420 Peyton St' }],
    bills: [
      { project: '420 Peyton Street', vendor: 'Luxury Oaks', number: '1099', date: '2026-03-11', lines: [{ costCode: '08', amount: '1,300' }, { kind: 'fee', costCode: '26', amount: 260 }, { costCode: '08', amount: '-135.73' }] },
      { project: '420 Peyton Street', vendor: 'ITC Millwork', number: 'CM284855', date: '2026-05-21', kind: 'credit', backupFor: '1103', lines: [{ costCode: '08', amount: '135.73' }] },
      { project: '109 Plainview Ave', vendor: 'Test GC', number: '1', date: '2026-09-01', lines: [{ costCode: '08', amount: 100 }] },
      { project: 'Nowhere', vendor: 'X', date: '2026-01-01', lines: [{ costCode: '08', amount: 1 }] },
      { project: '109 Plainview Ave', vendor: 'Y', date: '2026-01-01', lines: [{ costCode: '99', amount: 1 }] },
    ],
  });
  const p = planImport(f, ex);
  assert.equal(p.bills[0].total, '1424.27');
  assert.equal(p.bills[0].problem, null);
  assert.equal(p.bills[1].total, '-135.73');
  assert.equal(p.bills[2].duplicate, true);
  assert.match(p.bills[3].problem!, /isn't in the app/);
  assert.match(p.bills[4].problem!, /cost code/);
});

test('names and credit signs', () => {
  assert.deepEqual(splitFull('mary beth smith'), { firstName: 'Mary Beth', lastName: 'Smith' });
  assert.deepEqual(splitFull('Krupa'), { firstName: 'Krupa', lastName: '' });
  assert.equal(lineCents('135.73', 'credit'), -13573);
  assert.equal(lineCents('-135.73', 'credit'), -13573);
  assert.equal(lineCents('-5215', 'invoice'), -521500);
});
