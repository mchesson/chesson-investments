import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bigDealChecklist, checklistProgress, dealTypeLabel, guessSourceKind, isBigDeal, isDealType, rankSources, sourceStats, type SourceDeal } from './deal-sources';

const d = (o: Partial<SourceDeal>): SourceDeal => ({ stage: 'watching', metBuyBox: null, accurate: null, offered: false, bought: false, ...o });

test('a source’s record: counts, rates and a score pulled toward the middle when there are few deals', () => {
  const none = sourceStats([]);
  assert.equal(none.sent, 0);
  assert.equal(none.grade, 'unproven');
  assert.equal(none.score, 41); // all priors: 0.4·.5 + 0.3·.5 + 0.15·.3 + 0.15·.1 = .41
  // One great deal: better, but still too early to say.
  const one = sourceStats([d({ metBuyBox: true, accurate: true, offered: true, bought: true })]);
  assert.equal(one.grade, 'unproven');
  assert.ok(one.score > none.score);
  // Six deals, mostly good, two bought: proven.
  const good = sourceStats([
    d({ metBuyBox: true, accurate: true, offered: true, bought: true }), d({ metBuyBox: true, accurate: true, offered: true, bought: true }),
    d({ metBuyBox: true, accurate: true, offered: true }), d({ metBuyBox: true, accurate: false }), d({ metBuyBox: false, accurate: true }), d({}),
  ]);
  assert.deepEqual({ sent: good.sent, judged: good.judged, fit: good.fit, checked: good.checked, accurate: good.accurate, offered: good.offered, bought: good.bought, fitRate: good.fitRate, accuracyRate: good.accuracyRate },
    { sent: 6, judged: 5, fit: 4, checked: 5, accurate: 4, offered: 3, bought: 2, fitRate: 80, accuracyRate: 80 });
  assert.equal(good.grade, 'proven');
  // Lots of deals that never fit and whose numbers were off: not paying off.
  const bad = sourceStats(Array.from({ length: 8 }, () => d({ metBuyBox: false, accurate: false })));
  assert.equal(bad.grade, 'weak');
  assert.equal(bad.fitRate, 0);
  // Bought counts as offered.
  assert.equal(sourceStats([d({ bought: true })]).offered, 1);
});

test('best sources first', () => {
  const mk = (name: string, deals: SourceDeal[]) => ({ name, stats: sourceStats(deals) });
  const ranked = rankSources([
    mk('new', [d({ metBuyBox: true })]),
    mk('weak', Array.from({ length: 5 }, () => d({ metBuyBox: false, accurate: false }))),
    mk('proven', Array.from({ length: 4 }, () => d({ metBuyBox: true, accurate: true, offered: true, bought: true }))),
  ]).map((r) => r.name);
  assert.deepEqual(ranked, ['proven', 'new', 'weak']);
});

test('deal types, source kinds and the land and commercial checklists', () => {
  assert.ok(isDealType('land') && isDealType('commercial') && !isDealType('castle'));
  assert.equal(dealTypeLabel(null), 'Lot or Teardown');
  assert.ok(isBigDeal('land') && isBigDeal('commercial') && !isBigDeal('lot'));
  assert.equal(guessSourceKind(['investor', 'wholesaler']), 'wholesaler');
  assert.equal(guessSourceKind(['agent']), 'agent');
  assert.equal(guessSourceKind([]), null);
  const c = checklistProgress('land', { zoning: true, utilities: true, nope: true, yield: false });
  assert.equal(c.total, bigDealChecklist.land.length);
  assert.equal(c.done, 2);
  assert.equal(checklistProgress('lot', { zoning: true }).total, 0);
  // Every step has a reason, and keys are unique.
  for (const list of Object.values(bigDealChecklist)) {
    assert.equal(new Set(list.map((i) => i.key)).size, list.length);
    assert.ok(list.every((i) => i.why.length > 10));
  }
});
