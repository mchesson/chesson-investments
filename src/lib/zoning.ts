// Zoning in plain words (owner, Oct 3, 2026: "We need to consider all zoning
// regulations when looking at properties so that needs to be a filter"). A zone
// code from the county map → its family (what kind of building it's for) and a
// short description, with the town's own ordinance to check the details.
// Pure, tested in zoning.test.ts. Never the final word: the ordinance is.

export const zoningFamilies = [
  { key: 'houses', label: 'Houses', hint: 'Detached houses' },
  { key: 'houses_plus', label: 'Houses and Townhomes', hint: 'Houses plus duplexes or townhomes' },
  { key: 'multi', label: 'Apartments / Multifamily' },
  { key: 'mixed', label: 'Mixed Use', hint: 'Homes, shops and offices together' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'office', label: 'Office / Institutional' },
  { key: 'industrial', label: 'Industrial' },
  { key: 'planned', label: 'Planned Development', hint: 'Its own approved plan decides' },
  { key: 'rural', label: 'Rural / Agricultural' },
  { key: 'conservation', label: 'Conservation / Open Space' },
  { key: 'other', label: 'Other' },
] as const;
export type ZoningFamily = (typeof zoningFamilies)[number]['key'];
export const isZoningFamily = (v: string | null | undefined): v is ZoningFamily => zoningFamilies.some((f) => f.key === v);
export const zoningFamilyLabel = (v: string | null | undefined) => zoningFamilies.find((f) => f.key === v)?.label ?? 'Not Known';

/** Each town's zoning rules, to check what the map says. */
export const ordinances: Record<string, string> = {
  Raleigh: 'https://udo.raleighnc.gov/',
  Durham: 'https://durhamnc.gov/1393/Unified-Development-Ordinance',
  Cary: 'https://www.carync.gov/projects-initiatives/land-development-ordinance',
  Apex: 'https://www.apexnc.org/337/Unified-Development-Ordinance',
  'Wake County': 'https://www.wake.gov/departments-government/planning-development-inspections/planning/unified-development-ordinance',
};

export type ZoningInfo = { code: string; place: string; family: ZoningFamily; label: string; detail: string; ordinance: string | null; overlays: string[] };

const perAcre = (n: number) => `about ${n} home${n === 1 ? '' : 's'} per acre`;

/** What a zone code means, from its code and the county's own description (if any). */
export function describeZoning(rawCode: string, place: string, countyLabel?: string | null): Omit<ZoningInfo, 'overlays'> {
  const code = rawCode.trim().toUpperCase().replace(/\s+/g, ' ');
  const base = code.replace(/\(D\)|\(CU\)|-CU$|-CZ$|\s*CZ$/g, '').replace(/-$/, '').trim();
  const conditional = /\(D\)|\(CU\)|-CU$|CZ$/.test(code) ? ' Conditional: the approved conditions also apply.' : '';
  const ord = ordinances[place] ?? null;
  const out = (family: ZoningFamily, label: string, detail: string) => ({ code: rawCode.trim(), place, family, label, detail: detail + conditional, ordinance: ord });
  let m: RegExpMatchArray | null;

  // Raleigh's residential districts: R-1 … R-10 are homes per acre.
  if ((m = base.match(/^R-(\d+)$/)) && place === 'Raleigh') {
    const n = Number(m[1]);
    return n >= 6
      ? out('houses_plus', countyLabel || `Residential-${n}`, `${perAcre(n)}; houses, and attached homes such as townhomes are allowed in this district.`)
      : out('houses', countyLabel || `Residential-${n}`, `${perAcre(n)}; mainly detached houses. Raleigh now allows some duplexes and cottage courts in more districts: check the lot.`);
  }
  // Durham: RS (suburban) and RU (urban) residential, RR rural, RC compact.
  if ((m = base.match(/^RS-(\d+)$/))) return out('houses', countyLabel || `Residential Suburban ${m[1]}`, `Detached houses on lots of about ${(Number(m[1]) * 1000).toLocaleString('en-US')} sq ft or more.`);
  if ((m = base.match(/^RU-(\d+)(\(2\))?$/))) return out(m[2] ? 'houses_plus' : 'houses', countyLabel || `Residential Urban ${m[1]}`, `Urban lots of about ${(Number(m[1]) * 1000).toLocaleString('en-US')} sq ft${m[2] ? '; duplexes allowed' : '; mainly detached houses'}.`);
  if (/^R[SU]-M$/.test(base)) return out('multi', countyLabel || 'Residential Multifamily', 'Apartments, townhomes and other attached homes.');
  if (base === 'RR') return out('rural', countyLabel || 'Rural Residential', 'Large rural lots, often on well and septic.');
  if (/^RC$/.test(base) && place === 'Durham') return out('houses_plus', countyLabel || 'Residential Compact', 'Small lots and attached homes near the center.');
  // Town districts named by lot size or density (Cary R-40, Wake R-80W, RM-12...).
  if ((m = base.match(/^RM-(\d+)/))) return out('multi', countyLabel || `Residential Multifamily ${m[1]}`, `${perAcre(Number(m[1]))}; attached and multifamily homes.`);
  if ((m = base.match(/^R-(\d+)/))) {
    const n = Number(m[1]);
    // Above 20 it's a minimum lot size in thousands of sq ft (R-40 = 40,000 sq ft); else homes per acre.
    return n > 20
      ? out(n >= 80 ? 'rural' : 'houses', countyLabel || `Residential ${n}`, `Detached houses on lots of about ${(n * 1000).toLocaleString('en-US')} sq ft or more.`)
      : out(n >= 8 ? 'houses_plus' : 'houses', countyLabel || `Residential ${n}`, `${perAcre(n)}.`);
  }
  // Apex and others: low, medium and high density residential.
  if (/^(LD|LDR|RLD)$/.test(base)) return out('houses', countyLabel || 'Low Density Residential', 'Detached houses on larger lots.');
  if (/^(MD|MDR|RMD)$/.test(base)) return out('houses_plus', countyLabel || 'Medium Density Residential', 'Houses, and townhomes in some places.');
  if (/^(HD|HDR|RHD)$/.test(base)) return out('multi', countyLabel || 'High Density Residential', 'Townhomes and apartments.');
  if (/^PDR|^PD$|^PUD|^PRD|^TND|^PD-/.test(base)) {
    const d = base.match(/PDR\s*([\d.]+)/);
    return out('planned', countyLabel || 'Planned Development', `Built to its own approved plan${d ? `, about ${Math.round(Number(d[1]))} homes per acre` : ''}. Read the plan for what's allowed.`);
  }
  // Raleigh's mixed-use districts: RX, NX, CX, DX, OX, IX (with stories after: CX-3).
  if ((m = base.match(/^(RX|NX|CX|DX|OX|IX|OP)-?(\d+)?/))) {
    const what: Record<string, [ZoningFamily, string]> = {
      RX: ['multi', 'Residential Mixed Use: homes of every kind, a little retail'], NX: ['mixed', 'Neighborhood Mixed Use: homes, shops and offices'],
      CX: ['mixed', 'Commercial Mixed Use: shops and offices, homes allowed'], DX: ['mixed', 'Downtown Mixed Use'],
      OX: ['office', 'Office Mixed Use: offices, homes allowed'], IX: ['industrial', 'Industrial Mixed Use: light industry, shops, homes allowed'], OP: ['office', 'Office Park'],
    };
    const [fam, lbl] = what[m[1]];
    return out(fam, countyLabel || lbl, `${lbl}${m[2] ? `, up to ${m[2]} stories` : ''}.`);
  }
  if (/^(MU|MXD|MX|CSD|DD|TC|TOD|VC|UC|NC)/.test(base)) return out('mixed', countyLabel || 'Mixed Use', 'Homes, shops and offices together; the district sets the mix and height.');
  if (/^(CG|CC|CN|CI|GC|GB|HB|NB|C-?\d|C$|SC|B-?\d|CB|RD|CMX)/.test(base)) return out('commercial', countyLabel || 'Commercial', 'Shops, restaurants and services; homes usually not by right.');
  if (/^(OI|O&I|OF|INST|CMP|RSCH|RAD|O-?\d)/.test(base)) return out('office', countyLabel || 'Office / Institutional', 'Offices, schools, churches, medical; some allow homes.');
  if (/^(I-?\d|IL|IH|IG|LI|HI|M-?\d|IND)/.test(base)) return out('industrial', countyLabel || 'Industrial', 'Warehouses, manufacturing and the like.');
  if (/^(AP|AG|A-?\d|RA|R-80W|R-40W|AR)/.test(base)) return out('rural', countyLabel || 'Agricultural / Rural', 'Farms and large lots.');
  if (/^(CM|OS|CON|PK|P$|GR)/.test(base)) return out('conservation', countyLabel || 'Conservation / Open Space', 'Kept open: building is limited or not allowed.');
  if (/^MH/.test(base)) return out('houses', countyLabel || 'Manufactured Housing', 'Manufactured homes and parks.');
  return out('other', countyLabel || code, 'Check the ordinance for what this district allows.');
}

/** The zone code from whichever field a town's map uses. */
export function zoneFieldsOf(attrs: Record<string, unknown>): { code: string | null; label: string | null } {
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = attrs[k];
      if (typeof v === 'string' && v.trim() && !/^(null|none)$/i.test(v.trim())) return v.trim();
    }
    return null;
  };
  return {
    code: pick(['UDO', 'UDO_LABEL', 'ZONE_TYPE', 'ZONING', 'ZONE_CODE', 'CLASS', 'ZONE_CLASS', 'ZONECLASS', 'ZONE', 'DISTRICT', 'ZONE_DIST', 'ZONING_CODE', 'ZN']),
    label: pick(['ZONE_TYPE_DECODE', 'ZONE_DESC', 'ZONEDESC', 'DESCRIPTION', 'ZONE_NAME', 'ZONING_DESC']),
  };
}

/** "Raleigh Zoning" (Wake's layer name) → "Raleigh"; "County Zoning" → "Wake County". */
export function placeOfLayer(name: string): string {
  const p = name.replace(/\s*Zoning( Overlay)?$/i, '').trim();
  return p === 'County' ? 'Wake County' : p;
}
