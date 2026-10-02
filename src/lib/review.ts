// Post-project review (after-action report): the project's own numbers, read
// back against what would have made it work. Pure, tested in review.test.ts.
import { daysSince } from './roles';

export type ReviewIn = {
  value: number | null; // cents: actual sale, else market value today
  valueBasis: 'sold' | 'market' | 'pro forma' | null;
  sellingCostPct: number;
  closingAtSale: number;
  lotCost: number;
  acquisition: number; // closing and due diligence on the purchase
  build: number; // the build actually spent (or projected)
  staging: number;
  holding: number;
  keptAssets: number;
  heatedSf: number | null;
  originalEstimate: number | null;
  targetProfitPct: number; // e.g. 15
  purchasedOn: string | null;
  completedOn: string | null;
  plannedExit: string | null;
  actualExit: string | null;
  byCode: { code: string; name: string; amount: number; budget: number }[];
  gcBilled: number;
  ownerDirect: number;
};

export type Finding = { tone: 'good' | 'warn' | 'bad'; title: string; detail: string };

const $ = (c: number) => `${c < 0 ? '−' : ''}$${Math.round(Math.abs(c) / 100).toLocaleString('en-US')}`;
const months = (a: string, b: string) => Math.max(0, Math.round(((daysSince(a, b) ?? 0) / 30.44) * 10) / 10);

export function review(r: ReviewIn) {
  const findings: Finding[] = [];
  const allIn = r.lotCost + r.acquisition + r.build + r.staging + r.holding - r.keptAssets;
  const net = r.value === null ? null : r.value - Math.round((r.value * r.sellingCostPct) / 100) - r.closingAtSale;
  const profit = net === null ? null : net - allIn;
  const target = r.value === null ? null : Math.round((r.value * r.targetProfitPct) / 100);
  // What we could have paid for the lot and still made the target, at this scope and these costs.
  const maxLot = net === null || target === null ? null : net - target - (r.acquisition + r.build + r.staging + r.holding - r.keptAssets);
  // What the build could have cost at the price we paid.
  const maxBuild = net === null || target === null ? null : net - target - (r.lotCost + r.acquisition + r.staging + r.holding - r.keptAssets);
  const perSf = r.heatedSf ? Math.round(allIn / r.heatedSf) : null;
  const valuePerSf = r.heatedSf && r.value ? Math.round(r.value / r.heatedSf) : null;
  const held = r.purchasedOn && r.completedOn ? months(r.purchasedOn, r.completedOn) : null;

  if (profit !== null) {
    findings.push(profit >= (target ?? 0)
      ? { tone: 'good', title: 'It made the target', detail: `${$(profit)} against a target of ${$(target!)} (${r.targetProfitPct}% of ${r.valueBasis === 'sold' ? 'the sale' : 'the value'}).` }
      : { tone: profit < 0 ? 'bad' : 'warn', title: profit < 0 ? 'It lost money' : 'It missed the target', detail: `At ${$(r.value!)} (${r.valueBasis}) it nets ${$(net!)} after selling costs against an all-in cost of ${$(allIn)}: ${$(profit)}, against a target of ${$(target!)}.` });
  } else findings.push({ tone: 'warn', title: 'No value to judge it by', detail: 'Add the sale price or today’s market value.' });

  if (maxLot !== null) {
    findings.push(maxLot <= 0
      ? { tone: 'bad', title: 'It didn’t work at any purchase price', detail: `Even a free lot leaves ${$(maxLot)} short of the target: the scope and costs were too big for what the house is worth. The answer was a smaller scope, or not buying.` }
      : r.lotCost > maxLot
        ? { tone: 'bad', title: 'We paid too much for what we built', detail: `To make the target at this scope we could have paid up to ${$(maxLot)}; we paid ${$(r.lotCost)} (${$(r.lotCost - maxLot)} too much).` }
        : { tone: 'good', title: 'The purchase price was right', detail: `We could have paid up to ${$(maxLot)} and paid ${$(r.lotCost)}.` });
  }
  if (maxBuild !== null && r.build > 0) {
    findings.push(r.build > maxBuild
      ? { tone: 'bad', title: 'The build cost more than the house could carry', detail: `At the price we paid, the build (${$(r.build)}) needed to be ${$(Math.max(0, maxBuild))} or less: ${$(r.build - Math.max(0, maxBuild))} over.` }
      : { tone: 'good', title: 'The build fit the deal', detail: `${$(r.build)} against room for ${$(maxBuild)}.` });
  }
  if (r.originalEstimate !== null && r.originalEstimate > 0) {
    const over = r.build - r.originalEstimate;
    findings.push({ tone: over > r.originalEstimate * 0.1 ? 'bad' : over > 0 ? 'warn' : 'good', title: over > 0 ? 'The build ran over the first estimate' : 'The build came in under the first estimate',
      detail: `First estimate ${$(r.originalEstimate)}; spent ${$(r.build)} (${over >= 0 ? '+' : ''}${$(over)}, ${Math.round((over / r.originalEstimate) * 100)}%).` });
  }
  if (perSf !== null && valuePerSf !== null) {
    findings.push({ tone: perSf > valuePerSf ? 'bad' : 'good', title: perSf > valuePerSf ? 'Cost per square foot passed the value per square foot' : 'Cost per square foot stayed under value',
      detail: `All-in ${$(perSf * 100 / 100)} a heated sf against a value of ${$(valuePerSf)} a heated sf.` });
  }
  const unbudgeted = r.byCode.filter((c) => c.budget === 0 && c.amount > 0).sort((a, b) => b.amount - a.amount);
  if (unbudgeted.length && r.byCode.some((c) => c.budget > 0)) {
    const sum = unbudgeted.reduce((s, c) => s + c.amount, 0);
    findings.push({ tone: 'warn', title: 'Spent on things that weren’t in the budget', detail: `${$(sum)}: ${unbudgeted.slice(0, 5).map((c) => `${c.name} ${$(c.amount)}`).join(', ')}.` });
  }
  if (r.staging > 0 && r.value) {
    findings.push({ tone: r.staging > r.value * 0.02 ? 'warn' : 'good', title: 'Staging and listing', detail: `${$(r.staging)} (${Math.round((r.staging / r.value) * 1000) / 10}% of the value).` });
  }
  if (r.ownerDirect > 0 && r.gcBilled > 0) {
    findings.push({ tone: 'warn', title: 'Costs outside the GC', detail: `${$(r.ownerDirect)} paid directly on top of ${$(r.gcBilled)} through the GC: ${Math.round((r.ownerDirect / (r.ownerDirect + r.gcBilled)) * 100)}% of the build and selling costs never went through the GC's budget.` });
  }
  if (held !== null) {
    findings.push({ tone: held > 9 ? 'warn' : 'good', title: `Money tied up ${held} months`, detail: `From purchase (${r.purchasedOn}) to completion (${r.completedOn}); holding costs ${$(r.holding)}${held ? ` (${$(Math.round(r.holding / held))} a month)` : ''}.` });
  }
  if (r.plannedExit || r.actualExit) {
    const changed = r.plannedExit && r.actualExit && r.plannedExit.trim().toLowerCase() !== r.actualExit.trim().toLowerCase();
    findings.push({ tone: changed ? 'warn' : 'good', title: changed ? 'The exit changed' : 'The exit held', detail: `Planned: ${r.plannedExit ?? '—'}. Actual: ${r.actualExit ?? '—'}.` });
  }
  const top = [...r.byCode].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 8);
  return { allIn, net, profit, target, maxLot, maxBuild, perSf, valuePerSf, held, findings, top };
}
