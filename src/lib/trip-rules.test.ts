import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateMiles, milesBetween, nearestPlaces, odometerMiles, rateFor, tripLogCsv, yearCompare } from './trip-rules';

test('the standard rate: known years, the owner’s own, nothing guessed', () => {
  assert.equal(rateFor(2025), 0.7);
  assert.equal(rateFor(2026), null);
  assert.equal(rateFor(2026, { 2026: 0.725 }), 0.725);
  assert.equal(rateFor(2026, { 2026: 72.5 }), null); // cents typed as dollars
});

test('odometer miles', () => {
  assert.equal(odometerMiles(10200, 10236), 36);
  assert.equal(odometerMiles(10236, 10200), null);
  assert.equal(odometerMiles(null, 10200), null);
  assert.equal(odometerMiles(1, 5000), null); // not one trip
});

test('distances and the estimate', () => {
  const raleigh = { lat: 35.7796, lng: -78.6382 }, durham = { lat: 35.994, lng: -78.8986 };
  assert.ok(Math.abs(milesBetween(raleigh, durham) - 20.6) < 1);
  const est = estimateMiles(raleigh, [durham], true)!;
  assert.ok(est > 50 && est < 56, String(est)); // there and back, roads winding
  assert.equal(estimateMiles(raleigh, [], true), null);
});

test('I’m Here: the closest place within half a mile', () => {
  const here = { lat: 35.8, lng: -78.64 };
  const places = [{ id: 'far', lat: 35.9, lng: -78.64 }, { id: 'near', lat: 35.801, lng: -78.64 }, { id: 'none', lat: null, lng: null }];
  assert.deepEqual(nearestPlaces(here, places).map((p) => p.id), ['near']);
});

test('the year both ways', () => {
  const trips = [{ on: '2025-03-01', miles: 4000, vehicleId: 'v' }, { on: '2025-09-01', miles: 2000, vehicleId: 'v' }, { on: '2024-12-31', miles: 999, vehicleId: 'v' }];
  const y = yearCompare({ year: 2025, trips, startMiles: 20000, endMiles: 32000, rate: 0.7, carCosts: 9000 });
  assert.deepEqual(y, { business: 6000, total: 12000, sharePct: 50, standard: 4200, actual: 4500, better: 'actual', overTotal: false });
  const noOdo = yearCompare({ year: 2025, trips, startMiles: null, endMiles: null, rate: 0.7, carCosts: 9000 });
  assert.equal(noOdo.actual, null);
  assert.equal(noOdo.better, null);
  assert.equal(noOdo.standard, 4200);
});

test('the log as CSV: quoted, formulas neutralised', () => {
  const csv = tripLogCsv([{ on: '2025-03-01', vehicle: 'Tahoe', business: 'Chesson Investments', destination: '109 Plainview', purpose: '=HYPERLINK("x")', miles: 12.5, how: 'odometer' }]);
  assert.equal(csv.split('\r\n')[1], '"2025-03-01","Tahoe","Chesson Investments","109 Plainview","\'=HYPERLINK(""x"")","12.5","odometer"');
});
