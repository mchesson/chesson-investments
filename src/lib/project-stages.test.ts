import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeStages, isSubStage, mainStage, openStage, projectStages, stageStates, subStageLabel, subStages, withState } from './project-stages';

test('every stage has sub-stages, with unique keys', () => {
  for (const s of projectStages) {
    assert.ok(subStages[s.key].length >= 3, s.key);
    assert.equal(new Set(subStages[s.key].map((x) => x.key)).size, subStages[s.key].length, s.key);
  }
  assert.ok(isSubStage('presold_listed', 'showings'));
  assert.ok(!isSubStage('permits', 'showings'));
  assert.equal(subStageLabel('rental', 'on_market'), 'On the Market');
  assert.equal(subStageLabel('rental', null), null);
});

test('a project with no saved states reads from its one stage', () => {
  const b = stageStates('building', {});
  assert.deepEqual(activeStages(b), ['building']);
  assert.equal(b.under_contract, 'done');
  assert.equal(b.permits, 'done');
  assert.equal(b.presold_listed, 'not_started');
  const r = stageStates('rental', null);
  assert.equal(r.building, 'done');
  assert.equal(r.presold_listed, 'not_started'); // a rental wasn't sold
  assert.equal(r.closed, 'not_started');
  assert.equal(stageStates('closed', {}).presold_listed, 'done');
});

test('several stages at once; the main stage is the latest going now', () => {
  let s = stageStates('under_contract', {});
  s = withState(s, 'permits', 'active');
  s = withState(s, 'building', 'active');
  assert.deepEqual(activeStages(s), ['under_contract', 'permits', 'building']);
  assert.equal(mainStage(s), 'building');
  s = withState(withState(withState(s, 'building', 'done'), 'permits', 'done'), 'under_contract', 'done');
  assert.equal(mainStage(s), 'building'); // nothing going: the latest done
  assert.equal(mainStage(stageStates('x', {})), 'under_contract');
  // Saved states win over the old single stage; junk is ignored.
  assert.deepEqual(activeStages(stageStates('building', { design: 'active', bogus: 'active', permits: 'nope' })), ['design']);
});

test('the opened stage', () => {
  const s = stageStates('building', {});
  assert.equal(openStage('permits', s), 'permits');
  assert.equal(openStage('nonsense', s), 'building');
  assert.equal(openStage(undefined, s), 'building');
});
