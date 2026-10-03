import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docCaption, groupDocs, splitCaption } from './doc-types';

test('a caption is the kind, then the rest', () => {
  assert.deepEqual(splitCaption('Settlement Statement · Purchase, Nov 2024'), { type: 'Settlement Statement', title: 'Purchase, Nov 2024' });
  assert.deepEqual(splitCaption('Deed'), { type: 'Deed', title: null });
  assert.deepEqual(splitCaption('Kitchen photo'), { type: null, title: 'Kitchen photo' });
  assert.equal(docCaption('Receipt', 'Lowe’s, fridge'), 'Receipt · Lowe’s, fridge');
});

test('documents grouped by kind; unknown ones under Other', () => {
  const g = groupDocs([{ caption: 'Deed · Recorded' }, { caption: 'Receipt · Ace' }, { caption: null }]);
  assert.deepEqual(g.map((x) => [x.label, x.rows.length]), [['Deed, Title and Survey', 1], ['Receipts, Invoices and Bills', 1], ['Other', 1]]);
});
