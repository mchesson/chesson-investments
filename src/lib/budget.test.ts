import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cents, codeMoney, payBlocker, pnl, resolveBudget, saleCosts, retainageFor, rollup, scenarios, totals } from './budget';

const plainview = [9460, 0, 18000, 3030, 0, 3500, 84571, 102200, 36203, 49496, 58220, 11686, 21031, 36664, 82499, 22278, 60559, 66713, 38331, 63500, 16400, 13419, null, 20350, 600];

test('109 Plainview budget: construction subtotal, 13.87% management and 5% contingency', () => {
  const lines = plainview.map((a, i) => ({ costCodeId: `c${i}`, kind: 'construction', amount: a, percentOfConstruction: null }));
  lines.push({ costCodeId: 'mgmt', kind: 'soft', amount: null, percentOfConstruction: '13.87' } as never);
  lines.push({ costCodeId: 'cont', kind: 'soft', amount: null, percentOfConstruction: '5' } as never);
  const r = resolveBudget(lines);
  assert.equal(r.construction, 81_871_000);
  assert.equal(r.byCode.get('mgmt'), 11_355_508);
  assert.equal(r.byCode.get('cont'), 4_093_550);
  assert.equal(r.total, 81_871_000 + 11_355_508 + 4_093_550); // $973,200.58
});

test('acquisition and selling codes stay out of the build', () => {
  const r = resolveBudget([
    { costCodeId: 'a', kind: 'construction', amount: 100, percentOfConstruction: null },
    { costCodeId: 'dd', kind: 'acquisition', amount: 50, percentOfConstruction: null },
    { costCodeId: 'st', kind: 'selling', amount: 30, percentOfConstruction: null },
    { costCodeId: 'm', kind: 'soft', amount: null, percentOfConstruction: '10' },
  ]);
  assert.equal(r.total, 11_000);
  assert.equal(r.acquisition, 5_000);
  assert.equal(r.selling, 3_000);
});

test('a line is over when committed or billed passes the budget', () => {
  assert.equal(codeMoney(1000, 900, 500, 0).over, false);
  const over = codeMoney(1000, 900, 1200, 0);
  assert.equal(over.over, true);
  assert.equal(over.left, -200);
  assert.equal(over.projected, 1200);
});

test('rollup adds change orders to commitments and splits paid', () => {
  const m = rollup([{ id: 'f' }], new Map([['f', 10_000_00]]),
    [{ costCodeId: 'f', amount: '9000', changeOrders: ['500', '-200'] }],
    [{ costCodeId: 'f', amount: '4000', status: 'paid' }, { costCodeId: 'f', amount: '1000', status: 'approved' }]);
  const f = m.get('f')!;
  assert.equal(f.committed, 930_000);
  assert.equal(f.billed, 500_000);
  assert.equal(f.paid, 400_000);
  assert.equal(totals(m.values()).left, 70_000);
});

test('paid needs approval, and a lien waiver only when one is required', () => {
  assert.match(payBlocker({ status: 'entered', lienWaiverReceived: true })!, /Approve/);
  assert.match(payBlocker({ status: 'approved', lienWaiverReceived: false })!, /lien waiver/);
  assert.equal(payBlocker({ status: 'approved', lienWaiverReceived: true }), null);
  assert.equal(payBlocker({ status: 'approved', lienWaiverReceived: false, lienWaiverRequired: false }), null);
  assert.match(payBlocker({ status: 'paid', lienWaiverReceived: true })!, /already/);
});

test('retainage from the commitment percent unless typed', () => {
  assert.equal(retainageFor('1000', null, '10'), 10_000);
  assert.equal(retainageFor('1000', '50', '10'), 5_000);
  assert.equal(retainageFor('1000', null, null), 0);
});

test('P&L: pro forma, projected and the over-building check', () => {
  const r = pnl({
    salePrice: cents(1_800_000), marketValue: cents(1_700_000), sellingCostPct: 6, lotCost: cents(380_000), acquisitionCosts: cents(2_000),
    buildBudget: cents(973_200), buildProjected: cents(1_000_000), buildBilled: cents(100_000), holdingToDate: cents(5_000), heatedSf: 4142,
  });
  assert.equal(r.proforma.selling, cents(108_000));
  assert.equal(r.proforma.profit, cents(1_800_000 - 108_000 - 382_000 - 973_200));
  assert.equal(r.projected.profit, cents(1_800_000 - 108_000 - 382_000 - 1_000_000 - 5_000));
  assert.equal(r.market!.net, cents(1_598_000));
  assert.equal(r.market!.overbuilt, false);
  const peyton = pnl({ salePrice: cents(550_000), marketValue: cents(450_000), sellingCostPct: 5, lotCost: cents(204_184), buildBudget: 0, buildProjected: cents(311_340), buildBilled: 0, holdingToDate: 0, heatedSf: 1408 });
  assert.equal(peyton.market!.overbuilt, true);
  assert.ok(peyton.market!.profit < 0);
});

test("sale scenarios match the owner's 420 Peyton sheet", () => {
  // His sheet: High 569,900 / Mid 550,000 / Low 535,000, 5% commissions, $3,000 closing, all-in $515,523.96.
  const s = scenarios({ low: cents(535_000), mid: cents(550_000), high: cents(569_900), sellingCostPct: 5, closingAtSale: cents(3000), allIn: cents(515_523.96), keptAssets: 0, taxRatePct: 50, heatedSf: 1408 });
  assert.deepEqual(s.map((x) => x.profit), [cents(22_881.04), cents(3_976.04), cents(-10_273.96)]);
  assert.equal(s[0].afterTax, cents(11_440.52));
  assert.equal(s[2].tax, 0);
});

test('a sold house uses the settlement statement’s cost of sale, never the commission % on top (Hillock)', () => {
  assert.deepEqual(saleCosts({ sale: cents(430_000), pct: 5, closing: cents(18_685), actual: cents(18_685) }), { commissions: 0, closing: cents(18_685), total: cents(18_685), fromSettlement: true });
  assert.equal(saleCosts({ sale: cents(430_000), pct: 5, closing: cents(3_000) }).total, cents(21_500 + 3_000));
  const base = { salePrice: cents(430_000), marketValue: null, sellingCostPct: 5, lotCost: cents(325_000), acquisitionCosts: cents(3_867.4), buildBudget: 0, buildProjected: 0, buildBilled: 0, holdingToDate: 0, heatedSf: null };
  assert.equal(pnl({ ...base, closingAtSale: cents(18_685), actualSaleCosts: cents(18_685) }).projected.profit, cents(430_000 - 18_685 - 325_000 - 3_867.4));
  assert.equal(pnl({ ...base, closingAtSale: cents(18_685) }).projected.profit, cents(430_000 - 21_500 - 18_685 - 325_000 - 3_867.4));
});
