// Cities and states that fill in as you type (owner, Oct 2, 2026: "auto load
// cities and states on the map or any drop downs"). The Triangle and nearby
// towns first, then every city already on a record (PlaceLists). Pure.

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'],
  ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'],
  ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const;

/** Wake, Durham, Orange, Chatham, Johnston and nearby: where we buy and build. */
export const AREA_CITIES = [
  'Raleigh', 'Durham', 'Cary', 'Apex', 'Morrisville', 'Holly Springs', 'Fuquay-Varina', 'Garner', 'Knightdale', 'Wake Forest', 'Rolesville',
  'Wendell', 'Zebulon', 'Chapel Hill', 'Carrboro', 'Hillsborough', 'Pittsboro', 'Clayton', 'Smithfield', 'Angier', 'Youngsville', 'Franklinton',
  'Creedmoor', 'Butner', 'Mebane', 'Burlington', 'Sanford', 'Benson', 'Willow Spring', 'New Hill', 'Bahama', 'Rougemont',
] as const;

/** One list of cities: ours first, then the rest on file, no repeats (case doesn't matter). */
export function cityList(onFile: (string | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [...AREA_CITIES, ...onFile.filter(Boolean).sort()] as string[]) {
    const k = c.trim().toLowerCase();
    if (k && !seen.has(k)) { seen.add(k); out.push(c.trim()); }
  }
  return out;
}
