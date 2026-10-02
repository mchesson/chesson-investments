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
  await choose(page, 'kind', 'site_walk');
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
  await choose(page, 'responsible', 'owner');
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
  await expect(page.getByText(/Imported .* 2 bills/)).toBeVisible();
  await page.goto(`/companies?q=Haul${s}`);
  await page.getByRole('link', { name: `Haul${s} Brothers`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What We’ve Spent With Them' })).toBeVisible();
  await expect(page.getByText('$800.50 in all · 1 project · 2 invoices')).toBeVisible();
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
  await expect(page.getByText('No one matches')).toBeVisible();

  await page.goto('/admin/archived');
  const row = page.locator('li', { hasText: `Gone Soon${s}` });
  await row.getByRole('button', { name: 'Restore' }).click();
  await page.goto(`/people?q=Soon${s}`);
  await expect(page.getByRole('link', { name: `Gone Soon${s}` })).toBeVisible();

  await page.goto(url);
  await page.getByRole('link', { name: 'Delete Permanently…' }).click();
  await expect(page.getByText('1 roles')).toBeVisible();
  await page.getByLabel(/Type the name to confirm/).fill('wrong name');
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.getByText(`Type the name exactly: Gone Soon${s}`)).toBeVisible();
  await page.getByLabel(/Type the name to confirm/).fill(`gone soon${s}`);
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.getByText(`Deleted Gone Soon${s} permanently`)).toBeVisible();
  expect((await page.goto(url))?.status()).toBe(404);

  // Money history blocks a delete.
  const file = JSON.stringify({ companies: [{ name: `Keep${s} Lumber`, role: 'supplier', supplierTypes: ['materials'] }],
    bills: [{ project: '109 Plainview Ave', vendor: `Keep${s} Lumber`, date: '2026-09-02', lines: [{ kind: 'build', costCode: '01', amount: '99.00' }] }] });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'keep.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.getByText(/Imported .* 1 bills/)).toBeVisible();
  await page.goto(`/companies?q=Keep${s}`);
  await page.getByRole('link', { name: `Keep${s} Lumber`, exact: true }).click();
  await page.getByRole('link', { name: 'Delete Permanently…' }).click();
  await expect(page.getByText(/It has 1 bills from them/)).toBeVisible();
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
  await expect(page.getByText(/^Imported /)).toBeVisible();

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
  await expect(page.getByText('Estimate added.')).toBeVisible();

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
  await expect(page.getByText(new RegExp(`chose Oak${s} Builders’s bid .* as the winning budget`)).first()).toBeVisible();
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
  await expect(page.getByText(/^Imported /)).toBeVisible();
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
  await expect(page.getByText('Making money each month')).toBeVisible();
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
  await expect(page.getByText(`Pat Tenant ${s}`).first()).toBeVisible();

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
  await expect(page.getByText('Losing money each month')).toBeVisible();
  await expect(page.getByText(/Break-even rent: \$[0-9,]+ a month/)).toBeVisible();

  await page.getByRole('link', { name: 'History' }).last().click();
  await expect(page.getByText(`added the lease with Pat Tenant ${s}: $2,500 a month from 2026-09-01 to 2027-08-31`)).toBeVisible();
});

test('stages: several going at once, each with its sub-stages, all in History and on the list', async ({ page }) => {
  await signIn(page, 'Sample Owner');
  const s = Date.now().toString().slice(-6);
  const file = JSON.stringify({ projects: [{ name: `Stage Test ${s}`, address: `${s} Stage St`, city: 'Raleigh', stage: 'building' }] });
  await page.goto('/admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'stage.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Import It' }).click();
  await expect(page.getByText(/^Imported /)).toBeVisible();
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
  await expect(page.getByText('moved Permits to In Review').first()).toBeVisible();
  await expect(page.getByText(/marked Permits Going Now/).first()).toBeVisible();
  await expect(page.getByText(/moved Rental to On the Market; Rental is going now/).first()).toBeVisible();

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
  await expect(page.getByText(`This looks like someone already on file: Robert Smithers${s}`)).toBeVisible();
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
  await expect(page.getByText(`A company with a name like this is already on file: Baggett${s}`)).toBeVisible();

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
  await expect(page.getByText(/^Imported /)).toBeVisible();
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
  await expect(page.getByText(/Say why they got D/)).toBeVisible();
  await page.locator('textarea[name=justification]').fill('Grout lines uneven in both baths; had to come back twice and still left a cracked tile.');
  await page.getByRole('button', { name: 'Save the Grade' }).click();
  await expect(page.locator('.dnu-banner')).toContainText('Overall grade D from 1 job');
  await expect(page.locator('.grade-card')).toContainText('Grout lines uneven');

  // Kept usable anyway, with why.
  await page.getByText('Keep Them Usable Anyway (Override)').click();
  await page.locator('textarea[name=reason]').fill('Only tile crew free this month; owner approved');
  await page.getByRole('button', { name: 'Keep Them Usable' }).click();
  await expect(page.locator('.dnu-banner')).toHaveCount(0);
  await expect(page.getByText(/Kept usable despite the grade/)).toBeVisible();

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
  await expect(page.getByText(/graded them D on 109 Plainview Ave/).first()).toBeVisible();
  await expect(page.getByText(/marked them Do Not Use: Overall grade D/).first()).toBeVisible();
  await expect(page.getByText(/moved issue #\d+ from Open to Fixed/).first()).toBeVisible();

  // The job's Vendors tab shows them with their grade.
  await page.goto('/projects');
  await page.getByRole('link', { name: '109 Plainview Ave' }).first().click();
  await page.locator('.tabs').getByRole('link', { name: 'Vendors and Issues' }).click();
  await expect(page.locator('.grade-card').filter({ has: page.getByRole('link', { name: `Tile${s} Pros`, exact: true }) }).locator('.grade-why')).toContainText('Grout lines uneven');
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
  await expect(page.getByText('Specializes in Five Points, Oakwood')).toBeVisible();
  await page.goto(`/people?roles=agent&q=Agent${s}`);
  await expect(page.locator('tr', { hasText: `Ava Agent${s}` })).toContainText('Specializes in Five Points, Oakwood');
});
