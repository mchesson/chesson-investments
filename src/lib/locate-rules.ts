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

/**
 * A name that only says the address again ("420 Peyton Street" for "420 Peyton
 * St"): shown once, not twice (Oct 3, 2026, Peyton listed twice on Projects).
 * Every screen that shows a name with its address uses this.
 */
export function sameAsAddress(name: string | null | undefined, address: string | null | undefined): boolean {
  const flat = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!name || !address) return !name === !address ? flat(name) === flat(address) : false;
  if (flat(name) === flat(address)) return true;
  const a = addressKey(name), b = addressKey(address);
  return !!a && !!b && a.number === b.number && a.street === b.street && (a.unit ?? '') === (b.unit ?? '');
}

export type AddressParts = { street: string; city: string | null; state: string | null; zip: string | null };
/**
 * One address typed the way people write it ("109 Plainview Ave, Raleigh, NC
 * 27604", "109 Plainview Ave Raleigh NC", "109 Plainview Ave") split into the
 * parts the county lookups use (owner, Oct 3, 2026: "it should all be together
 * as long as the system can look things up").
 */
export function splitAddress(text: string | null | undefined): AddressParts {
  const s = (text ?? '').replace(/\s+/g, ' ').trim();
  let rest = s, zip: string | null = null, state: string | null = null, city: string | null = null;
  const z = rest.match(/[ ,]+(\d{5})(?:-\d{4})?$/);
  if (z) { zip = z[1]; rest = rest.slice(0, z.index).trim(); }
  const st = rest.match(/[ ,]+(NC|SC|VA|GA|TN|FL|North Carolina|South Carolina)$/i);
  if (st) { state = st[1].length === 2 ? st[1].toUpperCase() : st[1].toLowerCase().startsWith('north') ? 'NC' : 'SC'; rest = rest.slice(0, st.index).trim(); }
  const parts = rest.split(',').map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) { city = parts.pop()!; rest = parts.join(', '); }
  return { street: rest.replace(/,\s*$/, ''), city, state, zip };
}
/** The parts written as one line. */
export const joinAddress = (p: { address: string | null; city?: string | null; state?: string | null; zip?: string | null }) =>
  [p.address, p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter((x) => x && String(x).trim()).join(', ');
