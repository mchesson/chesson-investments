import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { cleanZipInput, zipHeadline, zipStory } from '@/lib/zip-report-rules';
import { zipReport } from '@/lib/zip-report';
import { zipDrivers } from '@/lib/price-drivers-data';
import { driverSentences } from '@/lib/price-drivers';
import { ourPlaces, readFilters } from '@/lib/market-data';
import { landUses } from '@/lib/market-sources';
import { permitKinds } from '@/lib/market-feeds';
import { formatDate, formatMoney } from '@/lib/format';
import { MarketMap } from '@/components/MarketMap';
import { query } from '@/components/MarketParts';
import { AgentsHere } from '@/components/AgentsHere';
import { ZipLookup } from '@/components/ZipLookup';
import { Empty, PageHead, Section, Tile } from '@/components/ui';

export async function generateMetadata({ params }: { params: Promise<{ zip: string }> }) {
  return { title: `ZIP ${(await params).zip}` };
}

const useLabel = (k: string) => landUses.find((u) => u.key === k)?.label ?? 'Other';
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

/** What's happening in one ZIP code (owner, Oct 3, 2026). */
export default async function ZipPage({ params }: { params: Promise<{ zip: string }> }) {
  await requirePage('properties.view');
  const zip = cleanZipInput((await params).zip);
  if (!zip) notFound();
  const [rep, places, drivers] = await Promise.all([zipReport(zip), ourPlaces(), zipDrivers(zip)]);
  const { facts: f, place } = rep;
  const story = zipStory(f);
  const r = f.redfin;
  const nothing = !r && !f.sales.now && !f.sales.before && !f.permits.newHomes && !f.permits.teardowns && !rep.projects.length && !rep.watched.length;
  return (
    <>
      <PageHead eyebrow="ZIP Code" title={`What’s Happening in ${zip}`} sub={[place.city, place.county === 'wake' ? 'Wake County' : place.county === 'durham' ? 'Durham County' : null].filter(Boolean).join(' · ') || undefined}
        actions={<><ZipLookup current={zip} /><Link className="btn secondary" href="/market">Market Map</Link></>} />
      <Section title="In Plain Words" kind="blue" hint={r ? `Redfin to ${formatDate(r.periodEnd)}; county sales to ${formatDate(rep.recent[0]?.sold_on ?? null)}` : undefined}>
        {nothing ? <Empty>Nothing on file for {zip}. The Market Map covers Wake and Durham counties: check the ZIP, or update the market data.</Empty> : <>
          <p className="trend-sentence"><strong>{zipHeadline(f)}</strong></p>
          <ul className="zip-story">{story.map((x) => <li key={x}>{x}</li>)}</ul>
        </>}
      </Section>
      {r ? (
        <Section title="Right Now" kind="aqua" hint="Redfin, the latest 3 months, all homes">
          <div className="tiles">
            <Tile k="Days on Market" v={r.medianDom === null ? '—' : Math.round(r.medianDom)} s={r.domYearAgo !== null ? `${Math.round(r.domYearAgo)} a year ago` : undefined} />
            <Tile k="Months of Supply" v={r.monthsOfSupply ?? '—'} s="Under 3: seller’s market; over 6: buyer’s" />
            <Tile k="Sold vs List" v={pct(r.saleToList)} />
            <Tile k="Price Cuts" v={pct(r.priceDrops)} />
            <Tile k="For Sale" v={r.inventory ?? '—'} s={r.homesSold !== null ? `${r.homesSold} sold in 3 months` : undefined} />
            <Tile k="Median Sale" v={formatMoney(r.medianSalePrice)} s={r.medianPpsf !== null ? `$${Math.round(r.medianPpsf)}/sf${r.ppsfYearAgo !== null ? ` ($${Math.round(r.ppsfYearAgo)} a year ago)` : ''}` : undefined} />
          </div>
        </Section>
      ) : null}
      <Section title="Map" kind="aqua">
        {place.lat && place.lng ? <MarketMap focus={{ lat: place.lat, lng: place.lng, zoom: 14, label: zip }} query={query(readFilters({ months: '12' }))} projects={places.projects} watch={places.watch} areas={[]} parcelInfo />
          : <Empty>No county parcels with a place on the map in {zip} yet.</Empty>}
      </Section>
      <Section title="What Buyers Pay For Here" kind="energy" hint={drivers ? `Measured from ${drivers.n.toLocaleString()} sales in ${zip}, the last 2 years` : 'Measured from county sales'}>
        {drivers ? <>
          <ul className="zip-story">{driverSentences(drivers).slice(1).map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="small muted">Size, age, lot and kind of home explain {drivers.r2}% of why prices differ inside {zip}. <Link href="/market/buyers">Buyer Factors for the whole area</Link></p>
        </> : <Empty>Too few ordinary home sales in {zip} to measure (it needs about 60). <Link href="/market/buyers">Buyer Factors for the whole area</Link></Empty>}
      </Section>
      <div className="grid-2">
        <Section title="Sales by Kind of Home" kind="blue" hint="County records, the last 12 months against the 12 before">
          {rep.uses.length ? <div className="table-wrap"><table className="t">
            <thead><tr><th>Kind</th><th className="num">Sales</th><th className="num">Year Before</th><th className="num">Median</th><th className="num">$/sf</th></tr></thead>
            <tbody>{rep.uses.map((u) => <tr key={u.use}><td>{useLabel(u.use)}</td><td className="num">{u.now}</td><td className="num">{u.before}</td><td className="num">{formatMoney(u.price)}</td><td className="num">{u.psf ? `$${u.psf}` : '—'}</td></tr>)}</tbody>
          </table></div> : <Empty>No county sales on file in {zip}.</Empty>}
        </Section>
        <Section title="Neighborhoods" kind="aqua" hint="Busiest, the last 12 months">
          {rep.hoods.length ? <div className="table-wrap"><table className="t">
            <thead><tr><th>Neighborhood</th><th className="num">Sales</th><th className="num">Median</th><th className="num">$/sf</th></tr></thead>
            <tbody>{rep.hoods.map((h) => <tr key={h.name}><td><Link href={`/market?hood=${encodeURIComponent(h.name)}`}>{h.name}</Link></td><td className="num">{h.sales}</td><td className="num">{formatMoney(h.price)}</td><td className="num">{h.psf ? `$${h.psf}` : '—'}</td></tr>)}</tbody>
          </table></div> : <Empty>No named neighborhoods with sales here.</Empty>}
        </Section>
      </div>
      <Section title="Newest Sales" kind="blue" hint="County records">
        {rep.recent.length ? <div className="table-wrap"><table className="t">
          <thead><tr><th>Address</th><th>Sold</th><th className="num">Price</th><th className="num">Heated SF</th><th className="num">$/sf</th><th>Kind</th></tr></thead>
          <tbody>{rep.recent.map((x, i) => <tr key={i}>
            <td>{x.lat && x.lng ? <Link href={`/market?${new URLSearchParams({ lat: x.lat, lng: x.lng, label: x.address ?? zip })}`}>{x.address ?? '—'}</Link> : x.address ?? '—'}{x.neighborhood ? <div className="small muted">{x.neighborhood}</div> : null}</td>
            <td>{formatDate(x.sold_on)}</td><td className="num">{formatMoney(x.price)}</td><td className="num">{x.heated_sf?.toLocaleString() ?? '—'}</td><td className="num">{x.psf ? `$${x.psf}` : '—'}</td><td>{useLabel(x.land_use ?? 'other')}</td>
          </tr>)}</tbody>
        </table></div> : <Empty>No county sales on file in {zip}.</Empty>}
      </Section>
      <Section title="Who’s Building" kind="energy" hint={`${f.permits.newHomes} new homes · ${f.permits.teardowns} teardowns, the last 12 months`}>
        {rep.permits.length ? <>
          {rep.builders.length ? <p style={{ marginTop: 0 }}>{rep.builders.map((b) => <span key={b.name} className="chip blue" style={{ marginRight: 6 }}>{b.name} · {b.n}</span>)}</p> : null}
          <ul className="rows">{rep.permits.map((p, i) => <li key={i}><strong>{permitKinds[p.kind as keyof typeof permitKinds] ?? p.kind}</strong> · {p.address ?? 'No address'} · {formatDate(p.issued)}{p.builder ? ` · ${p.builder}` : ''}{p.cost ? ` · ${formatMoney(p.cost)}` : ''}</li>)}</ul>
          <p className="small muted">Raleigh’s and Durham’s permits; Raleigh’s name the builder. <Link href="/market/builders">Every builder</Link></p>
        </> : <Empty>No new-home or teardown permits in {zip} in the last 12 months (only Raleigh and Durham permits are loaded).</Empty>}
      </Section>
      <div className="grid-2">
        <Section title="Ours Here" kind="grey">
          {rep.projects.length || rep.watched.length ? <ul className="rows">
            {rep.projects.map((p) => <li key={p.id}><Link href={`/projects/${p.id}`}>{p.name}</Link> <span className="small muted">Project</span></li>)}
            {rep.watched.map((p) => <li key={p.id}><Link href={`/watchlist/${p.id}`}>{p.name}</Link> <span className="small muted">Watchlist</span></li>)}
          </ul> : <Empty>None of our projects or watched properties are in {zip}.</Empty>}
        </Section>
        <AgentsHere place={{ zip, city: place.city }} />
      </div>
    </>
  );
}
