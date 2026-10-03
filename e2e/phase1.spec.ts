import { expect, test, type Locator, type Page } from '@playwright/test';

/** Taps one of a Choice's buttons (src/components/Choice.tsx). */
const choose = (scope: Page | Locator, name: string, value: string) => scope.locator(`label.choice-opt:has(input[name="${name}"][value="${value}"])`).click();


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
  await choose(page, 'howMet', 'introduction');
  await page.getByLabel(/Or Introducer Not on File/).fill(`Jordan Intro${stamp}`);
  await page.getByLabel('About the Introduction').fill('Met through Jordan at the REIA meetup.');
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Riley Builder${stamp}`);
  await expect(page.locator('main').getByText('Where we are with them: Met').first()).toBeVisible();
  await expect(page.locator('.page-head .chip', { hasText: 'General Contractor' })).toBeVisible();
  await expect(page.locator('.page-head .chip', { hasText: 'Networking Contact' })).toBeVisible();
  await expect(page.locator('.page-head')).not.toContainText('· Met');
  const personUrl = page.url();
  await page.getByRole('link', { name: `Jordan Intro${stamp}` }).click();
  await page.getByRole('link', { name: /Introductions/ }).click();
  await expect(page.locator('main').getByText('Met through Jordan at the REIA meetup.')).toBeVisible();
  await page.goto(personUrl);
  await page.getByRole('link', { name: 'Log a Touch' }).first().click();
  await choose(page, 'kind', 'site_walk');
  await page.getByLabel('What Happened').fill('Walked the lot together.');
  await page.getByRole('button', { name: 'Log It' }).click();
  await expect(page.locator('main').getByText('Logged.')).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('main').getByText(/logged a site walk/)).toBeVisible();
});

test('add a watched lot, then mark it sold as a comparable', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/watchlist/new');
  await page.getByLabel('Address').fill(`${stamp} Oakwood Ave`);
  await page.getByLabel('Asking Price').fill('425k');
  await page.getByLabel('Lot Size (sq ft)').fill('8,000');
  await page.getByLabel('Zoning', { exact: true }).fill('r-10');
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${stamp} Oakwood Ave`);
  await expect(page.locator('main').getByText('$53.13')).toBeVisible();
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
  await expect(page.locator('main').getByText('Build Budget')).toBeVisible();
  await page.getByRole('link', { name: 'Budget', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Edit Budget' })).toBeVisible();
  await expect(page.locator('main').getByText('$818,710').first()).toBeVisible();
  await expect(page.locator('main').getByText('$973,201').first()).toBeVisible();
  await expect(page.locator('main').getByText('Outdoor patio fireplace')).toBeVisible();
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
  await expect(page.locator('main').getByText('Saved.')).toBeVisible();
  const bill = page.locator('li', { hasText: `Test GC ${stamp} #${stamp}` });
  await expect(bill.getByText('$1,364.94')).toBeVisible();
  await bill.getByRole('button', { name: 'Approve' }).click();
  await expect(bill.getByText(/lien waiver is needed/)).toBeVisible();
  await bill.getByRole('button', { name: 'Lien Waiver Received' }).click();
  await bill.getByRole('button', { name: 'Mark Paid' }).click();
  await expect(bill.getByText('Paid', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('main').getByText(`entered a bill for $1,364.94 (#${stamp}) in 2 lines`)).toBeVisible();
});

test('the accountant sees projects and money, not contacts', async ({ page }) => {
  await signIn(page, 'Sample Accountant');
  await page.goto('/people');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await page.goto('/projects');
  await expect(page.getByRole('link', { name: '109 Plainview Ave' }).first()).toBeVisible();
  // Address, city, state, ZIP and neighborhood each in their own column; a sale price not yet real says Projected.
  for (const h of ['Address', 'City', 'State', 'ZIP', 'Neighborhood', 'Sale Price']) await expect(page.getByRole('columnheader', { name: h, exact: true }).first()).toBeVisible();
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: '109 Plainview Ave' }) }).first();
  await expect(row.getByRole('cell', { name: 'Raleigh', exact: true })).toBeVisible();
  await expect(row.getByText('Projected', { exact: true })).toBeVisible();
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
  await expect(page.locator('main').getByText(/Imported 1 people, 2 companies, 0 projects, 1 bills and 0 photos/)).toBeVisible();
  await page.goto(`/people?q=Sub${stamp}`);
  await page.getByRole('link', { name: `Emma Sub${stamp}` }).click();
  await expect(page.locator('main').getByText('Where we are with them: Hired').first()).toBeVisible();
  await expect(page.locator('main').getByText(new RegExp(`Through GC Co ${stamp}`))).toBeVisible();
  await page.goto(`/companies?q=GC Co ${stamp}`);
  await page.getByRole('link', { name: `GC Co ${stamp}` }).click();
  await expect(page.locator('main').getByText('Subs and Suppliers Through Them')).toBeVisible();
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
  await expect(page.locator('main').getByText('Saved as the Rough Estimate.')).toBeVisible();
  await page.locator('select[name=kind]').selectOption('approved');
  await page.getByRole('button', { name: "Save Today's Budget as This Stage" }).click();
  await expect(page.locator('main').getByText('Approved: this is now the baseline.')).toBeVisible();
  await page.goto(`${base}?tab=schedule`);
  await page.getByText('Add a Milestone').click();
  await page.getByLabel('Name', { exact: true }).fill(`Trim-Out ${stamp}`);
  await page.getByLabel('Planned Start').fill('2027-03-15');
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await expect(page.locator('li strong', { hasText: `Trim-Out ${stamp}` })).toBeVisible();
  await page.goto(`${base}?tab=schedule`);
  await page.getByLabel('What', { exact: true }).fill(`Appliances ${stamp}`);
  await choose(page, 'responsible', 'owner');
  await page.getByLabel('Milestone').selectOption({ label: `Trim-Out ${stamp}` });
  await page.getByLabel(/Days Before/).fill('-5');
  await page.getByLabel('GC Allowance').fill('47,000');
  await page.getByLabel('Our Cost').fill('30,000');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  const row = page.locator('tr', { hasText: `Appliances ${stamp}` });
  await expect(row.getByText('3/10/2027')).toBeVisible();
  await expect(row.getByText("$47,000")).toBeVisible();
  await expect(page.locator('main').getByText(/Owner-supplied savings: \$[0-9,]+/)).toBeVisible();
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
  await expect(page.locator('main').getByText('Saved.')).toBeVisible();
  await expect(page.locator('main').getByText(/The build (ran over|came in under) the first estimate/)).toBeVisible();
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

test('a utility supplier with a kind, Do Not Use with a reason, and a property utility', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const last = `Power${Date.now().toString().slice(-6)}`;
  await page.goto('/people/new');
  await page.getByLabel('First Name', { exact: true }).fill('Lubna');
  await page.getByLabel('Last Name', { exact: true }).fill(last);
  await page.getByLabel('Utilities', { exact: true }).check();
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.locator('.page-head .chip', { hasText: 'Supplier: Utilities' })).toBeVisible();
  const personUrl = page.url();

  // People: Suppliers, then the Utilities kind.
  await page.goto('/people');
  await page.getByRole('link', { name: 'Suppliers', exact: true }).click();
  await page.getByRole('link', { name: 'Utilities', exact: true }).click();
  await expect(page).toHaveURL(/supply=utilities/);
  await expect(page.getByRole('link', { name: `Lubna ${last}` })).toBeVisible();

  // Do Not Use needs a reason, shows red, and History keeps it.
  await page.goto(personUrl);
  await page.locator('summary', { hasText: 'Mark Do Not Use' }).click();
  await page.getByLabel(/^Why/).fill('Never showed up for the meter set');
  await page.getByRole('button', { name: 'Mark Do Not Use' }).click();
  await expect(page.locator('.dnu-banner')).toContainText('Never showed up for the meter set');
  await page.goto('/people?q=' + last);
  await expect(page.locator('table.t .chip.red', { hasText: 'Do Not Use' })).toBeVisible();

  // The property's utilities: electric, with this person as the contact there.
  await page.goto('/projects');
  await page.getByRole('link', { name: /109 Plainview/ }).first().click();
  await page.getByRole('link', { name: 'Utilities', exact: true }).click();
  await choose(page, 'service', 'electric');
  await page.locator('select[name=personId]').selectOption({ label: `Lubna ${last}` });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.rows')).toContainText(`Lubna ${last}`);
  await expect(page.locator('.rows')).toContainText('Electric');
});

test('bills under a longer name link to the company, which shows every invoice and the total', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const file = JSON.stringify({
    companies: [{ name: `Haul${s} Brothers`, role: 'sub', trade: 'Dumpsters' }],
    bills: [
      { project: '109 Plainview Ave', vendor: `Haul${s} Brothers Contracting LLC`, number: `A${s}`, date: '2026-09-01', lines: [{ kind: 'build', costCode: '01', amount: '375.00' }] },
      { project: '109 Plainview Ave', vendor: `Haul${s} Brothers Contracting`, number: `B${s}`, date: '2026-09-15', lines: [{ kind: 'build', costCode: '01', amount: '425.50' }] },
    ],
  });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'haul.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.locator('main').getByText(/Imported .* 2 bills/)).toBeVisible();
  await page.goto(`/companies?q=Haul${s}`);
  await page.getByRole('link', { name: `Haul${s} Brothers`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What We’ve Spent With Them' })).toBeVisible();
  await expect(page.locator('main').getByText('$800.50 in all · 1 project · 2 invoices')).toBeVisible();
  await page.getByText(/109 Plainview Ave: 2 invoices/).click();
  await expect(page.getByRole('cell', { name: `A${s}` })).toBeVisible();
  await expect(page.getByRole('cell', { name: `B${s}` })).toBeVisible();
});

test('archive, restore and delete permanently; a company with bills can only be archived', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  await page.goto('/people/new');
  await page.getByLabel('First Name', { exact: true }).fill('Gone');
  await page.getByLabel('Last Name', { exact: true }).fill(`Soon${s}`);
  await page.getByLabel('General Contractor', { exact: true }).check();
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Gone Soon${s}`);
  const url = page.url();

  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.waitForURL('**/people');
  await page.goto(`/people?q=Soon${s}`);
  await expect(page.locator('main').getByText('No one matches')).toBeVisible();

  await page.goto('/admin/archived');
  const row = page.locator('li', { hasText: `Gone Soon${s}` });
  await row.getByRole('button', { name: 'Restore' }).click();
  await expect(row).toHaveCount(0, { timeout: 20_000 }); // restored before moving on
  await page.goto(`/people?q=Soon${s}`);
  await expect(page.getByRole('link', { name: `Gone Soon${s}` })).toBeVisible();

  await page.goto(url);
  await page.getByRole('link', { name: 'Delete Permanently…' }).click();
  await expect(page.locator('main').getByText('1 roles')).toBeVisible();
  await page.getByLabel(/Type the name to confirm/).fill('wrong name');
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.locator('main').getByText(`Type the name exactly: Gone Soon${s}`)).toBeVisible();
  await page.getByLabel(/Type the name to confirm/).fill(`gone soon${s}`);
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.locator('main').getByText(`Deleted Gone Soon${s} permanently`)).toBeVisible();
  expect((await page.goto(url))?.status()).toBe(404);

  // Money history blocks a delete.
  const file = JSON.stringify({ companies: [{ name: `Keep${s} Lumber`, role: 'supplier', supplierTypes: ['materials'] }],
    bills: [{ project: '109 Plainview Ave', vendor: `Keep${s} Lumber`, date: '2026-09-02', lines: [{ kind: 'build', costCode: '01', amount: '99.00' }] }] });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'keep.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.locator('main').getByText(/Imported .* 1 bills/)).toBeVisible();
  await page.goto(`/companies?q=Keep${s}`);
  await page.getByRole('link', { name: `Keep${s} Lumber`, exact: true }).click();
  await page.getByRole('link', { name: 'Delete Permanently…' }).click();
  await expect(page.locator('main').getByText(/It has 1 bills from them/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Permanently' })).toHaveCount(0);
});

test('GC bids next to our estimate, the gaps flagged, and Select the Winning Budget', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const file = JSON.stringify({
    companies: [{ name: `Oak${s} Builders`, role: 'gc' }],
    projects: [{ name: `Bid Test ${s}`, address: `${s} Bid Test Rd`, city: 'Raleigh', stage: 'design', heatedSf: 3000 }],
    bids: [{ project: `Bid Test ${s}`, kind: 'bid', company: `Oak${s} Builders`, submittedOn: '2026-09-01', label: 'Preliminary',
      lines: [{ costCode: '08', amount: 75300 }, { costCode: '21', amount: 47000 }, { costCode: '14', amount: 15000 }] }],
  });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'bid.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.locator('main').getByText(/^Imported /)).toBeVisible();

  await page.goto('/projects');
  await page.getByRole('link', { name: `Bid Test ${s}` }).first().click();
  await expect(page.locator('.page-head .eyebrow')).toContainText(/Project P-\d+/);
  await page.getByRole('link', { name: 'Budget', exact: true }).click();
  await expect(page.locator('table.bids')).toContainText(`Oak${s} Builders`);

  // Our estimate: appliances owner-supplied at $30,000, nothing for siding/stone.
  await page.locator('summary', { hasText: 'Add one' }).click();
  const form = page.locator('form:has(input[name=bidKind])');
  await choose(form, 'bidKind', 'ours');
  await form.locator('input[name=label]').fill(`Ours ${s}`);
  const code = async (c: string) => form.locator('.bid-grid label', { hasText: new RegExp(`^${c} `) }).locator('input');
  await (await code('08')).fill('72,000');
  await (await code('21')).fill('30,000');
  await form.locator('input[name=file]').setInputFiles({ name: `estimate-${s}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${s}\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n`) });
  await form.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main').getByText('Estimate added.')).toBeVisible();

  // Every saved document opens in the app, or downloads.
  const budgetUrl = page.url();
  await page.getByRole('link', { name: `estimate-${s}.pdf` }).click();
  await expect(page.locator('.page-head .eyebrow')).toHaveText(/Document/i);
  await expect(page.locator('iframe.doc-frame')).toBeVisible();
  const dl = await page.request.get(await page.getByRole('link', { name: 'Download' }).getAttribute('href') ?? '');
  expect(dl.status()).toBe(200);
  expect(dl.headers()['content-disposition']).toContain('attachment');
  expect((await page.request.get((await page.locator('iframe.doc-frame').getAttribute('src'))!)).headers()['content-disposition']).toContain('inline');
  await page.goto(budgetUrl);
  const table = page.locator('table.bids');
  await expect(table).toContainText(`Ours ${s}`);
  // Ours at $30,000 is flagged against the GC's $47,000, and the GC's against ours.
  await expect(table.locator('tr', { hasText: '21 Appliances' })).toContainText(/\$47,000\s*high/);
  await expect(table.locator('tr', { hasText: '21 Appliances' })).toContainText(/\$30,000\s*low/);
  await expect(table).toContainText('Per Heated SF');
  await expect(table.locator('tr', { hasText: '14 Siding' }).locator('td.amber').first()).toContainText('not in it');

  const item = page.locator('li', { hasText: `Oak${s} Builders` }).first();
  await item.locator('summary', { hasText: 'Select as the Winning Budget' }).click();
  await item.getByLabel('Why this one').fill('Best scope; we supply the appliances');
  page.once('dialog', (d) => d.accept());
  await item.getByRole('button', { name: 'Select the Winning Budget' }).click();
  await expect(page.locator('table.bids th', { hasText: `Oak${s} Builders` })).toContainText('Winner');
  await page.getByRole('link', { name: 'History' }).last().click();
  await expect(page.locator('main').getByText(new RegExp(`chose Oak${s} Builders’s bid .* as the winning budget`)).first()).toBeVisible();
});

test('a rental: status and manager, the lease, rent in, the loan, and whether it makes money', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const file = JSON.stringify({
    projects: [{ name: `Rent Test ${s}`, address: `${s} Rent Rd`, city: 'Raleigh', stage: 'rental', lotCost: 200000 }],
    companies: [{ name: `Manage${s} Realty`, role: 'property_manager' }, { name: `Other${s} Builders`, role: 'gc' }],
    people: [{ name: `Ann Lead${s}`, company: `Manage${s} Realty`, title: 'Broker' }, { name: `Ben Agent${s}`, company: `Manage${s} Realty` }, { name: `Cal Elsewhere${s}`, company: `Other${s} Builders` }],
  });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'rent.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.locator('main').getByText(/^Imported /)).toBeVisible();
  await page.goto('/projects');
  await page.getByRole('link', { name: `Rent Test ${s}` }).first().click();
  await page.locator('.tabs').getByRole('link', { name: 'Rental', exact: true }).click();

  const setup = page.locator('form:has(input[name=askingRent])');
  await choose(setup, 'status', 'on_market');
  await setup.locator('input[name=askingRent]').fill('2,450');
  await setup.locator('input[name=managementFeePct]').fill('8');
  await setup.locator('input[name=taxesMonthly]').fill('300');
  await setup.locator('input[name=insuranceMonthly]').fill('150');
  // Only property management companies; then only their people.
  await expect(setup.locator('select[name=managerCompanyId] option', { hasText: `Other${s} Builders` })).toHaveCount(0);
  await setup.locator('select[name=managerCompanyId]').selectOption({ label: `Manage${s} Realty` });
  await expect(setup.getByText(`Cal Elsewhere${s}`)).toHaveCount(0);
  await setup.getByLabel(`Ann Lead${s}`).check();
  await setup.getByLabel(`Ben Agent${s}`).check();
  await setup.locator(`.contact-row:has-text("Ben Agent${s}") input[type=radio]`).check();
  await setup.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main').getByText('Making money each month')).toBeVisible();
  const people = page.locator('section', { hasText: 'Status and Property Manager' }).first();
  await expect(people.locator('li', { hasText: `Ben Agent${s}` })).toContainText('Main');
  await expect(people.locator('li', { hasText: `Ann Lead${s}` })).not.toContainText('Main');

  await page.locator('summary', { hasText: 'Add the Lease' }).click();
  const lf = page.locator('form:has(input[name=tenants])');
  await lf.locator('input[name=tenants]').fill(`Pat Tenant ${s}`);
  await lf.locator('input[name=rent]').fill('2,500');
  await lf.locator('input[name=startsOn]').fill('2026-09-01');
  await lf.locator('input[name=endsOn]').fill('2027-08-31');
  await lf.locator('input[name=deposit]').fill('2,500');
  await lf.getByRole('button', { name: 'Add the Lease' }).click();
  await expect(page.locator('section', { hasText: 'Status and Property Manager' }).first()).toContainText('Leased');
  await expect(page.locator('main').getByText(`Pat Tenant ${s}`).first()).toBeVisible();

  await page.locator('summary', { hasText: 'Record Money Received' }).click();
  const rf = page.locator('form:has(input[name=receivedOn])');
  await rf.locator('input[name=receivedOn]').fill('2026-09-03');
  await rf.locator('input[name=amount]').fill('2,500');
  await rf.locator('input[name=forMonth]').fill('2026-09');
  await rf.getByRole('button', { name: 'Record It' }).click();
  await expect(page.locator('table.t tr', { hasText: '2026-09' })).not.toContainText(/short/i);

  await page.locator('summary', { hasText: 'Add the Loan' }).click();
  const lo = page.locator('form:has(input[name=monthlyPayment])');
  await lo.locator('input[name=lenderName]').fill('Test Bank');
  await lo.locator('input[name=originalAmount]').fill('150,000');
  await lo.locator('input[name=monthlyPayment]').fill('3,000');
  await lo.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main').getByText('Losing money each month')).toBeVisible();
  await expect(page.locator('main').getByText(/Break-even rent: \$[0-9,]+ a month/)).toBeVisible();

  await page.getByRole('link', { name: 'History' }).last().click();
  await expect(page.locator('main').getByText(`added the lease with Pat Tenant ${s}: $2,500 a month from 2026-09-01 to 2027-08-31`)).toBeVisible();
});

test('stages: several going at once, each with its sub-stages, all in History and on the list', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const file = JSON.stringify({ projects: [{ name: `Stage Test ${s}`, address: `${s} Stage St`, city: 'Raleigh', stage: 'building' }] });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'stage.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.locator('main').getByText(/^Imported /)).toBeVisible();
  await page.goto('/projects');
  await page.getByRole('link', { name: `Stage Test ${s}` }).first().click();

  const bar = page.getByRole('navigation', { name: 'Stages' });
  const step = (label: string) => bar.locator('.stage-step', { hasText: label });
  await expect(step('Building')).toHaveAttribute('data-state', 'active');
  await expect(step('Design')).toHaveAttribute('data-state', 'done');
  // Building is open: its own sub-stages.
  await expect(bar.getByRole('region', { name: 'Building stage' })).toBeVisible();
  await bar.getByRole('button', { name: 'Framing' }).click();
  await expect(bar.locator('.sub-step[aria-current=true]')).toHaveText('Framing');

  // Permits going at the same time.
  await step('Permits').click();
  await expect(bar.getByRole('region', { name: 'Permits stage' })).toBeVisible();
  await bar.getByRole('button', { name: 'Going Now' }).click();
  await expect(step('Permits')).toHaveAttribute('data-state', 'active');
  await bar.getByRole('button', { name: 'In Review' }).click();
  await expect(bar.locator('.stage-now')).toContainText('Permits (In Review)');
  await expect(bar.locator('.stage-now')).toContainText('Building (Framing)');

  // For Sale has its own: picking one starts the stage.
  await step('For Sale').click();
  await bar.getByRole('button', { name: 'Coming Soon' }).click();
  await expect(step('For Sale')).toHaveAttribute('data-state', 'active');

  // A rental's sub-stage is the rental's status.
  await step('Rental').click();
  await bar.getByRole('button', { name: 'On the Market' }).click();
  await expect(bar.locator('.sub-step[aria-current=true]')).toHaveText('On the Market');

  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('main').getByText('moved Permits to In Review').first()).toBeVisible();
  await expect(page.locator('main').getByText(/marked Permits Going Now/).first()).toBeVisible();
  await expect(page.locator('main').getByText(/moved Rental to On the Market; Rental is going now/).first()).toBeVisible();

  await page.goto('/projects');
  const row = page.locator('tr', { hasText: `Stage Test ${s}` }).first();
  await expect(row).toContainText('Permits · In Review');
  await expect(row).toContainText('Building · Framing');
  await expect(row).toContainText('Rental · On the Market');
});

test('like names: a nickname or typo stops and asks, and Possible Duplicates lists what is on file', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const add = async (first: string, last: string) => {
    await page.goto('/people/new');
    await page.getByLabel('First Name', { exact: true }).fill(first);
    await page.getByLabel('Last Name', { exact: true }).fill(last);
  };
  await add('Robert', `Smithers${s}`);
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Robert Smithers${s}`);
  await add('Bob', `Smithrs${s}`);
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.locator('main').getByText(`This looks like someone already on file: Robert Smithers${s}`)).toBeVisible();
  await page.getByLabel(/Different person/).check();
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Bob Smithrs${s}`);

  await page.goto('/companies/new');
  await page.getByLabel('Name', { exact: true }).fill(`Baggett${s}`);
  await page.getByRole('button', { name: /Add Company|Save/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Baggett${s}`);
  await page.goto('/companies/new');
  await page.getByLabel('Name', { exact: true }).fill(`Baggett${s} Construction, Inc.`);
  await page.getByRole('button', { name: /Add Company|Save/ }).first().click();
  await expect(page.locator('main').getByText(`A company with a name like this is already on file: Baggett${s}`)).toBeVisible();

  await page.goto('/admin/duplicates');
  const pair = page.locator('.dup-rows li', { hasText: `Robert Smithers${s}` });
  await expect(pair).toContainText(`Bob Smithrs${s}`);
  await pair.getByRole('button', { name: 'Not the Same' }).click();
  await expect(page.locator('.dup-rows li', { hasText: `Robert Smithers${s}` })).toHaveCount(0);
});

test('grades with a justification, D or below is Do Not Use unless overridden, and issues by status with days to fix', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const file = JSON.stringify({
    companies: [{ name: `Tile${s} Pros`, role: 'sub', trade: 'Tile' }],
    people: [{ name: `Tess Tiler${s}`, company: `Tile${s} Pros`, title: 'Owner' }],
    bills: [{ project: '109 Plainview Ave', vendor: `Tile${s} Pros`, number: `T${s}`, date: '2026-09-01', lines: [{ kind: 'build', costCode: '01', amount: '900.00' }] }],
  });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'tile.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.locator('main').getByText(/^Imported /)).toBeVisible();
  await page.goto(`/companies?q=Tile${s}`);
  await page.getByRole('link', { name: `Tile${s} Pros`, exact: true }).click();
  await page.waitForURL(/\/companies\/[0-9a-f-]{36}/);
  const companyUrl = page.url().split('?')[0];

  // A grade needs a justification.
  await page.locator('.tabs').getByRole('link', { name: 'Grades' }).click();
  await choose(page, 'grade', 'D');
  await page.locator('select[name=projectId]').selectOption({ label: '109 Plainview Ave' });
  await page.locator('textarea[name=justification]').fill('Short.');
  await page.locator('textarea[name=justification]').evaluate((el: HTMLTextAreaElement) => el.removeAttribute('minlength'));
  await page.getByRole('button', { name: 'Save the Grade' }).click();
  await expect(page.locator('main').getByText(/Say why they got D/)).toBeVisible();
  await page.locator('textarea[name=justification]').fill('Grout lines uneven in both baths; had to come back twice and still left a cracked tile.');
  await page.getByRole('button', { name: 'Save the Grade' }).click();
  await expect(page.locator('.dnu-banner')).toContainText('Overall grade D from 1 job');
  await expect(page.locator('.grade-card')).toContainText('Grout lines uneven');

  // Kept usable anyway, with why.
  await page.getByText('Keep Them Usable Anyway (Override)').click();
  await page.locator('textarea[name=reason]').fill('Only tile crew free this month; owner approved');
  await page.getByRole('button', { name: 'Keep Them Usable' }).click();
  await expect(page.locator('.dnu-banner')).toHaveCount(0);
  await expect(page.locator('main').getByText(/Kept usable despite the grade/)).toBeVisible();

  // An issue: open, then fixed, with who was involved and the days to fix.
  await page.goto(`${companyUrl}?tab=issues`);
  await page.locator('input[name=title]').fill(`Cracked tile in hall bath ${s}`);
  await choose(page, 'severity', 'high');
  await page.locator('input[name=reportedOn]').fill('2026-09-01');
  await page.locator('label.role-btn', { hasText: `Tess Tiler${s}` }).click();
  await page.locator('label.role-btn', { hasText: 'Sample Owner (us)' }).click();
  await page.getByRole('button', { name: 'Open the Issue' }).click();
  const card = page.locator('.issue-card', { hasText: `Cracked tile in hall bath ${s}` });
  await expect(card).toContainText(`Tess Tiler${s}`);
  await expect(card).toContainText('open so far');
  await expect(page.locator('.status-tab[aria-current=page]')).toContainText('All Open');
  await card.getByText('Move It').click();
  await choose(card, 'status', 'resolved');
  await card.locator('input[name=resolvedOn]').fill('2026-09-11');
  await card.locator('textarea[name=resolution]').fill('Replaced the tile and regrouted at no charge');
  await card.getByRole('button', { name: 'Move' }).click();
  await page.locator('.status-tab[data-k=resolved]').click();
  const fixed = page.locator('.issue-card', { hasText: `Cracked tile in hall bath ${s}` });
  await expect(fixed).toContainText('10 days to fix');
  await expect(fixed).toContainText('Replaced the tile');

  await page.goto(`${companyUrl}?tab=history`);
  await expect(page.locator('main').getByText(/graded them D on 109 Plainview Ave/).first()).toBeVisible();
  await expect(page.locator('main').getByText(/marked them Do Not Use: Overall grade D/).first()).toBeVisible();
  await expect(page.locator('main').getByText(/moved issue #\d+ from Open to Fixed/).first()).toBeVisible();

  // The job's Vendors tab shows them with their grade.
  await page.goto('/projects');
  await page.getByRole('link', { name: '109 Plainview Ave' }).first().click();
  await page.locator('.tabs').getByRole('link', { name: 'Vendors and Issues' }).click();
  await expect(page.locator('.grade-card').filter({ has: page.getByRole('link', { name: `Tile${s} Pros`, exact: true }) }).locator('.grade-why')).toContainText('Grout lines uneven', { timeout: 20_000 });
  // An issue opened right on the job's tab: the vendor is picked by typing, not from a list of everyone.
  const open = page.locator('section', { has: page.getByRole('heading', { name: /Open an Issue/ }) }).last();
  await open.locator('input[name=title]').fill(`Loose threshold ${s}`);
  await expect(async () => {
    await open.getByRole('combobox', { name: /^Vendor/ }).fill(`Tile${s}`);
    await page.getByRole('option', { name: new RegExp(`Tile${s} Pros.*On this job`) }).click({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await open.getByRole('button', { name: 'Open the Issue' }).click();
  await expect(page.locator('.toast', { hasText: 'Saved' })).toBeVisible({ timeout: 20_000 }); // the job's tab holds every earlier run's vendors locally
  await expect(page.locator('.issue-card', { hasText: `Loose threshold ${s}` })).toContainText(`Tile${s} Pros`);
});

test('agents: the areas they specialize in', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  await page.goto('/people/new');
  await page.getByLabel('First Name', { exact: true }).fill('Ava');
  await page.getByLabel('Last Name', { exact: true }).fill(`Agent${s}`);
  await page.getByLabel('Real Estate Agent / Broker', { exact: true }).check();
  await page.locator('input[name=areas]').fill('Five Points, Oakwood');
  await expect(page.locator('input[name=city]')).toHaveAttribute('list', 'city-options');
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.locator('main').getByText('Specializes in Five Points, Oakwood')).toBeVisible();
  await page.goto(`/people?roles=agent&q=Agent${s}`);
  await expect(page.locator('tr', { hasText: `Ava Agent${s}` })).toContainText('Specializes in Five Points, Oakwood');
});

test('the market map: filters and layer buttons, sales in view, neighborhoods and the trend by price', async ({ page }) => {
  // Made-up sales (the counties are never called in tests).
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  const s = Date.now().toString().slice(-6);
  const hood = `Testwood ${s}`;
  for (let i = 0; i < 6; i++) {
    const r = await db.query(`insert into market_parcels (county, parcel_key, address, street, city, neighborhood, land_use, heated_sf, lat, lng, last_sale_price, last_sale_on)
      values ('wake', $1, $2, 'TESTWOOD LN', 'Raleigh', $3, 'condo', 2000, $4, $5, $6, current_date - ($7 || ' days')::interval) returning id`,
      [`T${s}${i}`, `${i + 1} TESTWOOD${s} LN`, hood, 35.70 + i * 0.001, -78.70, 2600000 + i * 10000, 20 + i * 10]);
    await db.query(`insert into market_sales (parcel_id, sold_on, price, heated_sf) values ($1, current_date - ($2 || ' days')::interval, $3, 2000)`, [r.rows[0].id, 20 + i * 10, 2600000 + i * 10000]);
  }
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.getByRole('link', { name: 'Market Map' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Market Map' })).toBeVisible();
  await expect(page.locator('.tile', { hasText: '$400k–700k' })).toBeVisible();
  // Condos at $1.5M and up: the made-up neighborhood is the busiest.
  await page.locator('.market-filters').getByRole('link', { name: 'Condo' }).click();
  await expect(page).toHaveURL(/use=condo/);
  await expect(page.locator('.market-filters').getByRole('link', { name: 'Condo' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.market-filters').getByRole('link', { name: '$1.5M and Up' }).click();
  await expect(page).toHaveURL(/use=condo.*band=15m|band=15m.*use=condo/);
  await expect(page.locator('table', { hasText: hood }).first()).toBeVisible();
  await expect(page.locator('section', { hasText: 'Where the Market Is Headed' }).locator('.trend-sentence').first()).not.toBeEmpty();

  // Layer buttons add and take away.
  const dots = page.getByRole('button', { name: 'Each Sale' });
  await expect(dots).toHaveAttribute('aria-pressed', 'false');
  await dots.click();
  await expect(dots).toHaveAttribute('aria-pressed', 'true');
  // The sales in the view come from our own records.
  const r = await page.request.get('/api/market/points?bbox=-78.71,35.69,-78.69,35.72&band=15m&use=condo');
  const body = await r.json();
  expect(body.points.filter((p: { h: string }) => p.h === hood).length).toBe(6);
  expect(body.points.find((p: { h: string }) => p.h === hood).psf).toBeGreaterThan(1000);

  // Go to an address: the sale on file, with a star where it is.
  await page.getByRole('textbox', { name: 'Go to an address' }).fill(`1 TESTWOOD${s}`);
  await page.getByRole('button', { name: 'Go', exact: true }).click();

  await expect(page.locator('.found-label')).toContainText(`1 TESTWOOD${s} LN`);
  const found = await (await page.request.get(`/api/market/find?q=2%20Testwood${s}%20Ln`)).json();
  expect(found.results[0]).toMatchObject({ label: `2 TESTWOOD${s} LN, Raleigh`, kind: 'Sold' });
  // Street map or aerial, and the parcel lines as a layer.
  await page.getByRole('button', { name: 'Aerial (Wake)' }).click();
  await expect(page.getByRole('button', { name: 'Aerial (Wake)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Parcel Lines' })).toBeVisible();
  await page.getByRole('button', { name: 'Full Screen' }).click();
  await expect(page.locator('.market-map-wrap.is-full')).toBeVisible();
  await page.getByRole('button', { name: 'Exit Full Screen' }).click();

  // Planning layers are kept apart and start off; Zoning turns on with its color legend, and stays on next time.
  await page.locator('.map-plan > summary').click();
  for (const k of ['zoning', 'overlays', 'easements', 'septic', 'nowater', 'row'])
    await expect(page.locator(`.map-plan .layer-btn[data-k=${k}]`)).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.map-plan .layer-btn[data-k=zoning]').click();
  await expect(page.locator('.map-plan .layer-btn[data-k=zoning]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.zoning-legend')).toContainText('Houses and Townhomes');
  await page.reload();
  await expect(page.locator('.map-plan .layer-btn[data-k=zoning]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.map-plan .layer-btn[data-k=zoning]').click();

  // Filters are buttons in the address.
  await page.locator('.market-filters').getByRole('link', { name: 'Durham' }).click();
  await expect(page).toHaveURL(/county=durham/);
  await expect(page.locator('table', { hasText: hood })).toHaveCount(0);
});

test('a contractor invited as a guest: a sign-in link, only their project, the daily log and their issues', async ({ page, browser }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  // Their company, with an issue on Plainview.
  const file = JSON.stringify({ companies: [{ name: `Guest${s} Framing`, role: 'sub', trade: 'Framing' }],
    bills: [{ project: '109 Plainview Ave', vendor: `Guest${s} Framing`, number: `G${s}`, date: '2026-09-01', lines: [{ kind: 'build', costCode: '01', amount: '100.00' }] }] });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'g.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.locator('main').getByText(/^Imported /)).toBeVisible();
  await page.goto(`/companies?q=Guest${s}`);
  await page.getByRole('link', { name: `Guest${s} Framing`, exact: true }).click();
  await page.waitForURL(/\/companies\/[0-9a-f-]{36}/);
  await page.goto(page.url().split('?')[0] + '?tab=issues');
  await page.locator('input[name=title]').fill(`Header sagging ${s}`);
  await page.locator('select[name=projectId]').selectOption({ label: '109 Plainview Ave' });
  await page.getByRole('button', { name: 'Open the Issue' }).click();
  await expect(page.locator('.issue-card', { hasText: `Header sagging ${s}` })).toBeVisible();

  // An outside email can't be added as staff: it says to invite a guest.
  await page.goto('/admin/users');
  const add = page.locator('form:has(button:text("Add"))').last();
  await expect(async () => { // filled again if the page wasn't ready yet
    await add.locator('input[name=email]').fill(`other${s}@contractor.example`);
    await add.getByRole('button', { name: 'Add' }).click();
    await expect(add.getByText(/isn’t a Technical Source account/)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30_000 });

  // Added as staff before this check existed: inviting them as a guest turns them into one.
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  await db.query(`insert into users (email, name, role) values ($1, 'Jo (added as staff)', 'staff')`, [`jo${s}@contractor.example`]);
  await db.end();
  await page.reload();
  await expect(page.locator('.user-card', { hasText: `jo${s}@contractor.example` })).toContainText('isn’t a Technical Source account');
  // Invite them: one project, the standard things; the page gives the link (no email here).
  const inv = page.locator('form:has(button:text("Invite Them"))');
  await expect(async () => { // filled again if the page wasn't ready yet after the reload
    await inv.locator('input[name=email]').fill(`jo${s}@contractor.example`);
    await inv.locator('input[name=name]').fill(`Jo Framer${s}`);
    await inv.locator('select[name=companyId]').selectOption({ label: `Guest${s} Framing` });
    const plainview = inv.locator('label.role-btn', { hasText: '109 Plainview Ave' });
    if (!(await plainview.locator('input').isChecked())) await plainview.click();
    await inv.getByRole('button', { name: 'Invite Them' }).click();
    await expect(inv.getByText(/Invited\. Email isn’t set up yet/)).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  const link = await inv.locator('.copy-link input').inputValue();
  expect(link).toMatch(/\/signin\/link\?t=[A-Za-z0-9_-]{40,}/);
  await page.reload();
  await expect(page.locator('section', { hasText: 'Outside Partners' }).locator('.user-card', { hasText: `jo${s}@contractor.example` })).toContainText('109 Plainview Ave');

  // The guest signs in with the link (in their own browser).
  const ctx = await browser.newContext();
  const g = await ctx.newPage();
  await g.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await g.getByRole('button', { name: 'Sign In' }).click();
  await g.waitForURL(/\/guest$/);
  await g.getByRole('link', { name: /109 Plainview Ave/ }).click();
  await expect(g.getByRole('heading', { name: 'Issues With You' })).toBeVisible();
  // Staff pages are closed to them.
  await g.goto('/people');
  await expect(g).toHaveURL(/\/guest$/);
  await g.goto('/projects');
  await expect(g).toHaveURL(/\/guest$/);
  // The link works once.
  const g2 = await (await browser.newContext()).newPage();
  await g2.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await g2.getByRole('button', { name: 'Sign In' }).click();
  await expect(g2.getByText(/That sign-in link has been used or has expired/)).toBeVisible();

  // They add to the daily log and answer the issue.
  await g.goto('/guest');
  await g.getByRole('link', { name: /109 Plainview Ave/ }).click();
  await g.getByText('Add to the Daily Log').click();
  await g.locator('textarea[name=work]').fill(`Set the headers on the back wall ${s}`);
  await g.getByRole('button', { name: 'Add It' }).click();
  await expect(g.getByText(`Set the headers on the back wall ${s}`)).toBeVisible();
  const card = g.locator('.issue-card', { hasText: `Header sagging ${s}` });
  await card.getByText('Update It').click();
  await choose(card, 'status', 'check');
  await card.locator('textarea[name=note]').fill('Added a sister header and shimmed it level');
  await card.getByRole('button', { name: 'Send' }).click();
  await expect(card.locator('.chip.status')).toHaveText('Ready to Check');
  await ctx.close();

  // We see their update.
  await page.goto('/projects');
  await page.getByRole('link', { name: '109 Plainview Ave' }).first().click();
  await page.locator('.tabs').getByRole('link', { name: 'Vendors and Issues' }).click();
  await page.locator('.status-tab[data-k=check]').click();
  await expect(page.locator('.issue-card', { hasText: `Header sagging ${s}` })).toContainText('Added a sister header');
});

test('access is a set of checkboxes per person', async ({ page, browser }) => {
  await signIn(page, 'Sample Owner');
  await page.goto('/admin/users');
  const card = page.locator('.user-card', { hasText: 'accountant@example.com' });
  await expect(async () => { // opened again if the page wasn't ready yet
    const box = card.getByLabel('See people and companies');
    if (!(await box.isVisible())) await card.getByText(/What They Can Do/).click();
    await box.check({ timeout: 3000 });
    await card.getByRole('button', { name: 'Save Access' }).click();
    await expect(card.getByText('Access saved.')).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });

  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await signIn(a, 'Sample Accountant');
  await a.goto('/people');
  await expect(a.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();

  await page.reload();
  const again = page.locator('.user-card', { hasText: 'accountant@example.com' });
  await expect(async () => {
    const back = again.getByRole('button', { name: /Back to the Accountant Standard Set/ });
    if (!(await back.isVisible())) await again.getByText(/What They Can Do/).click();
    await back.click({ timeout: 3000 });
    await expect(again.getByText(/Using the Accountant standard set/)).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  await a.goto('/people');
  await expect(a.getByRole('heading', { level: 1, name: 'People' })).toHaveCount(0);
  await ctx.close();
});

test('merging duplicates: everything moves to the one kept, the extra is archived', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const file = JSON.stringify({
    companies: [{ name: `Mergeco${s}`, role: 'sub', phone: '9195550101' }, { name: `Mergeco${s} LLC`, role: 'sub', website: `mergeco${s}.example` }],
    people: [{ name: `Samuel Pike${s}`, company: `Mergeco${s} LLC`, title: 'Owner' }, { name: `Sam Pike${s}`, email: `sam${s}@mergeco.example` }],
    bills: [{ project: '109 Plainview Ave', vendor: `Mergeco${s}`, number: `M${s}`, date: '2026-09-01', lines: [{ kind: 'build', costCode: '01', amount: '250.00' }] }],
  });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'm.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.locator('main').getByText(/^Imported /)).toBeVisible();

  // Companies: keep the one with the bill; the LLC's person and website come over.
  await page.goto('/admin/duplicates');
  const pair = page.locator('.dup-rows li').filter({ has: page.getByRole('link', { name: `Mergeco${s}`, exact: true }) }).filter({ has: page.getByRole('link', { name: `Mergeco${s} LLC`, exact: true }) });
  await pair.getByRole('link', { name: 'Merge…' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Merge Two Records' })).toBeVisible();
  await page.locator('label.choice-opt', { hasText: new RegExp(`^.?\\s*Mergeco${s} \\(`) }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Merge Them' }).click();
  await expect(page.locator('main').getByText(`Merged Mergeco${s} LLC into this record`)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Mergeco${s}`);
  await expect(page.locator('main').getByText(`mergeco${s}.example`)).toBeVisible();
  await page.locator('.tabs').getByRole('link', { name: /People/ }).click();
  await expect(page.getByRole('link', { name: `Samuel Pike${s}` })).toBeVisible();
  await page.goto(`/companies?q=Mergeco${s}`);
  await expect(page.getByRole('link', { name: `Mergeco${s} LLC`, exact: true })).toHaveCount(0);

  // People, from a record page: Sam is Samuel; his email comes over.
  await page.goto(`/people?q=Pike${s}`);
  await page.getByRole('link', { name: `Samuel Pike${s}` }).click();
  await page.getByRole('link', { name: 'Merge With a Duplicate…' }).click();
  await page.locator('.role-pick').getByRole('link', { name: `Sam Pike${s}` }).click();
  await page.locator('label.choice-opt', { hasText: `Samuel Pike${s} (left)` }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Merge Them' }).click();
  await expect(page.locator('main').getByText(`Merged Sam Pike${s} into this record`)).toBeVisible();
  await expect(page.locator('main').getByText(`sam${s}@mergeco.example`).first()).toBeVisible();
  await page.locator('.tabs').getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('main').getByText(new RegExp(`merged Sam Pike${s} into this record`)).first()).toBeVisible();
});

test('outside partner types: a wholesaler sees only the deals they sent us', async ({ page, browser }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  const p = await db.query(`insert into people (first_name, last_name) values ('Wes', $1) returning id`, [`Wholesale${s}`]);
  await db.query(`insert into properties (address, city, source_person_id, our_offer) values ($1, 'Raleigh', $2, '123456')`, [`${s} Deal Rd`, p.rows[0].id]);
  await db.end();

  await page.goto('/admin/users');
  const inv = page.locator('form:has(button:text("Invite Them"))');
  await inv.locator('input[name=email]').fill(`wes${s}@deals.example`);
  await inv.locator('select[name=personId]').selectOption({ label: `Wes Wholesale${s}` });
  // Picking Wholesaler ticks "see the deals they sent" and only the project basics (tapped again if the page wasn't ready yet).
  await expect(async () => {
    await choose(inv, 'guestType', 'gc'); // another kind first: re-tapping a picked button changes nothing
    await choose(inv, 'guestType', 'wholesaler');
    await expect(inv.locator('input[name=extra][value=deals]')).toBeChecked({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(inv.locator('input[name=can][value=daily_log]')).not.toBeChecked();
  await inv.getByRole('button', { name: 'Invite Them' }).click();
  const link = await inv.locator('.copy-link input').inputValue();
  await page.reload();
  await expect(page.locator('.user-card', { hasText: `wes${s}@deals.example` })).toContainText('Wholesaler / Deal Source');

  const g = await (await browser.newContext()).newPage();
  await g.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await g.getByRole('button', { name: 'Sign In' }).click();
  await g.waitForURL(/\/guest$/);
  const deals = g.locator('section', { hasText: 'Deals You Sent Us' });
  await expect(deals).toContainText(`${s} Deal Rd`);
  await expect(g.locator('body')).not.toContainText('123,456'); // never our offer
  // No Market Map for a wholesaler unless it's ticked.
  expect((await g.request.get('/api/market/points?bbox=-79,35.5,-78.5,36.2')).status()).toBe(403);
});

test('standard access by type: a role standard everyone follows, and an agent with the Market Map', async ({ page, browser }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  await page.goto('/admin/users');
  // The Accountant standard: add People and Companies; the sample accountant follows it.
  const acc = page.locator('.user-card', { hasText: /^Accountant/ }).filter({ has: page.getByText('Change the Accountant Standard') });
  await expect(async () => { // opened again if the page wasn't ready yet
    const box = acc.getByLabel('See people and companies');
    if (!(await box.isVisible())) await acc.getByText('Change the Accountant Standard').click();
    await box.check({ timeout: 3000 });
    await acc.getByRole('button', { name: 'Save the Accountant Standard' }).click();
    await expect(acc.getByText(/Everyone who is Accountant without their own ticks has this now/)).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await signIn(a, 'Sample Accountant');
  await a.goto('/people');
  await expect(a.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();
  await page.reload();
  const acc2 = page.locator('.user-card').filter({ has: page.getByText('Change the Accountant Standard') });
  await expect(async () => { // tapped again if the page wasn't ready yet after the reload
    const back = acc2.getByRole('button', { name: 'Back to the Built-In Standard' });
    if (!(await back.isVisible())) await acc2.getByText('Change the Accountant Standard').click();
    await back.click({ timeout: 3000 });
    await expect(page.locator('.user-card').filter({ has: page.getByText('Change the Accountant Standard') })).toContainText('built-in standard', { timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  await a.goto('/people');
  await expect(a.getByRole('heading', { level: 1, name: 'People' })).toHaveCount(0);
  await ctx.close();

  // An agent: the Market Map is in their standard; they see it, never our projects layer.
  const inv = page.locator('form:has(button:text("Invite Them"))');
  await inv.locator('input[name=email]').fill(`ava${s}@realty.example`);
  await choose(inv, 'guestType', 'agent');
  await expect(inv.locator('input[name=extra][value=market]')).toBeChecked();
  await inv.locator('label.role-btn', { hasText: '109 Plainview Ave' }).click();
  await inv.getByRole('button', { name: 'Invite Them' }).click();
  const link = await inv.locator('.copy-link input').inputValue();
  const g = await (await browser.newContext()).newPage();
  await g.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await g.getByRole('button', { name: 'Sign In' }).click();
  await g.waitForURL(/\/guest$/);
  await g.getByRole('link', { name: 'Market Map' }).click();
  await expect(g.getByRole('heading', { level: 1, name: 'Market Map' })).toBeVisible();
  await expect(g.getByRole('button', { name: 'Each Sale' })).toBeVisible();
  await expect(g.getByRole('button', { name: 'Our Projects' })).toHaveCount(0);
  expect((await g.request.get('/api/market/points?bbox=-79,35.5,-78.5,36.2')).status()).toBe(200);
  // Agents can go to an address, but owners' names on a parcel are for us only.
  expect((await g.request.get('/api/market/find?q=ab')).status()).toBe(200);
  expect((await g.request.get('/api/market/parcel?lat=35.78&lng=-78.64')).status()).toBe(403);
});

test('the buy box: a zone where we can pay more than lots sell for, on the page and on a watched lot', async ({ page }) => {
  const s = Date.now().toString().slice(-6);
  const hood = `Buyzone ${s}`;
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  const add = async (i: number, use: string, sf: number | null, price: number, year: number | null) => {
    const r = await db.query(`insert into market_parcels (county, parcel_key, address, street, city, zip, neighborhood, land_use, heated_sf, year_built, lat, lng, last_sale_price, last_sale_on)
      values ('wake', $1, $2, $3, 'Raleigh', $9, $4, $5, $6, $7, 35.79, -78.64, $8, current_date - 40) returning id`, [`B${s}${i}`, `${i} BUYZONE${s} ST`, `BUYZONE${s} ST`, hood, use, sf, year, price, `7${s.slice(-4)}`]);
    await db.query(`insert into market_sales (parcel_id, sold_on, price, heated_sf) values ($1, current_date - 40, $2, $3)`, [r.rows[0].id, price, sf]);
  };
  for (let i = 0; i < 6; i++) await add(i, 'single_family', 2600, 2_300_000 + i * 10_000, 2022); // new builds at ~$890/sf
  for (let i = 6; i < 9; i++) await add(i, 'land', null, 300_000, null); // lots at $300k
  await db.query(`insert into properties (address, city, neighborhood, asking_price) values ($1, 'Raleigh', $2, 400000)`, [`${s} Buyzone St`, hood]);
  // Its ZIP sells fast: 15 days on market (Redfin).
  await db.query(`insert into market_trends (region_type, region, metro, property_type, period_end, median_dom) values ('zip', $1, 'Raleigh, NC', 'all', current_date - 30, 15)`, [`7${s.slice(-4)}`]);
  // Builders at work there: two new homes and a teardown within half a mile (earlier runs' made-up permits there cleared first).
  await db.query(`delete from market_permits where permit_no like 'BZ%'`);
  for (const [i, kind] of (['new_home', 'new_home', 'demolition'] as const).entries())
    await db.query(`insert into market_permits (source, county, permit_no, kind, issued_on, year, lat, lng, builder) values ('raleigh', 'wake', $1, $2, current_date - 20, extract(year from current_date), 35.7905, -78.6402, $3)`, [`BZ${s}${i}`, kind, kind === 'demolition' ? null : `Bzlocal${s} Homes, LLC`]);
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto('/market/buy-box');
  await expect(page.locator('.market-map.leaflet-container')).toBeVisible();
  // Saving the numbers works every zone out again (a value that's always a change, whatever an earlier run left).
  await page.locator('input[name=buildPerSf]').fill('190');
  await page.locator('input[name=minLot]').fill(String(76000 + Number(s.slice(-3))));
  await page.getByRole('button', { name: 'Save and Work It Out Again' }).click();
  await expect(page.locator('main').getByText(/Saved: every zone is worked out again/)).toBeVisible({ timeout: 20_000 });
  await page.goto('/market/buy-box?show=buy');
  await expect(page.locator('.market-map.leaflet-container')).toBeVisible();
  const row = page.locator('.buy-table tr', { hasText: hood });
  await expect(row).toContainText('Buy Zone');
  await expect(row).toContainText('$300k');
  // Looking ahead (no trend yet: every sale is recent) and the builders nearby.
  await expect(row).toContainText('no trend yet');
  await expect(row).toContainText(/\d+ new · \d+ teardowns/);
  await expect(row).toContainText(`Bzlocal${s} Homes (2)`); // the local builder building there, by name
  await expect(row).toContainText('15 days');
  await expect(row).toContainText(`homes in 7${s.slice(-4)} sell in about 15 days`);
  // Raising the build cost makes it too expensive; then back.
  await page.locator('input[name=buildPerSf]').fill('700');
  await page.getByRole('button', { name: 'Save and Work It Out Again' }).click();
  await expect(page.locator('main').getByText(/Saved: every zone/)).toBeVisible({ timeout: 20_000 });
  await page.goto('/market/buy-box?show=pass');
  await expect(page.locator('.market-map.leaflet-container')).toBeVisible();
  await expect(page.locator('.buy-table tr', { hasText: hood })).toContainText('Too Expensive');
  await page.locator('input[name=buildPerSf]').fill('190');
  await page.locator('input[name=minLot]').fill('75000');
  await page.getByRole('button', { name: 'Save and Work It Out Again' }).click();
  await expect(page.locator('main').getByText(/Saved: every zone/)).toBeVisible({ timeout: 20_000 });

  // The watched lot in that zone is checked against it.
  await page.goto('/watchlist');
  await page.getByRole('link', { name: `${s} Buyzone St` }).click();
  const check = page.locator('section', { hasText: 'Buy Box Check' });
  await expect(check).toContainText('Buy Zone');
  await expect(check).toContainText(/The asking price of \$400,000 is .* under what we can pay/);
  await page.goto('/admin/history');
  await expect(page.locator('main').getByText(/changed the buy box: Build Cost per sf \(\$\) 190 → 700/).first()).toBeVisible();
});

test('free market data: rates and what buyers can afford, time on market by ZIP, and who is building', async ({ page }) => {
  const s = Date.now().toString().slice(-6);
  const zip = `9${s.slice(-4)}`;
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  // Three years of weekly rates, ending at 6.30% (made up; the Federal Reserve is never called in tests).
  for (let i = 0; i < 160; i++) {
    const week = new Date(Date.UTC(2026, 8, 24) - i * 7 * 864e5).toISOString().slice(0, 10);
    await db.query(`insert into market_rates (series, week, rate) values ('30yr', $1, $2) on conflict (series, week) do update set rate = excluded.rate`, [week, (6.3 + Math.sin(i / 20) * 0.6).toFixed(2)]);
  }
  // Redfin's numbers for a made-up ZIP, now and a year earlier, and Wake County's month.
  for (const [end, dom] of [['2026-08-31', 14], ['2025-08-31', 31]] as const)
    await db.query(`insert into market_trends (region_type, region, metro, property_type, period_end, median_sale_price, median_ppsf, inventory, months_of_supply, median_dom, sale_to_list, price_drops, off_market_2wk)
      values ('zip', $1, 'Raleigh, NC', 'all', $2, 815000, 402.5, 37, 2.1, $3, 0.9934, 0.18, 0.41)`, [zip, end, dom]);
  await db.query(`update market_trends set homes_sold = 52 where region = $1`, [zip]);
  await db.query(`insert into market_trends (region_type, region, metro, property_type, period_end, median_sale_price, median_dom, months_of_supply, inventory)
    values ('county', 'Wake County, NC', 'Raleigh, NC', 'all', '2026-08-31', 480000, 33, 3.4, 5100) on conflict do nothing`);
  // A builder's new homes: enough to top the list whatever else is loaded (earlier runs' taken off first).
  await db.query(`delete from market_permits where permit_no like 'FB%-%' and builder like 'Testbuild%'`);
  await db.query(`insert into market_permits (source, county, permit_no, kind, issued_on, year, zip, lat, lng, builder, cost)
    select 'raleigh', 'wake', $1 || g, 'new_home', current_date - 30, extract(year from current_date), $2, 35.81, -78.62, $3, 400000 from generate_series(1, 400) g`,
    [`FB${s}-`, zip, `Testbuild${s} Homes, LLC`]);
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto('/market');
  const rates = page.locator('section', { hasText: 'Rates and Buyers' }).first();
  await expect(rates.locator('.tile', { hasText: '30-Year Rate Now' })).toContainText('6.30%');
  await expect(rates.locator('svg.rate-chart')).toBeVisible();
  await expect(rates.locator('tr', { hasText: '$1.5M and Up' })).toContainText(/\$\d{1,3},\d{3}/); // a monthly payment
  const zips = page.locator('.zip-table tr', { hasText: zip }).first(); // fastest, with enough sales: in the open top 20
  await expect(zips).toContainText('14');
  await expect(zips).toContainText('31 a year ago');
  await expect(zips).toContainText('Seller’s Market');
  await expect(page.locator('.tile', { hasText: 'Wake County' })).toContainText('33 days');
  await expect(page.locator('section', { hasText: 'Who’s Building' }).first()).toContainText(`Testbuild${s} Homes`);
  // The map's permit layer reads them in the view; guests without the Market Map can't.
  const p = await (await page.request.get('/api/market/permits?bbox=-78.63,35.80,-78.61,35.82&kinds=new_home')).json();
  expect(p.permits.filter((x: { b: string | null }) => x.b === `Testbuild${s} Homes`).length).toBe(400);
  await expect(async () => {
    const b = page.getByRole('button', { name: 'New-Home Permits' });
    if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
    await expect(b).toHaveAttribute('aria-pressed', 'true', { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  // The update buttons are there for each free source.
  await page.locator('summary', { hasText: 'Update One at a Time' }).click();
  for (const b of ['Update Rates', 'Update Redfin Data', 'Update Permits']) await expect(page.getByRole('button', { name: b })).toBeVisible();
});

test('a land deal from a wholesaler: its facts, the checklist, and the Deal Sources scoreboard', async ({ page }) => {
  const s = Date.now().toString().slice(-6);
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  await db.query(`insert into people (first_name, last_name) values ('Lana', $1)`, [`Land${s}`]);
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto('/watchlist/new?type=land');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('label.choice-opt:has(input[name="dealType"][value="land"]) input')).toBeChecked();
  await page.locator('input[name=address]').fill(`${s} Acreage Rd`);
  await page.locator('input[name=askingPrice]').fill('1,200,000');
  await page.locator('input[name=lotAcres]').fill('20');
  await page.locator('input[name=lotsPossible]').fill('24');
  await page.locator('select[name=utilities]').selectOption('nearby');
  await page.locator('select[name=entitlement]').selectOption('rezoning');
  await page.locator('select[name=sourcePersonId]').selectOption({ label: `Lana Land${s}` });
  await page.locator('select[name=sourceKind]').selectOption('wholesaler');
  await choose(page, 'sourceAccurate', 'no');
  await page.locator('input[name=sourceNote]').fill('said 24 acres, it’s 20');
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();
  await page.waitForURL(/\/watchlist\/[0-9a-f-]{36}$/);

  // Its facts: per lot and per acre, water and sewer, approvals; who sent it and that their numbers were off.
  await expect(page.locator('main h1').locator('..')).toContainText('Land / Subdivision');
  const land = page.locator('section', { has: page.getByRole('heading', { name: /^\W*Land$/ }) });
  await expect(land).toContainText('$50,000'); // 1.2M ÷ 24 lots
  await expect(land).toContainText('$60,000'); // per acre
  await expect(land).toContainText('Nearby: Would Need Extending');
  await expect(page.locator('main').getByText('Were off: said 24 acres, it’s 20')).toBeVisible();
  // The checklist: tick the first step.
  const list = page.locator('section', { has: page.getByRole('heading', { name: /Land Checklist/ }) });
  await expect(list).toContainText('0 of 10 done');
  await list.locator('li', { hasText: 'Zoning and what it allows' }).getByRole('button', { name: 'Done' }).click();
  await expect(list).toContainText('1 of 10 done', { timeout: 20_000 });
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('main').getByText(/checked off “Zoning and what it allows”/)).toBeVisible();

  // The scoreboard: Lana as a wholesaler, one deal, numbers that didn't hold up, too early to say.
  await page.goto('/watchlist/sources?type=land');
  const row = page.locator('.sources-table tr', { hasText: `Lana Land${s}` });
  await expect(row).toContainText('Wholesaler');
  await expect(row).toContainText('0 of 1'); // numbers held up
  await expect(row).toContainText('Too Early to Say');
  await expect(page.locator('.sources-table tr', { hasText: 'Wholesaler' }).first()).toBeVisible();
  // Her page shows her record as a source.
  await row.getByRole('link', { name: `Lana Land${s}` }).click();
  await page.getByRole('link', { name: /Deals/ }).first().click();
  await expect(page.locator('.tile', { hasText: 'As a Source' })).toContainText('Too Early to Say');
});

test('builders: a local quick seller, its track record, where it is moving in; national builders kept apart', async ({ page }) => {
  const s = Date.now().toString().slice(-6);
  const zip = `8${s.slice(-4)}`;
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  // Three homes permitted a year ago and sold about 8 months later, and two new permits this month.
  for (let i = 0; i < 3; i++) {
    const addr = `${100 + i} QUICKBUILD${s} LN`;
    await db.query(`insert into market_permits (source, county, permit_no, kind, issued_on, year, zip, lat, lng, builder, address)
      values ('raleigh', 'wake', $1, 'new_home', current_date - 400, extract(year from current_date - 400), $2, 35.79, -78.66, $3, $4)`, [`QB${s}${i}`, zip, `Quickbuild${s} Homes, LLC`, addr]);
    const r = await db.query(`insert into market_parcels (county, parcel_key, address, city, land_use, heated_sf, lat, lng, last_sale_price, last_sale_on)
      values ('wake', $1, $2, 'Raleigh', 'single_family', 2500, 35.79, -78.66, 1000000, current_date - 160) returning id`, [`QBP${s}${i}`, addr]);
    await db.query(`insert into market_sales (parcel_id, sold_on, price, heated_sf) values ($1, current_date - 160, 1000000, 2500)`, [r.rows[0].id]);
  }
  for (let i = 3; i < 5; i++)
    await db.query(`insert into market_permits (source, county, permit_no, kind, issued_on, year, zip, lat, lng, builder) values ('raleigh', 'wake', $1, 'new_home', current_date - 10, extract(year from current_date), $2, 35.79, -78.66, $3)`,
      [`QB${s}${i}`, zip, `Quickbuild${s} Homes, LLC`]);
  await db.query(`insert into market_permits (source, county, permit_no, kind, issued_on, year, zip, lat, lng, builder) values ('raleigh', 'wake', $1, 'new_home', current_date - 10, extract(year from current_date), $2, 35.79, -78.66, 'Lennar Carolinas, LLC')`, [`LN${s}`, zip]);
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto('/market');
  await page.getByRole('link', { name: 'Builders', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Builders' })).toBeVisible();
  const row = page.locator('.builders-table tr', { hasText: `Quickbuild${s} Homes` });
  await expect(row).toContainText('Local Builder');
  await expect(row).toContainText('Quick Seller');
  await expect(row).toContainText('3 of 5'); // sold
  await expect(row).toContainText('$400'); // $1M ÷ 2,500 sf
  await expect(page.locator('section', { hasText: 'Local Builders Moving In' }).first()).toContainText(`ZIP ${zip}`);
  // National builders have their own list.
  await expect(page.locator('.builders-table tr', { hasText: 'Lennar Carolinas' })).toHaveCount(0);
  await page.getByRole('link', { name: /National \/ Production/ }).click();
  await expect(page.locator('.builders-table tr', { hasText: 'Lennar Carolinas' }).first()).toBeVisible();
});

test('business entities: who owns what, documents, and tax IDs kept encrypted and shown on request; staff can’t see them', async ({ page, browser }) => {
  const s = Date.now().toString().slice(-6);
  await signIn(page, 'Sample Owner');
  // Chesson Investments, then WJ Investment Group with Chesson as a 65% member-manager.
  for (const name of [`Chesson Test${s}, LLC`, `WJ Test${s}, LLC`]) {
    await expect(async () => { // filled again if the page wasn't ready yet
      await page.goto('/entities/new');
      await page.locator('input[name=name]').fill(name);
      await page.locator('input[name=taxForm]').fill('Form 1065 partnership');
      await page.getByRole('button', { name: 'Add the Entity' }).click();
      await page.waitForURL(/\/entities\/[0-9a-f-]{36}$/, { timeout: 8000 });
    }).toPass({ timeout: 40_000 });
  }
  await expect(page.locator('h1')).toHaveText(`WJ Test${s}, LLC`);
  const add = page.locator('details', { hasText: 'Add a Member' });
  await add.locator('summary').click();
  await add.locator('select[name=memberEntityId]').selectOption({ label: `Chesson Test${s}, LLC` });
  await add.locator('input[name=percent]').fill('65');
  await add.locator('input[name=capital]').fill('146,250');
  await add.locator('select[name=role]').selectOption('member_manager');
  await add.getByRole('button', { name: 'Add the Member' }).click();
  await expect(page.locator('.members-table tr', { hasText: `Chesson Test${s}` })).toContainText('65%', { timeout: 20_000 });
  await add.locator('input[name=name]').fill(`James Test${s}`);
  await add.locator('input[name=percent]').fill('35');
  await add.getByRole('button', { name: 'Add the Member' }).click();
  await expect(page.locator('.members-table tr', { hasText: `James Test${s}` })).toContainText('35%', { timeout: 20_000 });
  await expect(page.locator('main').getByText('100% recorded')).toBeVisible();

  // A document, restricted.
  await page.getByRole('link', { name: /^Documents/ }).click();
  await page.locator('select[name=docType]').selectOption('Operating Agreement');
  await page.locator('input[name=note]').fill('signed May 20, 2025');
  await page.locator('input[name=file]').setInputFiles({ name: `oa-${s}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${s}\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n`) });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('link', { name: 'Operating Agreement · signed May 20, 2025' })).toBeVisible({ timeout: 20_000 });
  const docHref = await page.getByRole('link', { name: 'Operating Agreement · signed May 20, 2025' }).getAttribute('href');

  // The EIN: saved encrypted, shown as the last 4, opened on request and written to History.
  await page.getByRole('link', { name: /^Tax IDs/ }).click();
  await page.locator('input[name=value]').fill('987654321');
  await page.getByRole('button', { name: 'Save It' }).click();
  await expect(page.locator('main').getByText('Saved: •••• 4321.')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.tax-id-value').first()).toHaveText('•••• 4321');
  await page.getByRole('button', { name: 'Show' }).first().click();
  await expect(page.locator('.tax-id-value').first()).toHaveText('98-7654321');
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  const stored = await db.query(`select t.cipher from entity_tax_ids t join entities e on e.id = t.entity_id where e.name = $1`, [`WJ Test${s}, LLC`]);
  const logged = await db.query(`select summary from audit_log where summary like '%Federal EIN%' and entity_id = (select id from entities where name = $1)`, [`WJ Test${s}, LLC`]);
  await db.end();
  expect(stored.rows[0].cipher).not.toContain('7654321'); // never kept as plain text
  expect(logged.rows.map((r) => r.summary).sort()).toEqual(['added the Federal EIN (•••• 4321)', 'viewed the Federal EIN (•••• 4321)']);
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('main').getByText('viewed the Federal EIN (•••• 4321)')).toBeVisible();
  await expect(page.locator('main').getByText('7654321')).toHaveCount(0);

  // Staff without restricted-records access: no menu link, the page and the document are not found.
  const ctx = await browser.newContext();
  const st = await ctx.newPage();
  await signIn(st, 'Sample Staff');
  await expect(st.getByRole('link', { name: 'Business Entities' })).toHaveCount(0);
  await st.goto('/entities');
  await expect(st.getByText('This page could not be found.')).toBeVisible();
  expect((await st.request.get(docHref!.replace('/documents/', '/files/'))).status()).toBe(404);
  await ctx.close();
});

test('remove someone added by mistake, every save says how it went, and an association with its events and who we met', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  // Added as staff by mistake, never signed in: Remove takes them off, and the message box says so.
  await page.goto('/admin/users');
  const add = page.locator('section', { hasText: 'Add Staff, a Partner or an Accountant' }).last();
  await add.getByLabel('Email').fill(`mistake${s}@technicalsource.com`);
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.toast', { hasText: 'Added' })).toBeVisible();
  await page.reload();
  const card = page.locator('.user-card', { hasText: `mistake${s}@technicalsource.com` });
  page.on('dialog', (d) => d.accept());
  await expect(async () => {
    await card.getByRole('button', { name: 'Remove' }).click({ timeout: 2000 });
    await expect(page.locator('.toast', { hasText: `Removed mistake${s}@technicalsource.com` })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await page.reload();
  await expect(page.locator('.user-card', { hasText: `mistake${s}@technicalsource.com` })).toHaveCount(0);

  // An association, and a person to meet.
  await page.goto('/companies/new');
  await page.getByLabel('Name', { exact: true }).fill(`Triangle REIA ${s}`);
  await page.getByLabel('What They Are to Us').selectOption('association');
  await page.getByRole('button', { name: /Add Company|Save/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Triangle REIA ${s}`);
  await expect(page.locator('.page-head .chip', { hasText: 'Association' })).toBeVisible();
  const companyUrl = page.url();
  await page.goto('/people/new');
  await page.getByLabel('First Name', { exact: true }).fill('Morgan');
  await page.getByLabel('Last Name', { exact: true }).fill(`Meetup${s}`);
  await page.getByLabel('Networking Contact', { exact: true }).check();
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Morgan Meetup${s}`);

  // The event, held by the association (picked by typing), and who we met there and how.
  await page.goto('/events');
  await page.getByLabel('Name', { exact: true }).fill(`October Meetup ${s}`);
  await expect(async () => {
    await page.getByRole('combobox', { name: /Association/ }).fill(`REIA ${s}`);
    await page.getByRole('option', { name: new RegExp(`Triangle REIA ${s}`) }).click({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page.getByRole('button', { name: 'Add Event' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`October Meetup ${s}`);
  await expect(page.locator('.toast', { hasText: 'Saved' })).toBeVisible();
  await expect(page.getByRole('link', { name: `Triangle REIA ${s}` })).toBeVisible();
  await page.locator('summary', { hasText: 'Add Someone You Met' }).click();
  await page.getByRole('combobox', { name: /Who/ }).fill(`Meetup${s}`);
  await page.getByRole('option', { name: new RegExp(`Morgan Meetup${s}`) }).click();
  await page.getByLabel(/How You Met/).fill('Introduced by the host; building in Five Points');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.toast', { hasText: 'Added' })).toBeVisible();

  // The association's Events tab lists the event and who we met, with how.
  await page.goto(`${companyUrl}?tab=events`);
  const ev = page.locator('section', { hasText: 'Their Events and Who We Met' });
  await expect(ev).toContainText(`October Meetup ${s}`);
  await expect(ev).toContainText(`Morgan Meetup${s}`);
  await expect(ev).toContainText('Introduced by the host');
  // The Companies list says what they do, not "Roles".
  await page.goto(`/companies?q=Triangle REIA ${s}`);
  await expect(page.getByRole('columnheader', { name: 'What They Do' })).toBeVisible();
  await expect(page.locator('table.t .chip', { hasText: 'Association' })).toBeVisible();
});

test('the watchlist filtered by what the zoning allows; Find Locations and Zoning says what it did', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  for (const name of [`${s} Houses Ln`, `${s} Mixed Way`]) {
    await page.goto('/watchlist/new');
    await page.getByLabel('Address').fill(name);
    await page.getByRole('button', { name: 'Add to Watchlist' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  }
  // The county maps aren't called in tests: set what they'd have found.
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  await db.query(`update properties set zoning = 'R-4', zoning_family = 'houses', zoning_place = 'Raleigh', zoning_checked_at = now() where address = $1`, [`${s} Houses Ln`]);
  await db.query(`update properties set zoning = 'CX-3', zoning_family = 'mixed', zoning_place = 'Raleigh', zoning_checked_at = now() where address = $1`, [`${s} Mixed Way`]);
  await db.end();

  await page.goto(`/watchlist?q=${s}`);
  await expect(page.getByRole('link', { name: `${s} Houses Ln` })).toBeVisible();
  await expect(page.getByRole('link', { name: `${s} Mixed Way` })).toBeVisible();
  await page.getByRole('navigation', { name: 'Zoning' }).getByRole('link', { name: 'Houses', exact: true }).click();
  await expect(page).toHaveURL(/zoning=houses/);
  await expect(page.getByRole('link', { name: `${s} Houses Ln` })).toBeVisible();
  await expect(page.getByRole('link', { name: `${s} Mixed Way` })).toHaveCount(0);
  await expect(page.locator('tr', { hasText: `${s} Houses Ln` })).toContainText('Houses · Raleigh');
  // A second family adds to it; the search keeps the filter.
  await page.getByRole('navigation', { name: 'Zoning' }).getByRole('link', { name: 'Mixed Use', exact: true }).click();
  await expect(page.getByRole('link', { name: `${s} Mixed Way` })).toBeVisible();
  await expect(page.getByRole('link', { name: `${s} Houses Ln` })).toBeVisible();

  await expect(async () => {
    await page.getByRole('button', { name: 'Find Locations and Zoning' }).click({ timeout: 2000 });
    await expect(page.locator('.toast', { hasText: /Done: placed \d+ on the map/ })).toBeVisible({ timeout: 15000 });
  }).toPass({ timeout: 60000 });
});

test('market data updates itself: the scheduled route needs its secret, and Update Everything Now runs every part', async ({ page }) => {
  // Without Vercel's secret the scheduled route refuses.
  const r = await page.request.get('/api/cron/market?part=places');
  expect(r.status()).toBe(401);
  await signIn(page, 'Sample Owner');
  await page.goto('/market');
  await expect(page.locator('.auto-update')).toContainText('Updates itself twice a day');
  await expect(async () => {
    await page.getByRole('button', { name: 'Update Everything Now' }).click({ timeout: 2000 });
    await expect(page.locator('.toast', { hasText: 'Everything is updated.' })).toBeVisible({ timeout: 60000 });
  }).toPass({ timeout: 120000 });
  await page.reload();
  await expect(page.locator('.auto-update')).toContainText(/Map places, zoning and bills: \d/);
  await expect(page.locator('.auto-update')).toContainText(/linked \d+ bills/);
});

test('a partner from outside Technical Source: a sign-in link, sees everything but restricted records', async ({ page, browser }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  await page.goto('/admin/users');
  const add = page.locator('section', { hasText: 'Add Staff, a Partner or an Accountant' }).last();
  await expect(async () => {
    await add.getByLabel('Email').fill(`partner${s}@example.org`);
    await add.getByLabel('Name').fill(`Pat Partner${s}`);
    await add.locator('select[name=role]').selectOption('partner');
    await add.getByRole('button', { name: 'Add' }).click();
    await expect(add.locator('.copy-link input')).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  const link = await add.locator('.copy-link input').inputValue();
  expect(link).toMatch(/\/signin\/link\?t=/);
  await page.reload();
  await expect(page.locator('.user-card', { hasText: `partner${s}@example.org` })).toContainText('Send a New Sign-In Link');

  const ctx = await browser.newContext();
  const g = await ctx.newPage();
  await g.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await g.getByRole('button', { name: 'Sign In' }).click();
  await g.waitForURL((u) => !u.pathname.startsWith('/signin'));
  await g.goto('/projects');
  await expect(g.getByRole('link', { name: '109 Plainview Ave' }).first()).toBeVisible();
  await g.goto('/people');
  await expect(g.getByRole('heading', { level: 1 })).toHaveText('People');
  // Restricted records and managing users stay with the owner.
  await g.goto('/entities');
  await expect(g.getByText('This page could not be found.')).toBeVisible();
  await g.goto('/admin/users');
  await expect(g.getByText('This page could not be found.')).toBeVisible();
  await ctx.close();
});

test('drop documents: many at once, the same file skipped, filed from the inbox onto a project’s Documents tab', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const pdf = (n: string) => ({ name: `${n}-${s}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${n} ${s}\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n`) });
  await page.goto('/documents/drop');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Drop Documents');
  // Claude is off in tests: files wait in the inbox; a text file isn't taken.
  await page.locator('input[type=file]').setInputFiles([pdf('deed'), pdf('receipt'), { name: `notes-${s}.txt`, mimeType: 'text/plain', buffer: Buffer.from('hello') }]);
  await expect(page.locator('.toast', { hasText: /Done: 3 files sent/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('tr', { hasText: `deed-${s}.pdf` })).toContainText('Needs You');
  await expect(page.locator('tr', { hasText: `notes-${s}.txt` })).toContainText('Not Kept');
  // The same file again is skipped.
  await page.locator('input[type=file]').setInputFiles([pdf('deed')]);
  await expect(page.locator('tr', { hasText: `deed-${s}.pdf` }).last()).toContainText('Already Here', { timeout: 30_000 });

  // File the deed on 109 Plainview by hand.
  await page.reload();
  const item = page.locator('li', { hasText: `deed-${s}.pdf` });
  await item.locator('summary', { hasText: 'File It' }).click();
  await expect(async () => {
    await item.getByRole('combobox', { name: /Where It Goes/ }).fill('Plainview');
    await page.getByRole('option', { name: /109 Plainview Ave/ }).first().click({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await item.locator('select[name=type]').selectOption('Deed');
  await item.locator('input[name=title]').fill(`Recorded deed ${s}`);
  await item.getByRole('button', { name: 'File It' }).click();
  await expect(page.locator('.toast', { hasText: 'Filed on 109 Plainview Ave' })).toBeVisible();

  await page.goto('/projects');
  await page.getByRole('link', { name: '109 Plainview Ave' }).first().click();
  await page.locator('.tabs').getByRole('link', { name: 'Documents' }).click();
  const deeds = page.locator('section', { hasText: 'Deed, Title and Survey' });
  await expect(deeds).toContainText(`Recorded deed ${s}`);
});

test('drop documents: a zip is opened in the browser and each file inside is filed', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const { zipSync, strToU8 } = await import('fflate');
  const pdf = (n: string) => strToU8(`%PDF-1.4\n% ${n} ${s}\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n`);
  const zip = zipSync({ [`folder/lease-${s}.pdf`]: pdf('lease'), [`folder/survey-${s}.pdf`]: pdf('survey'), '__MACOSX/folder/._x.pdf': strToU8('junk') });
  await page.goto('/documents/drop');
  await page.locator('input[type=file]').setInputFiles([{ name: `docs-${s}.zip`, mimeType: 'application/zip', buffer: Buffer.from(zip) }]);
  await expect(page.locator('.toast', { hasText: /Done: 2 files sent/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('tr', { hasText: `lease-${s}.pdf` })).toContainText('Needs You');
  await expect(page.locator('tr', { hasText: `survey-${s}.pdf` })).toContainText('Needs You');
});

test('a project made from dropped documents, and a receipt filed as overhead', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  const [{ id: owner }] = (await db.query(`select id from users where role = 'owner' limit 1`)).rows;
  // Two documents Claude read as being about a property we don't have yet (Claude is off in tests).
  const np = { address: `${s} Shaw View Alley`, unit: '101', city: 'Raleigh', state: 'NC', zip: '27601', purchasePrice: null, purchasedOn: '2024-11-22', heatedSf: 1180, community: 'The Grey' };
  for (const [n, extra] of [['settlement', { purchasePrice: 389900 }], ['deed', {}]] as const) {
    await db.query(`insert into files (entity, entity_id, name, content_type, size, sha256, data, caption, uploaded_by, proposed_property)
      values ('inbox', $1, $2, 'application/pdf', 10, md5($2), '\\x255044462d'::bytea, $3, $1, $4)`, [owner, `${n}-${s}.pdf`, n === 'deed' ? 'Deed · Recorded deed' : 'Settlement Statement · Purchase', JSON.stringify({ ...np, ...extra })]);
  }
  // A receipt for the business itself, waiting.
  await db.query(`insert into files (entity, entity_id, name, content_type, size, sha256, data, caption, uploaded_by)
    values ('inbox', $1, $2, 'application/pdf', 10, md5($2), '\\x255044462d'::bytea, 'Receipt', $1)`, [owner, `staples-${s}.pdf`]);
  await db.end();

  await page.goto('/documents/drop');
  const card = page.locator('.new-property', { hasText: `${s} Shaw View Alley Unit 101` });
  await expect(card).toContainText('2 documents');
  await expect(card.locator('input[name=lotCost]')).toHaveValue('389900');
  await expect(card.locator('input[name=heatedSf]')).toHaveValue('1180');
  await expect(card.locator('input[name=neighborhood]')).toHaveValue('The Grey');
  await expect(async () => {
    await card.getByRole('button', { name: 'Create This Project' }).click({ timeout: 2000 });
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}\?tab=documents/, { timeout: 15000 });
  }).toPass({ timeout: 40_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('The Grey #101');
  await expect(page.locator('main')).toContainText('Settlement Statement');
  await expect(page.locator('main')).toContainText('Deed');

  // The receipt, filed as overhead for Chesson Investments, with its amount and category.
  await page.goto('/documents/drop');
  const item = page.locator('li', { hasText: `staples-${s}.pdf` });
  await item.locator('summary', { hasText: 'File It' }).click();
  await expect(async () => {
    await item.getByRole('combobox', { name: /Where It Goes/ }).fill('Overhead: Chesson');
    await page.getByRole('option', { name: /Overhead: Chesson Investments/ }).click({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await item.locator('input[name=vendor]').fill(`Staples ${s}`);
  await item.locator('input[name=amount]').fill('44.59');
  await item.locator('input[name=spentOn]').fill(`${new Date().getFullYear()}-01-15`);
  await item.locator('select[name=category]').selectOption('office');
  await item.getByRole('button', { name: 'File It' }).click();
  await expect(page.locator('.toast', { hasText: 'Filed as overhead for Chesson Investments LLC' })).toBeVisible();
  await page.goto('/overhead');
  await expect(page.locator('tr', { hasText: `Staples ${s}` })).toContainText('Office and Supplies');
  await expect(page.locator('tr', { hasText: `Staples ${s}` })).toContainText('$44.59');
});

test('comps on a project: county sales offered, one typed from an appraisal, sources and finish level counted, the value used', async ({ page }) => {
  const s = Date.now().toString().slice(-6);
  const lat = 34.2 + Number(s.slice(-3)) / 2000, lng = -79.9;
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  // Earlier runs' made-up sales nearby would be offered too: clear them first.
  await db.query(`delete from comps where market_sale_id in (select s.id from market_sales s join market_parcels pa on pa.id = s.parcel_id where pa.address like '%COMPLY RD')`);
  await db.query(`delete from market_sales where parcel_id in (select id from market_parcels where address like '%COMPLY RD')`);
  await db.query(`delete from market_parcels where address like '%COMPLY RD'`);
  const p = await db.query(`insert into projects (name, address, city, heated_sf, lat, lng) values ($1, $2, 'Raleigh', 2400, $3, $4) returning id`, [`Comp Test ${s}`, `${s} Comp St`, lat, lng]);
  const id = p.rows[0].id;
  for (const [i, sf, price] of [[1, 2300, 690_000], [2, 2500, 750_000], [3, 900, 200_000]] as const) {
    const r = await db.query(`insert into market_parcels (county, parcel_key, address, street, city, neighborhood, land_use, heated_sf, year_built, lat, lng)
      values ('wake', $1, $2, $3, 'Raleigh', $4, 'single_family', $5, 2021, $6, $7) returning id`, [`C${s}${i}`, `${i}${s} COMPLY RD`, `COMPLY${s} RD`, `Comply ${s}`, sf, lat + i * 0.001, lng]);
    await db.query(`insert into market_sales (parcel_id, sold_on, price, heated_sf) values ($1, current_date - 60, $2, $3)`, [r.rows[0].id, price, sf]);
  }
  await db.query(`insert into files (entity, entity_id, name, content_type, size, sha256, data) values ('project', $1, 'Appraisal_Report.pdf', 'application/pdf', 9, $2, $3)`, [id, `cmp${s}`, Buffer.from('%PDF-1.4\n')]);
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto(`/projects/${id}?tab=comps`);
  // County sales nearby are offered, the small house (900 sf) is left out.
  const offered = page.locator('[data-suggest]');
  await expect(offered).toHaveCount(2);
  await expect(page.locator(`[data-suggest="3${s} COMPLY RD"]`)).toHaveCount(0);
  await expect(async () => {
    await page.locator(`[data-suggest="1${s} COMPLY RD"] [data-k=add-public-comp]`).click();
    await expect(page.locator(`tr[data-comp="1${s} COMPLY RD"]`)).toBeVisible({ timeout: 5000 });
  }).toPass();
  await expect(page.locator(`[data-suggest="1${s} COMPLY RD"]`)).toHaveCount(0);

  // One typed in from an appraisal, with its finish level and an adjustment.
  await page.locator('.comp-add > summary').click();
  const form = page.locator('.comp-add');
  await form.getByLabel('Address', { exact: true }).fill(`77 Appraised Ln ${s}`);
  await form.getByLabel('Source').selectOption('appraisal');
  await form.getByLabel('Sold or Contract Date').fill('2026-06-01');
  await form.getByLabel('Price', { exact: true }).fill('820,000');
  await form.getByLabel('Heated SF').fill('2400');
  await form.getByLabel('Finish Level').selectOption('high');
  await form.getByLabel(/^Adjustments/).fill('Size: -20,000');
  await form.getByRole('button', { name: 'Add Comp' }).click();
  const typed = page.locator(`tr[data-comp="77 Appraised Ln ${s}"]`);
  await expect(typed).toContainText('$800,000');
  await expect(typed).toContainText('High End');

  // Two looked at: one public, one private; both counted.
  const tiles = page.locator('.tiles');
  await expect(tiles).toContainText('1 public · 1 private');
  await expect(tiles.locator('.tile', { hasText: 'Counted in the Value' })).toContainText('2');

  // Our finish level: the value at our finish uses only the High End comp ($820k / 2,400 sf × 2,400, size adjustment aside).
  await page.getByLabel('Our finish level').selectOption('high');
  await page.locator('.comp-bar').getByRole('button', { name: 'Save' }).click();
  await expect(tiles.locator('.tile', { hasText: 'At Our Finish' })).toContainText('$820,000'); // the size adjustment is left out of $/sf

  // Not counting the county sale leaves the appraisal's comp alone in the value.
  await page.locator(`tr[data-comp="1${s} COMPLY RD"] [data-k=comp-count]`).click();
  await expect(page.locator(`tr[data-comp="1${s} COMPLY RD"] [data-k=comp-count]`)).toHaveText(/Not Counted/);
  await expect(tiles.locator('.tile', { hasText: 'Counted in the Value' })).toContainText('1');

  await page.locator('[data-k=use-comp-value]').click();
  await expect(page.locator('.comp-bar')).toContainText('$820,000');

  // Reading an appraisal says plainly when Claude is off here.
  await page.locator('[data-k=read-comps]').first().click();
  await expect(page.locator('.toast').filter({ hasText: /isn’t switched on here/ })).toBeVisible();

  await page.goto(`/projects/${id}?tab=history`);
  const h = page.locator('main');
  await expect(h).toContainText(`added a comp from the county records: 1${s} COMPLY RD`);
  await expect(h).toContainText(`added a comp: 77 Appraised Ln ${s}`);
  await expect(h).toContainText('set our finish level to High End');
  await expect(h).toContainText('stopped counting the comp');
  await expect(h).toContainText('set the market value to $820,000 from the comps');
});

test('a presale someone told us about is watched until the county records it; whose numbers held up', async ({ page }) => {
  const s = Date.now().toString().slice(-6);
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db.connect();
  const p = await db.query(`insert into projects (name, address, city, heated_sf) values ($1, $2, 'Raleigh', 3000) returning id`, [`Presale Test ${s}`, `${s} Presale St`]);
  const id = p.rows[0].id;
  await db.query(`insert into people (first_name, last_name) values ('Blake', $1)`, [`Builder${s}`]);
  await db.end();

  await signIn(page, 'Sample Owner');
  await page.goto(`/projects/${id}?tab=comps`);
  await page.locator('.comp-add > summary').click();
  const form = page.locator('.comp-add');
  await form.getByLabel('Address', { exact: true }).fill(`88 Watched Way ${s}`);
  await form.getByLabel('Source').selectOption('new_build');
  await form.getByLabel('Status').selectOption('presale');
  await form.getByLabel('Price', { exact: true }).fill('1,000,000');
  await form.getByLabel('Heated SF').fill('3000');
  await form.getByLabel(/Expected Closing/).fill('2026-11-15');
  await form.getByLabel('Builder', { exact: true }).fill(`Envision ${s}`);
  await form.getByRole('combobox', { name: /Who Gave It to Us/ }).fill(`Builder${s}`);
  await form.getByRole('option', { name: new RegExp(`Builder${s}`) }).click();
  await form.getByRole('button', { name: 'Add Comp' }).click();
  const row = page.locator(`tr[data-comp="88 Watched Way ${s}"]`);
  await expect(row).toContainText('Watching for the Close: 11/15/2026');
  await expect(row).toContainText(`From Blake Builder${s}`);
  await expect(row).toContainText(`Built by Envision ${s}`);

  // The lot sells first (not the close), then the house closes at $1,020,000.
  const db2 = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci' });
  await db2.connect();
  const parcel = await db2.query(`insert into market_parcels (county, parcel_key, address, street, city, land_use) values ('wake', $1, $2, $3, 'Raleigh', 'single_family') returning id`, [`W${s}`, `88 WATCHED WAY ${s}`.replace(` ${s}`, ''), 'WATCHED']);
  await db2.query(`update market_parcels set address = $2 where id = $1`, [parcel.rows[0].id, `88 WATCHED WAY ${s}`]);
  await db2.query(`insert into market_sales (parcel_id, sold_on, price) values ($1, current_date - 5, 300000), ($1, current_date - 1, 1020000)`, [parcel.rows[0].id]);
  await db2.end();

  await page.goto('/market');
  await expect(async () => {
    await page.getByRole('button', { name: 'Update Everything Now' }).click({ timeout: 2000 });
    await expect(page.locator('.toast', { hasText: 'Everything is updated.' })).toBeVisible({ timeout: 60000 });
  }).toPass({ timeout: 120000 });
  await page.goto(`/projects/${id}?tab=comps`);
  await expect(row).toContainText('Closed $1,020,000');
  await expect(row).toContainText('+2% vs. what we were told');
  await expect(row).not.toContainText('Watching for the Close');
  const held = page.locator('tr:not([data-comp])', { hasText: `Blake Builder${s}` });
  await expect(held).toContainText('Held up');
  await page.goto(`/projects/${id}?tab=history`);
  await expect(page.locator('main')).toContainText(`found that the presale at 88 Watched Way ${s} closed: $1,020,000`);
});
