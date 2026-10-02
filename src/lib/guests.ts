// Guests: outside people (a GC, a sub, a partner) invited to one or more
// projects (owner, Oct 2, 2026: "invite people outside the Chesson inv org like
// a GC to certain parts of the app"). What they may do is ticked per project.
// They never see budgets, other vendors' prices, the P&L or contacts. Pure,
// tested in guests.test.ts.
import { createHash, randomBytes } from 'node:crypto';

export const guestAbilities = [
  { key: 'overview', label: 'See the project (address, stage)' },
  { key: 'schedule', label: 'See the schedule and their own commitments' },
  { key: 'daily_log', label: 'See the daily log' },
  { key: 'daily_log.add', label: 'Add to the daily log' },
  { key: 'issues', label: 'See and answer the issues with them' },
] as const;
export type GuestAbility = (typeof guestAbilities)[number]['key'];
export const isGuestAbility = (v: string): v is GuestAbility => guestAbilities.some((a) => a.key === v);
/** A GC usually gets all of it. */
export const defaultAbilities: GuestAbility[] = ['overview', 'schedule', 'daily_log', 'daily_log.add', 'issues'];

/** Clean the ticked list; adding to the daily log means seeing it; anything means seeing the project. */
export function cleanAbilities(xs: string[]): GuestAbility[] {
  const set = new Set(xs.filter(isGuestAbility));
  if (set.has('daily_log.add')) set.add('daily_log');
  if (set.size) set.add('overview');
  return guestAbilities.map((a) => a.key).filter((k) => set.has(k));
}

export type Access = { projectId: string; can: string[]; endsOn: string | null; removed: Date | null };
/** Still on: not taken off, and not past its last day. */
export const isLive = (a: Access, today: string) => !a.removed && (!a.endsOn || a.endsOn >= today);
export const mayGuest = (a: Access | undefined, ability: GuestAbility, today: string) => !!a && isLive(a, today) && a.can.includes(ability);

// Sign-in links: a random token in the link; only its SHA-256 is stored.
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const looksLikeToken = (t: string | null | undefined): t is string => !!t && /^[A-Za-z0-9_-]{40,60}$/.test(t);
/** An invite works for 7 days; a link asked for at sign-in, for 30 minutes. */
export const linkDays = { invite: 7, sign_in: 1 / 48 } as const;

/** How long a session lasts: guests 30 days (no Microsoft account to come back with), staff 12 hours. */
export const sessionHours = (role: string, provider: string | null | undefined) => (role === 'guest' || provider === 'link' ? 30 * 24 : 12);
