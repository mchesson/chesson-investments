import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakEvenRent, leaseAlerts, monthly, rentByMonth, verdict, yearly } from './rentals';

const base = { rent: 2_500_00, managementFeePct: 8, repairsReservePct: 5, vacancyPct: 5, taxes: 300_00, insurance: 150_00, hoa: 0, utilities: 0, loanPayment: 0, escrowIncluded: false };

test('a month with no loan', () => {
  const m = monthly(base);
  assert.equal(m.vacancy, 125_00);
  assert.equal(m.collected, 2_375_00);
  assert.equal(m.management, 190_00);
  assert.equal(m.repairs, 125_00);
  assert.equal(m.noi, 2_375_00 - (190_00 + 125_00 + 300_00 + 150_00));
  assert.equal(m.cashFlow, m.noi);
});

test('escrow: taxes and insurance inside the payment are not counted twice', () => {
  const a = monthly({ ...base, loanPayment: 2_000_00, escrowIncluded: true });
  const b = monthly({ ...base, loanPayment: 1_550_00, escrowIncluded: false });
  assert.equal(a.debt, 1_550_00);
  assert.equal(a.cashFlow, b.cashFlow);
});

test('the year, cap rate, cash-on-cash, DSCR and the verdict', () => {
  const m = monthly({ ...base, loanPayment: 1_200_00 });
  const y = yearly(m, 514_770_00, 0, 437_500_00);
  assert.equal(y.noi, m.noi * 12);
  assert.ok(Math.abs(y.capRate! - (m.noi * 12) / 514_770_00) < 1e-9);
  assert.equal(y.cashOnCash, y.cashFlow / 514_770_00);
  assert.ok(Math.abs(y.dscr! - m.noi / 1_200_00) < 1e-9);
  assert.deepEqual(verdict(-1, 2).tone, 'bad');
  assert.deepEqual(verdict(100, 1.1).tone, 'warn');
  assert.deepEqual(verdict(100, 1.5).tone, 'good');
});

test('break-even rent gives a cash flow of about zero', () => {
  const i = { ...base, loanPayment: 2_200_00 };
  const r = breakEvenRent(i)!;
  assert.ok(Math.abs(monthly({ ...i, rent: r }).cashFlow) <= 2);
  assert.equal(breakEvenRent({ ...i, vacancyPct: 100 }), null);
});

test('lease alerts and rent by month', () => {
  assert.deepEqual(leaseAlerts({ endsOn: '2026-11-15', decideBy: null, status: 'active' }, '2026-10-02'), ['Lease ends 2026-11-15 (44 days)']);
  assert.deepEqual(leaseAlerts({ endsOn: '2027-09-30', decideBy: '2026-10-10', status: 'active' }, '2026-10-02'), ['Decide on renewal by 2026-10-10']);
  assert.deepEqual(leaseAlerts({ endsOn: '2026-10-05', decideBy: null, status: 'ended' }, '2026-10-02'), []);
  const months = rentByMonth({ rent: 2_500_00, startsOn: '2026-09-01', endsOn: '2027-08-31' }, [{ forMonth: '2026-09-01', receivedOn: '2026-09-03', kind: 'rent', amount: 2_500_00 }, { forMonth: null, receivedOn: '2026-10-01', kind: 'rent', amount: 1_000_00 }], '2026-10-02');
  assert.deepEqual(months, [{ month: '2026-09', expected: 2_500_00, received: 2_500_00 }, { month: '2026-10', expected: 2_500_00, received: 1_000_00 }]);
});
