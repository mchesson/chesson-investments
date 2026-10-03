// Interest rates from the government's own free sources (owner, Oct 3, 2026:
// "where is my govt int rate"). FRED alone kept timing out from Vercel, so each
// rate has a first source and a fallback; any one that answers is enough. Pure
// parsers, tested in rate-sources.test.ts with copies of each source's format.

export const rateSeries = [
  { key: '30yr', label: '30-Year Mortgage', note: 'Freddie Mac’s weekly survey: what most buyers pay' },
  { key: '15yr', label: '15-Year Mortgage', note: 'Freddie Mac’s weekly survey' },
  { key: '10yr', label: '10-Year Treasury', note: 'What mortgage rates follow, day to day (U.S. Treasury)' },
  { key: 'fedfunds', label: 'Fed Funds Rate', note: 'The Federal Reserve’s overnight rate (New York Fed)' },
] as const;
export type RateKey = (typeof rateSeries)[number]['key'];

export type RatePoint = { series: RateKey; week: string; rate: number };

const ok = (n: number) => Number.isFinite(n) && n > -1 && n < 30;

/** "4/2/1971", "04/02/1971" or "1971-04-02" → "1971-04-02". */
export function isoDay(v: string): string | null {
  const s = v.trim().replace(/^"|"$/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

function csvRows(csv: string): string[][] {
  return csv.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
}

/** Freddie Mac's PMMS history (date, pmms30, …, pmms15, …): the 30- and 15-year rates each week. */
export function parsePmms(csv: string): RatePoint[] {
  const rows = csvRows(csv);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase());
  const di = head.findIndex((h) => h === 'date' || h.includes('date'));
  const c30 = head.findIndex((h) => h === 'pmms30' || /^(30|pmms ?30)/.test(h));
  const c15 = head.findIndex((h) => h === 'pmms15' || /^(15|pmms ?15)/.test(h));
  if (di < 0 || (c30 < 0 && c15 < 0)) return [];
  const out: RatePoint[] = [];
  for (const r of rows.slice(1)) {
    const day = isoDay(r[di] ?? '');
    if (!day) continue;
    for (const [series, i] of [['30yr', c30], ['15yr', c15]] as const) {
      if (i < 0 || !r[i]) continue;
      const n = Number(r[i]);
      if (ok(n) && n > 0) out.push({ series, week: day, rate: n });
    }
  }
  return out;
}

/** FRED's CSV (observation_date,VALUE; "." is a missing day) for one series. */
export function parseFred(csv: string, series: RateKey): RatePoint[] {
  const out: RatePoint[] = [];
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) continue;
    const n = Number(v);
    if (v && v.trim() !== '.' && ok(n)) out.push({ series, week: d, rate: n });
  }
  return out;
}

/** Treasury.gov's daily par yield curve CSV (Date, "1 Mo", …, "10 Yr", …): the 10-year each day. */
export function parseTreasury(csv: string): RatePoint[] {
  const rows = csvRows(csv);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase());
  const di = head.indexOf('date'), ti = head.findIndex((h) => h === '10 yr' || h === '10 yr.' || h === '10yr');
  if (di < 0 || ti < 0) return [];
  const out: RatePoint[] = [];
  for (const r of rows.slice(1)) {
    const day = isoDay(r[di] ?? ''), n = Number(r[ti]);
    if (day && r[ti] && ok(n)) out.push({ series: '10yr', week: day, rate: n });
  }
  return out;
}

/** The New York Fed's EFFR answer ({ refRates: [{ effectiveDate, percentRate }] }). */
export function parseEffr(json: unknown): RatePoint[] {
  const list = (json as { refRates?: unknown })?.refRates;
  if (!Array.isArray(list)) return [];
  const out: RatePoint[] = [];
  for (const x of list as Record<string, unknown>[]) {
    const day = typeof x.effectiveDate === 'string' ? isoDay(x.effectiveDate) : null, n = Number(x.percentRate);
    if (day && ok(n) && (x.type === undefined || x.type === 'EFFR')) out.push({ series: 'fedfunds', week: day, rate: n });
  }
  return out;
}

/** Where each rate comes from, first choice first. */
export function rateSourceUrls(today: string) {
  const year = Number(today.slice(0, 4));
  return {
    pmms: 'https://www.freddiemac.com/pmms/docs/PMMS_history.csv',
    fred: (id: string) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2015-01-01`,
    treasury: [year - 1, year].map((y) => `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`),
    effr: (from: string) => `https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=${from}&endDate=${today}`,
  };
}

/** Mortgage rate minus the 10-year: about 1.7 points is normal; wider means lenders are charging extra for risk. */
export function mortgageSpread(mortgage: number | null | undefined, tenYear: number | null | undefined) {
  if (mortgage === null || mortgage === undefined || tenYear === null || tenYear === undefined) return null;
  const spread = Math.round((mortgage - tenYear) * 100) / 100;
  return { spread, read: spread <= 1.9 ? 'normal' as const : spread <= 2.4 ? 'a little wide' as const : 'wide' as const };
}
