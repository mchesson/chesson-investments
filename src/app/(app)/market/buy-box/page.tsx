import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { buyBoxSettings, judgedZones } from '@/lib/buy-box-data';
import { buyBoxFields, verdictLabel, type Verdict } from '@/lib/buy-box';
import { ourPlaces } from '@/lib/market-data';
import { buildersNear, permitsNear } from '@/lib/market-feeds';
import { rateSummary, recentPermitPoints } from '@/lib/market-feeds-data';
import { MarketMap } from '@/components/MarketMap';
import { ActionForm } from '@/components/ActionForm';
import { Empty, PageHead, Section, Tile } from '@/components/ui';
import { saveBuyBox } from '../../market-actions';

export const metadata = { title: 'Buy Box' };
export const maxDuration = 60;

const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000).toLocaleString()}k`);
const verdicts: Verdict[] = ['buy', 'watch', 'pass', 'thin'];

export default async function BuyBoxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('properties.view');
  const sp = await searchParams;
  const by = sp.by === 'street' ? 'street' : 'neighborhood';
  const county = sp.county === 'wake' || sp.county === 'durham' ? sp.county : null;
  const near = sp.near === '1';
  const show = verdicts.includes(sp.show as Verdict) ? (sp.show as Verdict) : null;
  const [{ settings, zones }, saved, places, permits, rates] = await Promise.all([judgedZones(by, county ? [county] : []), buyBoxSettings(), ourPlaces(), recentPermitPoints(), rateSummary()]);
  const inView = zones.filter((z) => (!near || z.near.miles <= settings.nearMiles));
  const listed = inView.filter((z) => (show ? z.verdict === show : z.verdict !== 'thin')).slice(0, 150);
  const building = new Map(listed.map((z) => [`${z.name}|${z.city}|${z.county}`, { ...permitsNear(z, permits), locals: buildersNear(z, permits) }]));
  const holdUp = inView.filter((z) => z.verdict === 'buy' && z.outlook?.holdsUp).length;
  const count = (v: Verdict) => inView.filter((z) => z.verdict === v).length;
  const href = (o: Record<string, string | null>) => {
    const q = new URLSearchParams(Object.entries({ by: by === 'street' ? 'street' : null, county, near: near ? '1' : null, show, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return q ? `/market/buy-box?${q}` : '/market/buy-box';
  };
  return (
    <>
      <PageHead title="Buy Box" sub="Where to buy and what to pay, worked out from what’s selling now. It moves with the market: every time the county sales are updated, every zone is worked out again."
        actions={<Link className="btn secondary" href="/market">Market Map</Link>} />
      <div className="tiles">
        <Tile k="Buy Zones" v={count('buy')} s={`${inView.filter((z) => z.verdict === 'buy' && z.near.miles <= settings.nearMiles).length} within ${settings.nearMiles} miles of a downtown`} color="var(--aqua)" />
        <Tile k="Watch" v={count('watch')} s="Close: look for below-market lots" color="var(--energy)" />
        <Tile k="Too Expensive" v={count('pass')} color="var(--red)" />
        <Tile k="Buy Zones That Hold Up" v={holdUp} s={`Still a buy if prices fall ${settings.downsidePct}% by the time we sell`} color="var(--aqua-deep)" />
        {rates ? <Tile k="30-Year Rate" v={`${rates.now.rate.toFixed(2)}%`} s={rates.yearAgo ? `${rates.yearAgo.rate.toFixed(2)}% a year ago` : ''} color="var(--light-grey)" /> : null}
        <Tile k="The House We’d Build" v={`${settings.houseSf.toLocaleString()} sf`} s={`$${settings.buildPerSf}/sf to build · ${settings.profitPct}% profit`} color="var(--true-blue)" />
      </div>
      <Section title="Show" kind="grey">
        <div className="market-filters">
          <nav className="role-pick" aria-label="By"><span className="filter-label">By</span>
            <Link className="role-btn" aria-pressed={by === 'neighborhood'} href={href({ by: null })}>Neighborhood</Link>
            <Link className="role-btn" aria-pressed={by === 'street'} href={href({ by: 'street' })}>Street</Link>
          </nav>
          <nav className="role-pick" aria-label="County"><span className="filter-label">County</span>
            <Link className="role-btn" aria-pressed={!county} href={href({ county: null })}>Both</Link>
            <Link className="role-btn" aria-pressed={county === 'wake'} href={href({ county: 'wake' })}>Wake</Link>
            <Link className="role-btn" aria-pressed={county === 'durham'} href={href({ county: 'durham' })}>Durham</Link>
          </nav>
          <nav className="role-pick" aria-label="Where"><span className="filter-label">Where</span>
            <Link className="role-btn" aria-pressed={!near} href={href({ near: null })}>Anywhere</Link>
            <Link className="role-btn" aria-pressed={near} href={href({ near: '1' })}>Within {settings.nearMiles} Miles of a Downtown</Link>
          </nav>
          <nav className="role-pick" aria-label="Verdict"><span className="filter-label">Which</span>
            <Link className="role-btn" aria-pressed={!show} href={href({ show: null })}>All With Enough Sales</Link>
            {verdicts.map((v) => <Link key={v} className="role-btn" aria-pressed={show === v} href={href({ show: v })}>{verdictLabel[v]} ({count(v)})</Link>)}
          </nav>
        </div>
      </Section>
      <Section title="Map" kind="aqua" hint="Green: buy zones · olive: watch (too-expensive zones are in the table)">
        <MarketMap query={county ? `county=${county}` : ''} projects={places.projects} watch={places.watch} areas={[]} only={['zones', 'heat', 'dots', 'parcels', 'permits', 'teardowns', 'projects', 'watch']} parcelInfo
          zones={inView.filter((z) => z.verdict === 'buy' || z.verdict === 'watch').map((z) => ({ name: z.name, city: z.city, lat: z.lat, lng: z.lng, verdict: z.verdict, label: verdictLabel[z.verdict], maxLot: z.money?.maxLot ?? null, entry: z.entryPrice, value: z.money?.value ?? null }))} />
      </Section>
      <Section title={by === 'street' ? 'Streets' : 'Neighborhoods'} kind="blue" hint={`${listed.length} shown`}>
        {listed.length ? (
          <div className="table-wrap"><table className="t buy-table">
            <thead><tr><th>{by === 'street' ? 'Street' : 'Neighborhood'}</th><th>Verdict</th><th className="num">Downtown</th><th className="num">Finished $/sf</th><th className="num">New House Sells For</th><th className="num">We Can Pay for the Lot</th><th className="num">Lots and Teardowns Sell For</th><th className="num">Sales at That Price</th><th className="num">When We’d Sell: Low / Mid / High</th><th className="num">Building Nearby</th><th>Why</th></tr></thead>
            <tbody>{listed.map((z) => (
              <tr key={`${z.name}|${z.city}|${z.county}`}>
                <td><strong>{z.name}</strong><div className="small muted">{z.city ?? ''}{z.county ? ` · ${z.county === 'wake' ? 'Wake' : 'Durham'}` : ''}</div></td>
                <td><span className={`chip verdict-${z.verdict}`}>{verdictLabel[z.verdict]}</span></td>
                <td className="num">{z.near.miles} mi<div className="small muted">{z.near.name.replace('Downtown ', '')}</div></td>
                <td className="num">{z.finishedPsf ? `$${z.finishedPsf}` : '—'}<div className="small muted">{z.finished} {z.basis}</div></td>
                <td className="num">{money(z.money?.value)}</td>
                <td className="num"><strong>{money(z.money?.maxLot)}</strong></td>
                <td className="num">{money(z.entryPrice)}<div className="small muted">{z.entryCount} sales{z.entryCount ? ` ${z.entryFrom ?? ""}` : ""}</div></td>
                <td className="num">{z.money ? z.absorb : '—'}</td>
                <td className="num outlook">{z.outlook ? <>{money(z.outlook.low)} / <strong>{money(z.outlook.mid)}</strong> / {money(z.outlook.high)}
                  <div className="small muted">{z.outlook.trend === null ? 'no trend yet' : `prices ${z.outlook.trend >= 0 ? '+' : ''}${z.outlook.trend}% a year`}{z.outlook.holdsUp === true ? ' · holds up' : z.outlook.holdsUp === false ? ' · not at Low' : ''}</div></> : '—'}</td>
                <td className="num">{(() => { const b = building.get(`${z.name}|${z.city}|${z.county}`); return b && (b.newHomes || b.teardowns) ? <>{b.newHomes} new · {b.teardowns} teardowns<div className="small muted">within ½ mile, 12 months</div>
                  {b.locals.length ? <div className="small"><strong>Local builders:</strong> {b.locals.slice(0, 3).map((l) => `${l.name} (${l.count})`).join(', ')}{b.locals.length > 3 ? ` +${b.locals.length - 3}` : ''}</div> : null}</> : '—'; })()}</td>
                <td className="small">{z.reasons.join('; ')}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>Nothing here yet. Update the market data on the Market Map, or widen what’s shown.</Empty>}
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          How it’s worked out: a new {settings.houseSf.toLocaleString()} sf house at the zone’s finished $/sf (new builds when there are {settings.minSales}+, else the top quarter of houses over 1,500 sf, last 2 years),
          less {settings.sellingPct}% selling, the build at ${settings.buildPerSf}/sf, {settings.softPct}% soft and holding, and {settings.profitPct}% profit, divided by 1 + {settings.financingPct}% financing = what we can pay for the lot.
          Lots and teardowns = land sales and houses built before 1970 under 1,600 sf, last 3 years.
          When we’d sell: Mid carries the zone’s own $/sf trend (last 12 months against the 12 before, capped at ±15% a year) forward {settings.monthsToSell} months; Low takes {settings.downsidePct}% off, High adds {settings.upsidePct}%. “Holds up” means the Low case still covers what lots sell for there.
          Building nearby counts new-home and demolition permits (Raleigh and Durham) within half a mile, and names the local builders there (national and large builders left out; see <Link href="/market/builders">Builders</Link>).
        </p>
      </Section>
      <Section title="Our Numbers" kind="energy" hint={saved.saved ? `Changed ${saved.updated?.toISOString().slice(0, 10)}` : 'The starting numbers from the Plainview math'}>
        {can(user, 'properties.edit') ? (
          <ActionForm action={saveBuyBox} submit="Save and Work It Out Again">
            <div className="fields">{buyBoxFields.map((f) => (
              <label key={f.key} className="f">{f.label}<span className="h">{f.hint}</span><input name={f.key} inputMode="decimal" defaultValue={String(settings[f.key])} required /></label>
            ))}</div>
          </ActionForm>
        ) : <p className="small">{buyBoxFields.map((f) => `${f.label}: ${settings[f.key]}`).join(' · ')}</p>}
      </Section>
    </>
  );
}
