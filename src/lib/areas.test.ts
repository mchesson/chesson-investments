import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaSummary, areasOf, cleanAreas, parseAreas, worksAt } from './areas';

test('old free text is read as cities, ZIPs and neighborhoods', () => {
  assert.deepEqual(parseAreas('Five Points, Oakwood, Durham 27705; raleigh · 27604'), { cities: ['Durham', 'Raleigh'], zips: ['27705', '27604'], neighborhoods: ['Five Points', 'Oakwood'] });
  assert.deepEqual(parseAreas(null), { cities: [], zips: [], neighborhoods: [] });
});

test('the picker’s lists are cleaned and summed up', () => {
  const a = cleanAreas({ cities: ['Raleigh', ' raleigh '], zips: ['27604', 'abc', '27608', '27604'], neighborhoods: ['Oakwood', 'Five  Points'] });
  assert.deepEqual(a, { cities: ['Raleigh'], zips: ['27604', '27608'], neighborhoods: ['Oakwood', 'Five Points'] });
  assert.equal(areaSummary(a), 'Raleigh · 27604, 27608 · Oakwood, Five Points');
  assert.equal(areaSummary({ cities: [], zips: [], neighborhoods: ['Oakwood'] }), 'Oakwood');
});

test('lists win over the old text; who works at a place', () => {
  assert.deepEqual(areasOf({ cities: ['Cary'], zips: null, neighborhoods: null, areas: 'Oakwood' }), { cities: ['Cary'], zips: [], neighborhoods: [] });
  assert.deepEqual(areasOf({ areas: 'Oakwood 27604' }).zips, ['27604']);
  const a = { cities: ['Raleigh'], zips: ['27604'], neighborhoods: ['Belvidere Park'] };
  assert.deepEqual(worksAt(a, { city: 'Raleigh', zip: '27604-1234', neighborhood: 'belvidere park' }), ['belvidere park', '27604', 'Raleigh']);
  assert.deepEqual(worksAt(a, { city: 'Durham', zip: '27705', neighborhood: null }), []);
});
