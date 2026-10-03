import 'server-only';
import { unstable_cache } from 'next/cache';
import { describeZoning, placeOfLayer, zoneFieldsOf, type ZoningInfo } from './zoning';

// What the county zoning maps say at a spot: Wake's (every Wake town) and
// Durham's, both public. Remembered for 30 days per spot (about a meter).
export const WAKE_ZONING = 'https://maps.wakegov.com/arcgis/rest/services/Planning/Zoning/MapServer';
export const DURHAM_ZONING = 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Zoning_Features/FeatureServer/0';
/** Wake's map: 0–13 are overlays, 14–27 each town's zoning (28 airport). */
const WAKE_ZONING_LAYERS = Array.from({ length: 15 }, (_, i) => 14 + i);
const WAKE_OVERLAY_LAYERS = Array.from({ length: 14 }, (_, i) => i);

async function getJson(url: string, params: Record<string, string>) {
  const r = await fetch(`${url}?${new URLSearchParams({ ...params, f: 'json' })}`, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message ?? 'map error');
  return j;
}

async function wakeAt(lat: number, lng: number): Promise<ZoningInfo | null> {
  const d = 0.005; // 400 px over ~1 km: 4 px is about 11 m, so a point on a road still finds the zone beside it
  const j = await getJson(`${WAKE_ZONING}/identify`, {
    geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', sr: '4326', tolerance: '4', returnGeometry: 'false',
    layers: `all:${[...WAKE_ZONING_LAYERS, ...WAKE_OVERLAY_LAYERS].join(',')}`, mapExtent: `${lng - d},${lat - d},${lng + d},${lat + d}`, imageDisplay: '400,400,96',
  });
  const results = (j.results ?? []) as { layerId: number; layerName: string; attributes: Record<string, unknown> }[];
  const zone = results.find((r) => WAKE_ZONING_LAYERS.includes(r.layerId) && zoneFieldsOf(r.attributes).code);
  if (!zone) return null;
  const f = zoneFieldsOf(zone.attributes);
  const place = placeOfLayer(zone.layerName);
  const overlays = [...new Set(results.filter((r) => WAKE_OVERLAY_LAYERS.includes(r.layerId)).map((r) => r.layerName))];
  return { ...describeZoning(f.code!, place, f.label), overlays };
}

async function durhamAt(lat: number, lng: number): Promise<ZoningInfo | null> {
  const j = await getJson(`${DURHAM_ZONING}/query`, {
    geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'UDO,UDO_LABEL,ZONE_CODE,ZONE_GEN', returnGeometry: 'false',
  });
  const a = (j.features ?? [])[0]?.attributes as Record<string, unknown> | undefined;
  if (!a) return null;
  const f = zoneFieldsOf(a);
  return f.code ? { ...describeZoning(f.code, 'Durham', f.label), overlays: [] } : null;
}

async function lookUp(lat: number, lng: number): Promise<ZoningInfo | null> {
  // Durham County lies north and west of Wake; ask the likelier one first.
  const durhamFirst = lat > 35.87 && lng < -78.75;
  for (const look of durhamFirst ? [durhamAt, wakeAt] : [wakeAt, durhamAt]) {
    const z = await look(lat, lng);
    if (z) return z;
  }
  return null;
}
const cached = unstable_cache(lookUp, ['zoning-at-v1'], { revalidate: 60 * 60 * 24 * 30 });

/** The zoning at a spot, or null (outside both counties, or the map didn't answer). */
export async function zoningAt(lat: number | string | null | undefined, lng: number | string | null | undefined): Promise<ZoningInfo | null> {
  if (process.env.COUNTY_LOOKUPS === 'off') return null; // tests: never the real county maps
  const y = Number(lat), x = Number(lng);
  if (!Number.isFinite(y) || !Number.isFinite(x) || !y || !x) return null;
  const a = Math.round(y * 1e5) / 1e5, b = Math.round(x * 1e5) / 1e5;
  try { return await cached(a, b); } catch {
    // Outside a page request (scripts) there's no cache: ask the map directly.
    try { return await lookUp(a, b); } catch { return null; }
  }
}
