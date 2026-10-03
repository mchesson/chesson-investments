// The Market Map's sections from the free data: rates and what buyers can
// afford, Redfin's numbers by ZIP code, and who is building (permits).
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { heatLabel, marketHeat, sensitivityLabel } from '@/lib/market-feeds';
import type { bandsAndRates, countyTrends, latestRates, permitsByArea, rateSummary, topBuilders, ZipTrend } from '@/lib/market-feeds-data';
import { mortgageSpread } from '@/lib/rate-sources';
import { Empty, Tile } from './ui';

const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000).toLocaleString()}k`);
const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
const pct = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(d)}%`);
const change = (now: number | null, before: number | null, unit = '') => {
  if (now === null || before === null) return null;
  const d = Math.round((now - before) * 10) / 10;
  return d === 0 ? 'same as a year ago' : `${d > 0 ? '+' : ''}${d}${unit} on a year ago`;
};

/** A plain line chart of the rate, every week for three years. */
function RateChart({ weeks }: { weeks: { week: string; rate: number }[] }) {
  if (weeks.length < 2) return null;
  const W = 640, H = 140, pad = 26;
  const lo = Math.floor(Math.min(...weeks.map((w) => w.rate))), hi = Math.ceil(Math.max(...weeks.map((w) => w.rate)));
  const x = (i: number) => pad + (i / (weeks.length - 1)) * (W - pad * 2), y = (r: number) => H - pad - ((r - lo) / Math.max(0.5, hi - lo)) * (H - pad * 2);
  const path = weeks.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w.rate).toFixed(1)}`).join(' ');
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return (
    <svg className="rate-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`30-year mortgage rate, ${weeks[0].week} to ${weeks[weeks.length - 1].week}: from ${weeks[0].rate}% to ${weeks[weeks.length - 1].rate}%`}>
      {ticks.map((t) => <g key={t}><line x1={pad} x2={W - pad} y1={y(t)} y2={y(t)} stroke="#e3e3e3" /><text x={4} y={y(t) + 4} fontSize="11" fill="#666">{t}%</text></g>)}
      <path d={path} fill="none" stroke="#0D71BA" strokeWidth="2.5" />
      <text x={pad} y={H - 6} fontSize="11" fill="#666">{weeks[0].week.slice(0, 7)}</text>
      <text x={W - pad} y={H - 6} fontSize="11" fill="#666" textAnchor="end">{weeks[weeks.length - 1].week.slice(0, 7)}</text>
    </svg>
  );
}

/** The government's rates beside the mortgage rate: fed funds, the 10-year Treasury, the 15-year, and the mortgage spread. */
export function GovRates({ latest }: { latest: Awaited<ReturnType<typeof latestRates>> }) {
  const tile = (key: string, label: string, sub: string, color: string) => {
    const x = latest[key];
    const d = x && x.yearAgo !== null ? Math.round((x.rate - x.yearAgo) * 100) / 100 : null;
    return <Tile key={key} k={label} v={x ? `${x.rate.toFixed(2)}%` : '—'} color={color}
      s={x ? <>{sub}<br />{formatDate(x.week)}{d !== null ? ` · ${d > 0 ? 'up' : d < 0 ? 'down' : 'no change'}${d ? ` ${Math.abs(d).toFixed(2)}` : ''} from a year ago` : ''}</> : 'Not loaded yet'} />;
  };
  const sp = mortgageSpread(latest['30yr']?.rate, latest['10yr']?.rate);
  return (
    <div className="tiles">
      {tile('fedfunds', 'Fed Funds Rate', 'The Fed’s overnight rate', 'var(--near-black)')}
      {tile('10yr', '10-Year Treasury', 'What mortgage rates follow', 'var(--true-blue)')}
      {tile('15yr', '15-Year Mortgage', 'Freddie Mac', 'var(--aqua)')}
      <Tile k="Mortgage Over the 10-Year" v={sp ? `${sp.spread.toFixed(2)} pts` : '—'} color="var(--energy)"
        s={sp ? `${sp.read === 'normal' ? 'Normal (about 1.7)' : sp.read === 'a little wide' ? 'A little wide: room for mortgage rates to fall' : 'Wide: lenders charging extra for risk'}` : 'Needs the 30-year and the 10-year'} />
    </div>
  );
}

export function RatesAndBuyers({ rates, bands }: { rates: NonNullable<Awaited<ReturnType<typeof rateSummary>>>; bands: Awaited<ReturnType<typeof bandsAndRates>> }) {
  const diff = rates.yearAgo ? Math.round((rates.now.rate - rates.yearAgo.rate) * 100) / 100 : null;
  const sensitive = bands.filter((b) => b.sensitivity && b.sensitivity.pctPerPoint <= -15).map((b) => b.label);
  const steady = bands.filter((b) => b.sensitivity && b.sensitivity.pctPerPoint > -5).map((b) => b.label);
  return (
    <>
      <div className="tiles">
        <Tile k="30-Year Rate Now" v={`${rates.now.rate.toFixed(2)}%`} s={`Week of ${formatDate(rates.now.week)}`} color="var(--true-blue)" />
        <Tile k="A Year Ago" v={rates.yearAgo ? `${rates.yearAgo.rate.toFixed(2)}%` : '—'} s={diff === null ? '' : `${diff > 0 ? 'Up' : diff < 0 ? 'Down' : 'No change'}${diff ? ` ${Math.abs(diff).toFixed(2)} points` : ''}`} color="var(--aqua)" />
        <Tile k="Three Years Ago" v={rates.threeAgo ? `${rates.threeAgo.rate.toFixed(2)}%` : '—'} color="var(--light-grey)" />
        <Tile k="Range, 3 Years" v={`${rates.min.rate.toFixed(2)}–${rates.max.rate.toFixed(2)}%`} s={`Low ${rates.min.week.slice(0, 7)} · high ${rates.max.week.slice(0, 7)}`} color="var(--energy)" />
      </div>
      <RateChart weeks={rates.weeks} />
      {sensitive.length || steady.length ? (
        <p className="trend-sentence"><strong>
          {sensitive.length ? `${sensitive.join(', ')} ${sensitive.length === 1 ? 'sells' : 'sell'} noticeably less when rates rise (buyers who need a mortgage). ` : ''}
          {steady.length ? `${steady.join(', ')} barely ${steady.length === 1 ? 'moves' : 'move'} with rates.` : ''}
        </strong></p>
      ) : null}
      <div className="table-wrap"><table className="t">
        <thead><tr><th>Price</th><th className="num">A Month to Own (20% down)</th><th className="num">A Year Ago</th><th className="num">Income a Lender Wants</th><th>With Rates</th></tr></thead>
        <tbody>{bands.map((b) => (
          <tr key={b.band}>
            <td><strong>{b.label}</strong><div className="small muted">at {money(b.price)}</div></td>
            <td className="num">{dollars(b.now.payment)}</td>
            <td className="num">{b.before ? dollars(b.before.payment) : '—'}</td>
            <td className="num">{money(b.now.income)}/yr</td>
            <td>{sensitivityLabel(b.sensitivity?.pctPerPoint)}{b.sensitivity ? <div className="small muted">{b.sensitivity.pctPerPoint > 0 ? '+' : ''}{b.sensitivity.pctPerPoint}% sales per 1-point rise ({b.sensitivity.months} months)</div> : null}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Payment = principal and interest at this week’s 30-year rate, plus about 1.2% of the price a year for taxes and insurance; the income is that payment at 28% of gross income.
        “With rates” compares each month’s county sales in the band with that month’s rate over three years: a guide to which buyers rates hold back, not a forecast.
      </p>
    </>
  );
}

export function CountyTiles({ rows }: { rows: Awaited<ReturnType<typeof countyTrends>> }) {
  if (!rows.length) return null;
  return (
    <div className="tiles">{rows.map((c) => {
      const h = marketHeat(c);
      return (
        <Tile key={c.region} k={`${c.region}, ${c.periodEnd.slice(0, 7)}`} v={c.medianDom === null ? '—' : `${Math.round(c.medianDom)} days`}
          s={<>{h ? heatLabel[h] : ''}{c.monthsOfSupply !== null ? ` · ${c.monthsOfSupply} months of supply` : ''}<br />{change(c.medianDom, c.domAgo, ' days') ?? ''}{c.inventory !== null ? ` · ${c.inventory.toLocaleString()} for sale` : ''}{c.invAgo ? ` (${c.inventory! >= c.invAgo ? '+' : ''}${Math.round(((c.inventory! - c.invAgo) / c.invAgo) * 100)}%)` : ''}</>}
          color={h === 'hot' ? 'var(--red)' : h === 'slow' ? 'var(--energy)' : 'var(--true-blue)'} />
      );
    })}</div>
  );
}

function ZipRows({ rows }: { rows: ZipTrend[] }) {
  return (
    <div className="table-wrap"><table className="t zip-table">
      <thead><tr><th>ZIP</th><th className="num">Days on Market</th><th>Market</th><th className="num">Sold (3 Months)</th><th className="num">For Sale</th><th className="num">New Listings</th><th className="num">Sold vs List</th><th className="num">Price Cuts</th><th className="num">Gone in 2 Weeks</th><th className="num">Median Sale</th><th className="num">$/sf</th></tr></thead>
      <tbody>{rows.map((z) => {
        const h = marketHeat(z);
        return (
          <tr key={z.zip}>
            <td><strong><Link href={`/market/zip/${z.zip}`}>{z.zip}</Link></strong><div className="small muted">{[z.city, z.county === 'wake' ? 'Wake' : z.county === 'durham' ? 'Durham' : null].filter(Boolean).join(' · ')}</div></td>
            <td className="num">{z.medianDom === null ? '—' : Math.round(z.medianDom)}{z.domYearAgo !== null && z.medianDom !== null ? <div className="small muted">{Math.round(z.domYearAgo)} a year ago</div> : null}</td>
            <td>{h ? <span className={`chip heat-${h}`}>{heatLabel[h]}</span> : '—'}{z.monthsOfSupply !== null ? <div className="small muted">{z.monthsOfSupply} months of supply</div> : null}</td>
            <td className="num">{z.homesSold ?? '—'}</td>
            <td className="num">{z.inventory ?? '—'}</td>
            <td className="num">{z.newListings ?? '—'}</td>
            <td className="num">{pct(z.saleToList, 1)}</td>
            <td className="num">{pct(z.priceDrops)}</td>
            <td className="num">{pct(z.offMarket2Wk)}</td>
            <td className="num">{money(z.medianSalePrice)}</td>
            <td className="num">{z.medianPpsf ? `$${Math.round(z.medianPpsf)}` : '—'}{z.ppsfYoy !== null ? <div className={`small ${z.ppsfYoy >= 0 ? 'pace-faster' : 'pace-slower'}`}>{z.ppsfYoy > 0 ? '+' : ''}{z.ppsfYoy}%</div> : null}</td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );
}

/** ZIPs with enough sales to trust, fastest first: the top 20 open, the rest and the thin ones folded. */
export function ZipTable({ rows }: { rows: ZipTrend[] }) {
  if (!rows.length) return <Empty>No Redfin data yet. Press Update Redfin Data under Update Market Data.</Empty>;
  const solid = rows.filter((z) => (z.homesSold ?? 0) >= 10), thin = rows.filter((z) => (z.homesSold ?? 0) < 10);
  return (
    <>
      <ZipRows rows={solid.slice(0, 20)} />
      {solid.length > 20 ? <details className="fold"><summary>Show the Other {solid.length - 20} ZIP Codes</summary><ZipRows rows={solid.slice(20)} /></details> : null}
      {thin.length ? <details className="fold"><summary>{thin.length} ZIP Codes With Fewer Than 10 Sales (too few to trust)</summary><ZipRows rows={thin} /></details> : null}
    </>
  );
}

export function Builders({ builders, areas }: { builders: Awaited<ReturnType<typeof topBuilders>>; areas: Awaited<ReturnType<typeof permitsByArea>> }) {
  return (
    <div className="grid-2">
      <div>
        <h3 className="sub-h">Busiest Builders, Last 12 Months</h3>
        {builders.length ? <ul className="rows">{builders.map((b) => (
          <li key={b.builder}><strong>{b.builder}</strong> <span className="chip blue">{b.n} new {b.n === 1 ? 'home' : 'homes'}</span>
            <div className="small muted">{b.cost ? `Median ${money(b.cost)} to build · ` : ''}{b.zips.length ? `ZIP ${b.zips.join(', ')} · ` : ''}latest {formatDate(b.latest)}</div></li>
        ))}</ul> : <Empty>No permits loaded yet. Press Update Permits under Update Market Data.</Empty>}
        <p className="small muted">Raleigh’s permits name the builder; Durham’s don’t. <Link href="/market/builders">Every builder, their track record and where good local builders are moving in</Link></p>
      </div>
      <div>
        <h3 className="sub-h">Teardowns and New Homes by Area</h3>
        {areas.length ? <div className="table-wrap"><table className="t">
          <thead><tr><th>ZIP or Town</th><th className="num">Teardowns</th><th className="num">New Homes</th></tr></thead>
          <tbody>{areas.map((a) => <tr key={a.area}><td>{a.area}<span className="small muted"> · {a.county === 'wake' ? 'Wake' : 'Durham'}</span></td><td className="num">{a.teardowns}</td><td className="num">{a.homes}</td></tr>)}</tbody>
        </table></div> : <Empty>Nothing yet.</Empty>}
        <p className="small muted">Teardowns show where builders are buying old houses for the land: Durham’s demolition permits, and Raleigh’s new homes that name the demolition before them. Turn on Teardowns and New-Home Permits on the map to see each one.</p>
      </div>
    </div>
  );
}
