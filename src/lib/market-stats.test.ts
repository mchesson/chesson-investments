import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandOf, bandSentence, isPlaceName, median, pace, pctChange, psfColor } from './market-stats';

test('price bands', () => {
  assert.equal(bandOf(399_999), 'u400');
  assert.equal(bandOf(400_000), '400_700');
  assert.equal(bandOf(1_500_000), '15m');
});

test('median and change', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(5, 0), null);
});

test('selling faster or slower: the same 6 months a year apart', () => {
  assert.equal(pace(60, 50).pace, 'faster'); // 10/mo vs 8.3/mo
  assert.equal(pace(30, 50).pace, 'slower'); // 5/mo vs 8.3/mo
  assert.equal(pace(42, 42).pace, 'steady');
  assert.equal(pace(2, 2).pace, 'thin');
});

test('the sentence says which bands sell', () => {
  assert.equal(bandSentence([{ band: 'u400', pace: 'faster' }, { band: '400_700', pace: 'slower' }, { band: '700_1m', pace: 'slower' }, { band: '15m', pace: 'faster' }]),
    'Under $400k and $1.5M+ are selling faster than last year; $400k–700k and $700k–1M are slowing.');
  assert.equal(bandSentence([{ band: 'u400', pace: 'steady' }]), 'Every price band is selling at about the same pace as last year.');
});

test('dot colors run from low to high $/sf', () => {
  assert.equal(psfColor(100, 100, 400), 'rgb(0, 186, 180)');
  assert.equal(psfColor(400, 100, 400), 'rgb(179, 38, 30)');
  assert.equal(psfColor(null, 100, 400), '#898989');
});

test('neighborhood names that are not places are left out', () => {
  assert.ok(isPlaceName('Oakwood'));
  assert.ok(isPlaceName('Wendell Falls'));
  assert.ok(!isPlaceName('Residential'));
  assert.ok(!isPlaceName('Kb Homes'));
  assert.ok(!isPlaceName('Sweetbriar Phase 1 Mixed Residential Sf & Townhouse Mungo Homes'));
});
