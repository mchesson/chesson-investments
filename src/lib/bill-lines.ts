// Bills split into lines. Pure, tested in bill-lines.test.ts.
import { cents, dollars } from './budget';

export const lineKinds = [
  { key: 'build', label: 'Build cost' },
  { key: 'fee', label: 'GC fee' },
  { key: 'holding', label: 'Holding cost' },
  { key: 'not_project', label: 'Not for this project' },
] as const;
export type LineKind = (typeof lineKinds)[number]['key'];
export const isLineKind = (v: string): v is LineKind => lineKinds.some((k) => k.key === v);

export type LineIn = { kind: string; costCodeId: string | null; holdingKind: string | null; description: string | null; amount: string };

/** Check lines and work out the bill's total. A credit's lines are negative. */
export function checkLines(lines: LineIn[], billKind: string): { error: string } | { total: string; lines: LineIn[] } {
  const kept = lines.filter((l) => l.amount !== '' && l.amount !== null);
  if (!kept.length) return { error: 'Add at least one line with an amount.' };
  for (const [i, l] of kept.entries()) {
    const n = i + 1;
    if (!isLineKind(l.kind)) return { error: `Line ${n}: pick what kind of cost it is.` };
    if ((l.kind === 'build' || l.kind === 'fee') && !l.costCodeId) return { error: `Line ${n}: pick the cost code.` };
    if (l.kind === 'holding' && !l.holdingKind) return { error: `Line ${n}: pick the kind of holding cost.` };
    if (!Number.isFinite(Number(l.amount))) return { error: `Line ${n}: type an amount.` };
  }
  const signed = kept.map((l) => {
    const c = cents(l.amount);
    // A credit memo is entered as positive amounts and stored negative.
    return { ...l, amount: dollars(billKind === 'credit' ? -Math.abs(c) : c) };
  });
  const total = signed.reduce((s, l) => s + cents(l.amount), 0);
  return { total: dollars(total), lines: signed };
}

export type CountedLine = { kind: string; costCodeId: string | null; amount: string | number; status: string; backup: boolean };

/** What a bill line adds to the budget by cost code (build and fee lines of bills that aren't backup). */
export function countsTowardBudget(l: CountedLine): boolean {
  return !l.backup && (l.kind === 'build' || l.kind === 'fee') && !!l.costCodeId;
}

/** What a bill line adds to holding costs. */
export function countsTowardHolding(l: CountedLine): boolean {
  return !l.backup && l.kind === 'holding';
}

/**
 * A GC's line and the vendor invoices behind it: matched when they add up
 * to the cent; otherwise the difference is shown (unbacked or over).
 */
export function backupGap(lineAmount: string | number, backups: (string | number)[]): number {
  return cents(lineAmount) - backups.reduce((s: number, b) => s + cents(b), 0);
}
