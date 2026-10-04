import { test } from 'node:test';
import assert from 'node:assert/strict';
import { econUrls, parseBls, parseCensusCounties, parseFredMonthly, parseSentiment, parseStooq } from './econ-sources';

test('BLS: monthly values for our series, the yearly average and unknown series skipped', () => {
  const json = { status: 'REQUEST_SUCCEEDED', Results: { series: [
    { seriesID: 'SMU37395800000000001', data: [{ year: '2026', period: 'M08', periodName: 'August', value: '751.2' }, { year: '2025', period: 'M13', value: '740.0' }] },
    { seriesID: 'LAUMT373958000000003', data: [{ year: '2026', period: 'M07', value: '3.4' }] },
    { seriesID: 'XYZ', data: [{ year: '2026', period: 'M01', value: '1' }] },
  ] } };
  assert.deepEqual(parseBls(json), [{ series: 'jobs_raleigh', period: '2026-08-01', value: 751.2 }, { series: 'unemp_raleigh', period: '2026-07-01', value: 3.4 }]);
  assert.deepEqual(parseBls({ status: 'REQUEST_NOT_PROCESSED', message: ['daily threshold'] }), []);
});

test('University of Michigan sentiment, with title lines above the header', () => {
  const csv = 'Surveys of Consumers\nMonth,YYYY,ICS_ALL\nJanuary,2026,71.7\nFebruary,2026,64.7\nMarch,2026,\n';
  assert.deepEqual(parseSentiment(csv), [{ series: 'sentiment', period: '2026-01-01', value: 71.7 }, { series: 'sentiment', period: '2026-02-01', value: 64.7 }]);
});

test('FRED and Stooq monthly', () => {
  assert.deepEqual(parseFredMonthly('observation_date,UMCSENT\n2026-08-01,58.2\n2026-09-01,.\n', 'sentiment'), [{ series: 'sentiment', period: '2026-08-01', value: 58.2 }]);
  assert.deepEqual(parseStooq('Date,Open,High,Low,Close,Volume\n2026-08-29,6300,6500,6200,6450.5,1\n2026-09-30,6450,6600,6400,6580,1\n'), [{ series: 'stocks', period: '2026-08-01', value: 6450.5 }, { series: 'stocks', period: '2026-09-01', value: 6580 }]);
  assert.deepEqual(parseStooq('No data'), []);
});

test('Census: net migration per 1,000 residents for our counties only', () => {
  const csv = 'SUMLEV,REGION,DIVISION,STATE,COUNTY,STNAME,CTYNAME,POPESTIMATE2023,POPESTIMATE2024,NETMIG2023,NETMIG2024\n'
    + '050,3,5,37,183,North Carolina,Wake County,1190000,1210000,20230,21780\n'
    + '050,3,5,37,001,North Carolina,Alamance County,180000,182000,2000,2100\n'
    + '050,3,5,06,183,California,Nowhere,1,1,1,1\n';
  assert.deepEqual(parseCensusCounties(csv), [{ series: 'migration:Wake County, NC', period: '2023-07-01', value: 17 }, { series: 'migration:Wake County, NC', period: '2024-07-01', value: 18 }]);
});

test('the sources', () => {
  const u = econUrls('2026-10-04');
  assert.equal(u.blsBody.startyear, '2017');
  assert.equal(u.blsBody.seriesid.length, 5);
});
