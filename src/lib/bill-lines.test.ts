import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupGap, checkLines, countsTowardBudget, countsTowardHolding } from './bill-lines';

const line = (o: Partial<{ kind: string; costCodeId: string | null; holdingKind: string | null; amount: string }>) =>
  ({ kind: 'build', costCodeId: 'c', holdingKind: null, description: null, amount: '10.00', ...o });

test('a GC invoice split across codes, a fee, a credit line and a utility', () => {
  const r = checkLines([line({ amount: '5215.00' }), line({ amount: '-135.73' }), line({ kind: 'fee', amount: '1015.85' }), line({ kind: 'holding', costCodeId: null, holdingKind: 'Utilities', amount: '64.94' })], 'invoice');
  assert.ok('total' in r);
  assert.equal(r.total, '6160.06');
});

test('lines need a cost code, or a holding kind', () => {
  assert.match((checkLines([line({ costCodeId: null })], 'invoice') as { error: string }).error, /cost code/);
  assert.match((checkLines([line({ kind: 'holding', costCodeId: null })], 'invoice') as { error: string }).error, /holding/);
  assert.match((checkLines([], 'invoice') as { error: string }).error, /at least one/);
  assert.ok('total' in checkLines([line({ kind: 'not_project', costCodeId: null, amount: '353.91' })], 'invoice'));
});

test('a credit memo is stored negative', () => {
  const r = checkLines([line({ amount: '135.73' })], 'credit');
  assert.ok('total' in r && r.total === '-135.73');
});

test('backup bills, holding and personal lines never count toward the budget', () => {
  assert.equal(countsTowardBudget({ kind: 'build', costCodeId: 'c', amount: 1, status: 'paid', backup: false }), true);
  assert.equal(countsTowardBudget({ kind: 'build', costCodeId: 'c', amount: 1, status: 'paid', backup: true }), false);
  assert.equal(countsTowardBudget({ kind: 'not_project', costCodeId: null, amount: 1, status: 'paid', backup: false }), false);
  assert.equal(countsTowardHolding({ kind: 'holding', costCodeId: null, amount: 1, status: 'paid', backup: false }), true);
});

test('a GC line and its backup: matched to the cent or the gap shown', () => {
  assert.equal(backupGap('6464.96', ['5446.66', '354.22', '368.33']), 29_575);
  assert.equal(backupGap('181.14', ['181.14']), 0);
});
