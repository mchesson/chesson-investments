// Says whether a sale price is the real one or still a projection (owner, Oct 3,
// 2026: "plainview is projected sale price not actual").
export function saleBasis(p: { actualSalePrice: string | null; proformaSalePrice?: string | null; marketValue?: string | null }) {
  if (p.actualSalePrice) return { key: 'actual', label: 'Actual', value: p.actualSalePrice } as const;
  if (p.proformaSalePrice) return { key: 'projected', label: 'Projected', value: p.proformaSalePrice } as const;
  return null;
}

export function SalePriceTag({ p }: { p: { actualSalePrice: string | null; proformaSalePrice?: string | null } }) {
  const b = saleBasis(p);
  if (!b) return null;
  return <span className={`sale-tag sale-${b.key}`} title={b.key === 'actual' ? 'What it sold for' : 'Our estimate: not sold yet'}>{b.label}</span>;
}
