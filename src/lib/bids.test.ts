import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareBids, linesFrom, median, projectNumber, totalOf, withFee } from './bids';

const codes = [{ id: 'framing' }, { id: 'appliances' }, { id: 'paint' }, { id: 'stone' }];
const bids = [
  { id: 'jason', kind: 'bid', who: 'Luxury Oaks', total: 0, status: 'open', lines: [{ costCodeId: 'framing', cents: 7_530_000 }, { costCodeId: 'appliances', cents: 2_500_000 }, { costCodeId: 'paint', cents: 2_247_500 }, { costCodeId: 'stone', cents: 1_500_000 }] },
  { id: 'blake', kind: 'bid', who: 'Envision', total: 0, status: 'open', lines: [{ costCodeId: 'framing', cents: 7_000_000 }, { costCodeId: 'appliances', cents: 4_700_000 }, { costCodeId: 'paint', cents: 2_200_000 }] },
  { id: 'ours', kind: 'ours', who: 'Us', total: 0, status: null, lines: [{ costCodeId: 'framing', cents: 7_200_000 }, { costCodeId: 'appliances', cents: 3_000_000 }, { costCodeId: 'paint', cents: 2_300_000 }] },
];

test('bids line up by cost code with the gaps flagged', () => {
  const rows = compareBids(codes, bids);
  const ap = rows.find((r) => r.costCodeId === 'appliances')!;
  assert.equal(ap.flags.blake, 'high'); // $47,000 against a middle of $27,500
  assert.equal(ap.low, 2_500_000);
  assert.equal(ap.spread, 2_200_000);
  const stone = rows.find((r) => r.costCodeId === 'stone')!;
  assert.equal(stone.flags.blake, 'missing');
  assert.equal(stone.flags.ours, 'missing');
  assert.equal(stone.flags.jason, undefined);
  assert.equal(rows.find((r) => r.costCodeId === 'paint')!.flags.jason, undefined); // within 25%
});

test('a code nobody priced is left out', () => {
  assert.equal(compareBids([...codes, { id: 'pool' }], bids).some((r) => r.costCodeId === 'pool'), false);
});

test('amounts typed per cost code, totals, the cost-plus fee and P numbers', () => {
  assert.deepEqual(linesFrom([['a', '75,300'], ['b', ''], ['c', '$1,500.50'], ['d', '0']]), [{ costCodeId: 'a', cents: 7_530_000 }, { costCodeId: 'c', cents: 150_050 }]);
  assert.deepEqual(linesFrom([['a', 'lots']]), { error: '“lots” isn’t a dollar amount.' });
  assert.equal(totalOf([{ costCodeId: 'a', cents: 100 }, { costCodeId: 'b', cents: 250 }]), 350);
  assert.equal(withFee(10_000_000, 'cost_plus', '20'), 12_000_000);
  assert.equal(withFee(10_000_000, 'fixed', '20'), 10_000_000);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(projectNumber(1001), 'P-1001');
});
