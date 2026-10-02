import { expect, test, type Page } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';

/** A small PNG whose colour depends on the time, so each run uploads a new photo. */
function uniquePng(): Buffer {
  const w = 64, h = 48, t = Date.now();
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([t % 256, (t >> 8) % 256, (x * 4 + y) % 256], y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function signIn(page: Page, who: string) {
  await page.goto('/signin');
  await page.getByRole('button', { name: new RegExp(who) }).click();
  await page.waitForURL('/');
}

test('a project goes on the website with its photos, and comes off again', async ({ page, request }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/projects');
  await page.getByRole('link', { name: /109 Plainview/ }).first().click();
  await page.getByRole('link', { name: 'Website' }).click();
  // A run that stopped half way may have left it on the website: start from off.
  if (await page.getByLabel('Website Status').inputValue()) {
    await page.getByLabel('Website Status').selectOption('');
    await page.getByRole('button', { name: 'Save the Page' }).click();
  }
  await expect(page.getByText(/Not on the website\./)).toBeVisible();

  // A photo made on the spot, marked for the website.
  await page.locator('input[name=files]').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: uniquePng() });
  await page.locator('form:has(input[name=files])').getByLabel('They Are').selectOption('after');
  await page.getByRole('button', { name: 'Add Photos' }).click();
  await expect(page.getByText('Added 1 of 1.')).toBeVisible();

  await page.getByLabel('Website Status').selectOption('for_sale');
  await page.getByLabel(/^Price/).fill('1,250,000');
  await page.getByLabel(/^Web Address/).fill('109-plainview-e2e');
  await page.getByLabel(/^One Line/).fill('New construction in the Triangle.');
  await page.getByLabel('Description').fill('A new home, built from the ground up.');
  await page.getByLabel(/^Finishes and Selections/).fill('## Kitchen\nCounters: Quartz');
  await page.getByLabel(/^Project Team/).fill('General Contractor | Sample Builders | Pat Builder\nElectrical | Sample Electric | Full wiring');
  await page.getByRole('button', { name: 'Save the Page' }).click();
  await expect(page.getByText(/It’s on the website with \d+ photo/)).toBeVisible();

  // The public page, with no sign-in.
  const pub = await page.context().browser()!.newContext({ baseURL: page.url().replace(/(https?:\/\/[^/]+).*/, '$1') });
  const visitor = await pub.newPage();
  await visitor.goto('/site');
  await visitor.getByRole('link', { name: /109 Plainview/ }).click();
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(/109 Plainview/);
  await expect(visitor.getByText('$1,250,000')).toBeVisible();
  await expect(visitor.getByText('Sample Builders')).toBeVisible();
  await expect(visitor.getByText('Quartz')).toBeVisible();
  const src = await visitor.locator('.shot img').first().getAttribute('src');
  expect((await request.get(src!)).status()).toBe(200);
  // Nothing private: no costs, no budget words.
  await expect(visitor.getByText(/budget|contingency|lien/i)).toHaveCount(0);
  // The website's own address can't reach the app.
  expect((await request.get('/signin', { headers: { host: 'chessoninvestments.com' } })).status()).toBe(404);
  expect((await request.get('/', { headers: { host: 'chessoninvestments.com' } })).status()).toBe(200);

  // History records it, then it comes off.
  await page.getByLabel('Website Status').selectOption('');
  await page.getByRole('button', { name: 'Save the Page' }).click();
  await expect(page.getByText('Saved. It isn’t on the website.')).toBeVisible();
  expect((await request.get('/site/projects/109-plainview-e2e')).status()).toBe(404);
  expect((await request.get(src!, { headers: { 'cache-control': 'no-cache' } })).status()).toBe(404);
  await page.getByRole('link', { name: 'History' }).last().click();
  await expect(page.getByText('set its website status to For Sale').first()).toBeVisible();
  await expect(page.getByText('took it off the website').first()).toBeVisible();
  await pub.close();
});
