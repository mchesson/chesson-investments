// Leads and watchlist rules. Pure, tested in properties.test.ts.

export const propertyStages = [
  { key: 'watching', label: 'Watching' },
  { key: 'analyzing', label: 'Analyzing' },
  { key: 'offer_made', label: 'Offer Made' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'lost', label: 'Lost' },
  { key: 'passed', label: 'Passed' },
  { key: 'sold', label: 'Sold (Comparable)' },
] as const;

export type PropertyStage = (typeof propertyStages)[number]['key'];

/** On the active watchlist; everything else is kept and searchable (comparables, past bids). */
export const activeStages: PropertyStage[] = ['watching', 'analyzing', 'offer_made'];

export const propertyStageLabel = (k: string) => propertyStages.find((s) => s.key === k)?.label ?? k;

export const isPropertyStage = (k: string): k is PropertyStage => propertyStages.some((s) => s.key === k);

/** Stages a person picks by hand. Under Contract and Sold have their own buttons. */
export const pickableStages: PropertyStage[] = ['watching', 'analyzing', 'offer_made', 'lost', 'passed'];

export type StageFields = { ourOffer: string | null; winningPrice: string | null; winningBuyer: string | null };

/** What a stage needs before it's saved. */
export function stageProblem(stage: PropertyStage, f: StageFields): string | null {
  if (stage === 'offer_made' && !f.ourOffer) return 'Enter our offer.';
  if (stage === 'lost' && !f.ourOffer) return 'Enter what we offered, so the lost bid is kept.';
  return null;
}

/** Price per lot square foot, for comparing lots. */
export function pricePerLotSf(price: string | number | null, lotSf: number | null): number | null {
  const p = Number(price);
  if (!price || !lotSf || !Number.isFinite(p) || lotSf <= 0) return null;
  return Math.round((p / lotSf) * 100) / 100;
}

export const ACRE_SF = 43_560;

export function acresFromSf(sf: number | null): string | null {
  return sf ? (sf / ACRE_SF).toFixed(3) : null;
}

/** Deal-source credit for one person: what they sent us and what came of it. */
export function dealCredit(rows: { stage: string; metBuyBox: boolean | null; hasProject: boolean; referralFee: string | null }[]) {
  return {
    sent: rows.length,
    metBuyBox: rows.filter((r) => r.metBuyBox).length,
    closed: rows.filter((r) => r.hasProject || r.stage === 'under_contract').length,
    referralFees: rows.reduce((s, r) => s + (Number(r.referralFee) || 0), 0),
  };
}
