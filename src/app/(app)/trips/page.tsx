import Link from 'next/link';
import { asc, isNotNull, isNull, and } from 'drizzle-orm';
import { db } from '@/db';
import { entities, projects, properties, vehicleOdometers } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney, today } from '@/lib/format';
import { isUuid } from '@/lib/forms';
import { destinationOf, readMileageSettings, tripsIn, vehicleList } from '@/lib/trip-data';
import { rateFor, tripKindLabel } from '@/lib/trip-rules';
import { ActionForm } from '@/components/ActionForm';
import { ActionButton } from '@/components/ActionButton';
import { TripForm } from '@/components/TripForm';
import { Empty, PageHead, Section, Tile } from '@/components/ui';
import { removeTrip, saveMileageSettings, saveOdometer, saveVehicle } from '../trip-actions';

export const metadata = { title: 'Trip Log' };

/** The Trip Log (owner, Oct 3, 2026): every trip for the business, where and why, with the miles. */
export default async function TripsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('bills.edit');
  const sp = await searchParams;
  const thisYear = Number(today().slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? '') ? Number(sp.year) : thisYear;
  const [vs, ts, s, ps, ws, ents] = await Promise.all([
    vehicleList(), tripsIn(year), readMileageSettings(),
    db.select({ id: projects.id, name: projects.name, address: projects.address }).from(projects).where(isNull(projects.archived)).orderBy(asc(projects.name)),
    db.select({ id: properties.id, address: properties.address, city: properties.city }).from(properties).where(isNull(properties.archived)).orderBy(asc(properties.address)),
    db.select({ id: entities.id, name: entities.name }).from(entities).where(isNull(entities.archived)).orderBy(asc(entities.name)),
  ]);
  const odos = vs.length ? await db.select().from(vehicleOdometers).where(and(isNotNull(vehicleOdometers.vehicleId))) : [];
  const places = [
    ...ps.map((p) => ({ id: `project:${p.id}`, label: p.name, sub: p.address !== p.name ? p.address : 'Project' })),
    ...ws.map((p) => ({ id: `property:${p.id}`, label: p.address, sub: `Watchlist${p.city ? ` · ${p.city}` : ''}` })),
  ];
  const project = sp.project && isUuid(sp.project) ? `project:${sp.project}` : null;
  const miles = Math.round(ts.reduce((a, t) => a + Number(t.miles), 0) * 10) / 10;
  const rate = rateFor(year, s.rates);
  const money = can(user, 'money.view');
  return (
    <>
      <PageHead title="Trip Log" sub="Every business trip: where, why and the miles, for the car write-off. Keep it as you go; the IRS wants it written at the time."
        actions={money ? <Link className="btn secondary" href={`/trips/report?year=${year}`}>Year-End Report</Link> : null} />
      <Section title="Log a Trip" kind="energy">
        <TripForm places={places} vehicles={vs.map((v) => ({ id: v.id, label: v.name }))} businesses={ents.map((e) => ({ id: e.id, label: e.name }))}
          defaultWhere={project} defaultBusiness={vs[0]?.entityId ?? (ents.length === 1 ? ents[0].id : null)} />
      </Section>
      <nav className="role-pick" aria-label="Year"><span className="filter-label">Year</span>
        {[thisYear - 2, thisYear - 1, thisYear].map((y) => <Link key={y} className="role-btn" aria-pressed={y === year} href={`/trips?year=${y}`}>{y}</Link>)}
      </nav>
      <div className="tiles">
        <Tile k={`Business Miles ${year}`} v={miles.toLocaleString()} s={`${ts.length} ${ts.length === 1 ? 'trip' : 'trips'}`} />
        <Tile k="At the Standard Rate" v={rate ? formatMoney(miles * rate) : '—'} s={rate ? `$${rate.toFixed(3)} a mile` : `Add the ${year} rate under Settings`} />
      </div>
      <Section title="Trips" kind="blue" hint={`${ts.length}`}>
        {ts.length ? <div className="table-wrap"><table className="t">
          <thead><tr><th>Date</th><th>Where</th><th>Why</th><th className="num">Miles</th><th>Vehicle</th><th></th></tr></thead>
          <tbody>{ts.map((t) => (
            <tr key={t.id}>
              <td>{formatDate(t.on)}</td>
              <td>{t.projectId ? <Link href={`/projects/${t.projectId}?tab=timeline`}>{destinationOf(t)}</Link> : t.propertyId ? <Link href={`/watchlist/${t.propertyId}`}>{destinationOf(t)}</Link> : destinationOf(t)}<div className="small muted">{tripKindLabel(t.kind)}</div></td>
              <td>{t.purpose}{t.notes ? <div className="small muted">{t.notes}</div> : null}</td>
              <td className="num">{Number(t.miles).toLocaleString()}<div className="small muted">{t.milesHow === 'odometer' ? `odometer ${t.startOdometer?.toLocaleString()}–${t.endOdometer?.toLocaleString()}` : t.milesHow === 'estimate' ? 'estimated' : 'typed'}{t.roundTrip ? '' : ', one way'}</div></td>
              <td className="small">{t.vehicleName ?? '—'}{t.entityName ? <div className="muted">{t.entityName}</div> : null}</td>
              <td><ActionButton action={removeTrip.bind(null, t.id)} className="link-btn small" label="Take Off" done="Taken off." confirm="Take this trip off the log?" /></td>
            </tr>
          ))}</tbody>
        </table></div> : <Empty>No trips logged for {year} yet.</Empty>}
      </Section>
      <div className="grid-2">
        <Section title="Vehicles" kind="aqua" hint="The odometer each January 1 and December 31 gives the business share">
          {vs.length ? <ul className="rows">{vs.map((v) => {
            const o = odos.find((x) => x.vehicleId === v.id && x.year === year);
            return (
              <li key={v.id}><strong>{v.name}</strong>{v.entityName ? <span className="small muted"> · {v.entityName}</span> : null}{v.placedInService ? <span className="small muted"> · in service since {formatDate(v.placedInService)}</span> : null}
                <ActionForm action={saveOdometer} submit={`Save ${year} Odometer`}>
                  <input type="hidden" name="vehicleId" value={v.id} /><input type="hidden" name="year" value={year} />
                  <div className="fields">
                    <label className="f">January 1, {year}<input name="startMiles" inputMode="numeric" defaultValue={o?.startMiles ?? ''} /></label>
                    <label className="f">December 31, {year}<input name="endMiles" inputMode="numeric" defaultValue={o?.endMiles ?? ''} /></label>
                  </div>
                </ActionForm>
              </li>
            );
          })}</ul> : <Empty>No vehicles yet: add the one you drive for the business.</Empty>}
          <details className="fold"><summary>Add a Vehicle</summary>
            <ActionForm action={saveVehicle} submit="Add the Vehicle" resetOnOk>
              <div className="fields">
                <label className="f">Name<input name="name" required placeholder="2022 Tahoe" /></label>
                {ents.length ? <label className="f">Business<select name="entityId" defaultValue=""><option value="">Not named</option>{ents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label> : null}
                <label className="f">In Service Since<input type="date" name="placedInService" /></label>
              </div>
            </ActionForm>
          </details>
        </Section>
        {money ? <Section title="Settings" kind="grey">
          <ActionForm action={saveMileageSettings} submit="Save">
            <p className="small muted" style={{ marginTop: 0 }}>The IRS standard mileage rate is announced each December for the next year. On file: {Object.entries({ ...{ 2023: 0.655, 2024: 0.67, 2025: 0.7 }, ...s.rates }).map(([y, r]) => `${y} $${r}`).join(', ')}.</p>
            <div className="fields">
              <label className="f">Year<input name="rateYear" inputMode="numeric" defaultValue={rate ? '' : String(year)} placeholder={String(thisYear)} /></label>
              <label className="f">Dollars a Mile<input name="rate" inputMode="decimal" placeholder="0.70" /></label>
            </div>
            <p className="small muted">Where trips usually start (home or the office), for estimated miles: the coordinates from your map app.</p>
            <div className="fields">
              <label className="f">Start Point<input name="homeLabel" defaultValue={s.home?.label ?? ''} placeholder="Home" /></label>
              <label className="f">Latitude<input name="homeLat" inputMode="decimal" defaultValue={s.home?.lat ?? ''} /></label>
              <label className="f">Longitude<input name="homeLng" inputMode="decimal" defaultValue={s.home?.lng ?? ''} /></label>
            </div>
          </ActionForm>
        </Section> : null}
      </div>
    </>
  );
}
