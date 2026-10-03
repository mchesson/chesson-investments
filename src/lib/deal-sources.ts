// Where deals come from, and which sources prove out over time (owner, Oct 2,
// 2026: "Biggest deal will be off market and that is about relationships ...
// Are some sources more reliable than others and if so should we track the
// source and over time see what proves to provide the best deals"), and the
// bigger kinds of deal ("huge projects like fill neighborhoods and commercial
// ... large land deals"). Pure, tested in deal-sources.test.ts.

export const dealTypes = [
  { key: 'lot', label: 'Lot or Teardown', hint: 'One lot to build a house on' },
  { key: 'house', label: 'House', hint: 'To renovate, rent or flip' },
  { key: 'land', label: 'Land / Subdivision', hint: 'Acreage for several homes or a neighborhood' },
  { key: 'commercial', label: 'Commercial', hint: 'Retail, office, industrial, mixed use' },
] as const;
export type DealType = (typeof dealTypes)[number]['key'];
export const isDealType = (v: string | null | undefined): v is DealType => dealTypes.some((t) => t.key === v);
export const dealTypeLabel = (v: string | null | undefined) => dealTypes.find((t) => t.key === v)?.label ?? 'Lot or Teardown';
/** The bigger deals: their own facts and checklist. */
export const isBigDeal = (v: string | null | undefined) => v === 'land' || v === 'commercial';

/** How a deal reached us (the person or company who sent it is kept apart). */
export const sourceKinds = [
  { key: 'wholesaler', label: 'Wholesaler' },
  { key: 'agent', label: 'Agent / Broker' },
  { key: 'attorney', label: 'Attorney / Estate' },
  { key: 'builder', label: 'Builder' },
  { key: 'owner', label: 'Owner Directly' },
  { key: 'referral', label: 'Friend or Referral' },
  { key: 'driving', label: 'Driving the Area' },
  { key: 'mail', label: 'Letters / Mail' },
  { key: 'online', label: 'Online Listing' },
  { key: 'other', label: 'Other' },
] as const;
export type SourceKind = (typeof sourceKinds)[number]['key'];
export const isSourceKind = (v: string | null | undefined): v is SourceKind => sourceKinds.some((t) => t.key === v);
export const sourceKindLabel = (v: string | null | undefined) => sourceKinds.find((t) => t.key === v)?.label ?? 'Not Recorded';
/** The person's role suggests how it came (a wholesaler sent it), when nothing was picked. */
export function guessSourceKind(roles: string[]): SourceKind | null {
  for (const [role, kind] of [['wholesaler', 'wholesaler'], ['agent', 'agent'], ['attorney', 'attorney'], ['gc', 'builder']] as const) if (roles.includes(role)) return kind;
  return null;
}

export const utilities = [
  { key: 'water_sewer', label: 'City Water and Sewer' },
  { key: 'water_only', label: 'City Water, No Sewer' },
  { key: 'well_septic', label: 'Well and Septic' },
  { key: 'nearby', label: 'Nearby: Would Need Extending' },
  { key: 'unknown', label: 'Not Known Yet' },
] as const;
export const entitlements = [
  { key: 'none', label: 'Nothing Started' },
  { key: 'rezoning', label: 'Rezoning Needed or In Process' },
  { key: 'site_plan', label: 'Site Plan / Preliminary Plat' },
  { key: 'approved', label: 'Approved' },
  { key: 'recorded', label: 'Lots Recorded' },
] as const;
export const commercialUses = [
  { key: 'retail', label: 'Retail' }, { key: 'office', label: 'Office' }, { key: 'industrial', label: 'Industrial / Flex' },
  { key: 'mixed', label: 'Mixed Use' }, { key: 'multifamily', label: 'Apartments' }, { key: 'other', label: 'Other' },
] as const;
export const labelOf = (list: readonly { key: string; label: string }[], v: string | null | undefined) => (v ? list.find((x) => x.key === v)?.label ?? v : null);

/**
 * What a land or commercial deal needs looked at before an offer goes firm
 * (owner: "I don't have as much knowledge in those areas"). Plain steps, in order.
 */
export const bigDealChecklist: Record<'land' | 'commercial', { key: string; label: string; why: string }[]> = {
  land: [
    { key: 'zoning', label: 'Zoning and what it allows', why: 'How many homes, how small the lots can be, setbacks; a rezoning adds a year or more' },
    { key: 'yield', label: 'Lot yield: how many lots fit', why: 'A civil engineer’s quick sketch after roads, buffers, stormwater and open space' },
    { key: 'utilities', label: 'Water and sewer', why: 'Who serves it, capacity, and the cost to extend; the biggest swing in land value' },
    { key: 'access', label: 'Road access and frontage', why: 'NCDOT driveway permits, turn lanes, a second entrance for bigger subdivisions' },
    { key: 'environment', label: 'Wetlands, streams, flood zone, soils', why: 'Riparian buffers and floodplain take land out; soils decide septic and foundations' },
    { key: 'survey', label: 'Survey and title', why: 'Boundaries, easements, liens, access rights' },
    { key: 'fees', label: 'Impact fees and road improvements', why: 'Per-lot fees and required road work add straight to the cost' },
    { key: 'comps', label: 'What finished lots and homes sell for there', why: 'Builders pay for finished lots; check the Market Map and Who’s Building' },
    { key: 'exit', label: 'Who buys it from us', why: 'Builders for lots, or build ourselves; a letter of interest before closing' },
    { key: 'timeline', label: 'Timeline and holding cost', why: 'Approvals take 9–24 months; carry, taxes and interest the whole time' },
  ],
  commercial: [
    { key: 'zoning', label: 'Zoning and allowed uses', why: 'What can go there, parking rules, height' },
    { key: 'tenants', label: 'Tenants and leases', why: 'Who pays rent, for how long, and who pays taxes, insurance and repairs' },
    { key: 'income', label: 'Rent roll and expenses (NOI)', why: 'Net operating income is what the price is based on' },
    { key: 'cap_rate', label: 'Cap rate against similar sales', why: 'Price ÷ NOI; compare with what similar buildings traded at' },
    { key: 'condition', label: 'Building condition and roof', why: 'Inspection, roof, HVAC, parking lot; big near-term costs' },
    { key: 'environment', label: 'Environmental (Phase I)', why: 'Lenders require it; old gas stations and dry cleaners can be costly' },
    { key: 'utilities', label: 'Utilities and access', why: 'Capacity for the use, curb cuts, signage' },
    { key: 'survey', label: 'Survey and title', why: 'Easements, encroachments, cross-access agreements' },
    { key: 'financing', label: 'Financing', why: 'Commercial loans: bigger down payments, shorter terms' },
    { key: 'exit', label: 'Exit: hold, lease up or sell', why: 'How we make money and when' },
  ],
};
export function checklistProgress(type: string | null | undefined, ticks: Record<string, unknown> | null | undefined) {
  const items = type === 'land' || type === 'commercial' ? bigDealChecklist[type] : [];
  const done = items.filter((i) => ticks?.[i.key] === true).length;
  return { items, done, total: items.length };
}

// ---------- Which sources prove out ----------

export type SourceDeal = {
  stage: string; metBuyBox: boolean | null; accurate: boolean | null; offered: boolean; bought: boolean;
};
export type SourceStats = {
  sent: number; judged: number; fit: number; checked: number; accurate: number; offered: number; bought: number;
  fitRate: number | null; accuracyRate: number | null; score: number; grade: SourceGrade;
};
export type SourceGrade = 'proven' | 'promising' | 'unproven' | 'weak';
export const gradeLabel: Record<SourceGrade, string> = { proven: 'Proven', promising: 'Promising', unproven: 'Too Early to Say', weak: 'Not Paying Off' };

/**
 * One source's record and a 0–100 reliability score. The score blends how
 * often their deals fit the buy box (40%), whether their numbers held up (30%),
 * how often we offered (15%) and bought (15%). With only a few deals each rate
 * is pulled toward the middle (as if they'd sent 3 average deals more), so one
 * lucky deal doesn't make a source "proven" and one miss doesn't sink it.
 */
export function sourceStats(deals: SourceDeal[]): SourceStats {
  const sent = deals.length;
  const judged = deals.filter((d) => d.metBuyBox !== null).length, fit = deals.filter((d) => d.metBuyBox).length;
  const checked = deals.filter((d) => d.accurate !== null).length, accurate = deals.filter((d) => d.accurate).length;
  const offered = deals.filter((d) => d.offered || d.bought).length, bought = deals.filter((d) => d.bought).length;
  const PRIOR = 3;
  const shrink = (hits: number, n: number, mid: number) => (hits + PRIOR * mid) / (n + PRIOR);
  const score = Math.round(100 * (0.4 * shrink(fit, judged, 0.5) + 0.3 * shrink(accurate, checked, 0.5) + 0.15 * shrink(offered, sent, 0.3) + 0.15 * shrink(bought, sent, 0.1)));
  const grade: SourceGrade = sent < 3 ? 'unproven' : score >= 60 || bought >= 2 ? 'proven' : score >= 45 ? 'promising' : 'weak';
  return {
    sent, judged, fit, checked, accurate, offered, bought, score, grade,
    fitRate: judged ? Math.round((fit / judged) * 100) : null, accuracyRate: checked ? Math.round((accurate / checked) * 100) : null,
  };
}

/** Best sources first: proven ones by score, then by deals bought and sent. */
export function rankSources<T extends { stats: SourceStats }>(rows: T[]): T[] {
  const order: Record<SourceGrade, number> = { proven: 0, promising: 1, unproven: 2, weak: 3 };
  return [...rows].sort((a, b) => order[a.stats.grade] - order[b.stats.grade] || b.stats.score - a.stats.score || b.stats.bought - a.stats.bought || b.stats.sent - a.stats.sent);
}
