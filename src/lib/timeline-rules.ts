// One story in date order (owner, Oct 3, 2026: "under each property should be a
// timeline of all things that have happened at the property and who did it",
// and for a vendor "what they did for us"). Built from what's already recorded;
// nothing new to enter. Pure, tested in timeline-rules.test.ts.
import { overallGrade } from './grades';

export const timelineKinds = [
  { key: 'deal', label: 'Buying and Selling' },
  { key: 'work', label: 'The Work' },
  { key: 'money', label: 'Money' },
  { key: 'people', label: 'People and Issues' },
  { key: 'docs', label: 'Documents' },
] as const;
export type TimelineKind = (typeof timelineKinds)[number]['key'];
export const isTimelineKind = (v: unknown): v is TimelineKind => timelineKinds.some((k) => k.key === v);

export type Link = { name: string; href: string };
export type TimelineEvent = {
  on: string; // YYYY-MM-DD
  kind: TimelineKind;
  title: string;
  who?: Link | null; // who did it (a vendor, or our person)
  where?: Link | null; // the property (on a vendor's timeline)
  detail?: string | null;
  href?: string | null;
  flag?: 'late' | 'good' | 'bad' | null;
};

/** Newest first; the same day keeps the order it was added in. */
export function sortTimeline(es: TimelineEvent[]): TimelineEvent[] {
  return es.map((e, i) => ({ e, i })).filter(({ e }) => /^\d{4}-\d{2}-\d{2}/.test(e.on))
    .sort((a, b) => (a.e.on === b.e.on ? a.i - b.i : a.e.on < b.e.on ? 1 : -1)).map(({ e }) => ({ ...e, on: e.on.slice(0, 10) }));
}

/** Grouped by month ("October 2026"), newest first. */
export function byMonth(es: TimelineEvent[]): { month: string; label: string; events: TimelineEvent[] }[] {
  const out: { month: string; label: string; events: TimelineEvent[] }[] = [];
  for (const e of sortTimeline(es)) {
    const m = e.on.slice(0, 7);
    let g = out.find((x) => x.month === m);
    if (!g) {
      const [y, mo] = m.split('-').map(Number);
      g = { month: m, label: new Date(Date.UTC(y, mo - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }), events: [] };
      out.push(g);
    }
    g.events.push(e);
  }
  return out;
}

/** Done on or before it was due: on time. */
export const onTime = (done: string | null | undefined, due: string | null | undefined) => (!done || !due ? null : done.slice(0, 10) <= due.slice(0, 10));

/** What a vendor did for us, summed up across every property. */
export function vendorSummary(v: {
  projects: string[]; paidCents: number[]; assignments: { done: string | null; due: string | null }[];
  issues: { status: string }[]; grades: string[];
}) {
  const judged = v.assignments.map((a) => onTime(a.done, a.due)).filter((x): x is boolean => x !== null);
  return {
    jobs: new Set(v.projects).size,
    paid: v.paidCents.reduce((s, c) => s + c, 0),
    onTimePct: judged.length ? Math.round((judged.filter(Boolean).length / judged.length) * 100) : null,
    onTimeOf: judged.length,
    openIssues: v.issues.filter((i) => i.status !== 'resolved' && i.status !== 'wont_fix').length,
    // The same overall grade the vendor's Grades tab shows.
    averageGrade: overallGrade(v.grades.map((grade) => ({ grade })))?.letter ?? null,
  };
}
