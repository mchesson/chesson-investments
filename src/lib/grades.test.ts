import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doNotUseFromGrade, gradeProblem, overallGrade } from './grades';
import { daysToFix, isOverdue, issueSummary, nextResolvedOn } from './issues';

test('a grade needs a letter and a justification', () => {
  assert.equal(gradeProblem({ grade: 'Z', justification: 'x'.repeat(30) }), 'Pick a grade.');
  assert.match(gradeProblem({ grade: 'B', justification: 'fine' })!, /Say why they got B/);
  assert.equal(gradeProblem({ grade: 'B', justification: 'Framing was square and on time; two missed callbacks.' }), null);
  assert.equal(gradeProblem({ grade: 'B', justification: 'Framing was square and on time; two missed callbacks.', parts: { quality: 'Q' } }), 'Pick a letter for quality.');
});

test('the overall grade averages the jobs', () => {
  assert.equal(overallGrade([]), null);
  assert.deepEqual(overallGrade([{ grade: 'A' }, { grade: 'B' }]), { letter: 'A', average: 3.5, count: 2 });
  assert.equal(overallGrade([{ grade: 'C' }, { grade: 'F' }])!.letter, 'D');
  assert.equal(overallGrade([{ grade: 'F' }])!.letter, 'F');
});

test('D or below marks Do Not Use unless overridden; a hand-set one is never cleared', () => {
  const none = { doNotUse: false, reason: null, override: false };
  assert.deepEqual(doNotUseFromGrade({ letter: 'D', count: 2 }, none), { doNotUse: true, reason: 'Overall grade D from 2 jobs' });
  assert.equal(doNotUseFromGrade({ letter: 'D', count: 2 }, { ...none, override: true }), null);
  assert.equal(doNotUseFromGrade({ letter: 'D', count: 2 }, { doNotUse: true, reason: 'Overall grade D from 2 jobs', override: false }), null);
  assert.equal(doNotUseFromGrade({ letter: 'F', count: 1 }, { doNotUse: true, reason: 'Walked off the job', override: false }), null);
  assert.deepEqual(doNotUseFromGrade({ letter: 'B', count: 3 }, { doNotUse: true, reason: 'Overall grade D from 2 jobs', override: false }), { doNotUse: false, reason: null });
  assert.equal(doNotUseFromGrade({ letter: 'B', count: 3 }, { doNotUse: true, reason: 'Walked off the job', override: false }), null);
  assert.equal(doNotUseFromGrade(null, none), null);
});

test('issues: days to fix, overdue, the tabs and closing', () => {
  assert.deepEqual(daysToFix({ reportedOn: '2026-09-01', resolvedOn: '2026-09-11', status: 'resolved' }, '2026-10-02'), { days: 10, closed: true });
  assert.deepEqual(daysToFix({ reportedOn: '2026-09-01', resolvedOn: null, status: 'waiting' }, '2026-10-02'), { days: 31, closed: false });
  assert.ok(isOverdue({ dueOn: '2026-09-30', status: 'open' }, '2026-10-02'));
  assert.ok(!isOverdue({ dueOn: '2026-09-30', status: 'resolved' }, '2026-10-02'));
  const s = issueSummary([
    { status: 'open', reportedOn: '2026-09-01', resolvedOn: null, dueOn: '2026-09-15' },
    { status: 'resolved', reportedOn: '2026-09-01', resolvedOn: '2026-09-05', dueOn: null },
    { status: 'wont_fix', reportedOn: '2026-09-01', resolvedOn: '2026-09-07', dueOn: null },
  ], '2026-10-02');
  assert.equal(s.counts.open, 1); assert.equal(s.open, 1); assert.equal(s.overdue, 1); assert.equal(s.avgDaysToFix, 5);
  assert.equal(nextResolvedOn('resolved', null, null, '2026-10-02'), '2026-10-02');
  assert.equal(nextResolvedOn('resolved', '2026-09-30', null, '2026-10-02'), '2026-09-30');
  assert.equal(nextResolvedOn('open', null, '2026-09-30', '2026-10-02'), null);
});
