// Issues with a contractor or vendor (owner, Oct 2, 2026): every open item with
// a status (each a tab), how long it took to fix and who was involved. Pure,
// tested in issues.test.ts.

export const issueStatuses = [
  { key: 'open', label: 'Open', hint: 'Reported, nobody on it yet' },
  { key: 'in_progress', label: 'Being Fixed', hint: 'They are working on it' },
  { key: 'waiting', label: 'Waiting on Them', hint: 'We asked; waiting on the vendor' },
  { key: 'resolved', label: 'Fixed', hint: 'Fixed and checked' },
  { key: 'wont_fix', label: 'Closed Without a Fix', hint: 'Dropped, credited or not worth fixing' },
] as const;
export type IssueStatus = (typeof issueStatuses)[number]['key'];
export const isIssueStatus = (v: string | null | undefined): v is IssueStatus => issueStatuses.some((s) => s.key === v);
export const issueStatusLabel = (v: string) => issueStatuses.find((s) => s.key === v)?.label ?? v;
export const isClosed = (s: string) => s === 'resolved' || s === 'wont_fix';

export const severities = [
  { key: 'low', label: 'Low' }, { key: 'medium', label: 'Medium' }, { key: 'high', label: 'High' },
] as const;
export const isSeverity = (v: string | null | undefined) => severities.some((s) => s.key === v);

export const involvedRoles = [
  { key: 'reported', label: 'Reported It' }, { key: 'fixing', label: 'Fixing It' }, { key: 'signed_off', label: 'Signed Off' }, { key: 'involved', label: 'Involved' },
] as const;

const dayMs = 86_400_000;
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs));

/** Days it took to fix (closed), or days open so far. */
export function daysToFix(i: { reportedOn: string; resolvedOn: string | null; status: string }, today: string): { days: number; closed: boolean } {
  const closed = isClosed(i.status) && !!i.resolvedOn;
  return { days: daysBetween(i.reportedOn, closed ? i.resolvedOn! : today), closed };
}

/** Overdue: still open past its due day. */
export const isOverdue = (i: { dueOn: string | null; status: string }, today: string) => !isClosed(i.status) && !!i.dueOn && i.dueOn < today;

/** Count per status, for the tabs, and the average days to fix the closed ones. */
export function issueSummary(xs: { status: string; reportedOn: string; resolvedOn: string | null; dueOn: string | null }[], today: string) {
  const counts = Object.fromEntries(issueStatuses.map((s) => [s.key, 0])) as Record<IssueStatus, number>;
  for (const x of xs) if (isIssueStatus(x.status)) counts[x.status]++;
  const fixed = xs.filter((x) => isClosed(x.status) && x.resolvedOn).map((x) => daysToFix(x, today).days);
  return {
    counts, open: xs.filter((x) => !isClosed(x.status)).length, overdue: xs.filter((x) => isOverdue(x, today)).length,
    avgDaysToFix: fixed.length ? Math.round((fixed.reduce((a, b) => a + b, 0) / fixed.length) * 10) / 10 : null,
  };
}

/** Moving an issue: closing it sets the day it was fixed (today unless given); reopening clears it. */
export function nextResolvedOn(to: string, given: string | null, cur: string | null, today: string): string | null {
  if (!isClosed(to)) return null;
  return given ?? cur ?? today;
}
