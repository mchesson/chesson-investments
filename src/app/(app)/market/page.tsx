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
import { lastAutoUpdates } from '@/lib/market-auto';
import { formatDateTime } from '@/lib/format';
import { Builders, CountyTiles, RatesAndBuyers, ZipTable } from '@/components/MarketFeeds';
import { bandsAndRates, countyTrends, permitsByArea, rateSummary, topBuilders, zipTrends } from '@/lib/market-feeds-data';
import { heatLabel, marketHeat, trendTypes } from '@/lib/market-feeds';
import { Empty, PageHead, Section, Tile } from '@/components/ui';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const metadata = { title: 'Market Map' };
export const maxDuration = 800; // Update Redfin Data reads a national file (a minute or two)

export default async function MarketPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('properties.view');
  const sp = await searchParams;
  const f = readFilters(sp);
  const zipType = trendTypes.some((t) => t.key === sp.zipType) ? sp.zipType! : 'all';
  const [bands, hoods, streets, towns, places, counts, syncs, rates, zips, countyRows, builders, permitAreas] = await Promise.all([
    bandTrends(f), areaTable('neighborhood', f), areaTable('street', f), areaTable('city', f, 25), ourPlaces(), marketCounts(), lastSyncs(),
    rateSummary(), zipTrends(zipType), countyTrends(), topBuilders(), permitsByArea(),
  ]);
  // Opened from a link: a place (?lat=&lng=&label=) or a neighborhood (?hood=) to center on.
  const focus = await focusFrom(sp);
  const rateBands = rates ? await bandsAndRates({ now: rates.now.rate, yearAgo: rates.yearAgo?.rate ?? null }) : null;
  const zipLabels = zips.filter((z) => z.lat && z.lng).map((z) => {
    const h = marketHeat(z);
    return { zip: z.zip, lat: z.lat!, lng: z.lng!, dom: z.medianDom, mos: z.monthsOfSupply, heat: h,
      label: [z.medianDom !== null ? `${Math.round(z.medianDom)} days on market` : null, h ? heatLabel[h] : null, z.monthsOfSupply !== null ? `${z.monthsOfSupply} months of supply` : null,
        z.inventory !== null ? `${z.inventory} for sale` : null, z.priceDrops !== null ? `${Math.round(z.priceDrops * 100)}% with a price cut` : null].filter(Boolean).join(' · ') };
  });
  const totalSales = counts.reduce((s, c) => s + c.sales, 0);
  const autoLast = await lastAutoUpdates();
  const last = Object.fromEntries(syncs.map((s) => [s.county, { status: s.status, finished: s.finished ? new Date(s.finished).toISOString() : null, parcels: s.parcels, newSales: s.new_sales, error: s.error }]));
  return (
    <>
      <PageHead title="Market Map" sub="What’s selling, where and for how much, from Wake and Durham County public records. Zoom in to street level; the buttons above the map add or take away what it shows."
        actions={<><Link className="btn secondary" href="/market/builders">Builders</Link><Link className="btn" href="/market/buy-box">Buy Box: Where to Buy</Link></>} />
      <Section title="Filters" kind="grey"><Filters f={f} /></Section>
      <Section title="Map" kind="aqua" hint={totalSales ? `${totalSales.toLocaleString()} sales on file` : 'No sales loaded yet'}>
        <MarketMap focus={focus} query={query(f)} projects={places.projects} watch={places.watch} areas={hoods} zips={zipLabels} parcelInfo />
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
          From closed county sales. Days on market, homes for sale and price cuts are under Time on Market by ZIP Code (Redfin).
        </p>
      </Section>
      <Section title="Rates and Buyers" kind="energy" hint="What a house costs a month at today’s rate, and which price bands move with rates">
        {rates && rateBands ? <RatesAndBuyers rates={rates} bands={rateBands} /> : <Empty>No rates loaded yet. Press Update Rates under Update Market Data.</Empty>}
      </Section>
      <Section title="Time on Market by ZIP Code" kind="aqua" hint={zips[0] ? `Redfin, the 3 months to ${zips[0].periodEnd.slice(0, 7)}; fastest first` : 'Redfin’s free market data'}>
        <CountyTiles rows={countyRows} />
        <nav className="role-pick" aria-label="Kind of home"><span className="filter-label">Homes</span>
          {trendTypes.map((t) => {
            const q = new URLSearchParams(Object.entries({ ...sp, zipType: t.key === 'all' ? undefined : t.key }).filter(([, v]) => v) as [string, string][]).toString();
            return <Link key={t.key} className="role-btn" aria-pressed={zipType === t.key} href={q ? `/market?${q}#zips` : '/market#zips'} scroll={false}>{t.label}</Link>;
          })}
        </nav>
        <div id="zips"><ZipTable rows={zips} /></div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          From Redfin’s free public data (the MLS listings Redfin sees), refreshed monthly. Under 3 months of supply is a seller’s market; over 6 a buyer’s. Individual homes for sale aren’t in it: those need a listings feed.
        </p>
      </Section>
      <Section title="Who’s Building" kind="blue" hint="New-home and demolition permits, Raleigh and Durham, the last 12 months">
        <Builders builders={builders} areas={permitAreas} />
      </Section>
      <div className="grid-2">
        <Section title="Neighborhoods" kind="blue" hint={`Busiest, ${soldWithin.find((m) => m.key === String(f.months))?.label.toLowerCase()}`}><AreaRows rows={hoods} kind="neighborhoods" /></Section>
        <Section title="Streets" kind="aqua" hint="Three or more sales"><AreaRows rows={streets} kind="streets" /></Section>
      </div>
      <Section title="Towns" kind="energy"><AreaRows rows={towns} kind="towns" /></Section>
      {can(user, 'properties.edit') ? <Section title="Update Market Data" kind="grey" hint="Read-only from the counties"><MarketSync last={last} auto={(['counties', 'feeds', 'places'] as const).map((part) => ({ part, label: { counties: 'County sales', feeds: 'Rates, permits and Redfin', places: 'Map places, zoning and bills' }[part], at: autoLast[part] ? formatDateTime(autoLast[part]!.at) : null, summary: autoLast[part]?.summary ?? null }))} /></Section> : null}
    </>
  );
}

async function focusFrom(sp: Record<string, string | undefined>) {
  const lat = Number(sp.lat), lng = Number(sp.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat > 30 && lat < 40 && lng > -85 && lng < -74) return { lat, lng, zoom: 17, label: (sp.label ?? 'Here').slice(0, 120) };
  const hood = sp.hood?.trim().slice(0, 120);
  if (!hood) return null;
  const r = await db.execute<{ lat: string | null; lng: string | null }>(sql`select avg(lat) as lat, avg(lng) as lng from market_parcels where lower(neighborhood) = lower(${hood}) and lat is not null`);
  const p = r.rows[0];
  return p?.lat && p.lng ? { lat: Number(p.lat), lng: Number(p.lng), zoom: 15, label: hood } : null;
}
