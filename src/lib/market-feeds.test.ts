import { test } from 'node:test';
import assert from 'node:assert/strict';
import { affordability, builderName, headerCols, isNewHome, marketHeat, monthlyPayment, parseFredCsv, parseRedfinLine, permitSources, permitsNear, rateSensitivity, sensitivityLabel } from './market-feeds';

test('FRED’s rate file: both header styles, missing weeks skipped', () => {
  assert.deepEqual(parseFredCsv('observation_date,MORTGAGE30US\n2026-09-24,6.30\n2026-10-01,.\n2026-10-01,6.25\n'), [{ week: '2026-09-24', rate: 6.3 }, { week: '2026-10-01', rate: 6.25 }]);
  assert.deepEqual(parseFredCsv('DATE,MORTGAGE30US\r\n1971-04-02,7.33\r\nnot a line\r\n'), [{ week: '1971-04-02', rate: 7.33 }]);
  assert.deepEqual(parseFredCsv('<html>Too many requests</html>'), []);
});

test('a monthly payment and the income a lender wants', () => {
  assert.equal(Math.round(monthlyPayment(400_000, 6)), 2398); // $400k at 6% for 30 years
  assert.equal(monthlyPayment(0, 6), 0);
  assert.equal(Math.round(monthlyPayment(360_000, 0)), 1000);
  const a = affordability(500_000, 6); // $400k loan + $500/month taxes and insurance
  assert.equal(a.payment, 2898);
  assert.equal(a.income, 124_000);
  assert.ok(affordability(500_000, 7).payment > a.payment);
});

test('how a band’s sales move with rates', () => {
  // Sales fall 10 a month for each point: from an average of 50 that's −20% a point.
  const months = Array.from({ length: 24 }, (_, i) => ({ rate: 5 + i / 8, sales: 50 - 10 * (i / 8 - 1.4375) }));
  assert.equal(rateSensitivity(months)?.pctPerPoint, -20);
  assert.equal(sensitivityLabel(-20), 'Rate-sensitive');
  // Flat sales: no effect.
  assert.equal(rateSensitivity(months.map((m) => ({ ...m, sales: 30 })))?.pctPerPoint, 0);
  assert.equal(sensitivityLabel(0), 'Barely moves with rates');
  // Too few months, or rates that hardly moved: can't say.
  assert.equal(rateSensitivity(months.slice(0, 6)), null);
  assert.equal(rateSensitivity(months.map((m) => ({ ...m, rate: 6.5 }))), null);
  assert.equal(sensitivityLabel(null), 'Not enough to say');
});

const header = ['PERIOD_BEGIN', 'PERIOD_END', 'PERIOD_DURATION', 'REGION_TYPE', 'IS_SEASONALLY_ADJUSTED', 'REGION', 'PROPERTY_TYPE', 'MEDIAN_SALE_PRICE', 'MEDIAN_PPSF', 'INVENTORY', 'MONTHS_OF_SUPPLY', 'MEDIAN_DOM', 'AVG_SALE_TO_LIST', 'PRICE_DROPS', 'PARENT_METRO_REGION']
  .map((c) => `"${c}"`).join('\t');
const line = (o: Record<string, string>) => ['PERIOD_BEGIN', 'PERIOD_END', 'PERIOD_DURATION', 'REGION_TYPE', 'IS_SEASONALLY_ADJUSTED', 'REGION', 'PROPERTY_TYPE', 'MEDIAN_SALE_PRICE', 'MEDIAN_PPSF', 'INVENTORY', 'MONTHS_OF_SUPPLY', 'MEDIAN_DOM', 'AVG_SALE_TO_LIST', 'PRICE_DROPS', 'PARENT_METRO_REGION']
  .map((c) => (/^\d|NA|false/.test(o[c] ?? '') && !['PERIOD_BEGIN', 'PERIOD_END'].includes(c) ? o[c] : `"${o[c] ?? ''}"`)).join('\t');
const zipRow = { PERIOD_BEGIN: '2026-03-01', PERIOD_END: '2026-05-31', PERIOD_DURATION: '90', REGION_TYPE: 'zip code', IS_SEASONALLY_ADJUSTED: 'false', REGION: 'Zip Code: 27608', PROPERTY_TYPE: 'Single Family Residential',
  MEDIAN_SALE_PRICE: '1012500', MEDIAN_PPSF: '412.3456', INVENTORY: '41', MONTHS_OF_SUPPLY: '2.44', MEDIAN_DOM: '18.5', AVG_SALE_TO_LIST: '0.99123', PRICE_DROPS: 'NA', PARENT_METRO_REGION: 'Raleigh, NC' };

test('Redfin’s lines: our metros, ZIPs by the 3 months and counties by the month', () => {
  const cols = headerCols(header);
  const r = parseRedfinLine(line(zipRow), cols)!;
  assert.deepEqual({ ...r }, { regionType: 'zip', region: '27608', metro: 'Raleigh, NC', propertyType: 'single_family', periodEnd: '2026-05-31',
    medianSalePrice: 1012500, medianListPrice: null, medianPpsf: 412.3, homesSold: null, pendingSales: null, newListings: null, inventory: 41, monthsOfSupply: 2.4,
    medianDom: 18.5, saleToList: 0.9912, soldAboveList: null, priceDrops: null, offMarket2Wk: null });
  assert.equal(parseRedfinLine(line({ ...zipRow, PARENT_METRO_REGION: 'Chicago, IL' }), cols), null);
  assert.equal(parseRedfinLine(line({ ...zipRow, PERIOD_DURATION: '30' }), cols), null);
  assert.equal(parseRedfinLine(line({ ...zipRow, IS_SEASONALLY_ADJUSTED: 'true' }), cols), null);
  assert.equal(parseRedfinLine(line({ ...zipRow, PERIOD_END: '2015-05-31' }), cols), null);
  assert.equal(parseRedfinLine(line({ ...zipRow, PROPERTY_TYPE: 'Mobile' }), cols), null);
  const county = parseRedfinLine(line({ ...zipRow, PERIOD_DURATION: '30', REGION_TYPE: 'county', REGION: 'Durham County, NC', PARENT_METRO_REGION: 'Durham, NC', PROPERTY_TYPE: 'All Residential' }), cols)!;
  assert.equal(county.region, 'Durham County, NC');
  assert.equal(county.propertyType, 'all');
});

test('hot, balanced or slow', () => {
  assert.equal(marketHeat({ monthsOfSupply: 2.4, medianDom: 40 }), 'hot');
  assert.equal(marketHeat({ monthsOfSupply: 4, medianDom: 40 }), 'balanced');
  assert.equal(marketHeat({ monthsOfSupply: 7, medianDom: 10 }), 'slow');
  assert.equal(marketHeat({ monthsOfSupply: null, medianDom: 75 }), 'slow');
  assert.equal(marketHeat({ monthsOfSupply: null, medianDom: null }), null);
});

test('Raleigh’s permits: new homes and demolitions, builder and place', () => {
  const r = permitSources.raleigh.map({ geometry: { x: -78.534812131, y: 35.720963782 }, attributes: { permitnum: 'BLDR-038528-2026', workclass: 'Townhouse', issueddate: Date.UTC(2026, 8, 30, 15), originaladdress1: '7031 Dolmen Dr', originalcity: 'RALEIGH', originalzip: '27610-1234',
    estprojectcost: 254127.39, totalsqft: 0, housingunitstotal: null, contractorcompanyname: 'D.R. Horton, Inc. T/A Emerald Homes', proposedworkdescription: 'Townhomes, 5 units', statuscurrentmapped: 'Permit Issued', latitude_perm: 35.82, longitude_perm: -78.68 } })!; // latitude_perm can be another spot: the geometry wins
  assert.equal(r.kind, 'new_home');
  assert.equal(r.issuedOn, '2026-09-30');
  assert.equal(r.year, 2026);
  assert.equal(r.address, '7031 DOLMEN DR');
  assert.equal(r.city, 'Raleigh');
  assert.equal(r.zip, '27610');
  assert.equal(r.lat, 35.720964);
  assert.equal(r.sf, null);
  assert.equal(builderName(r.builder), 'D.R. Horton');
  assert.equal(builderName('LENNAR CAROLINAS, LLC'), 'Lennar Carolinas');
  assert.equal(builderName('MURDOCK GANNON CONSTRUCTION, I'), 'Murdock Gannon Construction');
  assert.equal(builderName('M I HOMES OF RALEIGH'), 'M I Homes of Raleigh');
  assert.equal(builderName('KB Home Raleigh-Durham Inc.'), 'KB Home Raleigh-Durham');
  // A new home that names the demolition before it: a rebuild on a teardown.
  const d = permitSources.raleigh.map({ attributes: { permitnum: 'BLDR-2', workclass: 'New Residential Dwelling', issueddate: Date.UTC(2026, 0, 5), proposedworkdescription: 'New Single Family Dwelling\nDEMO-009493-2023/Finaled 5/26', latitude_perm: 0, longitude_perm: 0 } })!;
  assert.equal(d.kind, 'rebuild');
  assert.equal(d.lat, null); // no place: kept, just not on the map
  assert.equal(permitSources.raleigh.map({ attributes: {} }), null);
});

test('Durham’s permits: demolitions with dates, new homes only (not pools or walls)', () => {
  const d = permitSources.durham_demo.map({ attributes: { PermitNum: '26102484', ISSUE_DATE: Date.UTC(2026, 4, 28), DESCRIPTION: 'SMPR- DEMOLITION OF SFD', BLD_Cost: 9500, SQFT_FLOOR: 1210, BLD_Type: 'Single Family House', PmtStatus: 'CO Issued' }, geometry: { x: -78.9, y: 35.99 } })!;
  assert.equal(d.kind, 'demolition');
  assert.equal(d.issuedOn, '2026-05-28');
  assert.equal(d.lat, 35.99);
  assert.equal(d.description, 'Single Family House: SMPR- DEMOLITION OF SFD');
  assert.equal(permitSources.durham_demo.map({ attributes: { PermitNum: '1', PmtStatus: 'Void' } }), null);
  const n = permitSources.durham_new.map({ attributes: { Permit_ID: '26103054', P_Descript: 'Lot 9 Colvard Woods - New SFD.', P_Status: 'ISS', SiteAdd: '105 Kyleway Dr' }, geometry: { x: -78.95, y: 35.87 } })!;
  assert.equal(n.year, 2026);
  assert.equal(n.issuedOn, null);
  assert.equal(n.status, 'Issued');
  assert.equal(permitSources.durham_new.map({ attributes: { Permit_ID: '21104922', P_Descript: 'Retaining Wall Installation' } }), null);
  assert.ok(isNewHome('Townhomes, 5 units'));
  assert.ok(!isNewHome('SMPR - 16 X 25 POOL SPA COMBO with SFD'));
});

test('permits near a point', () => {
  const at = { lat: 35.8, lng: -78.64 };
  const ps = [{ ...at, kind: 'new_home' }, { lat: 35.804, lng: -78.64, kind: 'demolition' }, { lat: 35.82, lng: -78.64, kind: 'new_home' }];
  assert.deepEqual(permitsNear(at, ps), { newHomes: 1, teardowns: 1 }); // 35.804 is about 0.28 mi; 35.82 about 1.4 mi
  assert.deepEqual(permitsNear(at, ps, 2), { newHomes: 2, teardowns: 1 });
  assert.deepEqual(permitsNear(at, [{ ...at, kind: 'rebuild' }]), { newHomes: 1, teardowns: 1 }); // a rebuild is both
});

test('builders: national by name, large by volume, everyone else local', async () => {
  const { builderBucket, LARGE_BUILDER_PERMITS } = await import('./market-feeds');
  assert.equal(builderBucket('Lennar Carolinas', 3), 'national');
  assert.equal(builderBucket('D.R. Horton', 3), 'national');
  assert.equal(builderBucket('M I Homes of Raleigh', 1), 'national');
  assert.equal(builderBucket('Homes by Dickerson', 12), 'local');
  assert.equal(builderBucket('Murdock Gannon Construction', LARGE_BUILDER_PERMITS), 'large');
  assert.equal(builderBucket(null, 0), 'local');
});

test('a builder’s record: permit to sale, $/sf, quick sellers', async () => {
  const { builderRecord } = await import('./market-feeds');
  const h = (issuedOn: string, soldOn: string | null, price: number | null, sf = 2500) => ({ issuedOn, soldOn, price, sf });
  const r = builderRecord([h('2025-01-01', '2025-08-01', 1_000_000), h('2025-02-01', '2025-10-01', 1_100_000), h('2025-03-01', '2025-11-01', 950_000), h('2025-06-01', null, null)]);
  assert.equal(r.homes, 4);
  assert.equal(r.sold, 3);
  assert.equal(r.medianDays, 242); // Feb 1 → Oct 1
  assert.equal(r.medianPsf, 400);
  assert.equal(r.quick, true);
  // Slow: half take over 300 days.
  assert.equal(builderRecord([h('2024-01-01', '2025-03-01', 900000), h('2024-01-01', '2025-04-01', 900000), h('2024-01-01', '2025-05-01', 900000)]).quick, false);
  // A sale before the permit (the old house) isn't counted.
  assert.equal(builderRecord([h('2025-06-01', '2025-01-01', 500000)]).medianDays, null);
});

test('local builders near a point, most permits first', async () => {
  const { buildersNear } = await import('./market-feeds');
  const at = { lat: 35.8, lng: -78.64 };
  const ps = [
    { ...at, kind: 'new_home', builder: 'Local A', bucket: 'local' }, { ...at, kind: 'rebuild', builder: 'Local A', bucket: 'local' },
    { ...at, kind: 'new_home', builder: 'Local B', bucket: 'local' }, { ...at, kind: 'new_home', builder: 'Lennar', bucket: 'national' },
    { lat: 35.83, lng: -78.64, kind: 'new_home', builder: 'Far Away', bucket: 'local' }, { ...at, kind: 'demolition', builder: null, bucket: null },
  ];
  assert.deepEqual(buildersNear(at, ps), [{ name: 'Local A', count: 2 }, { name: 'Local B', count: 1 }]);
  assert.deepEqual(buildersNear(at, ps, 'national'), [{ name: 'Lennar', count: 1 }]);
});
