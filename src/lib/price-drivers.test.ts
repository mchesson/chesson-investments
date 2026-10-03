import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageBand, buyingPowerPerPoint, driverSentences, ols, priceDrivers, usable, type Sale } from './price-drivers';

// Made-up sales with known effects: price = 300 × sf^0.8 × ZIP × new × lot^0.1 × townhouse, plus a little noise.
function made(seed = 1): Sale[] {
  let x = seed;
  const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  const zipFx: Record<string, number> = { '27601': 1, '27608': 1.6, '27610': 0.7 };
  const out: Sale[] = [];
  for (let i = 0; i < 1500; i++) {
    const zip = Object.keys(zipFx)[i % 3];
    const sf = 1200 + Math.floor(rnd() * 2800), age = [0, 5, 20, 45, 80][Math.floor(rnd() * 5)], acres = 0.1 + rnd() * 0.6;
    const use = rnd() < 0.25 ? 'townhouse' as const : 'single_family' as const;
    const price = 300 * sf ** 0.8 * zipFx[zip] * (age === 0 ? 1.15 : 1) * (use === 'single_family' ? acres ** 0.1 : 0.9) * (1 + (rnd() - 0.5) * 0.02);
    out.push({ price, sf, age, acres, use, zip, month: i % 24 });
  }
  return out;
}

test('least squares finds a known line', () => {
  const X = [[1, 0], [1, 1], [1, 2], [1, 3]], y = [1, 3, 5, 7];
  const b = ols(X, y)!;
  assert.ok(Math.abs(b[0] - 1) < 1e-4 && Math.abs(b[1] - 2) < 1e-4);
  assert.equal(ols([[1]], [1]), null); // too few rows
});

test('the model gets back the effects it was given', () => {
  const d = priceDrivers(made())!;
  assert.ok(d.r2 > 95, `r2 ${d.r2}`);
  assert.ok(Math.abs(d.sfElasticity - 0.8) < 0.03, `elasticity ${d.sfElasticity}`);
  assert.ok(Math.abs(d.agePremium.find((a) => a.key === 'new')!.pct - 15) < 2);
  assert.ok(Math.abs(d.townhouse! - -10) < 2.5, `townhouse ${d.townhouse}`);
  assert.ok(Math.abs(d.lotDoubling! - 7.2) < 1.5, `lot ${d.lotDoubling}`); // 2^0.1 - 1
  const z = Object.fromEntries(d.zips.map((x) => [x.zip, x.premium]));
  assert.ok(Math.abs(z['27601']) < 1 && z['27608'] > 55 && z['27610'] < -25, JSON.stringify(z)); // centred on the middle ZIP
  assert.equal(Math.round(d.shares.reduce((a, s) => a + s.share, 0)), 100);
  assert.equal(d.shares[0].key, 'location'); // the biggest made-up effect
  assert.ok(Math.abs(d.yearTrend) < 1);
});

test('sales with no year built still count, marked unknown', () => {
  const sales = made().map((s, i) => (i % 3 === 0 ? { ...s, age: null } : s));
  const d = priceDrivers(sales)!;
  assert.equal(d.n, 1500);
  assert.ok(Math.abs(d.sfElasticity - 0.8) < 0.04);
  assert.ok(!d.agePremium.some((a) => (a.key as string) === 'unknown'));
});

test('plain sentences from the findings', () => {
  const s = driverSentences(priceDrivers(made())!);
  assert.match(s[0], /^Of why sale prices here differ, location explains \d+%, size explains \d+%/);
  assert.match(s[1], /^Each extra 100 sq ft adds about \$[\d,]+ on a typical \$[\d,]+, [\d,]+ sq ft home\.$/);
  assert.match(s.join(' '), /A new home sells for 1[45]% more than an 11–30-year-old one/);
  assert.match(s.join(' '), /A townhouse sells for \d+% less than a house/);
});

test('too few sales to say', () => {
  assert.equal(priceDrivers(made().slice(0, 40)), null);
});

test('which sales count', () => {
  assert.equal(usable({ price: 10, sf: 2000, age: 5, acres: 0.2 }), false); // a $10 transfer
  assert.equal(usable({ price: 500_000, sf: 2000, age: 5, acres: 0.2 }), true);
  assert.equal(usable({ price: 9_000_000, sf: 2000, age: 5, acres: 0.2 }), false); // a multi-parcel deal
  assert.equal(usable({ price: 500_000, sf: 2000, age: -1, acres: 0.2 }), false); // built after it sold: a lot sale
  assert.equal(usable({ price: 500_000, sf: null, age: 5, acres: 0.2 }), false);
  assert.equal(usable({ price: 500_000, sf: 2000, age: null, acres: 0.2 }), true); // Durham: no year built
});

test('age bands', () => {
  assert.deepEqual([0, 1, 2, 10, 11, 30, 31, 61].map(ageBand), ['new', 'new', 'a2_10', 'a2_10', 'a11_30', 'a11_30', 'a31_60', 'a61']);
});

test('a point on the rate takes about a tenth off what a buyer can borrow', () => {
  assert.equal(buyingPowerPerPoint(6.3), 9.7);
  assert.equal(buyingPowerPerPoint(3), 11.7);
});
