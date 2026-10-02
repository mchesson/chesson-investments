// Job costing math. Pure (no database), tested in budget.test.ts.
// Money is kept in cents (integers) inside these functions so sums never drift.

export const cents = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
export const dollars = (c: number): string => (c / 100).toFixed(2);

export type BudgetLineIn = {
  costCodeId: string;
  kind: 'construction' | 'soft' | string;
  amount: string | number | null;
  percentOfConstruction: string | number | null;
};

/** Each line's budget in cents. A percent line is that percent of the construction lines' total. */
export function resolveBudget(lines: BudgetLineIn[]): { byCode: Map<string, number>; construction: number; soft: number; acquisition: number; selling: number; total: number } {
  const construction = lines
    .filter((l) => l.kind === 'construction' && (l.percentOfConstruction === null || l.percentOfConstruction === ''))
    .reduce((s, l) => s + cents(l.amount), 0);
  const byCode = new Map<string, number>();
  let soft = 0;
  let acquisition = 0;
  let selling = 0;
  let constructionAll = 0;
  for (const l of lines) {
    const pct = l.percentOfConstruction === null || l.percentOfConstruction === '' ? null : Number(l.percentOfConstruction);
    const c = pct !== null && Number.isFinite(pct) ? Math.round((construction * pct) / 100) : cents(l.amount);
    byCode.set(l.costCodeId, c);
    if (l.kind === 'construction') constructionAll += c;
    else if (l.kind === 'acquisition') acquisition += c; // part of the lot's cost, not the build
    else if (l.kind === 'selling') selling += c; // staging and listing: a cost of selling
    else soft += c;
  }
  return { byCode, construction: constructionAll, soft, acquisition, selling, total: constructionAll + soft };
}

export type CodeMoney = {
  budget: number;
  committed: number;
  billed: number;
  paid: number;
  /** What's left: budget minus the larger of committed and billed. Negative = over. */
  left: number;
  over: boolean;
  /** Our best guess of the final cost of this line: the largest of budget, committed and billed. */
  projected: number;
};

export function codeMoney(budget: number, committed: number, billed: number, paid: number): CodeMoney {
  const used = Math.max(committed, billed);
  return {
    budget, committed, billed, paid,
    left: budget - used,
    over: used > budget,
    projected: Math.max(budget, committed, billed),
  };
}

export type CommitmentIn = { costCodeId: string; amount: string | number; changeOrders: (string | number)[] };
/** One counted bill line (backup bills, holding and not-for-this-project lines are left out before this). */
export type BillIn = { costCodeId: string; amount: string | number; status: 'entered' | 'approved' | 'paid' | string };

/** Roll budget, commitments (with change orders) and bills up by cost code. */
export function rollup(
  codes: { id: string }[],
  budget: Map<string, number>,
  commitments: CommitmentIn[],
  bills: BillIn[],
): Map<string, CodeMoney> {
  const out = new Map<string, CodeMoney>();
  for (const code of codes) {
    const committed = commitments
      .filter((c) => c.costCodeId === code.id)
      .reduce((s, c) => s + cents(c.amount) + c.changeOrders.reduce((t: number, o) => t + cents(o), 0), 0);
    const mine = bills.filter((b) => b.costCodeId === code.id);
    const billed = mine.reduce((s, b) => s + cents(b.amount), 0);
    const paid = mine.filter((b) => b.status === 'paid').reduce((s, b) => s + cents(b.amount), 0);
    out.set(code.id, codeMoney(budget.get(code.id) ?? 0, committed, billed, paid));
  }
  return out;
}

export function totals(rows: Iterable<CodeMoney>): CodeMoney {
  let budget = 0, committed = 0, billed = 0, paid = 0, projected = 0;
  for (const r of rows) {
    budget += r.budget; committed += r.committed; billed += r.billed; paid += r.paid; projected += r.projected;
  }
  const t = codeMoney(budget, committed, billed, paid);
  return { ...t, projected };
}

/**
 * A bill can be marked paid only once it's approved and, for a sub or GC,
 * its lien waiver is in. Store and supplier bills don't need one.
 */
export function payBlocker(bill: { status: string; lienWaiverReceived: boolean; lienWaiverRequired?: boolean; kind?: string }): string | null {
  if (bill.status === 'paid') return bill.kind === 'credit' ? 'This credit is already applied.' : 'This bill is already paid.';
  if (bill.status !== 'approved') return 'Approve the bill before marking it paid.';
  if ((bill.lienWaiverRequired ?? true) && !bill.lienWaiverReceived) return 'A lien waiver is needed before this bill can be marked paid.';
  return null;
}

/** Retainage held on a bill, from its commitment's percent when not typed. */
export function retainageFor(amount: string | number, typed: string | number | null, pct: string | number | null): number {
  if (typed !== null && typed !== '' && typed !== undefined) return cents(typed);
  if (pct === null || pct === '' || pct === undefined) return 0;
  return Math.round((cents(amount) * Number(pct)) / 100);
}

export type PnlIn = {
  salePrice: number; // cents: pro forma (or actual once sold)
  marketValue?: number | null; // cents: what it would sell for today
  sellingCostPct: number; // percent of the sale price
  lotCost: number;
  acquisitionCosts?: number; // due diligence and closing costs (code 30): added to the lot
  buildBudget: number; // resolved total budget
  buildProjected: number; // sum of each line's projected
  buildBilled: number;
  holdingToDate: number;
  heatedSf: number | null;
};

export type Pnl = {
  /** Over-building check: what it would net at today's market value vs the all-in cost. */
  market: { value: number; net: number; allIn: number; profit: number; overbuilt: boolean } | null;
  proforma: { sale: number; selling: number; lot: number; build: number; profit: number; margin: number | null; perSf: number | null };
  projected: { sale: number; selling: number; lot: number; build: number; holding: number; profit: number; margin: number | null; perSf: number | null };
  actualToDate: { lot: number; build: number; holding: number; total: number; buildPerSf: number | null };
};

const per = (c: number, sf: number | null) => (sf && sf > 0 ? Math.round(c / sf) : null);
const margin = (profit: number, sale: number) => (sale > 0 ? Math.round((profit / sale) * 10000) / 100 : null);

/** Pro forma vs projected vs actual to date. Per-sf figures are all-in (lot + build) except buildPerSf. */
export function pnl(p: PnlIn): Pnl {
  const lot = p.lotCost + (p.acquisitionCosts ?? 0);
  const selling = Math.round((p.salePrice * p.sellingCostPct) / 100);
  const proProfit = p.salePrice - selling - lot - p.buildBudget;
  const projProfit = p.salePrice - selling - lot - p.buildProjected - p.holdingToDate;
  const allIn = lot + p.buildProjected + p.holdingToDate;
  let market: Pnl['market'] = null;
  if (p.marketValue) {
    const net = p.marketValue - Math.round((p.marketValue * p.sellingCostPct) / 100);
    market = { value: p.marketValue, net, allIn, profit: net - allIn, overbuilt: allIn > net };
  }
  p = { ...p, lotCost: lot };
  return {
    market,
    proforma: {
      sale: p.salePrice, selling, lot: p.lotCost, build: p.buildBudget, profit: proProfit,
      margin: margin(proProfit, p.salePrice), perSf: per(p.lotCost + p.buildBudget, p.heatedSf),
    },
    projected: {
      sale: p.salePrice, selling, lot: p.lotCost, build: p.buildProjected, holding: p.holdingToDate, profit: projProfit,
      margin: margin(projProfit, p.salePrice), perSf: per(p.lotCost + p.buildProjected + p.holdingToDate, p.heatedSf),
    },
    actualToDate: {
      lot: p.lotCost, build: p.buildBilled, holding: p.holdingToDate,
      total: p.lotCost + p.buildBilled + p.holdingToDate, buildPerSf: per(p.buildBilled, p.heatedSf),
    },
  };
}

export type Scenario = { label: string; sale: number; commissions: number; closing: number; allIn: number; profit: number; profitPct: number | null; tax: number | null; afterTax: number | null; perSf: number | null };

/**
 * The owner's sale scenarios (High / Mid / Low), as in his project sheets:
 * sale − commissions (selling %) − closing cost at sale − all-in cost
 * (lot, closing costs, build, holding, staging) + what we keep (furniture,
 * tools) = profit before tax; then tax at the set rate.
 */
export function scenarios(p: {
  low: number | null; mid: number | null; high: number | null; sellingCostPct: number; closingAtSale: number;
  allIn: number; keptAssets: number; taxRatePct: number | null; heatedSf: number | null;
}): Scenario[] {
  const rows: [string, number | null][] = [['High', p.high], ['Mid (Pro Forma)', p.mid], ['Low', p.low]];
  return rows.filter(([, v]) => v !== null && v > 0).map(([label, sale]) => {
    const s = sale!;
    const commissions = Math.round((s * p.sellingCostPct) / 100);
    const allIn = p.allIn - p.keptAssets;
    const profit = s - commissions - p.closingAtSale - allIn;
    const tax = p.taxRatePct !== null && profit > 0 ? Math.round((profit * p.taxRatePct) / 100) : p.taxRatePct !== null ? 0 : null;
    return {
      label, sale: s, commissions, closing: p.closingAtSale, allIn, profit,
      profitPct: margin(profit, s), tax, afterTax: tax === null ? null : profit - tax, perSf: per(allIn, p.heatedSf),
    };
  });
}
