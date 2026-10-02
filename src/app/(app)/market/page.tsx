import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { areaTable, bandTrends, marketCounts, ourPlaces, readFilters, type MarketFilters } from '@/lib/market-data';
import { lastSyncs } from '@/lib/market-sync';
import { bandSentence, paceLabel, priceBands, soldWithin } from '@/lib/market-stats';
import { landUses } from '@/lib/market-sources';
import { MarketMap } from '@/components/MarketMap';
import { MarketSync } from '@/components/MarketSync';
import { Empty, PageHead, Section, Tile } from '@/components/ui';

export const metadata = { title: 'Market Map' };
export const maxDuration = 60;

const money = (n: number | null) => (n === null ? '—' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000).toLocaleString()}k`);

function query(f: MarketFilters, over: Partial<Record<'county' | 'use' | 'band' | 'months', string | null>> = {}) {
  const cur: Record<string, string | null> = { county: f.counties.join(',') || null, use: f.uses.join(',') || null, band: f.bands.join(',') || null, months: f.months === 12 ? null : String(f.months) };
  const q = new URLSearchParams(Object.entries({ ...cur, ...over }).filter(([, v]) => v) as [string, string][]);
  return q.toString();
}
const toggle = (list: string[], k: string) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]).join(',') || null;

function Filters({ f }: { f: MarketFilters }) {
  const href = (over: Parameters<typeof query>[1]) => { const q = query(f, over); return q ? `/market?${q}` : '/market'; };
  return (
    <div className="market-filters">
      <nav aria-label="County" className="role-pick"><span className="filter-label">County</span>
        <Link href={href({ county: null })} className="role-btn" aria-pressed={!f.counties.length}>Both</Link>
        {[['wake', 'Wake'], ['durham', 'Durham']].map(([k, l]) => <Link key={k} href={href({ county: toggle(f.counties, k) })} className="role-btn" aria-pressed={f.counties.includes(k)}>{l}</Link>)}
      </nav>
      <nav aria-label="Kind of property" className="role-pick"><span className="filter-label">Kind</span>
        <Link href={href({ use: null })} className="role-btn" aria-pressed={!f.uses.length}>All</Link>
        {landUses.map((u) => <Link key={u.key} href={href({ use: toggle(f.uses, u.key) })} className="role-btn" aria-pressed={f.uses.includes(u.key)}>{u.label}</Link>)}
      </nav>
      <nav aria-label="Price" className="role-pick"><span className="filter-label">Price</span>
        <Link href={href({ band: null })} className="role-btn" aria-pressed={!f.bands.length}>Any</Link>
        {priceBands.map((b) => <Link key={b.key} href={href({ band: toggle(f.bands, b.key) })} className="role-btn" aria-pressed={f.bands.includes(b.key)}>{b.label}</Link>)}
      </nav>
      <nav aria-label="Sold" className="role-pick"><span className="filter-label">Sold</span>
        {soldWithin.map((m) => <Link key={m.key} href={href({ months: m.key === '12' ? null : m.key })} className="role-btn" aria-pressed={String(f.months) === m.key}>{m.label}</Link>)}
      </nav>
    </div>
  );
}

function AreaRows({ rows, kind }: { rows: Awaited<ReturnType<typeof areaTable>>; kind: string }) {
  if (!rows.length) return <Empty>No {kind} with enough sales yet. Update the market data, or widen the filters.</Empty>;
  return (
    <div className="table-wrap"><table className="t">
      <thead><tr><th>{kind === 'streets' ? 'Street' : kind === 'towns' ? 'Town' : 'Neighborhood'}</th>{kind === 'towns' ? null : <th>Town</th>}<th className="num">Sales</th><th className="num">Before</th><th className="num">Median Price</th><th className="num">$/sf</th><th className="num">$/sf Change</th></tr></thead>
      <tbody>{rows.map((r) => {
        const ch = r.median_psf && r.prior_psf ? Math.round(((r.median_psf - r.prior_psf) / r.prior_psf) * 100) : null;
        return (
          <tr key={`${r.name}|${r.county}`}>
            <td>{r.name}</td>{kind === 'towns' ? null : <td>{r.city ?? '—'}</td>}
            <td className="num">{r.sales}</td><td className="num muted">{r.prior}</td>
            <td className="num">{money(r.median_price)}</td><td className="num">{r.median_psf ? `$${r.median_psf}` : '—'}</td>
            <td className={`num ${ch === null ? 'muted' : ch >= 0 ? 'green' : 'red'}`}>{ch === null ? '—' : `${ch > 0 ? '+' : ''}${ch}%`}</td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('properties.view');
  const f = readFilters(await searchParams);
  const [bands, hoods, streets, towns, places, counts, syncs] = await Promise.all([
    bandTrends(f), areaTable('neighborhood', f), areaTable('street', f), areaTable('city', f, 25), ourPlaces(), marketCounts(), lastSyncs(),
  ]);
  const totalSales = counts.reduce((s, c) => s + c.sales, 0);
  const last = Object.fromEntries(syncs.map((s) => [s.county, { status: s.status, finished: s.finished ? new Date(s.finished).toISOString() : null, parcels: s.parcels, newSales: s.new_sales, error: s.error }]));
  return (
    <>
      <PageHead title="Market Map" sub="What’s selling, where and for how much, from Wake and Durham County public records. Zoom in to street level; the buttons above the map add or take away what it shows." />
      <Section title="Filters" kind="grey"><Filters f={f} /></Section>
      <Section title="Map" kind="aqua" hint={totalSales ? `${totalSales.toLocaleString()} sales on file` : 'No sales loaded yet'}>
        <MarketMap query={query(f)} projects={places.projects} watch={places.watch} areas={hoods} />
        {places.notPlaced ? <p className="small muted" style={{ margin: '8px 0 0' }}>{places.notPlaced} of our projects and watched properties aren’t on the map yet (their address wasn’t found on the county parcels).</p> : null}
      </Section>
      <Section title="Where the Market Is Headed" kind="blue" hint="Sales per month: the latest 6 months (to 30 days ago) against the same months a year earlier">
        <p className="trend-sentence"><strong>{totalSales ? bandSentence(bands.filter((b) => b.pace !== 'thin')) : 'Update the market data to see the trends.'}</strong></p>
        <div className="tiles">{bands.map((b) => (
          <Tile key={b.band} k={b.label} v={<span className={`pace pace-${b.pace}`}>{paceLabel[b.pace]}</span>}
            s={<>{b.perMonthNow}/month now · {b.perMonthBefore}/month before{b.change !== null ? ` (${b.change > 0 ? '+' : ''}${b.change}%)` : ''}{b.medianPsf ? <><br />Median ${b.medianPsf}/sf</> : null}</>}
            color={b.pace === 'faster' ? 'var(--aqua)' : b.pace === 'slower' ? 'var(--red)' : 'var(--light-grey)'} />
        ))}</div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Time on market and asking prices aren’t in county records: they come from the MLS or a listings service. Until one is connected, “selling faster” means more closed sales per month than the year before.
        </p>
      </Section>
      <div className="grid-2">
        <Section title="Neighborhoods" kind="blue" hint={`Busiest, ${soldWithin.find((m) => m.key === String(f.months))?.label.toLowerCase()}`}><AreaRows rows={hoods} kind="neighborhoods" /></Section>
        <Section title="Streets" kind="aqua" hint="Three or more sales"><AreaRows rows={streets} kind="streets" /></Section>
      </div>
      <Section title="Towns" kind="energy"><AreaRows rows={towns} kind="towns" /></Section>
      {can(user, 'properties.edit') ? <Section title="Update Market Data" kind="grey" hint="Read-only from the counties"><MarketSync last={last} /></Section> : null}
    </>
  );
}
