'use client';
// The interactive market map (owner, Oct 2, 2026: "an interactive heat map ...
// zoom in and out and we have buttons at the top to add in or subtract what is
// showing"; then "make sure the maps are very clear and especially when
// zooming in so we know exactly where to go and look"). Leaflet with
// OpenStreetMap streets or Wake County's 2025 aerial photos, the county parcel
// lines up close, every sale labelled with its price at street level, a click
// on a parcel for who owns it, and Go to an Address. Sales come from
// /api/market/points for the part of the map in view.
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { psfColor } from '@/lib/market-stats';

type Place = { id: string; name: string; stage: string; lat: number; lng: number };
type Area = { name: string; city: string | null; sales: number; median_price: number; median_psf: number | null; prior_psf: number | null; lat: number; lng: number };
type Zone = { name: string; city: string | null; lat: number; lng: number; verdict: string; label: string; maxLot: number | null; entry: number | null; value: number | null };
type Pt = { id: string; lat: number; lng: number; price: number; psf: number | null; on: string; a: string | null; h: string | null; u: string; sf: number | null };
type Found = { label: string; kind: string; lat: number; lng: number };

export const layerDefs = [
  { key: 'heat', label: 'Sales Heat ($/sf)' },
  { key: 'dots', label: 'Each Sale' },
  { key: 'parcels', label: 'Parcel Lines' },
  { key: 'areas', label: 'Neighborhoods' },
  { key: 'zones', label: 'Buy Zones' },
  { key: 'projects', label: 'Our Projects' },
  { key: 'watch', label: 'Watchlist' },
] as const;
export type LayerKey = (typeof layerDefs)[number]['key'];
const STORE = 'ci-market-layers';
/** Street level: every sale shows as a labelled dot and parcels show their lines. */
export const STREET_ZOOM = 16;

const WAKE_IMAGERY = 'https://maps.wakegov.com/arcgis/rest/services/Imagery/Imagery_2025/MapServer';
const WAKE_PARCELS = 'https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer';
const DURHAM_PARCELS = 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Parcels_NEW/FeatureServer/0';

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const useLabel: Record<string, string> = { single_family: 'Single family', townhouse: 'Townhouse', condo: 'Condo', multi_family: '2–4 units', land: 'Land / lot', other: 'Other' };

export function MarketMap({ query, projects, watch, areas, only, zones = [], parcelInfo = false }: {
  query: string; projects: Place[]; watch: Place[]; areas: Area[]; only?: LayerKey[]; zones?: Zone[];
  /** Staff only: a click on a parcel up close shows its owner and last sale. */
  parcelInfo?: boolean;
}) {
  const shown = layerDefs.filter((d) => (!only || only.includes(d.key) || d.key === 'parcels') && (d.key !== 'zones' || zones.length));
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const groups = useRef<Partial<Record<LayerKey, Leaflet.Layer>>>({});
  const base = useRef<{ streets?: Leaflet.Layer; aerial?: Leaflet.Layer }>({});
  const points = useRef<Pt[]>([]);
  const found = useRef<Leaflet.Layer | null>(null);
  const [on, setOn] = useState<Record<LayerKey, boolean>>({ heat: true, dots: false, parcels: true, areas: true, zones: true, projects: true, watch: true });
  const [aerial, setAerial] = useState(false);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(10);
  const [status, setStatus] = useState('Loading the map…');
  const [range, setRange] = useState<[number, number] | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  const onRef = useRef(on);
  onRef.current = on;
  const queryRef = useRef(query);
  queryRef.current = query;
  const rangeRef = useRef<[number, number]>([0, 0]);

  // Remember the layers and the base map per viewer (a convenience only).
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORE);
      if (s) { const v = JSON.parse(s); setOn((o) => ({ ...o, ...(v.layers ?? v) })); if (typeof v.aerial === 'boolean') setAerial(v.aerial); }
    } catch { /* private window */ }
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      const lib = (await import('leaflet')).default;
      (window as unknown as { L: typeof Leaflet }).L = lib;
      await import('leaflet.heat');
      const esri = await import('esri-leaflet');
      if (dead || !box.current || map.current) return;
      L.current = lib;
      const m = lib.map(box.current, { center: [35.86, -78.75], zoom: 10, zoomControl: true, preferCanvas: true, maxZoom: 20 });
      base.current.streets = lib.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap contributors; sales and parcels: Wake and Durham County public records' }).addTo(m);
      base.current.aerial = esri.dynamicMapLayer({ url: WAKE_IMAGERY, format: 'jpg', attribution: 'Aerial photos: Wake County 2025' });
      lib.control.scale({ imperial: true, metric: false }).addTo(m);
      map.current = m;

      // Parcel lines up close: Wake's drawn by the county, Durham's from its parcel outlines.
      groups.current.parcels = lib.layerGroup([
        esri.dynamicMapLayer({ url: WAKE_PARCELS, format: 'png32', transparent: true, minZoom: 15, opacity: 0.9 }),
        esri.featureLayer({ url: DURHAM_PARCELS, minZoom: 16, simplifyFactor: 0.4, fields: ['OBJECTID'], style: () => ({ color: '#212121', weight: 1, fillOpacity: 0 }) }),
      ]);
      const pin = (cls: string, label: string) => lib.divIcon({ className: `map-pin ${cls}`, html: `<span>${label}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
      groups.current.projects = lib.layerGroup(projects.map((p) => lib.marker([p.lat, p.lng], { icon: pin('pin-project', 'P'), zIndexOffset: 1000 })
        .bindTooltip(esc(p.name), { direction: 'top', offset: [0, -12] })
        .bindPopup(`<strong><a href="/projects/${p.id}">${esc(p.name)}</a></strong><br>Our project`)));
      groups.current.watch = lib.layerGroup(watch.map((p) => lib.marker([p.lat, p.lng], { icon: pin('pin-watch', 'W'), zIndexOffset: 900 })
        .bindTooltip(esc(p.name), { direction: 'top', offset: [0, -12] })
        .bindPopup(`<strong><a href="/watchlist/${p.id}">${esc(p.name)}</a></strong><br>On the watchlist`)));
      groups.current.areas = lib.layerGroup(areas.filter((a) => a.lat && a.lng).map((a) => lib.circleMarker([a.lat, a.lng], {
        radius: Math.max(6, Math.min(22, Math.sqrt(a.sales) * 2.2)), color: '#0D71BA', weight: 2, fillColor: '#0D71BA', fillOpacity: 0.12,
      }).bindTooltip(`${esc(a.name)}: ${a.sales} sales${a.median_psf ? `, $${a.median_psf}/sf` : ''}`)
        .bindPopup(`<strong>${esc(a.name)}</strong>${a.city ? `, ${esc(a.city)}` : ''}<br>${a.sales} sales · median ${money(a.median_price)}${a.median_psf ? ` · $${a.median_psf}/sf` : ''}${a.prior_psf && a.median_psf ? `<br>$/sf ${a.median_psf >= a.prior_psf ? 'up' : 'down'} ${Math.abs(Math.round(((a.median_psf - a.prior_psf) / a.prior_psf) * 100))}% on the period before` : ''}`)));
      const zoneColor: Record<string, string> = { buy: '#00756f', watch: '#5b6b14', pass: '#b3261e', thin: '#898989' };
      groups.current.zones = lib.layerGroup(zones.filter((z) => z.lat && z.lng).map((z) => lib.circleMarker([z.lat, z.lng], {
        radius: z.verdict === 'buy' ? 12 : 9, color: zoneColor[z.verdict] ?? '#898989', weight: 3, fillColor: zoneColor[z.verdict] ?? '#898989', fillOpacity: z.verdict === 'buy' ? 0.45 : 0.2,
      }).bindTooltip(`${esc(z.name)}: ${esc(z.label)}`, { className: 'zone-label' })
        .bindPopup(`<strong>${esc(z.name)}</strong>${z.city ? `, ${esc(z.city)}` : ''}<br><b>${esc(z.label)}</b>${z.value ? `<br>A new house would sell for about ${money(z.value)}` : ''}${z.maxLot ? `<br>We can pay up to ${money(z.maxLot)} for the lot` : ''}${z.entry ? `<br>Lots and teardowns sell around ${money(z.entry)}` : ''}`)));

      // Up close, a click on a parcel says what it is and who owns it (staff only).
      if (parcelInfo) m.on('click', async (e: Leaflet.LeafletMouseEvent) => {
        if (m.getZoom() < 15) return;
        const pop = lib.popup().setLatLng(e.latlng).setContent('Looking up the parcel…').openOn(m);
        try {
          const r = await fetch(`/api/market/parcel?lat=${e.latlng.lat.toFixed(6)}&lng=${e.latlng.lng.toFixed(6)}`);
          const { parcel: p } = await r.json();
          if (!p) { pop.setContent('No parcel here on the county records.'); return; }
          pop.setContent(`<div class="parcel-pop"><strong>${esc(p.address)}</strong>${p.city ? `, ${esc(p.city)}` : ''}<br>${esc(p.county)}${p.neighborhood ? ` · ${esc(p.neighborhood)}` : ''}<br>`
            + `${useLabel[p.landUse] ?? ''}${p.heatedSf ? ` · ${Number(p.heatedSf).toLocaleString()} sf` : ''}${p.yearBuilt ? ` · built ${p.yearBuilt}` : ''}${p.acres ? ` · ${p.acres} ac` : ''}<br>`
            + `Owner: ${esc(p.owner) || '—'}${p.absentee ? ' <b>(lives elsewhere)</b>' : ''}<br>`
            + `${p.assessedValue ? `Assessed ${money(p.assessedValue)}` : ''}${p.lastSalePrice ? ` · last sold ${money(p.lastSalePrice)}${p.lastSaleOn ? ` on ${p.lastSaleOn}` : ''}` : ''}<br>`
            + `<a href="/watchlist/new?address=${encodeURIComponent(p.address ?? '')}&city=${encodeURIComponent(p.city ?? '')}">Add to the Watchlist</a></div>`);
        } catch { pop.setContent('Couldn’t reach the county records just now.'); }
      });
      m.on('moveend', () => load());
      m.on('zoomend', () => { setZoom(m.getZoom()); drawDots(); });
      apply();
      load();
    })().catch((e) => setStatus(`The map couldn’t load: ${e instanceof Error ? e.message : e}`));
    return () => { dead = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload sales when the filters change.
  useEffect(() => { if (map.current) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);
  useEffect(() => {
    apply();
    try { localStorage.setItem(STORE, JSON.stringify({ layers: on, aerial })); } catch { /* private window */ }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [on, aerial]);
  // Full screen: the map fills the window (Esc to leave).
  useEffect(() => {
    setTimeout(() => map.current?.invalidateSize(), 50);
    if (!full) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [full]);

  function apply() {
    const m = map.current;
    if (!m) return;
    const b = base.current;
    if (b.aerial && b.streets) { if (aerialRef.current && !m.hasLayer(b.aerial)) b.aerial.addTo(m); if (!aerialRef.current && m.hasLayer(b.aerial)) m.removeLayer(b.aerial); }
    for (const d of layerDefs) {
      const g = groups.current[d.key];
      if (!g) continue;
      // Up close every sale shows, labelled, even with Each Sale off (that's where to look).
      const want = d.key === 'dots' ? onRef.current.dots || m.getZoom() >= STREET_ZOOM : onRef.current[d.key];
      if (want && !m.hasLayer(g)) g.addTo(m);
      if (!want && m.hasLayer(g)) m.removeLayer(g);
    }
  }
  const aerialRef = useRef(aerial);
  aerialRef.current = aerial;

  function drawDots() {
    const m = map.current, lib = L.current;
    if (!m || !lib) return;
    const [lo, hi] = rangeRef.current;
    const close = m.getZoom() >= STREET_ZOOM;
    const old = groups.current.dots;
    if (old && m.hasLayer(old)) m.removeLayer(old);
    groups.current.dots = lib.layerGroup(points.current.map((p) => {
      const mk = lib.circleMarker([p.lat, p.lng], { radius: close ? 8 : 5, weight: close ? 2 : 1, color: '#fff', fillColor: psfColor(p.psf, lo, hi), fillOpacity: 0.95 })
        .bindPopup(`<strong>${esc(p.a)}</strong>${p.h ? `<br>${esc(p.h)}` : ''}<br>${useLabel[p.u] ?? ''} · sold ${p.on} for <b>${money(p.price)}</b>${p.sf ? ` · ${p.sf.toLocaleString()} sf` : ''}${p.psf ? ` · <b>$${p.psf}/sf</b>` : ''}`);
      if (close) mk.bindTooltip(`${money(p.price)}${p.psf ? ` · $${p.psf}/sf` : ''}`, { permanent: true, direction: 'right', offset: [8, 0], className: 'sale-label' });
      return mk;
    }));
    apply();
  }

  async function load() {
    const m = map.current, lib = L.current;
    if (!m || !lib) return;
    const b = m.getBounds();
    setStatus('Loading sales…');
    try {
      const r = await fetch(`/api/market/points?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((x) => x.toFixed(5)).join(',')}&${queryRef.current}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const { points: pts, more } = (await r.json()) as { points: Pt[]; more: boolean };
      points.current = pts;
      const ps = pts.map((p) => p.psf).filter((x): x is number => !!x).sort((a, c) => a - c);
      const lo = ps[Math.floor(ps.length * 0.1)] ?? 0, hi = ps[Math.floor(ps.length * 0.9)] ?? 0;
      rangeRef.current = [lo, hi];
      setRange(ps.length ? [lo, hi] : null);
      const oldHeat = groups.current.heat;
      if (oldHeat && m.hasLayer(oldHeat)) m.removeLayer(oldHeat);
      const heatPts = pts.filter((p) => p.psf).map((p) => [p.lat, p.lng, Math.max(0.15, Math.min(1, (p.psf! - lo * 0.8) / ((hi - lo * 0.8) || 1)))] as [number, number, number]);
      groups.current.heat = (lib as unknown as { heatLayer: (p: [number, number, number][], o: object) => Leaflet.Layer }).heatLayer(heatPts, {
        radius: 18, blur: 16, maxZoom: 15, minOpacity: 0.3, gradient: { 0.2: '#00BAB4', 0.45: '#0D71BA', 0.7: '#C0D961', 1: '#b3261e' },
      });
      drawDots();
      setStatus(pts.length ? `${pts.length.toLocaleString()} sales in view${more ? ' (the newest; zoom in to see every one)' : ''}` : 'No sales in view with these filters. Zoom out, or refresh the market data.');
    } catch (e) {
      setStatus(`Couldn’t load the sales (${e instanceof Error ? e.message : e}). Move the map to try again.`);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setResults(null);
    const r = await fetch(`/api/market/find?q=${encodeURIComponent(q.trim())}`).catch(() => null);
    const j = r?.ok ? await r.json() : { results: [] };
    setResults(j.results);
    if (j.results.length === 1) go(j.results[0]);
  }
  function go(f: Found) {
    const m = map.current, lib = L.current;
    if (!m || !lib) return;
    if (found.current) m.removeLayer(found.current);
    found.current = lib.marker([f.lat, f.lng], { icon: lib.divIcon({ className: 'map-pin pin-found', html: '<span>★</span>', iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 2000 })
      .bindTooltip(esc(f.label), { permanent: true, direction: 'top', offset: [0, -14], className: 'found-label' }).addTo(m);
    m.flyTo([f.lat, f.lng], 18, { duration: 0.8 });
    setResults(null);
  }

  return (
    <div ref={wrap} className={`market-map-wrap${full ? ' is-full' : ''}`}>
      <div className="map-tools">
        <form className="map-search" onSubmit={search} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to an address or street" aria-label="Go to an address" />
          <button className="btn small" type="submit">Go</button>
          {results ? (
            <ul className="map-results">{results.length ? results.map((f, i) => (
              <li key={i}><button type="button" onClick={() => go(f)}>{f.label} <span className="small muted">{f.kind}</span></button></li>
            )) : <li className="small muted" style={{ padding: 8 }}>Nothing found. Try the house number and street.</li>}</ul>
          ) : null}
        </form>
        <div className="seg" role="group" aria-label="Base map">
          <button type="button" className="seg-btn" data-k="active" aria-pressed={!aerial} onClick={() => setAerial(false)}>Street Map</button>
          <button type="button" className="seg-btn" data-k="active" aria-pressed={aerial} onClick={() => setAerial(true)}>Aerial (Wake)</button>
        </div>
        <button type="button" className="btn small secondary" onClick={() => setFull((f) => !f)}>{full ? 'Exit Full Screen' : 'Full Screen'}</button>
      </div>
      <nav className="map-layers" aria-label="What the map shows">
        <span className="map-layers-label">Show</span>
        {shown.map((d) => (
          <button key={d.key} type="button" className="layer-btn" data-k={d.key} aria-pressed={on[d.key]} onClick={() => setOn((o) => ({ ...o, [d.key]: !o[d.key] }))}>{d.label}</button>
        ))}
      </nav>
      <div ref={box} className="market-map" role="region" aria-label="Market map" />
      <div className="map-foot">
        <span className="small" role="status">{status}{zoom < STREET_ZOOM ? ' · Zoom in to street level to see every sale with its price, and the parcel lines.' : parcelInfo ? ' · Tap a parcel for its owner and last sale.' : ''}</span>
        {range ? <span className="map-legend small"><span>${range[0]}/sf</span><span className="legend-bar" /><span>${range[1]}/sf</span></span> : null}
      </div>
    </div>
  );
}
