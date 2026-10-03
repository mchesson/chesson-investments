import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { areaDrivers } from '@/lib/price-drivers-data';
import { buyingPowerPerPoint, driverSentences } from '@/lib/price-drivers';
import { latestRates } from '@/lib/market-feeds-data';
import { affordability } from '@/lib/market-feeds';
import { formatDate, formatMoney } from '@/lib/format';
import { GovRates } from '@/components/MarketFeeds';
import { FactorBars } from '@/components/FactorBars';
import { Empty, PageHead, Section } from '@/components/ui';

export const metadata = { title: 'Buyer Factors' };
export const maxDuration = 120;

const prices = [400_000, 700_000, 1_000_000, 1_500_000, 2_000_000];

/** What decides whether buyers buy, and what they pay for (owner, Oct 3, 2026: "how it is weighted. Definitely not equal"). */
export default async function BuyerFactors({ searchParams }: { searchParams: Promise<{ county?: string }> }) {
  await requirePage('properties.view');
  const sp = await searchParams;
  const county = sp.county === 'wake' || sp.county === 'durham' ? sp.county : null;
  const [d, latest] = await Promise.all([areaDrivers(county), latestRates()]);
  const r30 = latest['30yr'];
  const where = county === 'wake' ? 'Wake County' : county === 'durham' ? 'Durham County' : 'Wake and Durham';
  return (
    <>
      <PageHead title="Buyer Factors" sub="Two decisions, weighted very differently: whether a buyer can buy at all (rates and the payment), then which house and what they’ll pay for it (measured from county sales here)."
        actions={<Link className="btn secondary" href="/market">Market Map</Link>} />
      <Section title="1. Can They Buy? Rates and the Payment" kind="energy" hint="The gate: this decides how fast the market moves">
        <GovRates latest={latest} />
        {r30 ? <>
          <p className="trend-sentence"><strong>At {r30.rate.toFixed(2)}% (week of {formatDate(r30.week)}), each 1-point rise in the 30-year rate cuts what a buyer can borrow on the same payment by about {buyingPowerPerPoint(r30.rate)}%; each 1-point fall adds about {buyingPowerPerPoint(Math.max(r30.rate - 1, 0.5))}%.</strong></p>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Price</th><th className="num">A Month (20% down)</th><th className="num">Income a Lender Wants</th><th className="num">A Month at {(r30.rate - 1).toFixed(2)}%</th></tr></thead>
            <tbody>{prices.map((p) => { const a = affordability(p, r30.rate), lo = affordability(p, r30.rate - 1); return (
              <tr key={p}><td><strong>{formatMoney(p)}</strong></td><td className="num">{formatMoney(a.payment)}</td><td className="num">{formatMoney(a.income)}/yr</td><td className="num">{formatMoney(lo.payment)}</td></tr>
            ); })}</tbody>
          </table></div>
          <p className="small muted">Principal and interest plus about 1.2% of the price a year for taxes and insurance; the income is that payment at 28% of gross income. Cash buyers (more of them above $1.5M) don’t pass through this gate: the Market Map’s Rates and Buyers shows which price bands sell less when rates rise.</p>
        </> : <Empty>No rates loaded yet: they update by themselves with the market data.</Empty>}
      </Section>
      <Section title="2. What They Pay For, Measured Here" kind="aqua" hint={d ? `${d.n.toLocaleString()} sales, ${where}, the last 2 years` : where}>
        <nav className="role-pick" aria-label="County"><span className="filter-label">Where</span>
          {[[null, 'Both'], ['wake', 'Wake'], ['durham', 'Durham']].map(([k, l]) => <Link key={l} className="role-btn" aria-pressed={county === k} href={k ? `/market/buyers?county=${k}` : '/market/buyers'}>{l}</Link>)}
        </nav>
        {d ? <>
          <FactorBars shares={d.shares} />
          <ul className="zip-story">{driverSentences(d).map((x) => <li key={x}>{x}</li>)}</ul>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Age When Sold</th><th className="num">Against an 11–30-Year-Old Home</th></tr></thead>
            <tbody>{d.agePremium.map((a) => <tr key={a.key}><td>{a.label}</td><td className="num">{a.pct > 0 ? '+' : ''}{a.pct}%</td></tr>)}</tbody>
          </table></div>
          <p className="small muted">Measured by comparing every sale with the others (a regression on the price’s logarithm): each factor’s share is how much of the spread in prices it accounts for, with the others held the same. These factors explain {d.r2}% of why prices differ; the rest is what county records don’t show (finish level, condition, layout, the view, the street, the agent). Ordinary sales only: no $10 transfers, multi-parcel deals or lot sales.</p>
        </> : <Empty>Not enough county sales loaded to measure. Update the market data on the Market Map.</Empty>}
      </Section>
      {d ? (
        <Section title="Location: Each ZIP Against the Middle One" kind="blue" hint="Same size, age and lot; most expensive first">
          <div className="table-wrap"><table className="t">
            <thead><tr><th>ZIP</th><th className="num">Sales</th><th className="num">Location Premium</th><th className="num">Median Sale</th><th className="num">100 More Sq Ft Adds</th></tr></thead>
            <tbody>{d.zips.map((z) => <tr key={z.zip}><td><Link href={`/market/zip/${z.zip}`}>{z.zip}</Link></td><td className="num">{z.n.toLocaleString()}</td>
              <td className="num">{z.premium > 0 ? '+' : ''}{z.premium}%</td><td className="num">{formatMoney(z.medianPrice)}</td><td className="num">{formatMoney(z.per100Sf)}</td></tr>)}</tbody>
          </table></div>
          <p className="small muted">ZIPs with fewer than 30 sales are counted together and left off the list.</p>
        </Section>
      ) : null}
      <div className="grid-2">
        <Section title="3. What Buyers Say Matters" kind="energy" hint="National surveys, not measured here">
          <ul className="rows">
            <li><strong>Quality of the neighborhood</strong>: the reason buyers give most often for where they bought.</li>
            <li><strong>Commute and convenience</strong>: to work, then to family and friends, shopping and health care.</li>
            <li><strong>Affordability</strong>: the payment, not the price, is what most buyers shop by.</li>
            <li><strong>Schools</strong>: near the top for buyers with children at home, who are a minority of buyers.</li>
            <li><strong>The house itself</strong>: size, a main-floor primary bedroom, the kitchen, storage and the garage; new construction for fewer repairs.</li>
          </ul>
          <p className="small muted">From the National Association of Realtors’ yearly Profile of Home Buyers and Sellers and similar surveys: what buyers say, ranked; the weights above are what they actually paid.</p>
        </Section>
        <Section title="Not Measured Yet" kind="grey">
          <ul className="rows">
            <li><strong>Bedrooms, bathrooms, layout, finish level, condition</strong>: not in county records. Appraisals and comps we read (Comps on each project) add them; a listings feed later.</li>
            <li><strong>Schools</strong>: North Carolina publishes school ratings and attendance zones for free; next to add.</li>
            <li><strong>Days on market for each house</strong>: Redfin gives it by ZIP (on each ZIP’s page); by house needs a listings feed.</li>
          </ul>
        </Section>
      </div>
    </>
  );
}
