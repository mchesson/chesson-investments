import { expect, test, type Page, type Locator } from '@playwright/test';

async function signIn(page: Page, who: string) {
  await page.goto('/signin');
  await page.getByRole('button', { name: new RegExp(who) }).click();
  await page.waitForURL('/');
}
async function pick(scope: Page | Locator, name: string, text: string) {
  const box = scope.locator(`.picker:has(input[type=hidden][name="${name}"])`);
  await expect(async () => {
    await box.getByRole('combobox').fill(text);
    await box.getByRole('option', { name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click({ timeout: 2000 });
  }).toPass();
}

test('Trip Log: a trip by odometer on the property’s timeline, I’m Here from the phone’s location, and the year both ways', async ({ page, context }) => {
  const s = Date.now().toString().slice(-6);
  const year = new Date().getFullYear();
  const lat = 35.6 + Number(s.slice(-3)) / 100000, lng = -78.9;
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  // Earlier runs' made-up properties would be near too: take them off the map first.
  await db.query(`update projects set lat = null, lng = null where name like '% Odometer Rd'`);
  const p = await db.query(`insert into projects (name, address, lat, lng) values ($1, $1, $2, $3) returning id`, [`${s} Odometer Rd`, lat, lng]);
  const pid = p.rows[0].id;
  const ent = (await db.query(`select id, name from entities where archived_at is null order by name limit 1`)).rows[0];

  await signIn(page, 'Sample Owner');
  // A vehicle, and its odometer for the year.
  await page.goto('/trips');
  await page.locator('summary', { hasText: 'Add a Vehicle' }).click();
  await page.locator('input[name=name]').fill(`Tahoe ${s}`);
  await page.getByRole('button', { name: 'Add the Vehicle' }).click();
  await expect(page.locator('.toast', { hasText: 'Saved' })).toBeVisible();
  const car = page.locator('li', { hasText: `Tahoe ${s}` });
  await car.locator('input[name=startMiles]').fill('10000');
  await car.locator('input[name=endMiles]').fill('20000');
  await car.getByRole('button', { name: `Save ${year} Odometer` }).click();
  await expect(page.locator('.toast', { hasText: 'Saved' }).last()).toBeVisible();
  // The standard rate for this year (the owner adds it each December).
  await page.locator('input[name=rateYear]').fill(String(year));
  await page.locator('input[name=rate]').fill('0.70');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();
  await expect(page.locator('.toast', { hasText: 'Saved' }).last()).toBeVisible();

  // A trip from the project's own button: the property is already picked; miles from the odometer.
  await page.goto(`/projects/${pid}`);
  await page.locator('main').getByRole('link', { name: 'Log a Trip' }).click();
  await page.waitForURL(/\/trips\?project=/);
  const form = page.locator('.trip-form');
  await expect(form.getByRole('combobox', { name: /Where/ })).toHaveValue(`${s} Odometer Rd`);
  await form.locator('input[name=purpose]').fill(`Checked framing ${s} with the GC`);
  await form.locator('input[name=startOdometer]').fill('10200');
  await form.locator('input[name=endOdometer]').fill('10236');
  await form.locator('select[name=vehicleId]').selectOption({ label: `Tahoe ${s}` });
  await form.getByRole('button', { name: 'Log the Trip' }).click();
  await expect(page.locator('.toast', { hasText: 'Logged: 36 miles' })).toBeVisible();
  await page.reload();
  await expect(page.locator('tr', { hasText: `Checked framing ${s}` })).toContainText('odometer 10,200–10,236');
  // On the property's Timeline, with who.
  await page.goto(`/projects/${pid}?tab=timeline`);
  await expect(page.locator('.tl', { hasText: `Trip here: Checked framing ${s}` })).toContainText('36 mi');

  // I'm Here: the phone is at the property.
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: lat + 0.0005, longitude: lng });
  await page.goto('/trips');
  await page.getByRole('button', { name: 'I’m Here' }).click();
  await expect(page.locator('.trip-form .notice')).toContainText(`You’re at ${s} Odometer Rd`);
  await expect(page.locator('.trip-form').getByRole('combobox', { name: /Where/ })).toHaveValue(`${s} Odometer Rd`);

  // Car costs tagged to the vehicle, then the year both ways.
  await page.goto('/overhead');
  const add = page.locator('section', { hasText: 'Add One by Hand' }).last();
  await add.locator('select[name=entityId]').selectOption(ent.id);
  await add.locator('input[name=vendor]').fill(`Gas ${s}`);
  await add.locator('input[name=amount]').fill('9000');
  await add.locator('select[name=category]').selectOption('vehicle');
  await add.locator('select[name=vehicleId]').selectOption({ label: `Tahoe ${s}` });
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.toast', { hasText: 'Added' })).toBeVisible();
  await page.goto(`/trips/report?year=${year}`);
  const row = page.locator('section', { hasText: 'Both Ways, by Vehicle' }).first().locator('tr', { hasText: `Tahoe ${s}` });
  await expect(row).toContainText('36'); // business miles
  await expect(row).toContainText('10,000'); // odometer miles
  await expect(row).toContainText('0.4%'); // business share
  await expect(row).toContainText('$25.20'); // 36 × $0.70
  await expect(row).toContainText('$32.40'); // $9,000 × 0.36%
  await expect(row).toContainText('Actual costs');
  // The log as a file.
  const res = await page.request.get(`/trips/report/csv?year=${year}`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain(`"Checked framing ${s} with the GC","36","odometer"`);
  await db.end();
});
