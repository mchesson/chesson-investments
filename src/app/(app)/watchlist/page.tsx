import Link from 'next/link';
import { listProperties, type WatchView } from '@/lib/watch';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney } from '@/lib/format';
import { pricePerLotSf, propertyStageLabel } from '@/lib/properties';
import { PageHead, Section, Empty } from '@/components/ui';
import { Pager } from '@/components/contacts';
import { dealTypeLabel, dealTypes, isDealType } from '@/lib/deal-sources';
import { isZoningFamily, zoningFamilies, zoningFamilyLabel } from '@/lib/zoning';
import { ActionButton } from '@/components/ActionButton';
import { findLocationsAndZoning } from '../locate-actions';

export const metadata = { title: 'Watchlist' };

const views: { key: WatchView; label: string }[] = [
  { key: 'active', label: 'Watching' }, { key: 'past', label: 'Past Bids and Passes' }, { key: 'comps', label: 'Sold (Comparables)' }, { key: 'all', label: 'Everything' },
];

export default async function Watchlist({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('properties.view');
  const sp = await searchParams;
  const view = (views.find((v) => v.key === sp.view)?.key ?? 'active') as WatchView;
  const dealType = isDealType(sp.type) ? sp.type : null;
  // Zoning: several can be picked (Houses, Houses and Townhomes...), kept in the address.
  const zoning = (sp.zoning ?? '').split(',').filter(isZoningFamily);
  const { rows, total, page, pageSize } = await listProperties({ view, q: sp.q, page: Number(sp.page) || 1, dealType, zoning });
  const toggle = (k: string) => { const n = zoning.includes(k as never) ? zoning.filter((z) => z !== k) : [...zoning, k]; return n.length ? n.join(',') : null; };
  const href = (o: Record<string, string | null>) => { const q = new URLSearchParams(Object.entries({ view: view === 'active' ? null : view, type: dealType, zoning: zoning.length ? zoning.join(',') : null, ...o }).filter(([, v]) => v) as [string, string][]).toString(); return q ? `/watchlist?${q}` : '/watchlist'; };
  return (
    <>
      <PageHead title="Watchlist" sub="Every lot we like, bid on or watch. Sold ones stay as comparables."
        actions={<>{can(user, 'properties.edit') ? <ActionButton action={findLocationsAndZoning} className="btn secondary" label="Find Locations and Zoning" done="Done." /> : null}<Link className="btn secondary" href="/watchlist/sources">Deal Sources</Link>{can(user, 'properties.edit') ? <Link className="btn" href={`/watchlist/new${dealType ? `?type=${dealType}` : ''}`}>Add a Property</Link> : null}</>} />
      <Section title="Find Properties" kind="grey">
        <nav className="chips" style={{ marginBottom: 10 }} aria-label="Which properties">
          {views.map((v) => (
            <Link key={v.key} href={href({ view: v.key === 'active' ? null : v.key })} className={`chip ${view === v.key ? 'blue' : ''}`} aria-current={view === v.key ? 'page' : undefined}>{v.label}</Link>
          ))}
        </nav>
        <nav className="role-pick" aria-label="Kind of deal"><span className="filter-label">Kind</span>
          <Link className="role-btn" aria-pressed={!dealType} href={href({ type: null })}>Every Kind</Link>
          {dealTypes.map((t) => <Link key={t.key} className="role-btn" aria-pressed={dealType === t.key} href={href({ type: t.key })}>{t.label}</Link>)}
        </nav>
        <nav className="role-pick" aria-label="Zoning"><span className="filter-label">Zoning</span>
          <Link className="role-btn" aria-pressed={!zoning.length} href={href({ zoning: null })}>Any Zoning</Link>
          {zoningFamilies.map((f) => <Link key={f.key} className="role-btn" aria-pressed={zoning.includes(f.key)} href={href({ zoning: toggle(f.key) })} title={'hint' in f ? f.hint : undefined}>{f.label}</Link>)}
        </nav>
        {zoning.length ? <p className="small muted" style={{ margin: '0 0 8px' }}>Zoning comes from the Wake and Durham county maps. A property without its location shows only under Any Zoning: press Find Locations and Zoning.</p> : null}
        <form className="find-bar">
          {zoning.length ? <input type="hidden" name="zoning" value={zoning.join(',')} /> : null}
          {view !== 'active' ? <input type="hidden" name="view" value={view} /> : null}
          {dealType ? <input type="hidden" name="type" value={dealType} /> : null}
          <label className="f grow">Search<input name="q" defaultValue={sp.q ?? ''} placeholder="Address, city, neighborhood, ZIP, zoning" /></label>
          <button className="btn" type="submit">Search</button>
        </form>
      </Section>
      <Section title={views.find((v) => v.key === view)!.label} kind="aqua" hint={`${total}`}>
        {rows.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Property</th><th>Stage</th><th className="num">{view === 'comps' ? 'Sold For' : 'Asking'}</th><th className="num">Lot</th><th className="num">$/Lot SF</th><th>Zoning</th><th>Source</th></tr></thead>
            <tbody>{rows.map((r) => {
              const price = r.stage === 'sold' ? r.soldPrice : r.askingPrice;
              const ppsf = pricePerLotSf(price, r.lotSf);
              return (
                <tr key={r.id}>
                  <td><Link href={`/watchlist/${r.id}`}>{r.address}</Link><div className="small muted">{[r.dealType !== 'lot' ? dealTypeLabel(r.dealType) + (r.lotsPossible ? ` (${r.lotsPossible} lots)` : '') : null, r.neighborhood, r.city, r.zip].filter(Boolean).join(' · ')}</div></td>
                  <td><span className="chip">{propertyStageLabel(r.stage)}</span>{r.stage === 'sold' && r.soldOn ? <div className="small muted">{formatDate(r.soldOn)}</div> : null}
                    {r.stage === 'lost' ? <div className="small muted">We offered {formatMoney(r.ourOffer)}{r.winningPrice ? `; won at ${formatMoney(r.winningPrice)}` : ''}</div> : null}</td>
                  <td className="num">{formatMoney(price)}</td>
                  <td className="num">{r.lotSf ? `${r.lotSf.toLocaleString()} sf` : '—'}</td>
                  <td className="num">{ppsf ? `$${ppsf.toFixed(2)}` : '—'}</td>
                  <td>{r.zoning ?? '—'}{r.zoningFamily ? <div className="small muted">{zoningFamilyLabel(r.zoningFamily)}{r.zoningPlace ? ` · ${r.zoningPlace}` : ''}</div> : null}</td>
                  <td>{r.sourceId ? <Link href={`/people/${r.sourceId}`}>{r.sourceName}</Link> : <span className="muted">Us</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <Empty>Nothing here yet.</Empty>}
        <Pager base="/watchlist" page={page} total={total} pageSize={pageSize} params={{ view: view === 'active' ? undefined : view, q: sp.q, type: dealType ?? undefined, zoning: zoning.length ? zoning.join(',') : undefined }} />
      </Section>
    </>
  );
}
