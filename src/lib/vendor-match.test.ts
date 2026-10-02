import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCompany, matchPerson, nameWords } from './vendor-match';

const cos = [
  { id: 'b', name: 'Baggett Brothers' }, { id: 'd', name: 'Duke Energy' }, { id: 'l', name: "Lowe's" },
  { id: 'g', name: 'Gardner Roofing & Construction, Inc.' }, { id: 'w', name: 'Wilmoth Interiors, LLC' }, { id: 'x', name: 'Co' },
];

test('names are compared without punctuation and company endings', () => {
  assert.deepEqual(nameWords("Lowe's, Inc."), ['lowes']);
  assert.deepEqual(nameWords('Gardner Roofing & Construction Inc.'), ['gardner', 'roofing', 'and', 'construction']);
});

test('a bill vendor finds its company', () => {
  assert.equal(matchCompany('Baggett Brothers Contracting LLC', cos)?.id, 'b');
  assert.equal(matchCompany('Baggett Brothers Contracting', cos)?.how, 'starts with');
  assert.equal(matchCompany('Duke Energy Progress', cos)?.id, 'd');
  assert.equal(matchCompany('Lowes', cos)?.how, 'same name');
  assert.equal(matchCompany('Gardner Roofing & Construction Inc.', cos)?.id, 'g');
  assert.equal(matchCompany('Wilmoth Design', cos), null); // a person decides
  assert.equal(matchCompany('Staging Items', cos), null);
  assert.equal(matchCompany('Co', cos), null); // too short to trust
});

test('the longest company wins; a tie is no match', () => {
  assert.equal(matchCompany('Duke Energy Progress', [...cos, { id: 'dp', name: 'Duke Energy Progress, LLC' }])?.id, 'dp');
  assert.equal(matchCompany('Duke Energy', [...cos, { id: 'd2', name: 'Duke Energy Inc' }]), null);
});

test('people by the same name, only when there is one', () => {
  const ps = [{ id: 'p1', firstName: 'Leo', lastName: 'Jarman' }, { id: 'p2', firstName: 'Evan', lastName: 'Bailey' }, { id: 'p3', firstName: 'Evan', lastName: 'Bailey' }];
  assert.equal(matchPerson('Leo Jarman', ps)?.id, 'p1');
  assert.equal(matchPerson('Evan Bailey', ps), null);
});
