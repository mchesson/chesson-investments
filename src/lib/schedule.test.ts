import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitmentState, compareVersions, doneLate, dueDate, latestByKind, ownerSavings } from './schedule';

test('a commitment follows its milestone, so it moves when the GC schedule moves', () => {
  const ms = new Map([['trim', { plannedStart: '2027-03-15', plannedEnd: '2027-04-01' }]]);
  const a = { dueOn: null, offsetDays: -5, milestoneId: 'trim' };
  assert.equal(dueDate(a, ms), '2027-03-10');
  ms.set('trim', { plannedStart: '2027-04-05', plannedEnd: '2027-04-20' });
  assert.equal(dueDate(a, ms), '2027-03-31');
  ms.set('trim', { plannedStart: '2027-04-05', plannedEnd: '2027-04-20', actualStart: '2027-04-08' } as never);
  assert.equal(dueDate(a, ms), '2027-04-03');
  assert.equal(dueDate({ dueOn: '2027-01-01', offsetDays: null, milestoneId: null }, ms), '2027-01-01');
});

test('missed, due soon, done late', () => {
  assert.equal(commitmentState({ status: 'open', doneOn: null }, '2026-10-01', '2026-10-02'), 'missed');
  assert.equal(commitmentState({ status: 'open', doneOn: null }, '2026-10-05', '2026-10-02'), 'due_soon');
  assert.equal(commitmentState({ status: 'open', doneOn: null }, '2026-11-05', '2026-10-02'), 'upcoming');
  assert.equal(commitmentState({ status: 'done', doneOn: '2026-10-03' }, '2026-10-01', '2026-10-02'), 'done');
  assert.equal(doneLate({ status: 'done', doneOn: '2026-10-03' }, '2026-10-01'), true);
  assert.equal(commitmentState({ status: 'open', doneOn: null }, null), 'no_date');
});

test('owner-supplied appliances: GC allowance $47,000, ours $30,000', () => {
  assert.deepEqual(ownerSavings([
    { responsible: 'owner', gcAllowance: '47000', ourCost: '30000' },
    { responsible: 'gc', gcAllowance: '10000', ourCost: null },
  ]), { allowance: 4_700_000, cost: 3_000_000, savings: 1_700_000 });
});

test('budget stages compared line by line against the approved baseline', () => {
  const v = latestByKind([
    { kind: 'rough', created: new Date('2026-01-01'), lines: [{ costCodeId: 'a', cents: 100 }] },
    { kind: 'approved', created: new Date('2026-03-01'), lines: [{ costCodeId: 'a', cents: 150 }] },
    { kind: 'approved', created: new Date('2026-02-01'), lines: [{ costCodeId: 'a', cents: 999 }] },
  ]);
  const rows = compareVersions([{ id: 'a' }, { id: 'b' }], v, new Map([['a', 170]]));
  assert.deepEqual(rows[0], { costCodeId: 'a', rough: 100, design: null, approved: 150, current: 170, vsApproved: 20 });
  assert.equal(rows[1].approved, null);
});
