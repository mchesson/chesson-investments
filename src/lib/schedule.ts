// Budget stages, the GC's schedule and who owes what by when. Pure, tested in schedule.test.ts.
import { addDays, today as todayFn } from './format';
import { daysSince } from './roles';

export const versionKinds = [
  { key: 'rough', label: 'Rough Estimate', hint: 'Before design' },
  { key: 'design', label: 'Post-Design Budget', hint: 'Real numbers from the engineer and GC' },
  { key: 'approved', label: 'Approved Budget', hint: 'Signed off: the baseline' },
] as const;
export type VersionKind = (typeof versionKinds)[number]['key'];
export const isVersionKind = (v: string | null | undefined): v is VersionKind => versionKinds.some((k) => k.key === v);
export const versionLabel = (k: string) => versionKinds.find((x) => x.key === k)?.label ?? k;

export const responsibleKinds = [
  { key: 'gc', label: 'GC' },
  { key: 'owner', label: 'Us (Owner-Supplied)' },
  { key: 'vendor', label: 'A Vendor or Sub' },
] as const;
export const isResponsible = (v: string | null | undefined): v is 'gc' | 'owner' | 'vendor' => responsibleKinds.some((k) => k.key === v);
export const responsibleLabel = (k: string) => responsibleKinds.find((x) => x.key === k)?.label ?? k;

/** The latest version of each kind; the newest approved one is the baseline. */
export function latestByKind<T extends { kind: string; created: Date }>(versions: T[]): Partial<Record<VersionKind, T>> {
  const out: Partial<Record<VersionKind, T>> = {};
  for (const v of [...versions].sort((a, b) => a.created.getTime() - b.created.getTime())) if (isVersionKind(v.kind)) out[v.kind] = v;
  return out;
}

/** Due day of a commitment: a fixed day, or days from its milestone (its start; its end when the offset is after it ends). */
export function dueDate(a: { dueOn: string | null; offsetDays: number | null; milestoneId: string | null }, ms: Map<string, { plannedStart: string | null; plannedEnd: string | null; actualStart?: string | null }>): string | null {
  if (a.milestoneId) {
    const m = ms.get(a.milestoneId);
    const anchor = m?.actualStart ?? m?.plannedStart ?? null;
    if (anchor) return addDays(anchor, a.offsetDays ?? 0);
  }
  return a.dueOn;
}

export type CommitmentState = 'done' | 'missed' | 'due_soon' | 'upcoming' | 'no_date';

export function commitmentState(a: { status: string; doneOn: string | null }, due: string | null, today = todayFn()): CommitmentState {
  if (a.status === 'done') return 'done';
  if (!due) return 'no_date';
  const d = daysSince(due, today)!;
  if (d > 0) return 'missed';
  if (d >= -7) return 'due_soon';
  return 'upcoming';
}

/** Done after it was due: still counts as a missed commitment in the record. */
export function doneLate(a: { status: string; doneOn: string | null }, due: string | null): boolean {
  return a.status === 'done' && !!a.doneOn && !!due && a.doneOn > due;
}

/** What we save supplying an item ourselves instead of the GC's allowance (the GC must credit the allowance). */
export function ownerSavings(items: { responsible: string; gcAllowance: string | null; ourCost: string | null }[]) {
  let allowance = 0, cost = 0;
  for (const i of items) {
    if (i.responsible !== 'owner' || i.gcAllowance === null) continue;
    allowance += Math.round(Number(i.gcAllowance) * 100);
    cost += Math.round(Number(i.ourCost ?? 0) * 100);
  }
  return { allowance, cost, savings: allowance - cost };
}

/** Line-by-line comparison of the budget stages and the current budget, in cents. */
export function compareVersions(codes: { id: string }[], versions: Partial<Record<VersionKind, { lines: unknown }>>, current: Map<string, number>) {
  const maps: Partial<Record<VersionKind, Map<string, number>>> = {};
  for (const [k, v] of Object.entries(versions) as [VersionKind, { lines: unknown }][]) {
    maps[k] = new Map((v.lines as { costCodeId: string; cents: number }[]).map((l) => [l.costCodeId, l.cents]));
  }
  return codes.map((c) => {
    const now = current.get(c.id) ?? 0;
    const approved = maps.approved?.get(c.id);
    return { costCodeId: c.id, rough: maps.rough?.get(c.id) ?? null, design: maps.design?.get(c.id) ?? null, approved: approved ?? null, current: now, vsApproved: approved === undefined ? null : now - approved };
  });
}
