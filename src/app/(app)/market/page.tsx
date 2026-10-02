import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { areaTable, bandTrends, marketCounts, ourPlaces, readFilters, type MarketFilters } from '@/lib/market-data';
import { lastSyncs } from '@/lib/market-sync';
import { bandSentence, paceLabel, priceBands, soldWithin } from '@/lib/market-stats';
import { landUses } from '@/lib/market-sources';
import { MarketMap } from '@/components/MarketMap';
import { AreaRows, Filters, query } from '@/components/MarketParts';
import { MarketSync } from '@/components/MarketSync';
import { Empty, PageHead, Section, Tile } from '@/components/ui';

export const metadata = { title: 'Market Map' };
export const maxDuration = 60;

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
