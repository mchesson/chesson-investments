import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, who: string) {
  await page.goto('/signin');
  await page.getByRole('button', { name: new RegExp(who) }).click();
  await page.waitForURL('/');
}

test('type a ZIP code on the Market Map and see what’s happening there, in plain words', async ({ page }) => {
  const s = Date.now().toString().slice(-4);
  const zip = `2${s}`;
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  // A made-up ZIP: clear anything an earlier run left in it.
  await db.query(`delete from market_sales where parcel_id in (select id from market_parcels where zip = $1)`, [zip]);
  await db.query(`delete from market_parcels where zip = $1`, [zip]);
  await db.query(`delete from market_permits where zip = $1`, [zip]);
  await db.query(`delete from market_trends where region_type = 'zip' and region = $1`, [zip]);
  const day = (back: number) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
  // 6 sales this year, 3 the year before, in one neighborhood.
  for (let i = 0; i < 9; i++) {
    const p = await db.query(`insert into market_parcels (county, parcel_key, address, street, city, zip, neighborhood, land_use, heated_sf, lat, lng)
      values ('wake', $1, $2, 'ZIPTEST ST', 'Raleigh', $3, 'Ziptest Park', 'single_family', 2000, 35.8 + $4 / 10000.0, -78.6) returning id`, [`ZT${zip}${i}`, `${100 + i} ZIPTEST ST`, zip, i]);
    await db.query(`insert into market_sales (parcel_id, sold_on, price, heated_sf) values ($1, $2, $3, 2000)`, [p.rows[0].id, i < 6 ? day(20 + i * 30) : day(400 + i * 20), i < 6 ? 800000 : 700000]);
  }
  await db.query(`insert into market_trends (region_type, region, property_type, period_end, median_dom, months_of_supply, sale_to_list, price_drops, inventory, median_sale_price, median_ppsf, homes_sold)
    values ('zip', $1, 'all', $2, 12, 1.5, 1.02, 0.18, 7, 800000, 400, 6)`, [zip, day(35)]);
  await db.query(`insert into market_permits (source, county, permit_no, kind, issued_on, year, address, city, zip, builder)
    values ('raleigh', 'wake', $1, 'new_home', $2, $3, '1 ZIPTEST ST', 'Raleigh', $4, 'ZIPTEST HOMES LLC')`, [`ZT-${zip}`, day(60), Number(day(60).slice(0, 4)), zip]);
  const proj = await db.query(`insert into projects (name, address, zip) values ($1, $1, $2) returning id`, [`${s} Ziptest Ct`, zip]);
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto('/market');
  await page.getByRole('textbox', { name: 'ZIP code' }).fill(zip);
  await page.getByRole('button', { name: 'Look Up' }).click();
  await page.waitForURL(`**/market/zip/${zip}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`What’s Happening in ${zip}`);
  const words = page.locator('.zip-story');
  await expect(page.locator('.trend-sentence')).toContainText(`${zip}: seller’s market, more homes selling than a year ago.`);
  await expect(words).toContainText('Homes are going under contract in a median 12 days, with 1.5 months of supply, selling at 102% of list.');
  await expect(words).toContainText('6 sales recorded by the county in the last 12 months, up 100% from 3 the year before.');
  await expect(words).toContainText('Median sale $800k, up 14% from $700k; $400/sf (up 14% from $350 the year before).');
  await expect(words).toContainText('1 new home and 0 teardowns permitted in the last 12 months; Ziptest Homes is building the most (1).');
  await expect(words).toContainText('We have 1 project here.');
  await expect(page.getByRole('row', { name: /^Ziptest Park 6 / })).toBeVisible();
  await expect(page.getByRole('link', { name: `${s} Ziptest Ct` })).toHaveAttribute('href', `/projects/${proj.rows[0].id}`);

  // A ZIP typed wrong says so.
  await page.goto('/market');
  await page.getByRole('textbox', { name: 'ZIP code' }).fill('abc');
  await page.getByRole('textbox', { name: 'ZIP code' }).evaluate((el) => el.removeAttribute('pattern'));
  await page.getByRole('button', { name: 'Look Up' }).click();
  await expect(page.locator('.notice.error', { hasText: 'Type a 5-digit ZIP code' })).toBeVisible();
});
