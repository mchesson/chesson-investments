import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spendByProject, type SpendBill } from './vendor-spend';

const b = (o: Partial<SpendBill>): SpendBill => ({ id: Math.random().toString(), projectId: 'p1', projectName: '420 Peyton', number: null, date: '2026-01-01', kind: 'invoice', amount: '100.00', status: 'paid', throughBillId: null, throughVendor: null, ...o });

test('spend rolls up by project and in all, credits count against it', () => {
  const r = spendByProject([
    b({ amount: '1000.00', date: '2026-02-01', number: '2' }),
    b({ amount: '500.50', date: '2026-01-15', number: '1' }),
    b({ amount: '-200.00', kind: 'credit', date: '2026-03-01' }),
    b({ projectId: 'p2', projectName: '109 Plainview', amount: '250.00', throughBillId: 'gc1', throughVendor: 'Luxury Oaks', date: '2026-09-01' }),
  ]);
  assert.equal(r.cents, 155050);
  assert.equal(r.count, 4);
  assert.deepEqual(r.projects.map((p) => [p.projectName, p.cents, p.direct, p.through]), [['109 Plainview', 25000, 0, 25000], ['420 Peyton', 130050, 130050, 0]]);
  assert.deepEqual(r.projects[1].bills.map((x) => x.number), ['1', '2', null]);
  assert.equal(r.projects[1].first, '2026-01-15');
});

test('nothing spent', () => {
  assert.deepEqual(spendByProject([]), { projects: [], cents: 0, count: 0 });
});
