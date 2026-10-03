import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjusted, finishFromQuality, finishGap, isPublicSource, milesBetween, parseAdjustments, rankSuggestions, summarize, type CompLike } from './comps';

const c = (o: Partial<CompLike>): CompLike => ({ source: 'public_record', status: 'sold', price: null, heatedSf: null, finishLevel: null, adjustments: [], adjustedPrice: null, counted: true, checked: true, ...o });

test('appraisal quality ratings become finish levels', () => {
  assert.equal(finishFromQuality('Q3'), 'upgraded');
  assert.equal(finishFromQuality('Q2;C1'), 'high');
  assert.equal(finishFromQuality('q 1'), 'luxury');
  assert.equal(finishFromQuality('Q4'), 'builder');
  assert.equal(finishFromQuality('Q6'), 'basic');
  assert.equal(finishFromQuality('C2'), null);
  assert.equal(finishFromQuality(null), null);
  assert.equal(finishGap('builder', 'high'), 2);
  assert.equal(finishGap('builder', null), null);
});

test('adjustments are read from plain text', () => {
  assert.deepEqual(parseAdjustments('Size: -12,000; Garage +5000\nView: $3,500'), [
    { label: 'Size', amount: -12000 }, { label: 'Garage', amount: 5000 }, { label: 'View', amount: 3500 },
  ]);
  assert.deepEqual(parseAdjustments('no number here; '), []);
});

test('adjusted price: the appraiser’s figure wins, else price plus adjustments', () => {
  assert.equal(adjusted({ price: 900000, adjustments: [{ label: 'Size', amount: -20000 }], adjustedPrice: null }), 880000);
  assert.equal(adjusted({ price: 900000, adjustments: [{ label: 'Size', amount: -20000 }], adjustedPrice: 875000 }), 875000);
  assert.equal(adjusted({ price: null, adjustments: [], adjustedPrice: null }), null);
});

test('public and private sources', () => {
  assert.ok(isPublicSource('public_record'));
  assert.ok(isPublicSource('listing'));
  assert.ok(!isPublicSource('appraisal'));
  assert.ok(!isPublicSource('new_build'));
});

test('the summary counts every comp looked at but values only the ones counted, checked and sold', () => {
  const rows = [
    c({ price: 1_000_000, heatedSf: 4000, finishLevel: 'high', source: 'appraisal' }), // 250/sf
    c({ price: 1_200_000, heatedSf: 4000, finishLevel: 'high', source: 'new_build' }), // 300/sf
    c({ price: 800_000, heatedSf: 4000, finishLevel: 'builder' }), // 200/sf
    c({ price: 2_000_000, heatedSf: 4000, counted: false }), // not counted
    c({ price: 2_000_000, heatedSf: 4000, checked: false, source: 'appraisal' }), // not looked at yet
    c({ price: 2_000_000, heatedSf: 4000, status: 'active', source: 'listing' }), // for sale, not a sale
  ];
  const s = summarize(rows, { heatedSf: 4142, finishLevel: 'high' });
  assert.equal(s.total, 6);
  assert.equal(s.counted, 3);
  assert.equal(s.toCheck, 1);
  assert.equal(s.publicCount, 3);
  assert.equal(s.privateCount, 3);
  assert.equal(s.medianPerSf, 250);
  assert.deepEqual(s.perSfRange, [200, 300]);
  assert.equal(s.value, 1_035_500);
  assert.deepEqual(s.valueRange, [828_400, 1_242_600]);
  assert.equal(s.sameFinishValue, Math.round(275 * 4142));
  assert.deepEqual(s.bySource.find((x) => x.key === 'appraisal'), { key: 'appraisal', label: 'Appraisal', count: 2, counted: 1 });
  assert.ok(s.byFinish.find((f) => f.key === 'high')!.sameAsOurs);
  assert.equal(s.byFinish.find((f) => f.key === '')!.count, 3);
});

test('with four or more comps the range is the middle half', () => {
  const rows = [200, 250, 300, 350, 400].map((p) => c({ price: p * 1000, heatedSf: 1000 }));
  const s = summarize(rows, { heatedSf: 1000, finishLevel: null });
  assert.deepEqual(s.perSfRange, [250, 350]);
  assert.equal(s.value, 300000);
});

test('no square footage, no value', () => {
  const s = summarize([c({ price: 500000, heatedSf: 2000 })], { heatedSf: null, finishLevel: null });
  assert.equal(s.value, null);
  assert.equal(s.medianPerSf, 250);
});

test('miles and suggestion order', () => {
  const m = milesBetween({ lat: 35.78, lng: -78.64 }, { lat: 35.79, lng: -78.64 });
  assert.ok(m > 0.68 && m < 0.70, String(m));
  const ranked = rankSuggestions([
    { id: 'far', miles: 1.4, soldOn: '2026-09-01', heatedSf: 2500 },
    { id: 'near', miles: 0.2, soldOn: '2026-08-01', heatedSf: 2400 },
    { id: 'old', miles: 0.2, soldOn: '2025-01-01', heatedSf: 2400 },
  ], 2400, '2026-10-03');
  assert.deepEqual(ranked.map((r) => r.id), ['near', 'far', 'old']);
});

import { readingToRows, type CompReading } from './comp-reading';

test('an appraisal reading becomes comp rows, never the subject, values checked', () => {
  const r: CompReading = {
    isComps: true, documentKind: 'appraisal',
    subject: { address: '1 Main St', appraisedValue: 1_250_000, effectiveDate: '2026-05-01' },
    comps: [
      { address: '1 Main St', city: 'Raleigh', source: 'appraisal', status: 'sold', soldOn: '2026-01-01', price: 1, heatedSf: 1, beds: null, baths: null, yearBuilt: null, lotAcres: null, quality: null, distanceMi: null, adjustments: [], adjustedPrice: null, notes: null },
      { address: ' 22 Oak Ave ', city: 'Raleigh', source: 'new_build', status: 'presale', soldOn: '2026-13-40', price: 1_190_000, heatedSf: 4011.4, beds: 5, baths: 4.5, yearBuilt: 2026, lotAcres: 0.21, quality: 'Q2;C1', distanceMi: 0.4, adjustments: [{ label: 'GLA', amount: 6500 }, { label: 'View', amount: 0 }], adjustedPrice: 1_196_500, notes: 'Same builder' },
    ],
  };
  const rows = readingToRows(r);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].address, '22 Oak Ave');
  assert.equal(rows[0].soldOn, null);
  assert.equal(rows[0].heatedSf, 4011);
  assert.equal(rows[0].finishLevel, 'high');
  assert.equal(rows[0].source, 'new_build');
  assert.deepEqual(rows[0].adjustments, [{ label: 'GLA', amount: 6500 }]);
  assert.deepEqual(readingToRows({ ...r, isComps: false }), []);
});

import { isWatched, offBy, reliability, sameAddress } from './comps';
import { addressKey } from './locate-rules';

test('a presale is watched until it closes, then the recorded price is used', () => {
  assert.ok(isWatched({ status: 'presale' }));
  assert.ok(isWatched({ status: 'pending', actualPrice: null }));
  assert.ok(!isWatched({ status: 'presale', actualPrice: 1_000_000 }));
  assert.ok(!isWatched({ status: 'sold' }));
  assert.equal(adjusted({ price: 950_000, adjustments: [{ label: 'Size', amount: -10_000 }], adjustedPrice: 940_000, actualPrice: 1_000_000 }), 990_000);
});

test('the same house whatever way the address is written', () => {
  assert.ok(sameAddress('105 Plainview Avenue', '105 PLAINVIEW AVE', addressKey));
  assert.ok(!sameAddress('105 Plainview Ave', '107 Plainview Ave', addressKey));
  assert.ok(!sameAddress('613 S Ocean Blvd Unit N3', '613 S Ocean Blvd Unit N4', addressKey));
});

test('who gives reliable numbers: within 3% held up', () => {
  assert.equal(offBy(1_000_000, 1_020_000), 2);
  assert.equal(offBy(1_000_000, 900_000), -10);
  assert.equal(offBy(null, 900_000), null);
  const r = reliability([
    { provider: 'Pat Agent', price: 1_000_000, actualPrice: 1_010_000 },
    { provider: 'Pat Agent', price: 800_000, actualPrice: 808_000 },
    { provider: 'Sam Builder', price: 1_000_000, actualPrice: 900_000 },
    { provider: 'Sam Builder', price: 1_000_000, actualPrice: null },
    { provider: null, price: 1, actualPrice: 1 },
  ]);
  assert.deepEqual(r.map((x) => [x.provider, x.given, x.compared, x.verdict, x.averageOff]), [
    ['Pat Agent', 2, 2, 'Held up', 1], ['Sam Builder', 2, 1, 'Didn’t hold up', 10],
  ]);
});

import { looksLikeTheClose, valuePerSf } from './comps';

test('$/sf leaves out size adjustments: they move a comp to another house’s size', () => {
  const c = { price: 1_750_000, heatedSf: 3871, actualPrice: null, adjustments: [{ label: 'Location', amount: 14_000 }, { label: 'Gross Living Area', amount: 44_300 }, { label: 'GLA', amount: 1 }, { label: 'Amenities', amount: -29_000 }] };
  assert.equal(Math.round(valuePerSf(c)!), Math.round((1_750_000 + 14_000 - 29_000) / 3871));
  assert.equal(valuePerSf({ price: 1_000_000, heatedSf: 4000, actualPrice: 1_100_000, adjustments: [] }), 275);
  assert.equal(valuePerSf({ price: null, heatedSf: 4000, actualPrice: null, adjustments: [] }), null);
});

test('an appraised house is watched; the lot selling first isn’t its close', () => {
  assert.ok(isWatched({ status: 'appraised' }));
  assert.ok(!looksLikeTheClose(1_821_000, 450_000));
  assert.ok(looksLikeTheClose(1_821_000, 1_790_000));
  assert.ok(looksLikeTheClose(null, 450_000));
});
