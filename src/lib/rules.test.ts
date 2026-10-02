import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysSince, firstStage, isCold, isStage, roleDef, roles, stageLabel } from './roles';
import { dealCredit, pricePerLotSf, stageProblem, acresFromSf } from './properties';
import { can } from './permissions';
import { howMetProblem, splitName } from './how-met';
import { formatName, formatState, parseMoney, showPhone, storePhone, addDays } from './format';
import { detectFile } from './file-rules';

test('every role has stages, and the contractor ladder matches the spec', () => {
  for (const r of roles) assert.ok(r.stages.length >= 2, r.key);
  assert.deepEqual(roleDef('gc')!.stages.map((s) => s.label), ['Met', 'Talking', 'Bid', 'Hired', 'Preferred', 'Avoid']);
  assert.deepEqual(roleDef('agent')!.stages.map((s) => s.label), ['Met', 'Talking', 'Sent a Deal', 'Closed a Deal']);
  assert.deepEqual(roleDef('networking')!.stages.map((s) => s.label), ['Met', 'Keeping in Touch']);
  assert.deepEqual(roleDef('personal')!.stages.map((s) => s.label), ['Friend', 'Family', 'Acquaintance']);
  assert.equal(firstStage('sub'), 'met');
  assert.equal(isStage('gc', 'avoid'), true);
  assert.equal(isStage('agent', 'avoid'), false);
  assert.equal(stageLabel('agent', 'sent_deal'), 'Sent a Deal');
});

test('going cold: by role days, never for quiet stages', () => {
  assert.equal(daysSince('2026-09-01', '2026-10-02'), 31);
  assert.equal(isCold({ role: 'agent', stage: 'talking', createdOn: '2026-01-01' }, '2026-08-01', '2026-10-02'), true);
  assert.equal(isCold({ role: 'agent', stage: 'talking', createdOn: '2026-01-01' }, '2026-09-20', '2026-10-02'), false);
  assert.equal(isCold({ role: 'sub', stage: 'avoid', createdOn: '2025-01-01' }, null, '2026-10-02'), false);
  assert.equal(isCold({ role: 'lender', stage: 'met', createdOn: '2026-01-01' }, null, '2026-10-02'), true);
});

test('watchlist stages keep the bid', () => {
  assert.match(stageProblem('offer_made', { ourOffer: null, winningPrice: null, winningBuyer: null })!, /offer/);
  assert.match(stageProblem('lost', { ourOffer: null, winningPrice: null, winningBuyer: null })!, /offered/);
  assert.equal(stageProblem('lost', { ourOffer: '400000', winningPrice: null, winningBuyer: null }), null);
  assert.equal(pricePerLotSf('450000', 9148), 49.19);
  assert.equal(acresFromSf(9148), '0.210');
  assert.deepEqual(dealCredit([
    { stage: 'passed', metBuyBox: false, hasProject: false, referralFee: null },
    { stage: 'under_contract', metBuyBox: true, hasProject: true, referralFee: '2500' },
  ]), { sent: 2, metBuyBox: 1, closed: 1, referralFees: 2500 });
});

test('who may do what', () => {
  assert.equal(can('owner', 'bills.approve'), true);
  assert.equal(can('staff', 'bills.approve'), false);
  assert.equal(can('staff', 'sensitive.view'), false);
  assert.equal(can('accountant', 'contacts.view'), false);
  assert.equal(can('accountant', 'bills.pay'), true);
  assert.equal(can('pending', 'projects.view'), false);
  assert.equal(can(null, 'projects.view'), false);
});

test('introductions: always say who, and the introducer becomes a record', () => {
  assert.match(howMetProblem({ howMet: 'introduction', introducedById: null, newIntroducer: null })!, /Who introduced/);
  assert.equal(howMetProblem({ howMet: 'introduction', introducedById: null, newIntroducer: 'Jane Smith' }), null);
  assert.match(howMetProblem({ howMet: null, introducedById: 'a', newIntroducer: 'Jane Smith' })!, /not both/);
  assert.match(howMetProblem({ howMet: null, introducedById: 'a', newIntroducer: null, selfId: 'a' })!, /themselves/);
  assert.deepEqual(splitName('Mary Beth Smith'), { firstName: 'Mary Beth', lastName: 'Smith' });
  assert.equal(splitName('Cher'), null);
});

test('formatting', () => {
  assert.equal(storePhone('919.795.8948'), '+19197958948');
  assert.equal(showPhone('+19197958948'), '(919) 795-8948');
  assert.equal(parseMoney('$1,800,000'), '1800000.00');
  assert.equal(parseMoney('450k'), '450000.00');
  assert.equal(parseMoney('1.8m'), '1800000.00');
  assert.equal(parseMoney('abc'), undefined);
  assert.equal(parseMoney(''), null);
  assert.equal(formatName('MCDONALD'), 'McDonald');
  assert.equal(formatName('DeShawn'), 'DeShawn');
  assert.equal(formatState('north carolina'), 'NC');
  assert.equal(addDays('2026-10-02', 7), '2026-10-09');
});

test('files are known by their bytes', () => {
  assert.equal(detectFile(Buffer.from('%PDF-1.7'))!.type, 'application/pdf');
  assert.equal(detectFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))!.image, true);
  assert.equal(detectFile(Buffer.from('MZ executable')), null);
});

test('every new table has row-level security', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  for (const f of readdirSync('drizzle').filter((x) => x.endsWith('.sql'))) {
    const s = readFileSync(`drizzle/${f}`, 'utf8');
    for (const [, t] of s.matchAll(/CREATE TABLE "(\w+)"/g)) assert.ok(s.includes(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`), `${f}: ${t}`);
  }
});

import { cleanSupplierTypes, doNotUseProblem, roleTag } from './roles';

test('supplier kinds and role tags (never the stage)', () => {
  assert.deepEqual(cleanSupplierTypes(['appliances', 'utilities', 'bogus', 'utilities']), ['utilities', 'appliances']);
  assert.equal(roleTag({ role: 'supplier', supplierTypes: ['utilities'] }), 'Supplier: Utilities');
  assert.equal(roleTag({ role: 'supplier', supplierTypes: [] }), 'Supplier');
  assert.equal(roleTag({ role: 'gc', supplierTypes: ['utilities'] }), 'General Contractor');
});

test('Do Not Use needs a reason', () => {
  assert.equal(doNotUseProblem(true, ' '), 'Say why they’re Do Not Use.');
  assert.equal(doNotUseProblem(true, 'Walked off the job'), null);
  assert.equal(doNotUseProblem(false, null), null);
});

test('admins run the app but not restricted records; only the owner manages owners and admins', async () => {
  const { can, mayManage } = await import('./permissions');
  assert.equal(can('admin', 'users.manage'), true);
  assert.equal(can('admin', 'sensitive.view'), false);
  const owner = { id: 'o', role: 'owner' as const }, admin = { id: 'a', role: 'admin' as const }, staff = { id: 's', role: 'staff' as const };
  assert.equal(mayManage(owner, admin, 'staff'), null);
  assert.match(mayManage(admin, owner)!, /Only the owner/);
  assert.match(mayManage(admin, staff, 'admin')!, /Only the owner/);
  assert.match(mayManage(admin, admin)!, /your own/);
  assert.equal(mayManage(admin, staff, 'accountant'), null);
});

test('a role standard set: the owner one if saved; a person own ticks win', async () => {
  const { effectivePermissions, roleStandard } = await import('./permissions');
  assert.ok(roleStandard('staff').includes('contacts.edit'));
  assert.deepEqual(roleStandard('staff', { staff: ['contacts.view', 'bogus'] }), ['contacts.view']);
  assert.deepEqual(effectivePermissions('staff', null, { staff: ['projects.view'] }), ['projects.view']);
  assert.deepEqual(effectivePermissions('staff', ['money.view'], { staff: ['projects.view'] }), ['money.view']);
  assert.equal(effectivePermissions('owner', [], { staff: [] }).length > 10, true);
});
