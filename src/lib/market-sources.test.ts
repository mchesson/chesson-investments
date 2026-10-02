import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durhamLandUse, normalizeAddress, pageQuery, sources, streetOf, wakeLandUse, wakeSubdivision } from './market-sources';

test('addresses are written the counties’ way', () => {
  assert.equal(normalizeAddress('420 Peyton Street'), '420 PEYTON ST');
  assert.equal(normalizeAddress('109 Plainview Ave.'), '109 PLAINVIEW AVE');
  assert.equal(normalizeAddress('1516 West Markham Avenue'), '1516 W MARKHAM AVE');
  assert.equal(streetOf('420 PEYTON ST'), 'PEYTON ST');
  assert.equal(streetOf('12B OAK CT UNIT 4'), 'OAK CT');
  assert.equal(streetOf('700 307 FINSBURY ST'), 'FINSBURY ST');
  assert.equal(streetOf('521 B EASTWAY AVE'), 'EASTWAY AVE');
  assert.equal(streetOf('100 E MAIN ST'), 'E MAIN ST');
});

test('Wake: the subdivision and the kind of property', () => {
  assert.equal(wakeSubdivision('LO130 KNIGHTDALE STATION PHR3 BM2016 -01442'), 'Knightdale Station');
  assert.equal(wakeSubdivision('LO579 401 ASSEMBLAGE PH7 BM2025 -01057'), '401 Assemblage');
  assert.equal(wakeSubdivision('BM1996 -01497'), null);
  assert.equal(wakeSubdivision('LO12 RCMB WESTON PLACE SE1 BM2001 -00001'), 'Weston Place');
  assert.equal(wakeLandUse('SINGLFAM', 'Residential Less Than 10 Acres', 1500), 'single_family');
  assert.equal(wakeLandUse(null, 'Vacant', null), 'land');
  assert.equal(wakeLandUse('FOURFAM', null, 3000), 'multi_family');
  assert.equal(wakeLandUse('SINGLFAM', 'Residential Less Than 10 Acres', 1600, 'Townhouse'), 'townhouse');
  assert.equal(wakeLandUse('FASTFOOD', null, 3000), 'other');
});

test('Durham: the kind of property', () => {
  assert.equal(durhamLandUse('RES/ 1-FAMILY', 1200), 'single_family');
  assert.equal(durhamLandUse('RES/TWNH W/ LAND', 1600), 'townhouse');
  assert.equal(durhamLandUse('VAC RES/ LOT-SML TRA', null), 'land');
  assert.equal(durhamLandUse('COM/ OFFICE BLDG', 5000), 'other');
});

test('a Wake record becomes a market parcel; owners living elsewhere are absentee', () => {
  const row = sources.wake.map({
    attributes: { REID: '0000001', SITE_ADDRESS: '100 SAMPLE ST', CITY_DECODE: 'RALEIGH', ZIPNUM: '27601', HEATEDAREA: 2000, YEAR_BUILT: 1955, TOTSALPRICE: 600000,
      SALE_DATE: Date.parse('2026-03-01'), TYPE_USE_DECODE: 'SINGLFAM', LAND_CLASS_DECODE: 'Residential Less Than 10 Acres', DEED_ACRES: 0.25, TOTAL_VALUE_ASSD: 550000,
      OWNER: 'SAMPLE INVESTMENTS LLC', ADDR1: '9 OTHER RD', PROPDESC: 'LO5 OAKWOOD BM1950 -00001' },
    centroid: { x: -78.6371234, y: 35.7891239 },
  })!;
  assert.equal(row.city, 'Raleigh'); assert.equal(row.street, 'SAMPLE ST'); assert.equal(row.neighborhood, 'Oakwood');
  assert.equal(row.lastSaleOn, '2026-03-01'); assert.equal(row.lastSalePrice, 600000); assert.equal(row.absentee, true);
  assert.equal(row.lat, 35.789124); assert.equal(row.lng, -78.637123);
  assert.equal(sources.wake.map({ attributes: { REID: 'x', SITE_ADDRESS: '1 A ST', ADDR1: '1 A ST', HEATEDAREA: 900, TYPE_USE_DECODE: 'SINGLFAM' } })!.absentee, false);
  assert.equal(sources.wake.map({ attributes: { REID: null } }), null);
});

test('a Durham record becomes a market parcel', () => {
  const row = sources.durham.map({ attributes: { REID: 100001, LOCATION_ADDR: '1 SAMPLE AVE', PHYADDR_CITY: 'DURHAM', PHYADDR_ZIP: '27701', NEIGHBORHOOD: 'WALL TOWN',
    HEATED_AREA: 1216, PKG_SALE_PRICE: 325000, PKG_SALE_DATE: Date.parse('2026-05-15'), LAND_CLASS: 'RES/ 2-FAMILY', OWNER_MAIL_1: '1 SAMPLE AVE' } })!;
  assert.equal(row.parcelKey, '100001'); assert.equal(row.neighborhood, 'Wall Town'); assert.equal(row.landUse, 'multi_family'); assert.equal(row.absentee, false);
});

test('the page query', () => {
  const q = pageQuery(sources.wake, '2023-10-01', 2000, 1000);
  assert.equal(q.get('where'), "SALE_DATE >= DATE '2023-10-01' AND TOTSALPRICE > 50000");
  assert.equal(q.get('resultOffset'), '2000'); assert.equal(q.get('returnCentroid'), 'true'); assert.equal(q.get('outSR'), '4326');
});
