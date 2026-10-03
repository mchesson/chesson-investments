// Business overhead in categories, and its totals (owner, Oct 3, 2026). Pure,
// tested in overhead.test.ts.

export const overheadCategories = [
  { key: 'office', label: 'Office and Supplies' },
  { key: 'software', label: 'Software and Subscriptions' },
  { key: 'phone', label: 'Phone and Internet' },
  { key: 'vehicle', label: 'Vehicle and Mileage' },
  { key: 'travel', label: 'Meals and Travel' },
  { key: 'professional', label: 'Legal and Accounting' },
  { key: 'licenses', label: 'Licenses, Filing Fees and Dues' },
  { key: 'insurance', label: 'Business Insurance' },
  { key: 'marketing', label: 'Marketing and Website' },
  { key: 'bank', label: 'Bank and Card Fees' },
  { key: 'tools', label: 'Tools and Equipment' },
  { key: 'education', label: 'Education and Training' },
  { key: 'other', label: 'Other' },
] as const;
export type OverheadCategory = (typeof overheadCategories)[number]['key'];
export const overheadKeys = overheadCategories.map((c) => c.key) as [OverheadCategory, ...OverheadCategory[]];
export const isOverheadCategory = (v: string | null | undefined): v is OverheadCategory => overheadCategories.some((c) => c.key === v);
export const overheadLabel = (v: string | null | undefined) => overheadCategories.find((c) => c.key === v)?.label ?? 'Other';

type Row = { amount: string | number | null; spentOn: string | null; category: string };
const cents = (v: string | number | null) => (v === null || v === '' ? 0 : Math.round(Number(v) * 100));

/** Totals in cents: all, by category (largest first) and by month (YYYY-MM, in order). */
export function overheadTotals(rows: Row[]) {
  const byCat = new Map<string, number>(), byMonth = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const c = cents(r.amount);
    total += c;
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + c);
    const m = r.spentOn?.slice(0, 7) ?? 'no date';
    byMonth.set(m, (byMonth.get(m) ?? 0) + c);
  }
  return {
    total,
    byCategory: [...byCat.entries()].map(([key, cents]) => ({ key, label: overheadLabel(key), cents })).sort((a, b) => b.cents - a.cents),
    byMonth: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, cents]) => ({ month, cents })),
  };
}
