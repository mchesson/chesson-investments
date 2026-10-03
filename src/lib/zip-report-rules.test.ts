import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanZipInput, zipHeadline, zipStory, type ZipFacts } from './zip-report-rules';

const base: ZipFacts = {
  zip: '27608',
  redfin: { periodEnd: '2026-08-31', medianDom: 14, domYearAgo: 21, monthsOfSupply: 1.9, saleToList: 1.01, priceDrops: 0.22, inventory: 41, medianSalePrice: 900000, medianPpsf: 410, ppsfYearAgo: 395, homesSold: 60 },
  sales: { now: 142, before: 155, medianPrice: 912000, medianPriceBefore: 880000, medianPsf: 415, medianPsfBefore: 398 },
  permits: { newHomes: 23, teardowns: 9, topBuilder: { name: 'Acme Homes', n: 5 } },
  ours: { projects: 1, watched: 2 },
};

test('a ZIP typed any usual way', () => {
  assert.equal(cleanZipInput(' 27608 '), '27608');
  assert.equal(cleanZipInput('27608-1234'), '27608');
  assert.equal(cleanZipInput('2760'), null);
  assert.equal(cleanZipInput('Raleigh'), null);
  assert.equal(cleanZipInput(null), null);
});

test('the headline: the market from Redfin, and whether more or fewer homes are selling', () => {
  assert.equal(zipHeadline(base), '27608: seller’s market, about as many homes selling as a year ago.');
  assert.equal(zipHeadline({ ...base, redfin: null, sales: { ...base.sales, now: 40, before: 20 } }), '27608: more homes selling than a year ago.');
  assert.equal(zipHeadline({ ...base, redfin: null, sales: { ...base.sales, now: 1, before: 2 } }), '27608: not enough sales on file to say.');
});

test('the story, a sentence per number we have', () => {
  const s = zipStory(base);
  assert.deepEqual(s, [
    'Homes are going under contract in a median 14 days (21 a year ago), with 1.9 months of supply, selling at 101% of list.',
    '22% of listings have had a price cut; 41 for sale now.',
    '142 sales recorded by the county in the last 12 months, down 8% from 155 the year before.',
    'Median sale $912k, up 4% from $880k; $415/sf (up 4% from $398 the year before).',
    '23 new homes and 9 teardowns permitted in the last 12 months; Acme Homes is building the most (5).',
    'We have 1 project and 2 watched properties here.',
  ]);
});

test('nothing invented: missing numbers leave their sentence out', () => {
  const s = zipStory({ zip: '27999', redfin: null, sales: { now: 0, before: 0, medianPrice: null, medianPriceBefore: null, medianPsf: null, medianPsfBefore: null }, permits: { newHomes: 0, teardowns: 0, topBuilder: null }, ours: { projects: 0, watched: 0 } });
  assert.deepEqual(s, []);
});
