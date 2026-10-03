import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byMonth, onTime, sortTimeline, vendorSummary, type TimelineEvent } from './timeline-rules';
import { overallGrade } from './grades';

const e = (on: string, title: string): TimelineEvent => ({ on, kind: 'work', title });

test('newest first, the same day in the order added, bad dates left out', () => {
  assert.deepEqual(sortTimeline([e('2026-01-02', 'a'), e('2026-03-01T10:00:00Z', 'b'), e('2026-01-02', 'c'), e('', 'x')]).map((x) => [x.on, x.title]),
    [['2026-03-01', 'b'], ['2026-01-02', 'a'], ['2026-01-02', 'c']]);
});

test('grouped by month with a plain label', () => {
  const g = byMonth([e('2026-10-03', 'a'), e('2026-09-30', 'b'), e('2026-10-01', 'c')]);
  assert.deepEqual(g.map((x) => [x.label, x.events.map((y) => y.title)]), [['October 2026', ['a', 'c']], ['September 2026', ['b']]]);
});

test('on time when done by the due day', () => {
  assert.equal(onTime('2026-05-01', '2026-05-01'), true);
  assert.equal(onTime('2026-05-02', '2026-05-01'), false);
  assert.equal(onTime(null, '2026-05-01'), null);
});

test('a vendor summed up across properties', () => {
  const s = vendorSummary({
    projects: ['p1', 'p2', 'p1'], paidCents: [100_00, 250_50],
    assignments: [{ done: '2026-01-01', due: '2026-01-02' }, { done: '2026-02-05', due: '2026-02-01' }, { done: null, due: '2026-03-01' }],
    issues: [{ status: 'open' }, { status: 'resolved' }], grades: ['A', 'B', 'X'],
  });
  assert.deepEqual(s, { jobs: 2, paid: 350_50, onTimePct: 50, onTimeOf: 2, openIssues: 1, averageGrade: overallGrade([{ grade: 'A' }, { grade: 'B' }])!.letter });
  assert.equal(vendorSummary({ projects: [], paidCents: [], assignments: [], issues: [], grades: [] }).averageGrade, null);
});
