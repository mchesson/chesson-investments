import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressKey, arcText } from './locate-rules';

test('house number and street name, as the county address points have them', () => {
  assert.deepEqual(addressKey('109 Plainview Ave'), { number: 109, street: 'PLAINVIEW', unit: null });
  assert.deepEqual(addressKey('420 Peyton St.'), { number: 420, street: 'PEYTON', unit: null });
  assert.deepEqual(addressKey('613 S Ocean Blvd Unit N3'), { number: 613, street: 'OCEAN', unit: 'N3' });
  assert.deepEqual(addressKey('2211 Hillock Dr'), { number: 2211, street: 'HILLOCK', unit: null });
  assert.deepEqual(addressKey('1211 Shaw View Alley 101'.replace(/ 101$/, ' Unit 101')), { number: 1211, street: 'SHAW VIEW', unit: '101' });
  assert.equal(addressKey('Lot 18 Birchwood Hills'), null);
  assert.equal(addressKey(null), null);
});

test('text for a county query keeps only safe characters', () => {
  assert.equal(arcText("O'NEAL; DROP"), "O''NEAL DROP");
});

import { sameAsAddress } from './locate-rules';

test('a name that only repeats the address is the same address', () => {
  assert.ok(sameAsAddress('420 Peyton Street', '420 Peyton St'));
  assert.ok(sameAsAddress('109 Plainview Ave', '109 Plainview Avenue'));
  assert.ok(sameAsAddress('613 S Ocean Blvd Unit N3', '613 South Ocean Boulevard Unit N3'));
  assert.ok(!sameAsAddress('613 S Ocean Blvd Unit N3', '613 S Ocean Blvd Unit N4'));
  assert.ok(!sameAsAddress('The Grey', '1211 Shaw View Alley Unit 101'));
  assert.ok(!sameAsAddress('422 Peyton St', '420 Peyton St'));
});

import { joinAddress, splitAddress } from './locate-rules';

test('one address field split for the lookups, and joined back', () => {
  assert.deepEqual(splitAddress('109 Plainview Ave, Raleigh, NC 27604'), { street: '109 Plainview Ave', city: 'Raleigh', state: 'NC', zip: '27604' });
  assert.deepEqual(splitAddress('613 S Ocean Blvd Unit N3, North Myrtle Beach, SC 29582'), { street: '613 S Ocean Blvd Unit N3', city: 'North Myrtle Beach', state: 'SC', zip: '29582' });
  assert.deepEqual(splitAddress('1211 Shaw View Alley Unit 101, Raleigh North Carolina'), { street: '1211 Shaw View Alley Unit 101', city: 'Raleigh', state: 'NC', zip: null });
  assert.deepEqual(splitAddress('420 Peyton St'), { street: '420 Peyton St', city: null, state: null, zip: null });
  assert.deepEqual(splitAddress('420 Peyton St 27610'), { street: '420 Peyton St', city: null, state: null, zip: '27610' });
  assert.equal(joinAddress({ address: '109 Plainview Ave', city: 'Raleigh', state: 'NC', zip: '27604' }), '109 Plainview Ave, Raleigh, NC 27604');
  assert.equal(joinAddress({ address: '420 Peyton St', city: null, state: 'NC', zip: null }), '420 Peyton St, NC');
});
