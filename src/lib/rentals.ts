// A rental's numbers (owner, Oct 2, 2026: "expected revenue ... and if that is a
// good deal or we lose money, and the bank loan against the property"). Cents
// throughout. Pure, tested in rentals.test.ts.

export const rentalStatuses = [
  { key: 'getting_ready', label: 'Getting Ready' },
  { key: 'on_market', label: 'On the Market' },
  { key: 'application', label: 'Application Pending' },
  { key: 'leased', label: 'Leased' },
  { key: 'notice', label: 'Notice Given' },
  { key: 'vacant', label: 'Vacant' },
] as const;
export const isRentalStatus = (v: string | null | undefined) => rentalStatuses.some((s) => s.key === v);
export const rentalStatusLabel = (v: string) => rentalStatuses.find((s) => s.key === v)?.label ?? v;

export type RentInputs = {
  rent: number; // monthly: the lease's, else the asking rent
  managementFeePct: number; repairsReservePct: number; vacancyPct: number;
  taxes: number; insurance: number; hoa: number; utilities: number; // monthly
  loanPayment: number; escrowIncluded: boolean; // the loan payment; escrow = taxes and insurance are inside it
};

/** One month: what comes in, what it costs to run, the loan, and what's left. */
export function monthly(i: RentInputs) {
  const vacancy = Math.round(i.rent * i.vacancyPct / 100);
  const collected = i.rent - vacancy;
  const management = Math.round(collected * i.managementFeePct / 100);
  const repairs = Math.round(i.rent * i.repairsReservePct / 100);
  const operating = management + repairs + i.taxes + i.insurance + i.hoa + i.utilities;
  const noi = collected - operating;
  // With escrow, the payment already holds the taxes and insurance counted above.
  const debt = Math.max(0, i.loanPayment - (i.escrowIncluded ? i.taxes + i.insurance : 0));
  const cashFlow = noi - debt;
  return { rent: i.rent, vacancy, collected, management, repairs, taxes: i.taxes, insurance: i.insurance, hoa: i.hoa, utilities: i.utilities, operating, noi, debt, cashFlow };
}

/** The year, and the measures investors use. Basis = all-in cost; cash in = basis − the loan. */
export function yearly(m: ReturnType<typeof monthly>, basis: number, loanOriginal: number, marketValue: number | null) {
  const noi = m.noi * 12, cashFlow = m.cashFlow * 12, debt = m.debt * 12;
  const cashIn = Math.max(0, basis - loanOriginal);
  return {
    noi, cashFlow, debt,
    capRate: basis > 0 ? noi / basis : null, // on what we put in
    capRateOnValue: marketValue ? noi / marketValue : null,
    cashOnCash: cashIn > 0 ? cashFlow / cashIn : null,
    dscr: debt > 0 ? noi / debt : null,
  };
}

/** The monthly rent where cash flow is zero, holding everything else the same. */
export function breakEvenRent(i: RentInputs): number | null {
  const share = (1 - i.vacancyPct / 100) * (1 - i.managementFeePct / 100) - i.repairsReservePct / 100;
  if (share <= 0) return null;
  const fixed = i.taxes + i.insurance + i.hoa + i.utilities + Math.max(0, i.loanPayment - (i.escrowIncluded ? i.taxes + i.insurance : 0));
  return Math.ceil(fixed / share);
}

/** The plain answer at the top of the tab. */
export function verdict(cashFlow: number, dscr: number | null): { tone: 'good' | 'warn' | 'bad'; text: string } {
  if (cashFlow < 0) return { tone: 'bad', text: 'Losing money each month' };
  if (dscr !== null && dscr < 1.2) return { tone: 'warn', text: 'Making a little: thin against the loan (a bank wants 1.2× or more)' };
  if (cashFlow === 0) return { tone: 'warn', text: 'Breaking even' };
  return { tone: 'good', text: 'Making money each month' };
}

/** Lease dates to act on: the decide-by date, or 60 days before it ends. */
export function leaseAlerts(l: { endsOn: string | null; decideBy: string | null; status: string }, today: string): string[] {
  if (l.status !== 'active') return [];
  const out: string[] = [];
  const days = (d: string) => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))) / 86_400_000);
  if (l.decideBy && days(l.decideBy) <= 14) out.push(days(l.decideBy) < 0 ? `Renewal decision was due ${l.decideBy}` : `Decide on renewal by ${l.decideBy}`);
  if (l.endsOn && days(l.endsOn) <= 60) out.push(days(l.endsOn) < 0 ? `Lease ended ${l.endsOn}` : `Lease ends ${l.endsOn} (${days(l.endsOn)} days)`);
  return out;
}

/** Rent expected each month of a lease up to today, against what came in for it. */
export function rentByMonth(lease: { rent: number; startsOn: string; endsOn: string | null }, receipts: { forMonth: string | null; receivedOn: string; kind: string; amount: number }[], today: string) {
  const months: { month: string; expected: number; received: number }[] = [];
  let y = +lease.startsOn.slice(0, 4), m = +lease.startsOn.slice(5, 7);
  const end = (lease.endsOn && lease.endsOn < today ? lease.endsOn : today).slice(0, 7);
  while (`${y}-${String(m).padStart(2, '0')}` <= end && months.length < 120) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const received = receipts.filter((r) => r.kind === 'rent' && (r.forMonth ?? r.receivedOn).slice(0, 7) === key).reduce((s, r) => s + r.amount, 0);
    months.push({ month: key, expected: lease.rent, received });
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}
