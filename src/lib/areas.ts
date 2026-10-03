// Where an agent (or anyone with an area) works: cities, ZIP codes and
// neighborhoods as real values, not one free-text box (owner, Oct 3, 2026: "under
// realtors we should add a place to say what zip codes and neighborhoods they are
// specialized in and cities"). Pure, tested in areas.test.ts.
import { AREA_CITIES } from './places';

export type Areas = { cities: string[]; zips: string[]; neighborhoods: string[] };
const BEACH = ['North Myrtle Beach', 'Myrtle Beach', 'Surfside Beach', 'Garden City', 'Little River', 'Conway'];
const KNOWN = new Set([...AREA_CITIES, ...BEACH].map((c) => c.toLowerCase()));

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const uniq = (xs: string[]) => { const seen = new Set<string>(); return xs.filter((x) => { const k = x.toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };
export const cleanZip = (v: string) => (/^\d{5}$/.test(v.trim()) ? v.trim() : null);

/** An old free-text Areas box ("Five Points, Oakwood, Durham 27705") read as cities, ZIPs and neighborhoods. */
export function parseAreas(text: string | null | undefined): Areas {
  const out: Areas = { cities: [], zips: [], neighborhoods: [] };
  for (const raw of (text ?? '').split(/[,;·|\n]+/)) {
    let part = tidy(raw);
    if (!part) continue;
    for (const z of part.match(/\b\d{5}\b/g) ?? []) out.zips.push(z);
    part = tidy(part.replace(/\b\d{5}\b/g, ''));
    if (!part) continue;
    if (KNOWN.has(part.toLowerCase())) out.cities.push([...AREA_CITIES, ...BEACH].find((c) => c.toLowerCase() === part.toLowerCase())!);
    else out.neighborhoods.push(part);
  }
  return { cities: uniq(out.cities), zips: uniq(out.zips), neighborhoods: uniq(out.neighborhoods) };
}

/** Cleaned lists (from the picker), each value once. */
export function cleanAreas(a: { cities?: string[]; zips?: string[]; neighborhoods?: string[] }): Areas {
  return {
    cities: uniq((a.cities ?? []).map(tidy)).slice(0, 30),
    zips: uniq((a.zips ?? []).map((z) => cleanZip(z) ?? '')).slice(0, 60),
    neighborhoods: uniq((a.neighborhoods ?? []).map(tidy)).slice(0, 60),
  };
}

/** "Raleigh · 27604, 27608 · Oakwood, Five Points" (empty when nothing's recorded). */
export const areaSummary = (a: Areas) => [a.cities.join(', '), a.zips.join(', '), a.neighborhoods.join(', ')].filter(Boolean).join(' · ');

/** What a role's areas are: the lists when saved that way, else read from the old text. */
export const areasOf = (r: { cities?: string[] | null; zips?: string[] | null; neighborhoods?: string[] | null; areas?: string | null }): Areas =>
  r.cities || r.zips || r.neighborhoods ? cleanAreas({ cities: r.cities ?? [], zips: r.zips ?? [], neighborhoods: r.neighborhoods ?? [] }) : parseAreas(r.areas);

/** Does someone working these areas work at this place? Says which of its areas matched. */
export function worksAt(a: Areas, place: { city?: string | null; zip?: string | null; neighborhood?: string | null }): string[] {
  const eq = (x: string, y: string | null | undefined) => !!y && x.toLowerCase() === y.trim().toLowerCase();
  return [
    ...(place.neighborhood && a.neighborhoods.some((n) => eq(n, place.neighborhood)) ? [place.neighborhood] : []),
    ...(place.zip && a.zips.includes(place.zip.slice(0, 5)) ? [place.zip.slice(0, 5)] : []),
    ...(place.city && a.cities.some((c) => eq(c, place.city)) ? [place.city] : []),
  ];
}
