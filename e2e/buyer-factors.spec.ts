import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, who: string) {
  await page.goto('/signin');
  await page.getByRole('button', { name: new RegExp(who) }).click();
  await page.waitForURL('/');
}

test('Buyer Factors: the rate gate, what buyers pay for measured from sales, and the same for one ZIP', async ({ page }) => {
  const s = Date.now().toString().slice(-4);
  const zip = `3${s}`;
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  await db.query(`delete from market_sales where parcel_id in (select id from market_parcels where zip = $1)`, [zip]);
  await db.query(`delete from market_parcels where zip = $1`, [zip]);
  await db.query(`insert into market_rates (series, week, rate) values ('30yr', '2026-09-24', 6.3) on conflict (series, week) do update set rate = excluded.rate`);
  // 120 made-up sales in a made-up ZIP: bigger and newer homes sell for more.
  const year = new Date().getFullYear();
  for (let i = 0; i < 120; i++) {
    const sf = 1400 + (i % 12) * 200, built = i % 4 === 0 ? year : 1990 + (i % 7), acres = 0.15 + (i % 5) * 0.1;
    const price = Math.round(220 * sf * (built === year ? 1.2 : 1) * (1 + (i % 5) * 0.02));
    const p = await db.query(`insert into market_parcels (county, parcel_key, address, city, zip, land_use, heated_sf, year_built, acres, lat, lng)
      values ('wake', $1, $2, 'Raleigh', $3, 'single_family', $4, $5, $6, 35.7, -78.7) returning id`, [`BF${zip}${i}`, `${i} BUYER ST`, zip, sf, built, acres]);
    const sold = new Date(Date.now() - (20 + (i % 20) * 30) * 86400000).toISOString().slice(0, 10);
    await db.query(`insert into market_sales (parcel_id, sold_on, price, heated_sf) values ($1, $2, $3, $4)`, [p.rows[0].id, sold, price, sf]);
  }
  // Redfin's months for a made-up county: busier in spring, slower when the rate was higher.
  await db.query(`delete from market_trends where region_type = 'county' and region like 'Testmarket%'`);
  for (let i = 0; i < 48; i++) {
    const y = 2016 + Math.floor(i / 12), m = (i % 12) + 1;
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const rate = 4 + (i / 48) * 2 + 1.2 * Math.sin(i / 5); // rates go up and down, not in a straight line like the trend
    await db.query(`insert into market_rates (series, week, rate) values ('30yr', $1, $2) on conflict (series, week) do update set rate = excluded.rate`, [`${y}-${String(m).padStart(2, '0')}-10`, rate.toFixed(2)]);
    const sold = Math.round(500 * (m >= 4 && m <= 7 ? 1.4 : m === 1 ? 0.8 : 1) * Math.exp(-0.08 * rate) * (1 + (i % 5) * 0.01));
    // National confidence and stocks for the month (made up; no source is called in tests).
    for (const [series, value] of [['sentiment', 60 + 10 * Math.sin(i / 6)], ['stocks', 4000 + 400 * Math.sin(i / 4)], ['cpi', 280 * Math.exp(0.03 * i / 12 + 0.01 * Math.sin(i / 5))]] as const)
      await db.query(`insert into market_econ (series, period, value) values ($1, $2, $3) on conflict (series, period) do update set value = excluded.value`, [series, `${y}-${String(m).padStart(2, '0')}-01`, value.toFixed(2)]);
    await db.query(`insert into market_trends (region_type, region, property_type, period_end, homes_sold, new_listings, median_sale_price)
      values ('county', $1, 'all', $2, $3, $4, $5) on conflict do nothing`, [`Testmarket${s} County, NC`, end, sold, Math.round(650 * (1 + 0.2 * Math.sin(i / 3))) /* listings move on their own, not in lockstep with sales */, 400000 + i * 1000]);
  }
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto('/market');
  await page.getByRole('link', { name: 'Buyer Factors' }).click();
  await page.waitForURL('**/market/buyers');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Buyer Factors');
  // The gate: what a point on the rate does.
  await expect(page.locator('.trend-sentence').first()).toContainText('each 1-point rise in the 30-year rate cuts what a buyer can borrow on the same payment by about 9.7%');
  // What moves the whole market: each factor's face value and its share, adding to 100% with what isn't explained.
  const market = page.locator('section', { hasText: '2. What Moves the Whole Market' }).first();
  await expect(async () => {
    await page.reload();
    await expect(market.locator('tr', { hasText: 'Buyer confidence' })).toBeVisible({ timeout: 2000 });
    await expect(market.locator('tr', { hasText: 'Mortgage rate' })).toContainText(/fewer sales/, { timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  await expect(market.locator('tr', { hasText: 'Mortgage rate' })).toContainText(/Each 1-point rise in the 30-year rate: [\d.]+% fewer sales/);
  await expect(market.locator('tr', { hasText: 'Time of year' })).toContainText(/sells [\d.]+% more homes than January/);
  await expect(market.locator('tr', { hasText: 'Buyer confidence' })).toContainText(/10 points more consumer confidence: [\d.]+% (more|fewer) sales the next month/);
  await expect(market.locator('tr', { hasText: 'Stock market' })).toContainText(/Stocks 10% higher/);
  const shares = (await market.locator('.sb-num').allTextContents()).map((v) => Number(v.replace('%', '')));
  expect(Math.round(shares.reduce((a, b) => a + b, 0))).toBeGreaterThanOrEqual(99);
  // Who is buying, as shares of the market.
  await expect(page.locator('section', { hasText: '3. Who Is Buying' }).first().locator('.tile', { hasText: 'New Construction' })).toContainText('%');
  // What they pay for: a bar per factor, adding to about 100%.
  const bars = page.locator('section', { hasText: '4. What They Pay For' }).first().locator('.factor-bars li');
  await expect(bars.first()).toBeVisible({ timeout: 30_000 });
  const values = (await page.locator('section', { hasText: '4. What They Pay For' }).first().locator('.fb-value').allTextContents()).map((v) => Number(v.replace('%', '')));
  expect(Math.round(values.reduce((a, b) => a + b, 0))).toBeGreaterThanOrEqual(99);
  await expect(page.locator('.zip-story')).toContainText('Each extra 100 sq ft adds about $');
  // The model is cached (a second in tests, served once more while it refreshes): reload until it has this run's ZIP.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('link', { name: zip, exact: true })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });

  // The same, measured inside the one ZIP.
  await page.getByRole('link', { name: zip, exact: true }).click();
  await page.waitForURL(`**/market/zip/${zip}`);
  const here = page.locator('section', { hasText: 'What Buyers Pay For Here' }).first();
  await expect(async () => {
    await page.reload();
    await expect(here).toContainText('Each extra 100 sq ft adds about $', { timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  await expect(here).toContainText('Each extra 100 sq ft adds about $');
  await expect(here).toContainText(/A new home sells for (19|20|21)(\.\d)?% more than an 11–30-year-old one/);
});
