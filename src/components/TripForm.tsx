'use client';

import { useState } from 'react';
import { ActionForm } from './ActionForm';
import { SearchPicker, type PickOption } from './SearchPicker';
import { saveTrip, placesNear } from '@/app/(app)/trip-actions';
import { tripKinds } from '@/lib/trip-rules';
import { today } from '@/lib/format';

type Opt = { id: string; label: string };

/**
 * Log a trip (owner, Oct 3, 2026: "track when I go to a property and why").
 * "I'm Here" asks the phone where it is, picks the nearest of our places and
 * fills in the miles from the start point (an estimate, marked so).
 */
export function TripForm({ places, vehicles, businesses, defaultWhere, defaultVehicle, defaultBusiness }: {
  places: PickOption[]; vehicles: Opt[]; businesses: Opt[]; defaultWhere?: string | null; defaultVehicle?: string | null; defaultBusiness?: string | null;
}) {
  const [where, setWhere] = useState<string | null>(defaultWhere ?? null);
  const [miles, setMiles] = useState('');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(0); // re-draws the place box with what "I'm Here" found

  function imHere() {
    if (!('geolocation' in navigator)) { setMsg('This browser can’t share its location: pick the place below.'); return; }
    setBusy(true); setMsg('Finding where you are…');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setHere(p);
      try {
        const r = await placesNear(p.lat, p.lng);
        if (r.near[0]) { setWhere(r.near[0].key); setN((x) => x + 1); }
        if (r.estimate) setMiles(String(r.estimate));
        setMsg(r.near[0]
          ? `You’re at ${r.near[0].name}${r.near.length > 1 ? ` (also near: ${r.near.slice(1).map((x) => x.name).join(', ')})` : ''}.${r.estimate ? ` About ${r.estimate} miles there and back from your start point: check it against the odometer.` : ''}`
          : `None of our properties is within half a mile. Type where you are below.${r.estimate ? ` About ${r.estimate} miles there and back from your start point.` : ''}`);
      } catch { setMsg('Couldn’t look up the places: pick one below.'); }
      setBusy(false);
    }, (e) => { setBusy(false); setMsg(e.code === e.PERMISSION_DENIED ? 'Location is off for this site: allow it in the browser, or pick the place below.' : 'Couldn’t find your location: pick the place below.'); }, { enableHighAccuracy: true, timeout: 15_000 });
  }

  return (
    <div className="trip-form">
      <p style={{ margin: 0 }}><button type="button" className="btn" onClick={imHere} disabled={busy}>{busy ? 'Finding You…' : 'I’m Here'}</button> <span className="small muted">On your phone at a property: one tap fills in where you are.</span></p>
      {msg ? <p className="notice" role="status">{msg}</p> : null}
      <ActionForm action={saveTrip} submit="Log the Trip" resetOnOk>
        {here ? <><input type="hidden" name="lat" value={here.lat} /><input type="hidden" name="lng" value={here.lng} /></> : null}
        <div key={n}><SearchPicker name="where" label="Where" placeholder="Type the property (or leave blank and type the place)" options={places} defaultId={where} /></div>
        <div className="fields">
          <label className="f">Or Another Place<input name="place" placeholder="Home Depot, the bank, the attorney" /></label>
          <label className="f">Date<input type="date" name="on" defaultValue={today()} max={today()} required /></label>
          <label className="f">What Kind<select name="kind" defaultValue="site_visit">{tripKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>
        </div>
        <label className="f">Why (the business reason)<input name="purpose" required minLength={3} placeholder="Checked framing with the GC; met the appraiser" /></label>
        <div className="fields">
          <label className="f">Miles<input name="miles" inputMode="decimal" value={miles} onChange={(e) => setMiles(e.target.value)} placeholder="Leave blank to use the odometer" /></label>
          <label className="f">Odometer at Start<span className="h">Optional</span><input name="startOdometer" inputMode="numeric" /></label>
          <label className="f">Odometer at End<span className="h">Optional</span><input name="endOdometer" inputMode="numeric" /></label>
          <label className="f">There and Back<select name="roundTrip" defaultValue="yes"><option value="yes">Yes, round trip</option><option value="no">One way</option></select></label>
        </div>
        <div className="fields">
          {vehicles.length ? <label className="f">Vehicle<select name="vehicleId" defaultValue={defaultVehicle ?? vehicles[0].id}><option value="">Not named</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label> : null}
          {businesses.length ? <label className="f">For Which Business<select name="entityId" defaultValue={defaultBusiness ?? ''}><option value="">Not named</option>{businesses.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label> : null}
          <label className="f">Notes<input name="notes" /></label>
        </div>
      </ActionForm>
    </div>
  );
}
