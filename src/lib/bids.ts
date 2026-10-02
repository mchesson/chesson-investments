// GC bids and our own estimate, side by side (owner, Oct 2, 2026: "multiple
// budgets, one for each submission by GCs, and one we think based on market
// and experience, and then select the winning budget"). Pure, tested in bids.test.ts.

export const bidKinds = [
  { key: 'bid', label: 'GC Bid' },
  { key: 'ours', label: 'Our Estimate' },
] as const;
export const isBidKind = (v: string | null | undefined): v is 'bid' | 'ours' => bidKinds.some((k) => k.key === v);
export const contractTypes = [{ key: 'fixed', label: 'Fixed Price' }, { key: 'cost_plus', label: 'Cost Plus' }] as const;
export const contractTypeLabel = (v: string | null | undefined) => contractTypes.find((c) => c.key === v)?.label ?? '';
export const projectNumber = (n: number | null | undefined) => (n ? `P-${n}` : '');

export type BidLine = { costCodeId: string; cents: number; note?: string | null };
export type Bid = { id: string; kind: string; who: string; total: number; lines: BidLine[]; status: string | null };

export type CompareRow = {
  costCodeId: string;
  cents: Record<string, number | null>; // per bid id
  low: number | null; high: number | null; spread: number | null;
  flags: Record<string, 'missing' | 'high' | 'low'>; // per bid id
};

/**
 * Line by line. A bid is flagged on a cost code when it has nothing there but
 * others do ("missing": scope left out, or bundled elsewhere), or when it's 25%
 * or more above (high) or below (low) the middle of the others. With only one
 * other number, the middle is that number.
 */
export function compareBids(codes: { id: string }[], bids: Bid[]): CompareRow[] {
  const maps = new Map(bids.map((b) => [b.id, new Map(b.lines.map((l) => [l.costCodeId, l.cents]))]));
  return codes.map((c) => {
    const cents: Record<string, number | null> = {};
    for (const b of bids) cents[b.id] = maps.get(b.id)!.get(c.id) ?? null;
    const vals = Object.values(cents).filter((v): v is number => v !== null && v > 0);
    const flags: CompareRow['flags'] = {};
    for (const b of bids) {
      const v = cents[b.id];
      const others = bids.filter((o) => o.id !== b.id).map((o) => cents[o.id]).filter((x): x is number => x !== null && x > 0);
      if (!others.length) continue;
      if (v === null || v === 0) { flags[b.id] = 'missing'; continue; }
      const mid = median(others);
      if (v >= mid * 1.25) flags[b.id] = 'high';
      else if (v <= mid * 0.75) flags[b.id] = 'low';
    }
    const low = vals.length ? Math.min(...vals) : null, high = vals.length ? Math.max(...vals) : null;
    return { costCodeId: c.id, cents, low, high, spread: low !== null && high !== null ? high - low : null, flags };
  }).filter((r) => Object.values(r.cents).some((v) => v !== null && v !== 0));
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Lines from a form: amounts typed per cost code (blank = none). */
export function linesFrom(entries: [string, string][]): BidLine[] | { error: string } {
  const out: BidLine[] = [];
  for (const [costCodeId, raw] of entries) {
    const v = raw.trim().replace(/[$,\s]/g, '');
    if (!v) continue;
    if (!/^-?\d+(\.\d{1,2})?$/.test(v)) return { error: `“${raw}” isn’t a dollar amount.` };
    const cents = Math.round(Number(v) * 100);
    if (cents) out.push({ costCodeId, cents });
  }
  return out;
}

export const totalOf = (lines: BidLine[]) => lines.reduce((s, l) => s + l.cents, 0);

/** A cost-plus bid's fee on top of its lines, when the lines don't already include it. */
export function withFee(total: number, contractType: string | null, feePct: string | null): number {
  return contractType === 'cost_plus' && feePct ? total + Math.round(total * Number(feePct) / 100) : total;
}
