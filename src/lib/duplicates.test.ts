import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companiesLookAlike, distance, firstNamesMatch, likeCompanies, likePeople, namesLookAlike, pairs } from './duplicates';

test('distance', () => {
  assert.equal(distance('smith', 'smith'), 0);
  assert.equal(distance('smith', 'smyth'), 1);
  assert.equal(distance('jessica', 'jesscia'), 1); // swapped letters
  assert.equal(distance('abc', 'xyzxyz'), 3);
});

test('people with like names', () => {
  assert.ok(namesLookAlike({ firstName: 'Bob', lastName: 'Smith' }, { firstName: 'Robert', lastName: 'Smith' }));
  assert.ok(namesLookAlike({ firstName: 'Jessica', lastName: 'Smith' }, { firstName: 'Jesica', lastName: 'Smyth' }));
  assert.ok(namesLookAlike({ firstName: 'José', lastName: 'Peña' }, { firstName: 'Jose', lastName: 'Pena' }));
  assert.ok(namesLookAlike({ firstName: 'J', lastName: 'Burnette' }, { firstName: 'Jason', lastName: 'Burnett' }));
  assert.ok(namesLookAlike({ firstName: 'Mary', lastName: 'Smith-Jones' }, { firstName: 'Mary', lastName: 'Smith Jones' }));
  assert.ok(!namesLookAlike({ firstName: 'John', lastName: 'Smith' }, { firstName: 'Mary', lastName: 'Smith' }));
  assert.ok(!namesLookAlike({ firstName: 'John', lastName: 'Smith' }, { firstName: 'John', lastName: 'Jones' }));
  assert.ok(!namesLookAlike({ firstName: 'Al', lastName: 'Ng' }, { firstName: 'Al', lastName: 'Wu' }));
  assert.ok(firstNamesMatch('Bill', 'William'));
  assert.ok(!firstNamesMatch('Dan', 'Don'));
});

test('companies with like names', () => {
  assert.ok(companiesLookAlike('Baggett', 'Baggett Construction, Inc.'));
  assert.ok(companiesLookAlike('Luxury Oaks LLC', 'Luxury Oaks'));
  assert.ok(companiesLookAlike('G & L Price', 'G and L Price'));
  assert.ok(companiesLookAlike('Wilmoth Design', 'Wilmouth Design'));
  assert.ok(companiesLookAlike('Duke Energy', 'Duke Energy Progress'));
  assert.ok(!companiesLookAlike('Duke Energy', 'Duke University'));
  assert.ok(!companiesLookAlike('ABC', 'ABC Plumbing')); // too short to say
  assert.ok(!companiesLookAlike('Lot 12 Holdings', 'Lot 13 Holdings')); // numbers must agree
  assert.ok(!companiesLookAlike('Home Depot', 'Lowes Home Improvement'));
});

test('finding them, and every pair', () => {
  const on = [{ id: '1', firstName: 'Robert', lastName: 'Smith' }, { id: '2', firstName: 'Ann', lastName: 'Lee' }];
  assert.deepEqual(likePeople({ firstName: 'Bob', lastName: 'Smith' }, on).map((p) => p.id), ['1']);
  assert.deepEqual(likePeople({ firstName: 'Robert', lastName: 'Smith' }, on, '1'), []);
  assert.deepEqual(likeCompanies('Baggett', [{ id: 'a', name: 'Baggett Construction' }, { id: 'b', name: 'Envision' }]).map((c) => c.id), ['a']);
  assert.equal(pairs([{ id: 'a', name: 'Baggett' }, { id: 'b', name: 'Baggett Co.' }, { id: 'c', name: 'Envision' }], (x, y) => companiesLookAlike(x.name, y.name)).length, 1);
});
