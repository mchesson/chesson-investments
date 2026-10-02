// How we know someone. Pure, tested in how-met.test.ts.
export const howMetOptions = [
  { key: 'introduction', label: 'Introduction / Referral', needsIntroducer: true },
  { key: 'event', label: 'Met at an Event' },
  { key: 'job_site', label: 'Met on a Job Site' },
  { key: 'inbound', label: 'They Reached Out to Us' },
  { key: 'outbound', label: 'We Reached Out' },
  { key: 'online', label: 'Online (LinkedIn, BiggerPockets…)' },
  { key: 'other', label: 'Other' },
] as const;

export type HowMet = (typeof howMetOptions)[number]['key'];
export const isHowMet = (v: string | null): v is HowMet => !!v && howMetOptions.some((o) => o.key === v);
export const howMetLabel = (v: string | null) => howMetOptions.find((o) => o.key === v)?.label ?? null;

/** What's wrong with the "how we know them" answers, if anything. */
export function howMetProblem(f: { howMet: string | null; introducedById: string | null; newIntroducer: string | null; selfId?: string | null }): string | null {
  if (f.howMet && !isHowMet(f.howMet)) return 'Pick how we know them.';
  if (f.introducedById && f.newIntroducer) return 'Pick the person who introduced them, or type a new name, not both.';
  if (f.selfId && f.introducedById === f.selfId) return 'Someone can’t introduce themselves.';
  if (f.howMet === 'introduction' && !f.introducedById && !f.newIntroducer) return 'Who introduced them? Pick them, or type their name to add them.';
  return null;
}

/** "Jane Smith" → first and last name for a new introducer record. */
export function splitName(full: string): { firstName: string; lastName: string } | null {
  const parts = full.trim().replace(/\s+/g, ' ').split(' ');
  if (parts.length < 2) return null;
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}
