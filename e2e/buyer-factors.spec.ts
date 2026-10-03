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
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto('/market');
  await page.getByRole('link', { name: 'Buyer Factors' }).click();
  await page.waitForURL('**/market/buyers');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Buyer Factors');
  // The gate: what a point on the rate does.
  await expect(page.locator('.trend-sentence').first()).toContainText('each 1-point rise in the 30-year rate cuts what a buyer can borrow on the same payment by about 9.7%');
  // What they pay for: a bar per factor, adding to about 100%.
  const bars = page.locator('.factor-bars li');
  await expect(bars.first()).toBeVisible({ timeout: 30_000 });
  const values = (await page.locator('.fb-value').allTextContents()).map((v) => Number(v.replace('%', '')));
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
