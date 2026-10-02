import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, who: string) {
  await page.goto('/signin');
  await page.getByRole('button', { name: new RegExp(who) }).click();
  await page.waitForURL('/');
}

const stamp = Date.now().toString().slice(-6);

test('log a GC you met, with who introduced them', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/people/new');
  await page.getByLabel('First Name', { exact: true }).fill('Riley');
  await page.getByLabel('Last Name', { exact: true }).fill(`Builder${stamp}`);
  await page.getByLabel('Mobile or Main Phone').fill(`919555${stamp.slice(-4)}`);
  await page.getByLabel('What They Are to Us').selectOption('gc');
  await page.getByLabel('How We Know Them').selectOption('introduction');
  await page.getByLabel(/Or Introducer Not on File/).fill(`Jordan Intro${stamp}`);
  await page.getByLabel('About the Introduction').fill('Met through Jordan at the REIA meetup.');
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Riley Builder${stamp}`);
  await expect(page.getByText('General Contractor · Met')).toBeVisible();
  const personUrl = page.url();
  await page.getByRole('link', { name: `Jordan Intro${stamp}` }).click();
  await page.getByRole('link', { name: /Introductions/ }).click();
  await expect(page.getByText('Met through Jordan at the REIA meetup.')).toBeVisible();
  await page.goto(personUrl);
  await page.getByRole('link', { name: 'Log a Touch' }).first().click();
  await page.locator('select[name=kind]').selectOption('site_walk');
  await page.getByLabel('What Happened').fill('Walked the lot together.');
  await page.getByRole('button', { name: 'Log It' }).click();
  await expect(page.getByText('Logged.')).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByText(/logged a site walk/)).toBeVisible();
});

test('add a watched lot, then mark it sold as a comparable', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/watchlist/new');
  await page.getByLabel('Address').fill(`${stamp} Oakwood Ave`);
  await page.getByLabel('Asking Price').fill('425k');
  await page.getByLabel('Lot Size (sq ft)').fill('8,000');
  await page.getByLabel('Zoning').fill('r-10');
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${stamp} Oakwood Ave`);
  await expect(page.getByText('$53.13')).toBeVisible();
  await page.getByLabel('Sold For').fill('440,000');
  await page.getByLabel('Sold On').fill('2026-09-30');
  await page.getByRole('button', { name: 'Mark Sold' }).click();
  await expect(page.getByText(/stays searchable as a comparable/)).toBeVisible();
  await page.goto('/watchlist?view=comps');
  await expect(page.getByRole('link', { name: `${stamp} Oakwood Ave` })).toBeVisible();
});

test("109 Plainview's budget, a split GC bill, and the lien waiver rule", async ({ page }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/projects');
  await page.getByRole('link', { name: '109 Plainview Ave' }).first().click();
  await expect(page.getByText('Build Budget')).toBeVisible();
  await page.getByRole('link', { name: 'Budget', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Edit Budget' })).toBeVisible();
  await expect(page.getByText('$818,710').first()).toBeVisible();
  await expect(page.getByText('$973,201').first()).toBeVisible();
  await expect(page.getByText('Outdoor patio fireplace')).toBeVisible();
  await page.getByRole('link', { name: /^Bills/ }).click();
  await page.getByLabel('Or Vendor Name').fill(`Test GC ${stamp}`);
  await page.getByLabel('Invoice #').fill(stamp);
  await page.getByLabel('Line 1 description').fill('Framing labor');
  await page.getByLabel('Line 1 cost code').selectOption({ label: '08 Framing' });
  await page.getByLabel('Line 1 amount').fill('1,300');
  await page.getByLabel('Line 2 description').fill('Power bill');
  await page.getByLabel('Line 2 kind').selectOption('holding');
  await page.getByLabel('Line 2 holding kind').selectOption('Utilities');
  await page.getByLabel('Line 2 amount').fill('64.94');
  await page.getByRole('button', { name: 'Save Bill' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  const bill = page.locator('li', { hasText: `Test GC ${stamp} #${stamp}` });
  await expect(bill.getByText('$1,364.94')).toBeVisible();
  await bill.getByRole('button', { name: 'Approve' }).click();
  await expect(bill.getByText(/lien waiver is needed/)).toBeVisible();
  await bill.getByRole('button', { name: 'Lien Waiver Received' }).click();
  await bill.getByRole('button', { name: 'Mark Paid' }).click();
  await expect(bill.getByText('Paid', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByText(`entered a bill for $1,364.94 (#${stamp}) in 2 lines`)).toBeVisible();
});

test('the accountant sees projects and money, not contacts', async ({ page }) => {
  await signIn(page, 'Sample Accountant');
  await page.goto('/people');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await page.goto('/projects');
  await expect(page.getByRole('link', { name: '109 Plainview Ave' }).first()).toBeVisible();
});
