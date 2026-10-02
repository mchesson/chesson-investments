import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review } from './review';

const c = (d: number) => Math.round(d * 100);

test('420 Peyton: lost money, paid too much for the scope, build over the first estimate', () => {
  const r = review({
    value: c(437500), valueBasis: 'market', sellingCostPct: 5, closingAtSale: c(3000), lotCost: c(200000), acquisition: c(3133), build: c(281213 - 3133),
    staging: c(19623), holding: c(10283), keptAssets: 0, heatedSf: 1408, originalEstimate: c(188807.72), targetProfitPct: 15,
    purchasedOn: '2025-07-31', completedOn: '2026-08-05', plannedExit: 'Sell after the remodel', actualExit: 'Rent (AMG Realty)',
    byCode: [{ code: '24', name: 'Landscaping', amount: c(20000), budget: 0 }], gcBilled: c(215048.84), ownerDirect: c(96091),
  });
  assert.ok(r.profit! < 0);
  const titles = r.findings.map((f) => f.title);
  assert.ok(titles.includes('It lost money'));
  assert.ok(titles.includes('It didn’t work at any purchase price') || titles.includes('We paid too much for what we built'));
  assert.ok(titles.includes('The build ran over the first estimate'));
  assert.ok(titles.includes('Cost per square foot passed the value per square foot'));
  assert.ok(titles.includes('The exit changed'));
  assert.equal(r.held, 12.2);
});

test('a deal that worked', () => {
  const r = review({
    value: c(600000), valueBasis: 'sold', sellingCostPct: 5, closingAtSale: 0, lotCost: c(150000), acquisition: c(3000), build: c(250000),
    staging: c(5000), holding: c(8000), keptAssets: 0, heatedSf: 2000, originalEstimate: c(250000), targetProfitPct: 15,
    purchasedOn: null, completedOn: null, plannedExit: 'Sell', actualExit: 'sell', byCode: [], gcBilled: 0, ownerDirect: 0,
  });
  assert.equal(r.findings[0].title, 'It made the target');
  assert.ok(r.maxLot! > c(150000));
  assert.equal(r.findings.find((f) => f.title.startsWith('The exit'))!.title, 'The exit held');
});
