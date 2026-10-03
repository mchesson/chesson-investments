// Links that open the Market Map on a place or a neighborhood (owner, Oct 3,
// 2026: the neighborhood "should light up and be clickable and link to the map
// we have and so should the address"). Pure.

export function placeMapHref(p: { lat: string | number | null; lng: string | number | null; label: string }) {
  if (p.lat == null || p.lng == null || p.lat === '' || p.lng === '') return null;
  return `/market?${new URLSearchParams({ lat: String(p.lat), lng: String(p.lng), label: p.label })}`;
}
export const hoodMapHref = (name: string) => `/market?${new URLSearchParams({ hood: name })}`;
