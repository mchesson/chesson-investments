'use client';
// The interactive market map (owner, Oct 2, 2026: "an interactive heat map ...
// zoom in and out and we have buttons at the top to add in or subtract what is
// showing"). Leaflet with OpenStreetMap tiles; sales come from /api/market/points
// for the part of the map in view.
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { psfColor } from '@/lib/market-stats';

type Place = { id: string; name: string; stage: string; lat: number; lng: number };
type Area = { name: string; city: string | null; sales: number; median_price: number; median_psf: number | null; prior_psf: number | null; lat: number; lng: number };
type Pt = { id: string; lat: number; lng: number; price: number; psf: number | null; on: string; a: string | null; h: string | null; u: string; sf: number | null };

export const layerDefs = [
  { key: 'heat', label: 'Sales Heat ($/sf)' },
  { key: 'dots', label: 'Each Sale' },
  { key: 'areas', label: 'Neighborhoods' },
  { key: 'projects', label: 'Our Projects' },
  { key: 'watch', label: 'Watchlist' },
] as const;
export type LayerKey = (typeof layerDefs)[number]['key'];
const STORE = 'ci-market-layers';

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function MarketMap({ query, projects, watch, areas, only }: { query: string; projects: Place[]; watch: Place[]; areas: Area[]; only?: LayerKey[] }) {
  const shown = layerDefs.filter((d) => !only || only.includes(d.key));
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const groups = useRef<Partial<Record<LayerKey, Leaflet.Layer>>>({});
  const [on, setOn] = useState<Record<LayerKey, boolean>>({ heat: true, dots: false, areas: true, projects: true, watch: true });
  const [status, setStatus] = useState('Loading the map…');
  const [range, setRange] = useState<[number, number] | null>(null);
  const onRef = useRef(on);
  onRef.current = on;
  const queryRef = useRef(query);
  queryRef.current = query;

  // Remember the layers per viewer (a convenience only).
  useEffect(() => {
    try { const s = localStorage.getItem(STORE); if (s) setOn((o) => ({ ...o, ...JSON.parse(s) })); } catch { /* private window */ }
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      const lib = (await import('leaflet')).default;
      (window as unknown as { L: typeof Leaflet }).L = lib;
      await import('leaflet.heat');
      if (dead || !box.current || map.current) return;
      L.current = lib;
      const m = lib.map(box.current, { center: [35.86, -78.75], zoom: 10, zoomControl: true, preferCanvas: true });
      lib.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors; sales: Wake and Durham County public records' }).addTo(m);
      map.current = m;
      // Our projects and the watchlist.
      const pin = (cls: string, label: string) => lib.divIcon({ className: `map-pin ${cls}`, html: `<span>${label}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
      groups.current.projects = lib.layerGroup(projects.map((p) => lib.marker([p.lat, p.lng], { icon: pin('pin-project', 'P') })
        .bindPopup(`<strong><a href="/projects/${p.id}">${esc(p.name)}</a></strong><br>Our project`)));
      groups.current.watch = lib.layerGroup(watch.map((p) => lib.marker([p.lat, p.lng], { icon: pin('pin-watch', 'W') })
        .bindPopup(`<strong><a href="/watchlist/${p.id}">${esc(p.name)}</a></strong><br>On the watchlist`)));
      groups.current.areas = lib.layerGroup(areas.filter((a) => a.lat && a.lng).map((a) => lib.circleMarker([a.lat, a.lng], {
        radius: Math.max(6, Math.min(22, Math.sqrt(a.sales) * 2.2)), color: '#0D71BA', weight: 2, fillColor: '#0D71BA', fillOpacity: 0.12,
      }).bindTooltip(`${esc(a.name)}: ${a.sales} sales${a.median_psf ? `, $${a.median_psf}/sf` : ''}`)
        .bindPopup(`<strong>${esc(a.name)}</strong>${a.city ? `, ${esc(a.city)}` : ''}<br>${a.sales} sales · median ${money(a.median_price)}${a.median_psf ? ` · $${a.median_psf}/sf` : ''}${a.prior_psf && a.median_psf ? `<br>$/sf ${a.median_psf >= a.prior_psf ? 'up' : 'down'} ${Math.abs(Math.round(((a.median_psf - a.prior_psf) / a.prior_psf) * 100))}% on the period before` : ''}`)));
      m.on('moveend', () => load());
      apply();
      load();
    })().catch((e) => setStatus(`The map couldn’t load: ${e instanceof Error ? e.message : e}`));
    return () => { dead = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload sales when the filters change.
  useEffect(() => { if (map.current) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);
  useEffect(() => { apply(); try { localStorage.setItem(STORE, JSON.stringify(on)); } catch { /* private window */ } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [on]);

  function apply() {
    const m = map.current;
    if (!m) return;
    for (const d of layerDefs) {
      const g = groups.current[d.key];
      if (!g) continue;
      if (onRef.current[d.key] && !m.hasLayer(g)) g.addTo(m);
      if (!onRef.current[d.key] && m.hasLayer(g)) m.removeLayer(g);
    }
  }

  async function load() {
    const m = map.current, lib = L.current;
    if (!m || !lib) return;
    const b = m.getBounds();
    setStatus('Loading sales…');
    try {
      const r = await fetch(`/api/market/points?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((x) => x.toFixed(5)).join(',')}&${queryRef.current}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const { points, more } = (await r.json()) as { points: Pt[]; more: boolean };
      const ps = points.map((p) => p.psf).filter((x): x is number => !!x).sort((a, c) => a - c);
      const lo = ps[Math.floor(ps.length * 0.1)] ?? 0, hi = ps[Math.floor(ps.length * 0.9)] ?? 0;
      setRange(ps.length ? [lo, hi] : null);
      for (const k of ['heat', 'dots'] as const) { const g = groups.current[k]; if (g && m.hasLayer(g)) m.removeLayer(g); }
      const heatPts = points.filter((p) => p.psf).map((p) => [p.lat, p.lng, Math.max(0.15, Math.min(1, (p.psf! - lo * 0.8) / ((hi - lo * 0.8) || 1)))] as [number, number, number]);
      groups.current.heat = (lib as unknown as { heatLayer: (p: [number, number, number][], o: object) => Leaflet.Layer }).heatLayer(heatPts, {
        radius: 18, blur: 16, maxZoom: 15, minOpacity: 0.3, gradient: { 0.2: '#00BAB4', 0.45: '#0D71BA', 0.7: '#C0D961', 1: '#b3261e' },
      });
      groups.current.dots = lib.layerGroup(points.map((p) => lib.circleMarker([p.lat, p.lng], { radius: 5, weight: 1, color: '#fff', fillColor: psfColor(p.psf, lo, hi), fillOpacity: 0.9 })
        .bindPopup(`<strong>${esc(p.a)}</strong>${p.h ? `<br>${esc(p.h)}` : ''}<br>Sold ${p.on} for ${money(p.price)}${p.sf ? ` · ${p.sf.toLocaleString()} sf` : ''}${p.psf ? ` · <b>$${p.psf}/sf</b>` : ''}`)));
      apply();
      setStatus(points.length ? `${points.length.toLocaleString()} sales in view${more ? ' (the newest; zoom in to see every one)' : ''}` : 'No sales in view with these filters. Zoom out, or refresh the market data.');
    } catch (e) {
      setStatus(`Couldn’t load the sales (${e instanceof Error ? e.message : e}). Move the map to try again.`);
    }
  }

  return (
    <div className="market-map-wrap">
      <nav className="map-layers" aria-label="What the map shows">
        <span className="map-layers-label">Show</span>
        {shown.map((d) => (
          <button key={d.key} type="button" className="layer-btn" data-k={d.key} aria-pressed={on[d.key]} onClick={() => setOn((o) => ({ ...o, [d.key]: !o[d.key] }))}>{d.label}</button>
        ))}
      </nav>
      <div ref={box} className="market-map" role="region" aria-label="Market map" />
      <div className="map-foot">
        <span className="small" role="status">{status}</span>
        {range ? <span className="map-legend small"><span>${range[0]}/sf</span><span className="legend-bar" /><span>${range[1]}/sf</span></span> : null}
      </div>
    </div>
  );
}
