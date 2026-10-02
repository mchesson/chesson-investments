// The Market Map's filter buttons and tables, shared by the staff page and an
// agent's view (/guest/market).
import Link from 'next/link';
import type { areaTable, MarketFilters } from '@/lib/market-data';
import { priceBands, soldWithin } from '@/lib/market-stats';
import { landUses } from '@/lib/market-sources';
import { Empty } from '@/components/ui';

const money = (n: number | null) => (n === null ? '—' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000).toLocaleString()}k`);

export function query(f: MarketFilters, over: Partial<Record<'county' | 'use' | 'band' | 'months', string | null>> = {}) {
  const cur: Record<string, string | null> = { county: f.counties.join(',') || null, use: f.uses.join(',') || null, band: f.bands.join(',') || null, months: f.months === 12 ? null : String(f.months) };
  const q = new URLSearchParams(Object.entries({ ...cur, ...over }).filter(([, v]) => v) as [string, string][]);
  return q.toString();
}
const toggle = (list: string[], k: string) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]).join(',') || null;

export function Filters({ f, base = '/market' }: { f: MarketFilters; base?: string }) {
  const href = (over: Parameters<typeof query>[1]) => { const q = query(f, over); return q ? `${base}?${q}` : base; };
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

export function AreaRows({ rows, kind }: { rows: Awaited<ReturnType<typeof areaTable>>; kind: string }) {
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

