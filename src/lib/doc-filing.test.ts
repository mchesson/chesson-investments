import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, scrubTitle, type Filing, type Target } from './doc-filing';

const targets: Target[] = [{ kind: 'project', id: 'p1', name: '420 Peyton Street' }, { kind: 'entity', id: 'e1', name: 'WJ Investment Group LLC' }];
const base: Filing = { isIdDocument: false, docType: 'Deed', title: 'Recorded deed', documentDate: null, targetKind: 'project', targetId: 'p1', confidence: 'high', reason: 'address', ein: null };

test('filed where Claude points, only to places we listed', () => {
  assert.deepEqual(decide(base, targets, true), { action: 'file', kind: 'project', id: 'p1', type: 'Deed', title: 'Recorded deed', ein: null });
  assert.equal(decide({ ...base, targetId: 'made-up' }, targets, true).action, 'inbox');
  assert.equal(decide({ ...base, targetKind: 'entity' }, targets, true).action, 'inbox'); // p1 isn't an entity
  assert.equal(decide({ ...base, confidence: 'low' }, targets, true).action, 'inbox');
  assert.equal(decide(null, targets, true).action, 'inbox');
});

test('personal IDs are refused; business documents need the owner; an EIN only from an EIN letter', () => {
  assert.equal(decide({ ...base, isIdDocument: true }, targets, true).action, 'refuse');
  const ein = { ...base, docType: 'EIN Letter', targetKind: 'entity' as const, targetId: 'e1', ein: '12-3456789' };
  assert.equal(decide(ein, targets, false).action, 'inbox');
  const d = decide(ein, targets, true);
  assert.equal(d.action === 'file' && d.ein, '123456789');
  const notLetter = decide({ ...ein, docType: 'Tax Return' }, targets, true);
  assert.equal(notLetter.action === 'file' && notLetter.ein, null);
});

test('long numbers never reach a title', () => {
  assert.equal(scrubTitle('Shellpoint statement loan 0123456789 March'), 'Shellpoint statement loan … March');
  assert.equal(scrubTitle('Lowe’s receipt 12/10/24 $44.59'), 'Lowe’s receipt 12/10/24 $44.59');
});

test('Word and Excel files are kept by their bytes and name; anything else is refused', async () => {
  const { detectDropFile } = await import('./file-rules');
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectDropFile(zip, 'Expenses.xlsx')!.ext, 'xlsx');
  assert.equal(detectDropFile(zip, 'Operating Agreement.docx')!.ext, 'docx');
  assert.equal(detectDropFile(zip, 'archive.zip'), null);
  assert.equal(detectDropFile(Buffer.from('%PDF-1.7 ....'), 'x.pdf')!.type, 'application/pdf');
});
