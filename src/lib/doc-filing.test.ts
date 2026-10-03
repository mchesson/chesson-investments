import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, scrubTitle, type Filing, type Target } from './doc-filing';

const targets: Target[] = [{ kind: 'project', id: 'p1', name: '420 Peyton Street' }, { kind: 'entity', id: 'e1', name: 'WJ Investment Group LLC' }];
const base: Filing = { isIdDocument: false, docType: 'Deed', title: 'Recorded deed', documentDate: null, targetKind: 'project', targetId: 'p1', confidence: 'high', reason: 'address', vendor: null, amount: null, overheadCategory: null, newProperty: null, ein: null };

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

test('a business receipt is overhead under its entity, with vendor, amount, date and category', () => {
  const r = decide({ ...base, docType: 'Receipt', targetKind: 'overhead', targetId: 'e1', vendor: 'Staples', amount: 44.594, documentDate: '2024-12-10', overheadCategory: 'office' }, targets, false);
  assert.deepEqual(r, { action: 'file', kind: 'overhead', id: 'e1', type: 'Receipt', title: 'Recorded deed', ein: null, expense: { vendor: 'Staples', amount: 44.59, spentOn: '2024-12-10', category: 'office' } });
  assert.equal(decide({ ...base, targetKind: 'overhead', targetId: 'p1' }, targets, true).action, 'inbox'); // overhead goes under an entity, not a property
  assert.equal(decide({ ...base, targetKind: 'overhead', targetId: 'e1' }, targets, true, false).action, 'inbox'); // needs someone who sees money
  const odd = decide({ ...base, targetKind: 'overhead', targetId: 'e1', amount: -5, documentDate: 'Dec 10', overheadCategory: null }, targets, true);
  assert.deepEqual(odd.action === 'file' && odd.kind === 'overhead' && odd.expense, { vendor: null, amount: null, spentOn: null, category: 'other' });
});

test('a document about a property we don’t have yet proposes it, with its facts; one key per address', async () => {
  const { propertyKey, mergeProposals } = await import('./doc-filing');
  const np = { address: '1211 Shaw View Alley', unit: '101', city: 'Raleigh', state: 'NC', zip: '27601', purchasePrice: 389900.4, purchasedOn: '2024-11-22', heatedSf: 1180, community: 'The Grey' };
  const d = decide({ ...base, targetKind: 'none', targetId: null, docType: 'Settlement Statement', newProperty: np }, targets, true);
  assert.equal(d.action, 'inbox');
  assert.equal(d.action === 'inbox' && d.proposal?.purchasePrice, 389900);
  assert.equal(propertyKey(np), '1211 SHAW VIEW #101');
  assert.equal(propertyKey({ address: '1211 Shaw View Alley Unit 101' }), '1211 SHAW VIEW #101');
  const m = mergeProposals([{ ...np, purchasePrice: null, heatedSf: null }, { ...np, purchasePrice: 389900, city: null }]);
  assert.equal(m?.purchasePrice, 389900);
  assert.equal(m?.city, 'Raleigh');
  // An address with no house number isn't a property to create.
  assert.equal(decide({ ...base, targetKind: 'none', targetId: null, newProperty: { ...np, address: 'The Grey condos' } }, targets, true).action === 'inbox', true);
});
