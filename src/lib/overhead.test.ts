import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overheadLabel, overheadTotals } from './overhead';

test('overhead totals by category and month, in cents', () => {
  const t = overheadTotals([
    { amount: '44.59', spentOn: '2024-12-10', category: 'office' },
    { amount: '120', spentOn: '2024-12-02', category: 'software' },
    { amount: '10.41', spentOn: '2025-01-05', category: 'office' },
    { amount: null, spentOn: null, category: 'other' },
  ]);
  assert.equal(t.total, 17500);
  assert.deepEqual(t.byCategory.map((c) => [c.key, c.cents]), [['software', 12000], ['office', 5500], ['other', 0]]);
  assert.deepEqual(t.byMonth, [{ month: '2024-12', cents: 16459 }, { month: '2025-01', cents: 1041 }, { month: 'no date', cents: 0 }]);
  assert.equal(overheadLabel('professional'), 'Legal and Accounting');
  assert.equal(overheadLabel('nope'), 'Other');
});
