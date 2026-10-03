// Turning a typed address into what the county address points are keyed by
// (house number and street name). Pure, tested in locate-rules.test.ts.

const SUFFIXES = new Set(['ST', 'STREET', 'AVE', 'AVENUE', 'AV', 'RD', 'ROAD', 'DR', 'DRIVE', 'LN', 'LANE', 'CT', 'COURT', 'CIR', 'CIRCLE', 'BLVD', 'BOULEVARD', 'PL', 'PLACE', 'WAY', 'TRL', 'TRAIL', 'PKWY', 'PARKWAY', 'TER', 'TERRACE', 'HWY', 'HIGHWAY', 'LOOP', 'RUN', 'PT', 'POINT', 'XING', 'CV', 'COVE', 'ALY', 'ALLEY', 'SQ', 'PATH', 'WALK', 'PIKE', 'BND', 'BEND', 'GLN', 'GLEN', 'RDG', 'RIDGE', 'HL', 'HILL', 'XRD']);
const DIRS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST']);

export type AddressKey = { number: number; street: string; unit: string | null };

/** "109 Plainview Ave" → { number: 109, street: 'PLAINVIEW' }; "613 S Ocean Blvd Unit N3" → OCEAN, unit N3. Null if there's no house number. */
export function addressKey(address: string | null | undefined): AddressKey | null {
  if (!address) return null;
  let s = address.toUpperCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
  let unit: string | null = null;
  const u = s.match(/\s(?:UNIT|APT|STE|SUITE|BLDG)\s+(\S+)$/);
  if (u) { unit = u[1]; s = s.slice(0, u.index).trim(); }
  const m = s.match(/^(\d+)[A-Z]?\s+(.+)$/);
  if (!m) return null;
  const words = m[2].split(' ');
  if (words.length > 1 && DIRS.has(words[0])) words.shift();
  while (words.length > 1 && (SUFFIXES.has(words[words.length - 1]) || DIRS.has(words[words.length - 1]))) words.pop();
  return { number: Number(m[1]), street: words.join(' '), unit };
}

/** SQL-safe text for an ArcGIS where clause (quotes doubled, nothing else odd). */
export const arcText = (s: string) => s.replace(/[^A-Z0-9 '-]/gi, '').replace(/'/g, "''");
