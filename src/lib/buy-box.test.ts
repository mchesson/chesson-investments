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

test('looking ahead: the zone’s trend carried to when we sell, and whether the Low case holds up', async () => {
  const { outlook, zoneTrend } = await import('./buy-box');
  assert.equal(zoneTrend({ psfRecent: 440, psfPrior: 400 }), 10);
  assert.equal(zoneTrend({ psfRecent: 600, psfPrior: 400 }), 15); // capped
  assert.equal(zoneTrend({ psfRecent: 440, psfPrior: null }), null);
  const s = { ...defaultBuyBox, monthsToSell: 12, downsidePct: 10, upsidePct: 5 };
  // Prices up 10% a year: Mid is today's $/sf × 1.10.
  const o = outlook(426, { psfRecent: 440, psfPrior: 400, entryPrice: 150_000, entryCount: 4 }, s);
  assert.equal(o.trend, 10);
  assert.equal(o.mid, maxLotPrice(426 * 1.1, s).maxLot);
  assert.equal(o.low, maxLotPrice(426 * 0.9, s).maxLot);
  assert.equal(o.high, maxLotPrice(426 * 1.1 * 1.05, s).maxLot);
  assert.ok(o.low < o.mid && o.mid < o.high);
  assert.equal(o.holdsUp, o.low >= 150_000);
  // A falling zone: Low starts from the lower Mid.
  const f = outlook(426, { psfRecent: 380, psfPrior: 400, entryPrice: 280_000, entryCount: 4 }, s);
  assert.equal(f.trend, -5);
  assert.equal(f.low, maxLotPrice(426 * 0.95 * 0.9, s).maxLot);
  assert.equal(f.holdsUp, false);
  // Too few lot sales to compare: can't say.
  assert.equal(outlook(426, { entryPrice: 100_000, entryCount: 1 }, s).holdsUp, null);
  // The judged zone carries it, with a reason when a buy wouldn't survive the Low case.
  const z = judgeZone({ name: 'X', city: 'Raleigh', county: 'wake', lat: 35.79, lng: -78.64, finished: 10, finishedPsf: 426, entryCount: 4, entryPrice: 250_000, bandCounts: { '1m_15m': 6 }, psfRecent: 440, psfPrior: 400 }, s);
  assert.equal(z.verdict, 'buy');
  assert.ok(z.outlook && z.outlook.holdsUp === false);
  assert.ok(z.reasons.some((r) => r.includes('if prices fall 10%')));
  assert.ok(z.reasons.some((r) => r.includes('up 10% in a year')));
});

test('days on market: a slow ZIP makes a buy zone a watch; fast ones say so and come first', async () => {
  const s = { ...defaultBuyBox, maxDom: 60 };
  const base = { name: 'X', city: 'Raleigh', county: 'wake', lat: 35.79, lng: -78.64, finished: 10, finishedPsf: 900, entryCount: 4, entryPrice: 300_000, bandCounts: { '15m': 6 } as Record<string, number>, zip: '27608' };
  assert.equal(judgeZone({ ...base, dom: null }, s).verdict, 'buy');
  const slow = judgeZone({ ...base, dom: 75 }, s);
  assert.equal(slow.verdict, 'watch');
  assert.ok(slow.reasons.some((r) => r.includes('take about 75 days to sell')));
  const fast = judgeZone({ ...base, name: 'Fast', dom: 12 }, s);
  assert.equal(fast.verdict, 'buy');
  assert.ok(fast.reasons.some((r) => r.includes('sell in about 12 days')));
  // Among buy zones near a downtown, the one selling within a month comes first.
  const middling = judgeZone({ ...base, name: 'Middling', dom: 45, entryPrice: 200_000 }, s);
  assert.deepEqual(rankZones([middling, fast], s).map((z) => z.name), ['Fast', 'Middling']);
});
