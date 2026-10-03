import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { builderTable, localBuildersMovingIn } from '@/lib/market-feeds-data';
import { bucketLabel, LARGE_BUILDER_PERMITS, type BuilderBucket } from '@/lib/market-feeds';
import { formatDate } from '@/lib/format';
import { Empty, PageHead, Section, Tile } from '@/components/ui';

export const metadata = { title: 'Builders' };
export const maxDuration = 60;

const buckets: BuilderBucket[] = ['local', 'large', 'national'];
const money = (n: number | null) => (n === null ? '—' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);

export default async function BuildersPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  await requirePage('properties.view');
  const { bucket: b } = await searchParams;
  const bucket = b === 'all' ? null : buckets.includes(b as BuilderBucket) ? (b as BuilderBucket) : 'local';
  const [all, movingIn] = await Promise.all([builderTable(), localBuildersMovingIn()]);
  const rows = (bucket ? all.filter((x) => x.bucket === bucket) : all).filter((x) => x.permits12 || x.permitsBefore).slice(0, 200);
  const count = (k: BuilderBucket) => all.filter((x) => x.bucket === k && x.permits12).length;
  const quick = all.filter((x) => x.bucket === 'local' && x.quick).length;
  return (
    <>
      <PageHead eyebrow="Market" title="Builders" sub="Every builder on the building permits, their track record (how fast their homes sell after the permit, at what $/sf) and where the good local builders are buying now. National and large builders are kept apart: they follow big land deals, not neighborhoods."
        actions={<><Link className="btn secondary" href="/market">Market Map</Link><Link className="btn secondary" href="/market/buy-box">Buy Box</Link></>} />
      <div className="tiles">
        <Tile k="Local Builders Active" v={count('local')} s="New-home permits in the last 12 months" color="var(--aqua)" />
        <Tile k="Quick Sellers" v={quick} s="Local builders whose homes sell within about 10 months of the permit" color="var(--true-blue)" />
        <Tile k="Large Builders" v={count('large')} s={`${LARGE_BUILDER_PERMITS}+ permits a year`} color="var(--energy)" />
        <Tile k="National / Production" v={count('national')} color="var(--light-grey)" />
      </div>
      <Section title="Local Builders Moving In" kind="energy" hint="Good local builders’ new permits in the last 6 months, by ZIP: an early sign an area is turning">
        {movingIn.length ? (
          <ul className="rows">{movingIn.slice(0, 25).map((z) => (
            <li key={z.zip}><strong>ZIP {z.zip}</strong> <span className="chip blue">{z.builders.length} {z.builders.length === 1 ? 'builder' : 'builders'} · {z.permits} homes</span>
              <div className="small muted">{z.builders.map((x) => `${x.name} (${x.n}${x.medianDays ? `, sells in ~${Math.round(x.medianDays / 30)} months` : ''})`).join(' · ')}</div></li>
          ))}</ul>
        ) : <Empty>Nothing yet. This fills in once permits are loaded (Update Permits on the Market Map) and the builders have sales on record.</Empty>}
      </Section>
      <Section title="Show" kind="grey">
        <nav className="role-pick" aria-label="Kind of builder"><span className="filter-label">Builders</span>
          {buckets.map((k) => <Link key={k} className="role-btn" aria-pressed={bucket === k} href={`/market/builders?bucket=${k}`}>{bucketLabel[k]} ({count(k)})</Link>)}
          <Link className="role-btn" aria-pressed={!bucket} href="/market/builders?bucket=all">All</Link>
        </nav>
      </Section>
      <Section title={bucket ? `${bucketLabel[bucket]}s` : 'Every Builder'} kind="blue" hint={`${rows.length} shown · most active first`}>
        {rows.length ? (
          <div className="table-wrap"><table className="t builders-table">
            <thead><tr><th>Builder</th><th className="num">New Homes, 12 Months</th><th className="num">The 12 Before</th><th className="num">On Teardown Lots</th><th>Where</th><th className="num">Sold</th><th className="num">Permit to Sale</th><th className="num">Sold at $/sf</th><th className="num">Typical Build Cost</th><th>Latest Permit</th></tr></thead>
            <tbody>{rows.map((x) => (
              <tr key={x.builder}>
                <td><strong>{x.builder}</strong><div className="small muted">{bucketLabel[x.bucket]}</div>{x.quick ? <span className="chip grade-proven">Quick Seller</span> : null}</td>
                <td className="num">{x.permits12}</td>
                <td className="num">{x.permitsBefore}{x.permitsBefore ? <div className={`small ${x.permits12 >= x.permitsBefore ? 'pace-faster' : 'pace-slower'}`}>{x.permits12 >= x.permitsBefore ? '+' : ''}{Math.round(((x.permits12 - x.permitsBefore) / x.permitsBefore) * 100)}%</div> : null}</td>
                <td className="num">{x.teardowns || '—'}</td>
                <td className="small">{x.zips.length ? x.zips.slice(0, 6).join(', ') : '—'}{x.zips.length > 6 ? ` +${x.zips.length - 6}` : ''}</td>
                <td className="num">{x.sold} of {x.homes}</td>
                <td className="num">{x.medianDays === null ? '—' : `${x.medianDays} days`}</td>
                <td className="num">{x.medianPsf ? `$${x.medianPsf}` : '—'}</td>
                <td className="num">{money(x.medianCost)}</td>
                <td>{x.latest ? formatDate(x.latest) : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>No builders yet. Press Update Permits on the Market Map.</Empty>}
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          From Raleigh’s building permits (they name the builder; Durham’s don’t), matched to the county sale of the same address after the permit.
          “Permit to sale” is the typical number of days from the permit to the sale, which is the build plus the time on the market. A quick seller sells half its homes within about 300 days, from at least 3 sales.
          National and production builders are picked by name; any other builder with {LARGE_BUILDER_PERMITS}+ permits a year counts as a large builder.
        </p>
      </Section>
    </>
  );
}
