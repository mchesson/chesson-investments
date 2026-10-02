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
  // Roles are buttons: tick two.
  await page.getByLabel('General Contractor', { exact: true }).check();
  await page.getByLabel('Networking Contact', { exact: true }).check();
  await page.getByLabel('How We Know Them').selectOption('introduction');
  await page.getByLabel(/Or Introducer Not on File/).fill(`Jordan Intro${stamp}`);
  await page.getByLabel('About the Introduction').fill('Met through Jordan at the REIA meetup.');
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Riley Builder${stamp}`);
  await expect(page.getByText('Where we are with them: Met').first()).toBeVisible();
  await expect(page.locator('.page-head .chip', { hasText: 'General Contractor' })).toBeVisible();
  await expect(page.locator('.page-head .chip', { hasText: 'Networking Contact' })).toBeVisible();
  await expect(page.locator('.page-head')).not.toContainText('· Met');
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
  await expect(page.getByRole('heading', { name: '› Sold (Comparable)' })).toBeVisible();
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

test('import a file: preview first, then people, a sub through the GC and a bill', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const file = {
    source: 'test',
    companies: [
      { name: `GC Co ${stamp}`, role: 'gc' },
      { name: `Siding Co ${stamp}`, role: 'sub', trade: 'Siding', hiredThrough: `GC Co ${stamp}` },
    ],
    people: [{ name: `Emma Sub${stamp}`, company: `Siding Co ${stamp}`, phone: `919-361-${stamp.slice(-4)}`, howMet: 'job_site', lastContactOn: '2026-06-10' }],
    bills: [{ project: '109 Plainview Ave', vendor: `GC Co ${stamp}`, number: `X${stamp}`, date: '2026-09-01', lienWaiverRequired: true, lines: [{ costCode: '14', amount: '1300' }, { kind: 'fee', costCode: '26', amount: '260' }] }],
  };
  await page.goto('/admin/import');
  await page.getByLabel('Import File (.json)').setInputFiles({ name: 'test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.getByRole('button', { name: 'Import It' })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.getByText(/Imported 1 people, 2 companies, 0 projects, 1 bills and 0 photos/)).toBeVisible();
  await page.goto(`/people?q=Sub${stamp}`);
  await page.getByRole('link', { name: `Emma Sub${stamp}` }).click();
  await expect(page.getByText('Where we are with them: Hired').first()).toBeVisible();
  await expect(page.getByText(new RegExp(`Through GC Co ${stamp}`))).toBeVisible();
  await page.goto(`/companies?q=GC Co ${stamp}`);
  await page.getByRole('link', { name: `GC Co ${stamp}` }).click();
  await expect(page.getByText('Subs and Suppliers Through Them')).toBeVisible();
});

test('budget stages, a GC milestone and an owner-supplied commitment that moves with it', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/projects');
  await page.getByRole('link', { name: '109 Plainview Ave' }).first().click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/);
  const base = page.url().split('?')[0];
  await page.goto(`${base}?tab=budget`);
  await page.locator('select[name=kind]').selectOption('rough');
  await page.getByLabel('Prepared by').fill('Luxury Oaks');
  await page.getByRole('button', { name: "Save Today's Budget as This Stage" }).click();
  await expect(page.getByText('Saved as the Rough Estimate.')).toBeVisible();
  await page.locator('select[name=kind]').selectOption('approved');
  await page.getByRole('button', { name: "Save Today's Budget as This Stage" }).click();
  await expect(page.getByText('Approved: this is now the baseline.')).toBeVisible();
  await page.goto(`${base}?tab=schedule`);
  await page.getByText('Add a Milestone').click();
  await page.getByLabel('Name', { exact: true }).fill(`Trim-Out ${stamp}`);
  await page.getByLabel('Planned Start').fill('2027-03-15');
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await expect(page.locator('li strong', { hasText: `Trim-Out ${stamp}` })).toBeVisible();
  await page.goto(`${base}?tab=schedule`);
  await page.getByLabel('What', { exact: true }).fill(`Appliances ${stamp}`);
  await page.getByLabel('Who Is Responsible').selectOption('owner');
  await page.getByLabel('Milestone').selectOption({ label: `Trim-Out ${stamp}` });
  await page.getByLabel(/Days Before/).fill('-5');
  await page.getByLabel('GC Allowance').fill('47,000');
  await page.getByLabel('Our Cost').fill('30,000');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  const row = page.locator('tr', { hasText: `Appliances ${stamp}` });
  await expect(row.getByText('3/10/2027')).toBeVisible();
  await expect(row.getByText("$47,000")).toBeVisible();
  await expect(page.getByText(/Owner-supplied savings: \$[0-9,]+/)).toBeVisible();
});

test('post-project review: the numbers and the lessons', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/projects');
  await page.getByRole('link', { name: '109 Plainview Ave' }).first().click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/);
  await page.goto(page.url().split('?')[0] + '?tab=review');
  await expect(page.getByRole('heading', { name: '› What the Numbers Say' })).toBeVisible();
  await page.getByLabel('First Estimate (Build)').fill('900,000');
  await page.getByLabel('What We Should Have Done').fill(`Lesson ${stamp}`);
  await page.getByRole('button', { name: 'Save Review' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(page.getByText(/The build (ran over|came in under) the first estimate/)).toBeVisible();
});

test('the account menu closes on a click outside and on Esc', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const menu = page.locator('details.account');
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open', '');
  await page.mouse.click(600, 500);
  await expect(menu).not.toHaveAttribute('open', '');
  await menu.locator('summary').click();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
});

test('People: role buttons pick one or several roles', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/people');
  await page.getByRole('link', { name: 'General Contractors', exact: true }).click();
  await expect(page).toHaveURL(/roles=gc/);
  await expect(page.getByRole('link', { name: 'General Contractors', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Subcontractors', exact: true }).click();
  await expect(page).toHaveURL(/roles=gc%2Csub|roles=gc,sub/);
  await expect(page.getByRole('heading', { name: 'General Contractors, Subcontractors' })).toBeVisible();
  await expect(page.locator('table.t')).not.toContainText('· Met');
  await page.getByRole('link', { name: 'All Roles' }).click();
  await expect(page).toHaveURL(/\/people$/);
});
