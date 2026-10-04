import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketDrivers, shapleyR2, type MarketMonth } from './market-drivers';

// Made-up months for two counties: sales = size × season × rate effect × listings, with a little noise.
function made(): MarketMonth[] {
  let x = 7;
  const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  const out: MarketMonth[] = [];
  for (const [region, size] of [['A County', 1000], ['B County', 200]] as const) {
    for (let i = 0; i < 72; i++) {
      const y = 2019 + Math.floor(i / 12), m = (i % 12) + 1;
      const rate = 3 + 4 * (i / 72) + Math.sin(i / 5) * 0.5;
      const listings = size * 1.3 * (1 + 0.3 * Math.sin((m / 12) * 2 * Math.PI)) * (0.8 + rnd() * 0.4);
      const seasonFx = m >= 4 && m <= 7 ? 1.4 : m === 1 ? 0.8 : 1;
      out.push({ region, period: `${y}-${String(m).padStart(2, '0')}-28`, homesSold: Math.round(size * seasonFx * Math.exp(-0.08 * rate) * (listings / (size * 1.3)) ** 0.2 * (0.97 + rnd() * 0.06)),
        newListings: Math.round(listings), price: 400000 * (1 + i / 200), rate });
    }
  }
  return out;
}

test('Shapley shares add up to the total and split a shared factor fairly', () => {
  // y = a + b, with a and b the same column: each gets half.
  const rows = Array.from({ length: 50 }, (_, i) => ({ fe: [1], g: { a: [i], b: [i] }, y: 2 * i + (i % 3) * 0.1 }));
  const s = shapleyR2(rows, ['a', 'b'] as const);
  assert.ok(Math.abs(s.shares.a - s.shares.b) < 1e-9);
  assert.ok(Math.abs(s.shares.a + s.shares.b - s.total) < 1e-9);
});

test('the market model gets back the season and the rate it was given', () => {
  const d = marketDrivers(made())!;
  assert.equal(d.regions, 2);
  assert.ok(Math.abs(d.ratePerPoint - -7.7) < 2.5, `rate ${d.ratePerPoint}`); // exp(-0.08) - 1
  assert.ok(['April', 'May', 'June', 'July'].includes(d.peakMonth), d.peakMonth);
  assert.equal(d.lowMonth, 'January');
  assert.ok(d.explained > 80, `explained ${d.explained}`);
  const sum = d.factors.reduce((a, f) => a + f.share, 0);
  assert.ok(Math.abs(sum - d.explained) < 0.5, `${sum} vs ${d.explained}`);
  assert.equal(d.factors[0].key, 'season');
  assert.match(d.factors.find((f) => f.key === 'rate')!.face, /^Each 1-point rise in the 30-year rate: \d+(\.\d)?% fewer sales/);
});

test('the economy: factors with enough months are measured, the rest named as left out', () => {
  const base = made();
  let x = 3;
  const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  // Jobs that grow and lift sales; confidence that wobbles; no migration loaded.
  const withJobs = base.map((m, i) => {
    const jobs = 700 * (1 + (i % 72) / 300) * (0.99 + rnd() * 0.02);
    return { ...m, homesSold: Math.round(m.homesSold * (jobs / 700) ** 1.5), extras: { jobs, confidence: 60 + 10 * Math.sin(i / 7), unemployment: 4 + Math.cos(i / 9) } };
  });
  const d = marketDrivers(withJobs)!;
  assert.ok(d.factors.some((f) => f.key === 'jobs'));
  assert.ok(d.missing.includes('migration') && d.missing.includes('stocks') && d.missing.includes('inflation'));
  assert.match(d.factors.find((f) => f.key === 'jobs')!.face, /^1% more local jobs: [\d.]+% more sales$/);
  const sum = d.factors.reduce((a, f) => a + f.share, 0);
  assert.ok(Math.abs(sum - d.explained) < 0.5);
});

test('too few months to say', () => {
  assert.equal(marketDrivers(made().slice(0, 20)), null);
});
