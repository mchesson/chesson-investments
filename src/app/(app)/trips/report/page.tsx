import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { formatDate, formatMoney, today } from '@/lib/format';
import { destinationOf, yearReport } from '@/lib/trip-data';
import { Empty, PageHead, Section, Tile } from '@/components/ui';

export const metadata = { title: 'Trip Log: Year-End' };

/** The year-end mileage log and the two methods side by side (owner, Oct 3, 2026: "track both ways so we can compare"). */
export default async function TripReport({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requirePage('money.view');
  const sp = await searchParams;
  const thisYear = Number(today().slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? '') ? Number(sp.year) : thisYear;
  const r = await yearReport(year);
  return (
    <>
      <PageHead eyebrow="Trip Log" title={`Year-End Mileage, ${year}`} sub="The log the IRS asks for (date, where, business purpose, miles, vehicle) and the car write-off figured both ways. Confirm the method with your accountant: once you use actual costs for a car, you generally can't switch it back to the standard rate."
        actions={<><a className="btn" href={`/trips/report/csv?year=${year}`}>Download the Log (CSV)</a><Link className="btn secondary" href={`/trips?year=${year}`}>Trip Log</Link></>} />
      <nav className="role-pick" aria-label="Year"><span className="filter-label">Year</span>
        {[thisYear - 2, thisYear - 1, thisYear].map((y) => <Link key={y} className="role-btn" aria-pressed={y === year} href={`/trips/report?year=${y}`}>{y}</Link>)}
      </nav>
      <div className="tiles">
        <Tile k="Business Miles" v={r.totalMiles.toLocaleString()} s={`${r.trips.length} trips`} />
        <Tile k="Standard Rate" v={r.rate ? `$${r.rate.toFixed(3)}` : '—'} s={r.rate ? 'a mile' : `Add the ${year} rate on the Trip Log`} />
        <Tile k="At the Standard Rate" v={r.rate ? formatMoney(r.totalMiles * r.rate) : '—'} s="All vehicles" />
      </div>
      <Section title="Both Ways, by Vehicle" kind="energy" hint="Standard rate × business miles, against actual car costs × the business share">
        {r.perVehicle.length ? <div className="table-wrap"><table className="t">
          <thead><tr><th>Vehicle</th><th className="num">Business Miles</th><th className="num">Total Miles (Odometer)</th><th className="num">Business Share</th><th className="num">Standard Rate</th><th className="num">Actual Costs</th><th className="num">Actual × Share</th><th>Larger</th></tr></thead>
          <tbody>{r.perVehicle.map((v) => (
            <tr key={v.vehicle.id}>
              <td><strong>{v.vehicle.name}</strong>{v.vehicle.entityName ? <div className="small muted">{v.vehicle.entityName}</div> : null}</td>
              <td className="num">{v.business.toLocaleString()}</td>
              <td className="num">{v.total !== null ? v.total.toLocaleString() : <span className="small muted">Add the odometer</span>}</td>
              <td className="num">{v.sharePct !== null ? `${v.sharePct}%` : '—'}{v.overTotal ? <div className="small error">More business miles than the odometer shows: check both</div> : null}</td>
              <td className="num">{v.standard !== null ? formatMoney(v.standard, { cents: true }) : '—'}</td>
              <td className="num">{formatMoney(v.carCosts, { cents: true })}</td>
              <td className="num">{v.actual !== null ? formatMoney(v.actual, { cents: true }) : '—'}</td>
              <td>{v.better === 'standard' ? 'Standard rate' : v.better === 'actual' ? 'Actual costs' : '—'}</td>
            </tr>
          ))}</tbody>
        </table></div> : <Empty>No vehicles yet: add one on the Trip Log.</Empty>}
        {r.unassignedMiles ? <p className="small muted">{r.unassignedMiles.toLocaleString()} miles were logged without a vehicle named.</p> : null}
        <p className="small muted">Actual costs are Overhead expenses tagged to the vehicle (gas, insurance, repairs, registration, loan interest or lease; depreciation is for the accountant). The business share is business miles ÷ the odometer’s miles for the year.</p>
      </Section>
      <div className="grid-2">
        <Section title="By Business" kind="blue">{r.byBusiness.length ? <table className="t"><tbody>{r.byBusiness.map((b) => <tr key={b.label}><td>{b.label}</td><td className="num">{b.trips} trips</td><td className="num">{b.miles.toLocaleString()} mi</td></tr>)}</tbody></table> : <Empty>No trips.</Empty>}</Section>
        <Section title="By Property" kind="aqua">{r.byProperty.length ? <table className="t"><tbody>{r.byProperty.map((b) => <tr key={b.label}><td>{b.label}</td><td className="num">{b.trips} trips</td><td className="num">{b.miles.toLocaleString()} mi</td></tr>)}</tbody></table> : <Empty>No trips.</Empty>}</Section>
      </div>
      <Section title="The Log" kind="grey" hint={`${r.trips.length} trips`}>
        {r.trips.length ? <div className="table-wrap"><table className="t">
          <thead><tr><th>Date</th><th>Vehicle</th><th>Where</th><th>Business Purpose</th><th className="num">Miles</th></tr></thead>
          <tbody>{[...r.trips].reverse().map((t) => <tr key={t.id}><td>{formatDate(t.on)}</td><td>{t.vehicleName ?? '—'}</td><td>{destinationOf(t)}</td><td>{t.purpose}</td><td className="num">{Number(t.miles).toLocaleString()}</td></tr>)}</tbody>
        </table></div> : <Empty>No trips logged for {year}.</Empty>}
      </Section>
    </>
  );
}
