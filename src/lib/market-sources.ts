// The counties' public parcel records, read the same way (owner, Oct 2, 2026:
// Wake, then Durham and the surrounding counties). Each county is a source: its
// ArcGIS address, its fields and how a record becomes a market parcel. Pure
// (no network), tested in market-sources.test.ts.

export type MarketRow = {
  county: string; parcelKey: string; address: string | null; street: string | null; city: string | null; zip: string | null;
  neighborhood: string | null; landUse: LandUse; heatedSf: number | null; yearBuilt: number | null; acres: number | null;
  assessedValue: number | null; ownerName: string | null; absentee: boolean | null; lat: number | null; lng: number | null;
  lastSalePrice: number | null; lastSaleOn: string | null;
};

export const landUses = [
  { key: 'single_family', label: 'Single Family' }, { key: 'townhouse', label: 'Townhouse' }, { key: 'condo', label: 'Condo' },
  { key: 'multi_family', label: '2–4 Units' }, { key: 'land', label: 'Land / Lots' },
] as const;
export type LandUse = (typeof landUses)[number]['key'] | 'other';

type Attrs = Record<string, string | number | null | undefined>;
type Feature = { attributes: Attrs; centroid?: { x: number; y: number } | null };

export type Source = {
  key: string; label: string; url: string; fields: string[];
  /** The where clause for sales since a day (and over $50k: family transfers are $0 or nominal). */
  where: (since: string) => string;
  map: (f: Feature) => MarketRow | null;
  /** Finding one address (to put our projects and the watchlist on the map). */
  addressField: string; cityField: string;
};

const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const pos = (v: unknown) => { const n = num(v); return n && n > 0 ? n : null; };
const day = (v: unknown) => { const n = num(v); return n ? new Date(n).toISOString().slice(0, 10) : null; };
const title = (s: string | null) => (s ? s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Nc|Llc|Ii|Iii)\b/g, (m) => m.toUpperCase()) : null);

const SUFFIX: Record<string, string> = {
  STREET: 'ST', AVENUE: 'AVE', ROAD: 'RD', DRIVE: 'DR', LANE: 'LN', COURT: 'CT', PLACE: 'PL', BOULEVARD: 'BLVD', CIRCLE: 'CIR',
  PARKWAY: 'PKWY', TERRACE: 'TER', TRAIL: 'TRL', HIGHWAY: 'HWY', WAY: 'WAY', SQUARE: 'SQ', LOOP: 'LOOP', RUN: 'RUN', CROSSING: 'XING',
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
};
/** "420 Peyton Street" → "420 PEYTON ST", the way both counties write addresses. */
export function normalizeAddress(a: string | null | undefined): string | null {
  if (!a) return null;
  const words = a.toUpperCase().replace(/[.,#]/g, ' ').split(/\s+/).filter(Boolean).map((w) => SUFFIX[w] ?? w);
  return words.length ? words.join(' ') : null;
}
/** The street without the house number: "420 PEYTON ST" → "PEYTON ST". */
export const streetOf = (address: string | null) => (address
  ? address.replace(/^(\d+[A-Z]?\s+|[A-DF-MO-RT-VX-Z]\s+)+/, '').replace(/\s+(UNIT|APT|STE)\s+\S+$/, '') || null
  : null); // house and unit numbers off; a lone N, S, E or W stays (it's part of the street)

/** Wake's PROPDESC carries the subdivision: "LO130 KNIGHTDALE STATION PHR3 BM2016 -01442" → "Knightdale Station". */
export function wakeSubdivision(desc: string | null | undefined): string | null {
  if (!desc) return null;
  const s = desc.toUpperCase()
    .replace(/\bBM\s?\d{4}\s*-?\s*\d+.*$/, '') // the book of maps reference and anything after
    .replace(/^(LO|LOT|LT|UNIT|U|BLDG|B)\s?[\dA-Z-]+\s+/g, '')
    .replace(/\b(PH|PHASE|SEC|SECTION|BLK|BLOCK|PHR|LO|LOT|PT|TR|TRACT|SE|S)\s?\d[\dA-Z-]*\b/g, ' ')
    .replace(/\b(PH|PHASE|SEC|SECTION|BLK|BLOCK|PHR|RCMB|RECOMB|REC|REV|REVISED|PT|TRACT)\b/g, ' ')
    .replace(/[@&]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < 3 || /^[\d\s-]+$/.test(s)) return null;
  return title(s);
}

function absentee(siteAddress: string | null, mail: string | null): boolean | null {
  if (!siteAddress || !mail) return null;
  const a = normalizeAddress(siteAddress)!, m = normalizeAddress(mail)!;
  const num0 = a.split(' ')[0];
  return !(m.includes(a) || (m.startsWith(num0 + ' ') && m.includes(a.split(' ')[1] ?? '')));
}

export function wakeLandUse(typeUse: string | null, landClass: string | null, heated: number | null, style: string | null = null): LandUse {
  const t = (typeUse ?? '').toUpperCase(), l = (landClass ?? '').toUpperCase(), st = (style ?? '').toUpperCase();
  if (!heated && (/VACANT|RESIDENTIAL/.test(l) || !t)) return 'land';
  if (/CONDO/.test(t) || st === 'CONDO') return 'condo';
  if (/TOWN/.test(t) || st === 'TOWNHOUSE') return 'townhouse';
  if (/DUP|TRI|FOUR|TWOFAM|MULT TEN/.test(t)) return 'multi_family';
  if (/SINGLFAM|RES CONV/.test(t)) return 'single_family';
  return 'other';
}

export function durhamLandUse(landClass: string | null, heated: number | null): LandUse {
  const l = (landClass ?? '').toUpperCase();
  if (/^VAC\s?RES|^VACRES|VACANT LAND/.test(l)) return 'land';
  if (/CONDO/.test(l) && /^RES/.test(l)) return 'condo';
  if (/TWNH/.test(l)) return 'townhouse';
  if (/2-FAMILY|3-FAMILY|4-FAMILY|DUPLEX/.test(l)) return 'multi_family';
  if (/1-FAMILY|RURAL RESID|1-MH/.test(l)) return heated ? 'single_family' : 'land';
  return 'other';
}

const ll = (f: Feature) => (f.centroid && Number.isFinite(f.centroid.x) ? { lat: Math.round(f.centroid.y * 1e6) / 1e6, lng: Math.round(f.centroid.x * 1e6) / 1e6 } : { lat: null, lng: null });

export const sources: Record<'wake' | 'durham', Source> = {
  wake: {
    key: 'wake', label: 'Wake County',
    url: 'https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/FeatureServer/0/query',
    fields: ['OBJECTID', 'REID', 'SITE_ADDRESS', 'CITY_DECODE', 'ZIPNUM', 'HEATEDAREA', 'YEAR_BUILT', 'TOTSALPRICE', 'SALE_DATE', 'TYPE_USE_DECODE', 'LAND_CLASS_DECODE', 'DEED_ACRES', 'TOTAL_VALUE_ASSD', 'OWNER', 'ADDR1', 'ADDR2', 'PROPDESC', 'DESIGN_STYLE_DECODE'],
    where: (since) => `SALE_DATE >= DATE '${since}' AND TOTSALPRICE > 50000`,
    addressField: 'SITE_ADDRESS', cityField: 'CITY_DECODE',
    map(f) {
      const a = f.attributes;
      const key = txt(a.REID);
      if (!key) return null;
      const heated = pos(a.HEATEDAREA);
      const landUse = wakeLandUse(txt(a.TYPE_USE_DECODE), txt(a.LAND_CLASS_DECODE), heated, txt(a.DESIGN_STYLE_DECODE));
      if (landUse === 'other') return null;
      const address = normalizeAddress(txt(a.SITE_ADDRESS));
      return {
        county: 'wake', parcelKey: key, address, street: streetOf(address), city: title(txt(a.CITY_DECODE)), zip: txt(a.ZIPNUM)?.slice(0, 5) ?? null,
        neighborhood: wakeSubdivision(txt(a.PROPDESC)), landUse, heatedSf: heated, yearBuilt: pos(a.YEAR_BUILT), acres: pos(a.DEED_ACRES),
        assessedValue: pos(a.TOTAL_VALUE_ASSD), ownerName: txt(a.OWNER), absentee: absentee(address, txt(a.ADDR1)),
        ...ll(f), lastSalePrice: pos(a.TOTSALPRICE), lastSaleOn: day(a.SALE_DATE),
      };
    },
  },
  durham: {
    key: 'durham', label: 'Durham County',
    url: 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Parcels_NEW/FeatureServer/0/query',
    fields: ['OBJECTID', 'REID', 'LOCATION_ADDR', 'PHYADDR_CITY', 'PHYADDR_ZIP', 'NEIGHBORHOOD', 'HEATED_AREA', 'PKG_SALE_PRICE', 'PKG_SALE_DATE', 'LAND_CLASS', 'PROPERTY_OWNER', 'OWNER_MAIL_1', 'TOTAL_PROP_VALUE', 'CALCULATED_ACRES'],
    where: (since) => `PKG_SALE_DATE >= DATE '${since}' AND PKG_SALE_PRICE > 50000`,
    addressField: 'LOCATION_ADDR', cityField: 'PHYADDR_CITY',
    map(f) {
      const a = f.attributes;
      const key = txt(a.REID) ?? (num(a.REID) ? String(num(a.REID)) : null);
      if (!key) return null;
      const heated = pos(a.HEATED_AREA);
      const landUse = durhamLandUse(txt(a.LAND_CLASS), heated);
      if (landUse === 'other') return null;
      const address = normalizeAddress(txt(a.LOCATION_ADDR));
      return {
        county: 'durham', parcelKey: key, address, street: streetOf(address), city: title(txt(a.PHYADDR_CITY)), zip: txt(String(a.PHYADDR_ZIP ?? ''))?.slice(0, 5) ?? null,
        neighborhood: title(txt(a.NEIGHBORHOOD)), landUse, heatedSf: heated, yearBuilt: null, acres: pos(a.CALCULATED_ACRES),
        assessedValue: pos(a.TOTAL_PROP_VALUE), ownerName: txt(a.PROPERTY_OWNER), absentee: absentee(address, txt(a.OWNER_MAIL_1)),
        ...ll(f), lastSalePrice: pos(a.PKG_SALE_PRICE), lastSaleOn: day(a.PKG_SALE_DATE),
      };
    },
  },
};
export const isCounty = (v: string | null | undefined): v is keyof typeof sources => v === 'wake' || v === 'durham';

/** The ArcGIS query for one page of sales (oldest object first, so paging is stable). */
export function pageQuery(src: Source, since: string, offset: number, size = 1000): URLSearchParams {
  return new URLSearchParams({
    where: src.where(since), outFields: src.fields.join(','), returnGeometry: 'false', returnCentroid: 'true', outSR: '4326',
    orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: String(size), f: 'json',
  });
}
