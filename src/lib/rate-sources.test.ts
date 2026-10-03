import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoDay, mortgageSpread, parseEffr, parseFred, parsePmms, parseTreasury, rateSourceUrls } from './rate-sources';

test('dates in each source’s style', () => {
  assert.equal(isoDay('4/2/1971'), '1971-04-02');
  assert.equal(isoDay('"10/01/2026"'), '2026-10-01');
  assert.equal(isoDay('2026-10-01'), '2026-10-01');
  assert.equal(isoDay('Oct 1'), null);
});

test('Freddie Mac’s history: the 30- and 15-year each week, blanks skipped', () => {
  const csv = 'date,pmms30,pmms30p,pmms15,pmms15p,pmms51,pmms51p,pmms51m,pmms51spread\n4/2/1971,7.33,,,,,,,\n9/25/2026,6.30,0.7,5.49,0.7,,,,\n10/2/2026,6.25,0.6,5.44,0.6,,,,\n';
  assert.deepEqual(parsePmms(csv), [
    { series: '30yr', week: '1971-04-02', rate: 7.33 },
    { series: '30yr', week: '2026-09-25', rate: 6.3 }, { series: '15yr', week: '2026-09-25', rate: 5.49 },
    { series: '30yr', week: '2026-10-02', rate: 6.25 }, { series: '15yr', week: '2026-10-02', rate: 5.44 },
  ]);
  assert.deepEqual(parsePmms('<html>Access denied</html>'), []);
});

test('FRED’s CSV for any series', () => {
  assert.deepEqual(parseFred('observation_date,DGS10\n2026-09-30,4.11\n2026-10-01,.\n', '10yr'), [{ series: '10yr', week: '2026-09-30', rate: 4.11 }]);
});

test('Treasury’s yield curve: the 10-year column each day', () => {
  const csv = 'Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"\n10/01/2026,4.20,4.19,4.18,4.10,4.05,3.98,3.80,3.60,3.58,3.70,3.88,4.11,4.60,4.70\n09/30/2026,4.21,,4.18,4.11,4.06,3.99,3.81,3.61,3.59,3.71,3.89,4.13,4.61,4.71\n';
  assert.deepEqual(parseTreasury(csv), [{ series: '10yr', week: '2026-10-01', rate: 4.11 }, { series: '10yr', week: '2026-09-30', rate: 4.13 }]);
  assert.deepEqual(parseTreasury('nothing here'), []);
});

test('the New York Fed’s effective fed funds rate', () => {
  assert.deepEqual(parseEffr({ refRates: [{ effectiveDate: '2026-10-01', type: 'EFFR', percentRate: 4.08, targetRateFrom: 4.0, targetRateTo: 4.25 }, { effectiveDate: 'x', percentRate: 1 }] }),
    [{ series: 'fedfunds', week: '2026-10-01', rate: 4.08 }]);
  assert.deepEqual(parseEffr({ error: 'nope' }), []);
});

test('the sources for this year and last', () => {
  const u = rateSourceUrls('2026-10-03');
  assert.equal(u.treasury.length, 2);
  assert.match(u.treasury[1], /2026/);
  assert.match(u.effr('2025-01-01'), /startDate=2025-01-01&endDate=2026-10-03/);
});

test('the mortgage spread over the 10-year', () => {
  assert.deepEqual(mortgageSpread(6.25, 4.11), { spread: 2.14, read: 'a little wide' });
  assert.deepEqual(mortgageSpread(5.8, 4.1), { spread: 1.7, read: 'normal' });
  assert.equal(mortgageSpread(6.25, null), null);
});
