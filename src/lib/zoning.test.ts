import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeZoning, placeOfLayer, zoneFieldsOf } from './zoning';

test('Raleigh residential: homes per acre; R-6 and up allow townhomes', () => {
  const r4 = describeZoning('R-4', 'Raleigh', 'Residential-4');
  assert.equal(r4.family, 'houses');
  assert.match(r4.detail, /about 4 homes per acre/);
  assert.equal(describeZoning('R-10', 'Raleigh').family, 'houses_plus');
  assert.equal(r4.ordinance, 'https://udo.raleighnc.gov/');
});

test('Raleigh mixed use with stories; Durham suburban, urban and planned; conditional zoning noted', () => {
  const cx = describeZoning('CX-3-PL', 'Raleigh');
  assert.equal(cx.family, 'mixed');
  assert.match(cx.detail, /up to 3 stories/);
  assert.equal(describeZoning('RX-', 'Raleigh', 'Residential Mixed Use').family, 'multi');
  assert.match(describeZoning('RS-10', 'Durham').detail, /10,000|10000/);
  assert.equal(describeZoning('RU-5(2)', 'Durham').family, 'houses_plus');
  assert.equal(describeZoning('RU-M', 'Durham').family, 'multi');
  const pdr = describeZoning('PDR 5.349', 'Durham');
  assert.equal(pdr.family, 'planned');
  assert.match(pdr.detail, /about 5 homes per acre/);
  assert.match(describeZoning('RS-8(D)', 'Durham').detail, /Conditional/);
});

test('other towns: lot-size districts, commercial, industrial, conservation, unknown', () => {
  assert.match(describeZoning('R-40', 'Cary').detail, /40,000 sq ft/);
  assert.equal(describeZoning('R-80W', 'Wake County').family, 'rural');
  assert.equal(describeZoning('CG', 'Durham').family, 'commercial');
  assert.equal(describeZoning('IH', 'Raleigh').family, 'industrial');
  assert.equal(describeZoning('CM', 'Raleigh').family, 'conservation');
  assert.equal(describeZoning('ZZZ', 'Zebulon').family, 'other');
});

test('the zone fields whatever the town calls them; Wake layer names to places', () => {
  assert.deepEqual(zoneFieldsOf({ ZONE_TYPE: 'R-10', ZONE_TYPE_DECODE: 'Residential-10' }), { code: 'R-10', label: 'Residential-10' });
  assert.deepEqual(zoneFieldsOf({ ZONE_CODE: 'None', ZONING: 'RS-20' }), { code: 'RS-20', label: null });
  assert.equal(placeOfLayer('Raleigh Zoning'), 'Raleigh');
  assert.equal(placeOfLayer('County Zoning'), 'Wake County');
  assert.equal(placeOfLayer('Fuquay-Varina Zoning'), 'Fuquay-Varina');
});

test('Durham’s current code (UDO) wins over the old one; Cary’s CLASS', () => {
  assert.equal(zoneFieldsOf({ UDO: 'DD-C', ZONE_CODE: '', ZONE_GEN: 'DOWNTOWN DESIGN-CORE' }).code, 'DD-C');
  assert.equal(zoneFieldsOf({ CLASS: 'TCCU', NAME: 'Null' }).code, 'TCCU');
});
