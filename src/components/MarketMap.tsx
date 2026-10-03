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
import { describeZoning, zoneFieldsOf, zoningFamilies, type ZoningFamily } from '@/lib/zoning';

type Place = { id: string; name: string; stage: string; lat: number; lng: number };
type Area = { name: string; city: string | null; sales: number; median_price: number; median_psf: number | null; prior_psf: number | null; lat: number; lng: number };
type Zone = { name: string; city: string | null; lat: number; lng: number; verdict: string; label: string; maxLot: number | null; entry: number | null; value: number | null };
type Pt = { id: string; lat: number; lng: number; price: number; psf: number | null; on: string; a: string | null; h: string | null; u: string; sf: number | null };
type Found = { label: string; kind: string; lat: number; lng: number };
type ZipLabel = { zip: string; lat: number; lng: number; dom: number | null; mos: number | null; heat: string | null; label: string };
type Permit = { k: string; lat: number; lng: number; a: string | null; c: string | null; d: string; b: string | null; v: number | null; t: string | null };

export const layerDefs = [
  { key: 'heat', label: 'Sales Heat ($/sf)' },
  { key: 'dots', label: 'Each Sale' },
  { key: 'parcels', label: 'Parcel Lines' },
  { key: 'areas', label: 'Neighborhoods' },
  { key: 'zips', label: 'ZIP Codes: Days on Market' },
  { key: 'permits', label: 'New-Home Permits' },
  { key: 'teardowns', label: 'Teardowns' },
  { key: 'zones', label: 'Buy Zones' },
  { key: 'projects', label: 'Our Projects' },
  { key: 'watch', label: 'Watchlist' },
] as const;
export type LayerKey = (typeof layerDefs)[number]['key'];

// Planning layers (owner, Oct 3, 2026: zoning, right-of-way and utilities, "to be
// able to add them, not on my normal maps"): kept apart and off until turned on.
export const planDefs = [
  { key: 'zoning', label: 'Zoning', hint: 'Every Wake town and Durham, colored by what it allows' },
  { key: 'overlays', label: 'Zoning Overlays', hint: 'Wake: historic, watershed, corridor and other overlays' },
  { key: 'easements', label: 'Easements', hint: 'Wake: access and major utility easements' },
  { key: 'septic', label: 'Septic (No Sewer)', hint: 'Wake: septic permits, where there’s no city sewer' },
  { key: 'nowater', label: 'No City Water', hint: 'Durham: parcels without water access' },
  { key: 'row', label: 'Right-of-Way', hint: 'Durham: the street right-of-way lines' },
] as const;
export type PlanKey = (typeof planDefs)[number]['key'];
const PLAN_STORE = 'ci-market-plan';
/** Planning layers draw from this zoom in (closer than a town, so the county maps answer quickly). */
export const PLAN_ZOOM = 14;
export const familyColor: Record<ZoningFamily, string> = {
  houses: '#f2c94c', houses_plus: '#f2994a', multi: '#c0582b', mixed: '#c45bb5', commercial: '#d64545', office: '#4a7fd6',
  industrial: '#7b5ea7', planned: '#9c7a54', rural: '#9bc46b', conservation: '#2f8f4e', other: '#9e9e9e',
};
const WAKE_ZONING = 'https://maps.wakegov.com/arcgis/rest/services/Planning/Zoning/MapServer';
const DURHAM_ZONING = 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Zoning_Features/FeatureServer/0';
const WAKE_TOWN_ZONING: [number, string][] = [[14, 'Apex'], [15, 'Angier'], [16, 'Cary'], [17, 'Wake County'], [18, 'Fuquay-Varina'], [19, 'Garner'], [20, 'Holly Springs'], [21, 'Knightdale'], [22, 'Morrisville'], [23, 'Raleigh'], [24, 'Rolesville'], [25, 'Wake Forest'], [26, 'Wendell'], [27, 'Zebulon']];
const WAKE_EASEMENTS = 'https://maps.wakegov.com/arcgis/rest/services/Property/Easements/MapServer';
const WAKE_SEPTIC = 'https://maps.wakegov.com/arcgis/rest/services/Environmental/Septic/MapServer';
const DURHAM_ROW = 'https://services3.arcgis.com/UqDvtuTcaWV6ztHb/arcgis/rest/services/Right_Of_Way/FeatureServer/44';
const DURHAM_NO_WATER = 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Parcels_Without_Water_Access/FeatureServer/0';
const STORE = 'ci-market-layers';
/** Street level: every sale shows as a labelled dot and parcels show their lines. */
export const STREET_ZOOM = 16;

const WAKE_IMAGERY = 'https://maps.wakegov.com/arcgis/rest/services/Imagery/Imagery_2025/MapServer';
const WAKE_PARCELS = 'https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer';
const DURHAM_PARCELS = 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Parcels_NEW/FeatureServer/0';

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const useLabel: Record<string, string> = { single_family: 'Single family', townhouse: 'Townhouse', condo: 'Condo', multi_family: '2–4 units', land: 'Land / lot', other: 'Other' };

export function MarketMap({ query, projects, watch, areas, only, zones = [], zips = [], parcelInfo = false }: {
  query: string; projects: Place[]; watch: Place[]; areas: Area[]; only?: LayerKey[]; zones?: Zone[]; zips?: ZipLabel[];
  /** Staff only: a click on a parcel up close shows its owner and last sale. */
  parcelInfo?: boolean;
}) {
  const shown = layerDefs.filter((d) => (!only || only.includes(d.key) || d.key === 'parcels') && (d.key !== 'zones' || zones.length) && (d.key !== 'zips' || zips.length));
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const groups = useRef<Partial<Record<LayerKey, Leaflet.Layer>>>({});
  const base = useRef<{ streets?: Leaflet.Layer; aerial?: Leaflet.Layer }>({});
  const points = useRef<Pt[]>([]);
  const found = useRef<Leaflet.Layer | null>(null);
  const [on, setOn] = useState<Record<LayerKey, boolean>>({ heat: true, dots: false, parcels: true, areas: true, zips: false, permits: false, teardowns: false, zones: true, projects: true, watch: true });
  const [plan, setPlan] = useState<Record<PlanKey, boolean>>({ zoning: false, overlays: false, easements: false, septic: false, nowater: false, row: false });
  const planRef = useRef(plan);
  planRef.current = plan;
  const planGroups = useRef<Partial<Record<PlanKey, Leaflet.Layer>>>({});
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
      const p = localStorage.getItem(PLAN_STORE);
      if (p) setPlan((o) => ({ ...o, ...JSON.parse(p) }));
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
      // Redfin's numbers by ZIP code: a label at each ZIP's middle, colored by how hot it is.
      const heatColor: Record<string, string> = { hot: '#b3261e', balanced: '#0D71BA', slow: '#5b6b14' };
      groups.current.zips = lib.layerGroup(zips.filter((z) => z.lat && z.lng).map((z) => lib.marker([z.lat, z.lng], {
        icon: lib.divIcon({ className: 'zip-label', html: `<span style="border-color:${heatColor[z.heat ?? ''] ?? '#898989'}"><b>${esc(z.zip)}</b> ${z.dom === null ? '' : `${Math.round(z.dom)} days`}</span>`, iconSize: [96, 22], iconAnchor: [48, 11] }),
      }).bindPopup(`<strong>ZIP ${esc(z.zip)}</strong><br>${esc(z.label)}`)));
      const zoneColor: Record<string, string> = { buy: '#00756f', watch: '#5b6b14', pass: '#b3261e', thin: '#898989' };
      groups.current.zones = lib.layerGroup(zones.filter((z) => z.lat && z.lng).map((z) => lib.circleMarker([z.lat, z.lng], {
        radius: z.verdict === 'buy' ? 12 : 9, color: zoneColor[z.verdict] ?? '#898989', weight: 3, fillColor: zoneColor[z.verdict] ?? '#898989', fillOpacity: z.verdict === 'buy' ? 0.45 : 0.2,
      }).bindTooltip(`${esc(z.name)}: ${esc(z.label)}`, { className: 'zone-label' })
        .bindPopup(`<strong>${esc(z.name)}</strong>${z.city ? `, ${esc(z.city)}` : ''}<br><b>${esc(z.label)}</b>${z.value ? `<br>A new house would sell for about ${money(z.value)}` : ''}${z.maxLot ? `<br>We can pay up to ${money(z.maxLot)} for the lot` : ''}${z.entry ? `<br>Lots and teardowns sell around ${money(z.entry)}` : ''}`)));

      // Planning layers: drawn from the county maps, colored our way, only up close.
      const zoneStyle = (code: string | null, place: string) => {
        const fam = code ? describeZoning(code, place).family : 'other';
        return { color: familyColor[fam], weight: 1, fillColor: familyColor[fam], fillOpacity: 0.35 };
      };
      const zonePopup = (place: string) => (l: Leaflet.Layer) => {
        const f = zoneFieldsOf(((l as unknown as { feature?: { properties: Record<string, unknown> } }).feature?.properties) ?? {});
        if (!f.code) return 'No zoning on this piece';
        const z = describeZoning(f.code, place, f.label);
        return `<strong>${esc(z.code)}</strong> · ${esc(z.label)} (${esc(place)})<br><span class="small">${esc(z.detail)}</span>${z.ordinance ? `<br><a href="${esc(z.ordinance)}" target="_blank" rel="noreferrer">${esc(place)}’s rules</a>` : ''}`;
      };
      planGroups.current.zoning = lib.layerGroup([
        ...WAKE_TOWN_ZONING.map(([id, place]) => esri.featureLayer({ url: `${WAKE_ZONING}/${id}`, minZoom: PLAN_ZOOM, simplifyFactor: 0.5,
          style: (f: { properties: Record<string, unknown> }) => zoneStyle(zoneFieldsOf(f.properties).code, place) } as never).bindPopup(zonePopup(place) as never)),
        esri.featureLayer({ url: DURHAM_ZONING, minZoom: PLAN_ZOOM, simplifyFactor: 0.5, fields: ['OBJECTID', 'UDO', 'UDO_LABEL', 'ZONE_CODE'],
          style: (f: { properties: Record<string, unknown> }) => zoneStyle(zoneFieldsOf(f.properties).code, 'Durham') } as never).bindPopup(zonePopup('Durham') as never),
      ]);
      planGroups.current.overlays = esri.dynamicMapLayer({ url: WAKE_ZONING, layers: Array.from({ length: 14 }, (_, i) => i), format: 'png32', transparent: true, opacity: 0.6, minZoom: PLAN_ZOOM } as never);
      planGroups.current.easements = esri.dynamicMapLayer({ url: WAKE_EASEMENTS, format: 'png32', transparent: true, minZoom: PLAN_ZOOM } as never);
      planGroups.current.septic = esri.dynamicMapLayer({ url: WAKE_SEPTIC, format: 'png32', transparent: true, minZoom: PLAN_ZOOM } as never);
      planGroups.current.nowater = esri.featureLayer({ url: DURHAM_NO_WATER, minZoom: PLAN_ZOOM, simplifyFactor: 0.5, fields: ['OBJECTID', 'LOCATION_ADDR'],
        style: () => ({ color: '#b3261e', weight: 2, fillColor: '#b3261e', fillOpacity: 0.15, dashArray: '4 3' }) } as never)
        .bindPopup(((l: Leaflet.Layer) => `<strong>No city water access</strong><br>${esc(String(((l as unknown as { feature?: { properties: Record<string, unknown> } }).feature?.properties.LOCATION_ADDR) ?? ''))}<br><span class="small">Durham’s own analysis: water would need extending or a well.</span>`) as never);
      planGroups.current.row = esri.featureLayer({ url: DURHAM_ROW, minZoom: PLAN_ZOOM, style: () => ({ color: '#212121', weight: 2, dashArray: '6 4' }) } as never);
      for (const k of Object.keys(planGroups.current) as PlanKey[]) (planGroups.current[k] as unknown as { __plan?: string }).__plan = k;

      // Up close, a click on a parcel says what it is and who owns it (staff only).
      if (parcelInfo) m.on('click', async (e: Leaflet.LeafletMouseEvent) => {
        if (m.getZoom() < 15) return;
        const pop = lib.popup().setLatLng(e.latlng).setContent('Looking up the parcel…').openOn(m);
        try {
          const r = await fetch(`/api/market/parcel?lat=${e.latlng.lat.toFixed(6)}&lng=${e.latlng.lng.toFixed(6)}`);
          const { parcel: p, zoning: z } = await r.json();
          const zline = z ? `<br><b>Zoning: ${esc(z.code)}</b> · ${esc(z.label)} (${esc(z.place)}, ${esc(z.family)})<br><span class="small">${esc(z.detail)}${z.overlays?.length ? ` Overlays: ${esc(z.overlays.join(', '))}.` : ''}</span>${z.ordinance ? ` <a href="${esc(z.ordinance)}" target="_blank" rel="noreferrer">Rules</a>` : ''}` : '';
          if (!p) { pop.setContent(`No parcel here on the county records.${zline}`); return; }
          pop.setContent(`<div class="parcel-pop"><strong>${esc(p.address)}</strong>${p.city ? `, ${esc(p.city)}` : ''}<br>${esc(p.county)}${p.neighborhood ? ` · ${esc(p.neighborhood)}` : ''}<br>`
            + `${useLabel[p.landUse] ?? ''}${p.heatedSf ? ` · ${Number(p.heatedSf).toLocaleString()} sf` : ''}${p.yearBuilt ? ` · built ${p.yearBuilt}` : ''}${p.acres ? ` · ${p.acres} ac` : ''}<br>`
            + `Owner: ${esc(p.owner) || '—'}${p.absentee ? ' <b>(lives elsewhere)</b>' : ''}<br>`
            + `${p.assessedValue ? `Assessed ${money(p.assessedValue)}` : ''}${p.lastSalePrice ? ` · last sold ${money(p.lastSalePrice)}${p.lastSaleOn ? ` on ${p.lastSaleOn}` : ''}` : ''}<br>`
            + `${zline ? `${zline}<br>` : ''}<a href="/watchlist/new?address=${encodeURIComponent(p.address ?? '')}&city=${encodeURIComponent(p.city ?? '')}">Add to the Watchlist</a></div>`);
        } catch { pop.setContent('Couldn’t reach the county records just now.'); }
      });
      m.on('moveend', () => { load(); loadPermits(); });
      m.on('zoomend', () => { setZoom(m.getZoom()); drawDots(); });
      apply();
      load();
    })().catch((e) => setStatus(`The map couldn’t load: ${e instanceof Error ? e.message : e}`));
    return () => { dead = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Permits load when either permit layer is turned on.
  useEffect(() => { if (map.current) loadPermits(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [on.permits, on.teardowns]);
  // Reload sales when the filters change.
  useEffect(() => { if (map.current) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);
  useEffect(() => {
    apply();
    try { localStorage.setItem(STORE, JSON.stringify({ layers: on, aerial })); } catch { /* private window */ }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [on, aerial, plan]);
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
    for (const d of planDefs) {
      const g = planGroups.current[d.key];
      if (!g) continue;
      if (planRef.current[d.key] && !m.hasLayer(g)) g.addTo(m);
      if (!planRef.current[d.key] && m.hasLayer(g)) m.removeLayer(g);
    }
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

  async function loadPermits() {
    const m = map.current, lib = L.current;
    if (!m || !lib) return;
    const kinds = [onRef.current.permits ? 'new_home' : null, onRef.current.teardowns ? 'demolition' : null].filter(Boolean);
    if (!kinds.length || m.getZoom() < 12) {
      for (const k of ['permits', 'teardowns'] as const) { const g = groups.current[k]; if (g && m.hasLayer(g)) m.removeLayer(g); delete groups.current[k]; }
      return;
    }
    const b = m.getBounds();
    const r = await fetch(`/api/market/permits?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((x) => x.toFixed(5)).join(',')}&kinds=${kinds.join(',')}`).catch(() => null);
    if (!r?.ok) return;
    const { permits } = (await r.json()) as { permits: Permit[] };
    const what: Record<string, string> = { demolition: 'Teardown', rebuild: 'New home on a teardown', new_home: 'New-home permit' };
    const make = (p: Permit) => lib.marker([p.lat, p.lng], {
      icon: lib.divIcon({ className: `map-pin ${p.k === 'new_home' ? 'pin-permit' : 'pin-teardown'}`, html: `<span>${p.k === 'demolition' ? '✕' : p.k === 'rebuild' ? '↻' : '⌂'}</span>`, iconSize: [20, 20], iconAnchor: [10, 10] }), zIndexOffset: 500,
    }).bindPopup(`<strong>${what[p.k] ?? 'Permit'}</strong>${p.a ? `<br>${esc(p.a)}${p.c ? `, ${esc(p.c)}` : ''}` : ''}<br>${p.d}${p.b ? ` · <b>${esc(p.b)}</b>` : ''}${p.v ? ` · ${money(p.v)} to build` : ''}${p.t ? `<br><span class="small">${esc(p.t)}</span>` : ''}`);
    // A rebuild shows on both layers (drawn once, on Teardowns when that's on).
    const tearOn = onRef.current.teardowns;
    for (const [k, keep] of [['permits', (p: Permit) => p.k === 'new_home' || (p.k === 'rebuild' && !tearOn)], ['teardowns', (p: Permit) => p.k !== 'new_home']] as const) {
      const old = groups.current[k];
      if (old && m.hasLayer(old)) m.removeLayer(old);
      groups.current[k] = lib.layerGroup(permits.filter(keep).map(make));
    }
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
      <details className="map-plan" open={Object.values(plan).some(Boolean) || undefined}>
        <summary>Planning Layers <span className="small muted">zoning, easements, sewer, water, right-of-way{Object.values(plan).some(Boolean) ? ` · ${Object.values(plan).filter(Boolean).length} on` : ''}</span></summary>
        <nav className="map-layers" aria-label="Planning layers">
          <span className="map-layers-label">Add</span>
          {planDefs.map((d) => (
            <button key={d.key} type="button" className="layer-btn" data-k={d.key} title={d.hint} aria-pressed={plan[d.key]} onClick={() => setPlan((o) => {
              // Saved as it's tapped (an effect could write the starting value over it while the page loads).
              const n = { ...o, [d.key]: !o[d.key] };
              try { localStorage.setItem(PLAN_STORE, JSON.stringify(n)); } catch { /* private window */ }
              return n;
            })}>{d.label}</button>
          ))}
        </nav>
        {plan.zoning ? (
          <div className="zoning-legend small" aria-label="Zoning colors">
            {zoningFamilies.map((f) => <span key={f.key}><i style={{ background: familyColor[f.key] }} />{f.label}</span>)}
          </div>
        ) : null}
        {Object.values(plan).some(Boolean) && zoom < PLAN_ZOOM ? <p className="small muted" style={{ margin: '4px 0 0' }}>Zoom in to a neighborhood to see the planning layers.</p> : null}
      </details>
      <div ref={box} className="market-map" role="region" aria-label="Market map" />
      <div className="map-foot">
        <span className="small" role="status">{status}{(on.permits || on.teardowns) && zoom < 12 ? ' · Zoom in to see permits.' : ''}{zoom < STREET_ZOOM ? ' · Zoom in to street level to see every sale with its price, and the parcel lines.' : parcelInfo ? ' · Tap a parcel for its owner and last sale.' : ''}</span>
        {range ? <span className="map-legend small"><span>${range[0]}/sf</span><span className="legend-bar" /><span>${range[1]}/sf</span></span> : null}
      </div>
    </div>
  );
}
