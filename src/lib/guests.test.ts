import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestTypes, cleanExtras, cleanAbilities, hashToken, isLive, looksLikeToken, mayGuest, newToken, sessionHours } from './guests';

test('what a guest may do on a project', () => {
  assert.deepEqual(cleanAbilities(['daily_log.add', 'bogus']), ['overview', 'daily_log', 'daily_log.add']);
  assert.deepEqual(cleanAbilities([]), []);
  const a = { projectId: 'p', can: ['overview', 'schedule'], endsOn: '2026-12-31', removed: null };
  assert.ok(mayGuest(a, 'schedule', '2026-10-02'));
  assert.ok(!mayGuest(a, 'issues', '2026-10-02'));
  assert.ok(!mayGuest(a, 'schedule', '2027-01-01')); // past its last day
  assert.ok(!isLive({ ...a, removed: new Date() }, '2026-10-02'));
  assert.ok(!mayGuest(undefined, 'overview', '2026-10-02'));
});

test('sign-in links: random tokens, only the hash kept', () => {
  const t = newToken();
  assert.ok(looksLikeToken(t));
  assert.notEqual(t, newToken());
  assert.equal(hashToken(t).length, 64);
  assert.ok(!looksLikeToken('short'));
  assert.ok(!looksLikeToken("abc'; drop table users;--abcdefghijklmnopqrstuvwxyz0123"));
});

test('guests stay signed in 30 days, staff 12 hours', () => {
  assert.equal(sessionHours('guest', 'link'), 720);
  assert.equal(sessionHours('staff', 'microsoft-entra-id'), 12);
});

test('every outside type starts with abilities that exist, and only agents and wholesalers see deals', () => {
  for (const t of guestTypes) {
    assert.deepEqual(cleanAbilities([...t.can]), [...t.can].length ? cleanAbilities([...t.can]) : []);
    assert.ok(t.can.includes('overview'), t.key);
  }
  assert.deepEqual(guestTypes.filter((t) => t.extras.length).map((t) => t.key), ['agent', 'wholesaler']);
  assert.deepEqual(cleanExtras(['market', 'deals', 'bogus']), ['deals', 'market']);
});

test('the owner standard per type wins over the built-in one', async () => {
  const { partnerStandard } = await import('./guests');
  assert.deepEqual(partnerStandard('agent'), { can: ['overview', 'schedule'], extras: ['deals', 'market'] });
  assert.deepEqual(partnerStandard('agent', { agent: { can: ['overview'], extras: ['market'] } }), { can: ['overview'], extras: ['market'] });
  assert.deepEqual(partnerStandard('gc', { agent: { can: [], extras: [] } }).can.length, 5);
  assert.equal(partnerStandard('nonsense').can[0], 'overview');
});
