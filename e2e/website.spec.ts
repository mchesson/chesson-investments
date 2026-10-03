import { expect, test, type Locator, type Page } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';

/** Taps one of a Choice's buttons (src/components/Choice.tsx). */
const choose = (scope: Page | Locator, name: string, value: string) => scope.locator(`label.choice-opt:has(input[name="${name}"][value="${value}"])`).click();


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
  if (await page.locator('input[name=siteStatus]:checked').getAttribute('value') || await page.getByText(/It’s on the website/).count()) {
    await choose(page, 'siteStatus', '');
    await page.getByRole('button', { name: 'Save the Page' }).click();
  }
  await expect(page.getByText(/Not on the website\./)).toBeVisible();

  // A photo made on the spot, marked for the website.
  await page.locator('input[name=files]').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: uniquePng() });
  await choose(page.locator('form:has(input[name=files])'), 'kind', 'after');
  await page.getByRole('button', { name: 'Add Photos' }).click();
  await expect(page.getByText('Added 1 of 1.')).toBeVisible();

  await choose(page, 'siteStatus', 'for_sale');
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
  await choose(page, 'siteStatus', '');
  await page.getByRole('button', { name: 'Save the Page' }).click();
  await expect(page.getByText('Saved. It isn’t on the website.')).toBeVisible();
  expect((await request.get('/site/projects/109-plainview-e2e')).status()).toBe(404);
  expect((await request.get(src!, { headers: { 'cache-control': 'no-cache' } })).status()).toBe(404);
  await page.getByRole('link', { name: 'History' }).last().click();
  await expect(page.getByText('set its website status to For Sale').first()).toBeVisible();
  await expect(page.getByText('took it off the website').first()).toBeVisible();
  await pub.close();
});

test('the website’s top bar, its pages and both forms reach Website Leads', async ({ page, request }) => {
  const stamp = Date.now().toString().slice(-6);
  // Each run is its own visitor address, so the per-address limit on forms doesn't carry over between runs.
  const ip = `10.${Number(stamp.slice(0, 2))}.${Number(stamp.slice(2, 4))}.${Number(stamp.slice(4))}`;
  const pub = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'x-forwarded-for': ip } });
  const visitor = await pub.newPage();
  // Arrives from a link with utm tags: the lead remembers where they came from.
  await visitor.goto('/site?utm_source=e2e-mailer&utm_medium=email');
  const bar = visitor.getByRole('navigation', { name: 'Main' });
  for (const name of ['Projects', 'What We Do', 'About', 'Contact', 'Sell Us Your Property']) await expect(bar.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(bar.getByRole('link', { name: '(919) 795-8948' })).toBeVisible();
  await expect(visitor.locator('footer')).toContainText('© ');
  for (const [link, heading] of [['What We Do', 'Three ways we build value'], ['About', 'About Chesson Investments'], ['Projects', 'Our work']] as const) {
    await bar.getByRole('link', { name: link, exact: true }).click();
    await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(bar.getByRole('link', { name: link, exact: true })).toHaveAttribute('aria-current', 'page');
  }

  // Contact Us: an error keeps what was typed, then the thank-you.
  await bar.getByRole('link', { name: 'Contact', exact: true }).click();
  await visitor.getByLabel('Your Name').fill(`Casey Contact${stamp}`);
  await visitor.getByLabel('Your Message').fill('Do you build custom homes on our own lot?');
  await visitor.getByRole('button', { name: 'Send the Message' }).click();
  await expect(visitor.locator('.form-error')).toContainText('email address or a phone number');
  await expect(visitor.getByLabel('Your Name')).toHaveValue(`Casey Contact${stamp}`);
  await visitor.getByLabel('Email', { exact: true }).fill(`casey${stamp}@example.com`);
  await visitor.locator('.pills label', { hasText: 'Working With Us' }).click();
  await visitor.getByRole('button', { name: 'Send the Message' }).click();
  await expect(visitor.locator('.thanks')).toContainText('Your message reached us');

  // Sell Us Your Property.
  await bar.getByRole('link', { name: 'Sell Us Your Property', exact: true }).click();
  await visitor.getByLabel('Your Name').fill(`Sam Seller${stamp}`);
  await visitor.getByLabel('Phone', { exact: true }).fill(`(919) 555-${stamp.slice(-4)}`);
  await visitor.getByLabel('Property Address').fill(`${stamp} Ridge Rd`);
  await visitor.getByLabel('City', { exact: true }).fill('Raleigh');
  await visitor.locator('.pills label', { hasText: 'Teardown' }).first().click();
  await visitor.locator('.pills label', { hasText: 'Should Come Down' }).click();
  await visitor.locator('.pills label', { hasText: 'Just Exploring' }).click();
  await visitor.getByLabel(/Asking Price/).fill('300k');
  await visitor.getByRole('button', { name: 'Send the Property' }).click();
  await expect(visitor.locator('.thanks')).toContainText('We have the details of your property');

  // A bot filling the hidden field gets thanked and nothing is kept (checked on the Leads page below).
  await visitor.goto('/site/contact');
  await visitor.getByLabel('Your Name').fill(`Bot Spam${stamp}`);
  await visitor.getByLabel('Email', { exact: true }).fill('bot@example.com');
  await visitor.getByLabel('Your Message').fill('Buy now');
  await visitor.locator(`input[name=company_website]`).fill('http://spam.example', { force: true });
  await visitor.getByRole('button', { name: 'Send the Message' }).click();
  await expect(visitor.locator('.thanks')).toContainText('Thank you');

  // The sitemap lists the new pages.
  const map = await (await request.get('/site/sitemap.xml')).text();
  for (const p of ['/sell', '/contact', '/about', '/what-we-do', '/projects']) expect(map).toContain(`https://chessoninvestments.com${p}<`);
  await pub.close();

  // Staff see both on Website Leads, with where they came from.
  await signIn(page, 'Sample Owner');
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Website Leads');
  await expect(page.getByRole('link', { name: `Casey Contact${stamp}` })).toBeVisible();
  await expect(page.getByRole('link', { name: `Sam Seller${stamp}` })).toBeVisible();
  await expect(page.getByText(`Bot Spam${stamp}`)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Website Visits/ })).toBeVisible();
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Leads by Source' }) }).getByText('e2e-mailer')).toBeVisible();
  await page.getByRole('link', { name: 'Sell Us Your Property', exact: true }).click();
  await expect(page.getByRole('link', { name: `Casey Contact${stamp}` })).toHaveCount(0);

  // Work the sell lead: status, a note, then add the property to the watchlist.
  await page.getByRole('link', { name: `Sam Seller${stamp}` }).click();
  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Sam Seller${stamp}`);
  await expect(page.locator('main')).toContainText(`${stamp} Ridge Rd`);
  const leadUrl = page.url();
  await expect(page.locator('main')).toContainText('e2e-mailer');
  await choose(page, 'status', 'contacted');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.page-head .chip', { hasText: 'Contacted' })).toBeVisible();
  await page.getByRole('link', { name: 'Add to Watchlist' }).click();
  await expect(page.getByLabel('Address')).toHaveValue(`${stamp} Ridge Rd`);
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${stamp} Ridge Rd`);
  await expect(page.locator('main')).toContainText('Our Website');
  await page.goto(leadUrl);
  await expect(page.getByRole('link', { name: `${stamp} Ridge Rd` })).toBeVisible();
  await page.getByRole('link', { name: /^Notes/ }).click();
  await page.getByLabel('Note').fill('Called, left a message.');
  await page.getByRole('button', { name: 'Add the Note' }).click();
  await expect(page.locator('main .rows')).toContainText('Called, left a message.');

  // Create Person from the lead, through Add Person and its duplicate check.
  await page.getByRole('link', { name: 'Overview' }).click();
  await page.getByRole('link', { name: 'Create Person' }).click();
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Sam');
  await expect(page.getByLabel('Last Name', { exact: true })).toHaveValue(`Seller${stamp}`);
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Sam Seller${stamp}`);

  // History on the lead tells the whole story.
  await page.goto('/leads?kind=sell');
  await page.getByRole('link', { name: `Sam Seller${stamp}` }).click();
  await expect(page.locator('main').getByRole('link', { name: `Sam Seller${stamp}` })).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  const hist = page.locator('main');
  await expect(hist.getByText(/sent a property through the website/)).toBeVisible();
  await expect(hist.getByText(/moved it to Contacted \(was New\)/)).toBeVisible();
  await expect(hist.getByText(/added a note: Called, left a message\./)).toBeVisible();
  await expect(hist.getByText(/added .* Ridge Rd to the watchlist from this lead/)).toBeVisible();
  await expect(hist.getByText(new RegExp(`created Sam Seller${stamp} from this lead`))).toBeVisible();
  await expect(hist.getByText('via website form').first()).toBeVisible();
});

test('Website Settings: Google Analytics and Search Console go on the website only when set', async ({ page, request }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/leads/settings');
  await page.getByLabel(/^Google Analytics Measurement ID/).fill('UA-12345');
  await page.getByRole('button', { name: 'Save the Settings' }).click();
  await expect(page.locator('.notice.error')).toContainText('starts with G-');
  await page.getByLabel(/^Google Analytics Measurement ID/).fill('G-NOTREAL123');
  await page.getByLabel(/^Search Console Verification/).fill('<meta name="google-site-verification" content="e2eVerifyCode_123" />');
  await page.getByRole('button', { name: 'Save the Settings' }).click();
  await expect(page.locator('.notice').filter({ hasText: 'Saved.' })).toBeVisible();
  const html = await (await request.get('/site/about')).text();
  expect(html).toContain('googletagmanager.com/gtag/js?id=G-NOTREAL123');
  expect(html).toContain('e2eVerifyCode_123');
  // Never on the app's own pages.
  await page.goto('/leads');
  expect(await page.content()).not.toContain('googletagmanager');
  // Take them off again.
  await page.goto('/leads/settings');
  await page.getByLabel(/^Google Analytics Measurement ID/).fill('');
  await page.getByLabel(/^Search Console Verification/).fill('');
  await page.getByRole('button', { name: 'Save the Settings' }).click();
  await expect(page.locator('.notice').filter({ hasText: 'Saved.' })).toBeVisible();
  expect(await (await request.get('/site/about')).text()).not.toContain('googletagmanager');
  await expect(page.locator('main').getByText(/changed the website settings/).first()).toBeVisible();
});
