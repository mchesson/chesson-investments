import Link from 'next/link';
import { StageChips } from '@/components/StageChips';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { listProjects, projectMoney } from '@/lib/projects';
import { formatCents } from '@/lib/format';
import { formatMoney } from '@/lib/format';
import { PageHead, Section, Empty } from '@/components/ui';
import { SalePriceTag, saleBasis } from '@/components/SalePriceTag';
import { saleCosts } from '@/lib/budget';
import { ActionButton } from '@/components/ActionButton';
import { findLocationsAndZoning } from '../locate-actions';
import { sameAsAddress } from '@/lib/locate-rules';

export const metadata = { title: 'Projects' };

export default async function Projects() {
  const user = await requirePage('projects.view');
  const rows = await listProjects();
  const seeMoney = can(user, 'money.view');
  // Track record: few projects, so each is worked out in full (same math as its page).
  const money = seeMoney ? await Promise.all(rows.map((p) => projectMoney(p.id))) : [];
  return (
    <>
      <PageHead title="Projects" actions={can(user, 'projects.edit') ? <>{can(user, 'properties.edit') ? <ActionButton action={findLocationsAndZoning} className="btn secondary" label="Find Locations and Zoning" done="Done." /> : null}<Link className="btn" href="/projects/new">Add Project</Link></> : null} />
      <Section title="Projects" kind="aqua" hint={`${rows.length}`}>
        {rows.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>No.</th><th>Address</th><th>City</th><th>State</th><th>ZIP</th><th>Neighborhood</th><th>Stage</th><th className="num">Heated SF</th>{seeMoney ? <><th className="num">Lot Cost</th><th className="num">Sale Price</th></> : null}</tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td className="small">{p.projectNumber ? `P-${p.projectNumber}` : ''}</td>
                <td><Link href={`/projects/${p.id}`}>{p.address || p.name}</Link>{p.address && !sameAsAddress(p.name, p.address) ? <div className="small muted">{p.name}</div> : null}</td>
                <td>{p.city ?? '—'}</td>
                <td>{p.state ?? '—'}</td>
                <td>{p.zip ?? '—'}</td>
                <td>{p.neighborhood ?? '—'}</td>
                <td><StageChips p={p} /></td>
                <td className="num">{p.heatedSf?.toLocaleString() ?? '—'}</td>
                {seeMoney ? <><td className="num">{formatMoney(p.lotCost)}</td><td className="num">{saleBasis(p) ? <>{formatMoney(saleBasis(p)!.value)} <SalePriceTag p={p} /></> : '—'}</td></> : null}
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>No projects yet.</Empty>}
      </Section>
      {seeMoney && rows.length ? (
        <Section title="Track Record" kind="blue" hint="Cost per heated sf by house and place, and whether it made money: actual sale, else today's market value, else the pro forma">
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Project</th><th>Where</th><th className="num">Heated SF</th><th className="num">All-In</th><th className="num">All-In / SF</th><th className="num">Worth / Sold</th><th className="num">Profit</th></tr></thead>
            <tbody>{money.map((d, i) => {
              if (!d) return null;
              const p = d.project;
              const value = p.actualSalePrice ?? p.marketValue ?? p.proformaSalePrice;
              const basis = p.actualSalePrice ? 'actual sale' : p.marketValue ? 'market value' : 'projected';
              const v = value ? Math.round(Number(value) * 100) : null;
              const costs = v !== null ? saleCosts({ sale: v, pct: Number(p.sellingCostPct ?? 0), closing: Math.round(Number(p.closingCostAtSale ?? 0) * 100), actual: p.actualSalePrice && p.actualSaleCosts ? Math.round(Number(p.actualSaleCosts) * 100) : null }).total : 0;
              const profit = v !== null ? v - costs - (d.allIn - Math.round(Number(p.keptAssetsValue ?? 0) * 100)) : null;
              return (
                <tr key={rows[i].id} className={profit !== null && profit < 0 ? 'over' : undefined}>
                  <td><Link href={`/projects/${p.id}`}>{p.name}</Link></td>
                  <td>{[p.neighborhood, p.zip].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="num">{p.heatedSf?.toLocaleString() ?? '—'}</td>
                  <td className="num">{formatCents(d.allIn)}</td>
                  <td className="num">{p.heatedSf ? formatCents(Math.round(d.allIn / p.heatedSf), { cents: true }) : '—'}</td>
                  <td className="num">{v !== null ? <>{formatCents(v)} <span className="small muted">({basis})</span></> : '—'}</td>
                  <td className="num">{profit === null ? '—' : profit < 0 ? <span className="red">−{formatCents(-profit)}</span> : formatCents(profit)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </Section>
      ) : null}
    </>
  );
}
