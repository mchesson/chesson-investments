import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultBuyBox, judgeZone, maxLotPrice, miles, nearestDowntown, rankZones, readBuyBox } from './buy-box';

test('the max lot price, worked back from the finished value (the owner’s Plainview math)', () => {
  // $426/sf × 2,600 = $1,107,600: the owner's $1.1M sale.
  const m = maxLotPrice(426, defaultBuyBox);
  assert.equal(m.value, 1107600);
  assert.equal(m.build, 494000);
  // 1,107,600 − 66,456 selling − 494,000 − 88,920 soft − 149,526 profit = 308,698, ÷ 1.08
  assert.equal(m.maxLot, 285831);
});

test('settings read safely', () => {
  assert.deepEqual(readBuyBox(null), defaultBuyBox);
  assert.equal(readBuyBox({ buildPerSf: 225, houseSf: -5 }).buildPerSf, 225);
  assert.equal(readBuyBox({ houseSf: -5 }).houseSf, 2600);
});

test('downtowns', () => {
  assert.ok(Math.abs(miles({ lat: 35.7796, lng: -78.6382 }, { lat: 35.994, lng: -78.8986 }) - 20.6) < 1);
  assert.equal(nearestDowntown({ lat: 35.80, lng: -78.62 }).name, 'Downtown Raleigh');
});

const base = { name: 'Oakwood', city: 'Raleigh', county: 'wake', lat: 35.786, lng: -78.628, finished: 12, finishedPsf: 426, entryCount: 6, entryPrice: 250000, bandCounts: { '1m_15m': 5 } };
test('a buy zone, a watch and a pass', () => {
  assert.equal(judgeZone(base, defaultBuyBox).verdict, 'buy');
  assert.equal(judgeZone({ ...base, entryPrice: 310000 }, defaultBuyBox).verdict, 'watch'); // within 15%
  assert.equal(judgeZone({ ...base, entryPrice: 600000 }, defaultBuyBox).verdict, 'pass');
  assert.equal(judgeZone({ ...base, bandCounts: {} }, defaultBuyBox).verdict, 'watch'); // can't absorb $1.1M
  assert.equal(judgeZone({ ...base, entryPrice: 600000, bandCounts: {} }, defaultBuyBox).verdict, 'pass'); // too expensive whatever it absorbs
  assert.equal(judgeZone({ ...base, entryCount: 1 }, defaultBuyBox).verdict, 'watch'); // one lot sale isn't enough to compare
  assert.equal(judgeZone({ ...base, finished: 2 }, defaultBuyBox).verdict, 'thin');
  assert.equal(judgeZone({ ...base, finishedPsf: 150 }, defaultBuyBox).verdict, 'pass'); // a new house doesn't pay there
  assert.equal(judgeZone({ ...base, finishedPsf: 300, entryPrice: 10000 }, defaultBuyBox).verdict, 'pass'); // leaves under $75k for a lot
});

test('best zones first', () => {
  const a = judgeZone(base, defaultBuyBox), b = judgeZone({ ...base, name: 'B', entryPrice: 100000 }, defaultBuyBox), c = judgeZone({ ...base, name: 'C', entryPrice: 600000 }, defaultBuyBox);
  assert.deepEqual(rankZones([c, a, b], defaultBuyBox).map((z) => z.name), ['B', 'Oakwood', 'C']);
});
