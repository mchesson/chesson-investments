import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTaxId, last4Of, masked, open, seal } from './secret-box';

const KEY = 'a-test-secret-a-test-secret';

test('sealed values open with the same key, never another; each seal differs', () => {
  const a = seal('12-3456789', KEY), b = seal('12-3456789', KEY);
  assert.notEqual(a, b); // a fresh IV every time
  assert.ok(!a.includes('3456789'));
  assert.equal(open(a, KEY), '12-3456789');
  assert.throws(() => open(a, 'another-secret-another-secret'));
  assert.throws(() => open(a.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), KEY)); // tampered
  assert.throws(() => open('nonsense', KEY));
  assert.throws(() => seal('x', 'short'));
});

test('tax IDs as typed', () => {
  assert.deepEqual(cleanTaxId('ein', '123456789'), { value: '12-3456789' });
  assert.deepEqual(cleanTaxId('ein', ' 12-3456789 '), { value: '12-3456789' });
  assert.ok('error' in cleanTaxId('ein', '12-345'));
  assert.deepEqual(cleanTaxId('sos', 'ab 1234567'), { value: 'AB1234567' });
  assert.ok('error' in cleanTaxId('other', '12;drop'));
  assert.equal(last4Of('12-3456789'), '6789');
  assert.equal(masked('6789'), '•••• 6789');
});
