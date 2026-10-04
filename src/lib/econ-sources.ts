// The economy behind home buying (owner, Oct 4, 2026: "Cover all"): local jobs
// and unemployment (U.S. Bureau of Labor Statistics), people moving in (Census
// county estimates), buyer confidence (University of Michigan), the stock
// market and inflation. Free public sources, read only; each has a backup.
// Pure parsers, tested in econ-sources.test.ts with copies of each format.

export const econSeries = [
  { key: 'jobs_raleigh', label: 'Jobs, Raleigh-Cary metro', unit: 'thousand jobs', source: 'BLS' },
  { key: 'jobs_durham', label: 'Jobs, Durham-Chapel Hill metro', unit: 'thousand jobs', source: 'BLS' },
  { key: 'unemp_raleigh', label: 'Unemployment, Raleigh-Cary metro', unit: '%', source: 'BLS' },
  { key: 'unemp_durham', label: 'Unemployment, Durham-Chapel Hill metro', unit: '%', source: 'BLS' },
  { key: 'cpi', label: 'Consumer prices (CPI)', unit: 'index', source: 'BLS' },
  { key: 'sentiment', label: 'Consumer confidence (University of Michigan)', unit: 'index', source: 'University of Michigan' },
  { key: 'stocks', label: 'Stock market (S&P 500)', unit: 'index', source: 'Stooq' },
] as const;
export type EconKey = (typeof econSeries)[number]['key'];
export type EconPoint = { series: string; period: string; value: number }; // period: the month's first day; migration: 'netmig:<county>' on July 1

/** BLS series ids for each of ours (the free v1 API: no key, 25 calls a day). */
export const blsIds: Record<string, EconKey> = {
  SMU37395800000000001: 'jobs_raleigh', // Raleigh-Cary MSA, total nonfarm, thousands
  SMU37205000000000001: 'jobs_durham', // Durham-Chapel Hill MSA
  LAUMT373958000000003: 'unemp_raleigh', // unemployment rate
  LAUMT372050000000003: 'unemp_durham',
  CUUR0000SA0: 'cpi', // CPI-U, all items, U.S. city average
};

/** Which metro's jobs go with each county Redfin reports. */
export const countyMetro: Record<string, 'raleigh' | 'durham'> = {
  'Wake County, NC': 'raleigh', 'Johnston County, NC': 'raleigh', 'Franklin County, NC': 'raleigh',
  'Durham County, NC': 'durham', 'Orange County, NC': 'durham', 'Chatham County, NC': 'durham', 'Person County, NC': 'durham', 'Granville County, NC': 'durham',
};
/** Census county codes in North Carolina (state 37). */
export const ncCounties: Record<string, string> = { '183': 'Wake County, NC', '063': 'Durham County, NC', '101': 'Johnston County, NC', '069': 'Franklin County, NC', '135': 'Orange County, NC', '037': 'Chatham County, NC', '145': 'Person County, NC', '077': 'Granville County, NC' };

const okNum = (n: number) => Number.isFinite(n);
const month = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}-01`;

/** The BLS answer: { status, Results: { series: [{ seriesID, data: [{ year, period: "M08", value }] }] } }. M13 is the year's average: skipped. */
export function parseBls(json: unknown): EconPoint[] {
  const series = (json as { Results?: { series?: unknown } })?.Results?.series;
  if (!Array.isArray(series)) return [];
  const out: EconPoint[] = [];
  for (const s of series as { seriesID?: string; data?: unknown }[]) {
    const key = s.seriesID ? blsIds[s.seriesID] : undefined;
    if (!key || !Array.isArray(s.data)) continue;
    for (const d of s.data as { year?: string; period?: string; value?: string }[]) {
      const m = /^M(0[1-9]|1[0-2])$/.exec(d.period ?? '');
      const y = Number(d.year), v = Number(String(d.value ?? '').replace(/,/g, ''));
      if (m && y > 1990 && okNum(v)) out.push({ series: key, period: month(y, Number(m[1])), value: v });
    }
  }
  return out;
}

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** The University of Michigan's sentiment file (Month,YYYY,ICS_ALL with month names), allowing a few header lines. */
export function parseSentiment(csv: string): EconPoint[] {
  const out: EconPoint[] = [];
  for (const line of csv.split(/\r?\n/)) {
    const c = line.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    if (c.length < 3) continue;
    const mi = months.indexOf(c[0].toLowerCase()), y = Number(c[1]), v = Number(c[2]);
    if (mi >= 0 && y > 1950 && okNum(v) && c[2] !== '') out.push({ series: 'sentiment', period: month(y, mi + 1), value: v });
  }
  return out;
}

/** FRED's CSV for a monthly series (the backup for any of these). */
export function parseFredMonthly(csv: string, series: EconKey): EconPoint[] {
  const out: EconPoint[] = [];
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '') || !v || v.trim() === '.') continue;
    const n = Number(v);
    if (okNum(n)) out.push({ series, period: `${d.slice(0, 7)}-01`, value: n });
  }
  return out;
}

/** Stooq's monthly CSV (Date,Open,High,Low,Close,Volume): each month's close. */
export function parseStooq(csv: string): EconPoint[] {
  const rows = csv.split(/\r?\n/).map((l) => l.split(','));
  const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const di = head.indexOf('date'), ci = head.indexOf('close');
  if (di < 0 || ci < 0) return [];
  const out: EconPoint[] = [];
  for (const r of rows.slice(1)) {
    const d = r[di]?.trim(), v = Number(r[ci]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && okNum(v) && v > 0) out.push({ series: 'stocks', period: `${d!.slice(0, 7)}-01`, value: v });
  }
  return out;
}

/** Census county estimates (co-est20xx-alldata.csv): each of our counties' net migration and population, by year. */
export function parseCensusCounties(csv: string): EconPoint[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toUpperCase());
  const si = head.indexOf('STATE'), ci = head.indexOf('COUNTY');
  if (si < 0 || ci < 0) return [];
  const mig = head.map((h, i) => [/^NETMIG(\d{4})$/.exec(h)?.[1], i] as const).filter(([y]) => y);
  const pop = new Map(head.map((h, i) => [/^POPESTIMATE(\d{4})$/.exec(h)?.[1], i] as const).filter(([y]) => y) as [string, number][]);
  const out: EconPoint[] = [];
  for (const l of lines.slice(1)) {
    const c = l.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    if (c[si] !== '37' && c[si] !== '037') continue;
    const name = ncCounties[c[ci].padStart(3, '0')];
    if (!name) continue;
    for (const [y, i] of mig) {
      const m = Number(c[i]), p = Number(c[pop.get(y!) ?? -1]);
      if (okNum(m) && p > 0) out.push({ series: `migration:${name}`, period: `${y}-07-01`, value: Math.round((m / p) * 1000 * 100) / 100 }); // per 1,000 residents
    }
  }
  return out;
}

/** Where each comes from, first choice first. */
export function econUrls(today: string) {
  const y = Number(today.slice(0, 4));
  return {
    bls: 'https://api.bls.gov/publicAPI/v1/timeseries/data/',
    blsBody: { seriesid: Object.keys(blsIds), startyear: String(y - 9), endyear: String(y) },
    sentiment: 'https://www.sca.isr.umich.edu/files/tbmics.csv',
    stooq: 'https://stooq.com/q/d/l/?s=%5Espx&i=m',
    fred: (id: string) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2015-01-01`,
    fredIds: { sentiment: 'UMCSENT', stocks: 'SP500', cpi: 'CPIAUCNS', unemp_raleigh: 'RALE537URN', unemp_durham: 'DURH937URN', jobs_raleigh: 'RALE537NAN', jobs_durham: 'DURH937NAN' } as Record<EconKey, string>,
    census: [
      'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv',
      'https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/counties/totals/co-est2023-alldata.csv',
    ],
    censusOld: 'https://www2.census.gov/programs-surveys/popest/datasets/2010-2019/counties/totals/co-est2019-alldata.csv',
  };
}
