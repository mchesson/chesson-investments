// The roles a person or company can have with us, each with its own stages.
// Data, not screens: a new role is one entry here. Pure, tested in roles.test.ts.

export type RoleKey =
  | 'personal' | 'gc' | 'sub' | 'supplier' | 'agent' | 'wholesaler' | 'lender' | 'attorney'
  | 'designer' | 'property_manager' | 'investor' | 'landowner' | 'networking';

export type RoleDef = {
  key: RoleKey;
  label: string;
  plural: string;
  stages: readonly { key: string; label: string }[];
  /** Has trade, areas and license # (contractors). */
  trade?: boolean;
  /** Days without a touch before they show on Going Cold (a setting later). */
  coldDays: number;
  /** Stages that never show on Going Cold (e.g. Avoid). */
  quietStages?: readonly string[];
};

const contractorStages = [
  { key: 'met', label: 'Met' },
  { key: 'talking', label: 'Talking' },
  { key: 'bid', label: 'Bid' },
  { key: 'hired', label: 'Hired' },
  { key: 'preferred', label: 'Preferred' },
  { key: 'avoid', label: 'Avoid' },
] as const;

const relationshipStages = [
  { key: 'met', label: 'Met' },
  { key: 'talking', label: 'Talking' },
  { key: 'working', label: 'Working Together' },
  { key: 'preferred', label: 'Preferred' },
  { key: 'avoid', label: 'Avoid' },
] as const;

export const roles: readonly RoleDef[] = [
  { key: 'gc', label: 'General Contractor', plural: 'General Contractors', stages: contractorStages, trade: true, coldDays: 60, quietStages: ['avoid'] },
  { key: 'sub', label: 'Subcontractor', plural: 'Subcontractors', stages: contractorStages, trade: true, coldDays: 60, quietStages: ['avoid'] },
  { key: 'supplier', label: 'Supplier', plural: 'Suppliers', stages: relationshipStages, trade: true, coldDays: 90, quietStages: ['avoid'] },
  {
    key: 'agent', label: 'Real Estate Agent / Broker', plural: 'Agents and Brokers', coldDays: 30,
    stages: [
      { key: 'met', label: 'Met' },
      { key: 'talking', label: 'Talking' },
      { key: 'sent_deal', label: 'Sent a Deal' },
      { key: 'closed_deal', label: 'Closed a Deal' },
    ],
  },
  {
    key: 'wholesaler', label: 'Wholesaler / Deal Source', plural: 'Wholesalers and Deal Sources', coldDays: 30,
    stages: [
      { key: 'met', label: 'Met' },
      { key: 'talking', label: 'Talking' },
      { key: 'sent_deal', label: 'Sent a Deal' },
      { key: 'closed_deal', label: 'Closed a Deal' },
    ],
  },
  { key: 'lender', label: 'Lender / Loan Officer', plural: 'Lenders', stages: relationshipStages, coldDays: 90, quietStages: ['avoid'] },
  { key: 'attorney', label: 'Attorney / Title', plural: 'Attorneys and Title', stages: relationshipStages, coldDays: 120, quietStages: ['avoid'] },
  { key: 'designer', label: 'Designer / Engineer / Surveyor', plural: 'Designers, Engineers and Surveyors', stages: relationshipStages, trade: true, coldDays: 90, quietStages: ['avoid'] },
  { key: 'property_manager', label: 'Property Manager', plural: 'Property Managers', stages: relationshipStages, coldDays: 90, quietStages: ['avoid'] },
  {
    key: 'investor', label: 'Investor', plural: 'Investors', coldDays: 45,
    stages: [
      { key: 'met', label: 'Met' },
      { key: 'interested', label: 'Interested' },
      { key: 'committed', label: 'Committed' },
      { key: 'invested', label: 'Invested' },
      { key: 'not_now', label: 'Not Now' },
    ],
    quietStages: ['not_now'],
  },
  {
    key: 'landowner', label: 'Landowner / Seller', plural: 'Landowners and Sellers', coldDays: 60,
    stages: [
      { key: 'met', label: 'Met' },
      { key: 'talking', label: 'Talking' },
      { key: 'offer_made', label: 'Offer Made' },
      { key: 'sold_to_us', label: 'Sold to Us' },
      { key: 'not_selling', label: 'Not Selling' },
    ],
    quietStages: ['sold_to_us', 'not_selling'],
  },
  {
    // Friends and family who introduce us to people but aren't in the business
    // themselves (owner, Oct 2, 2026). Kept apart with "Business Contacts Only".
    key: 'personal', label: 'Personal Connection', plural: 'Personal Connections', coldDays: 180,
    stages: [
      { key: 'friend', label: 'Friend' },
      { key: 'family', label: 'Family' },
      { key: 'acquaintance', label: 'Acquaintance' },
    ],
  },
  {
    key: 'networking', label: 'Networking Contact', plural: 'Networking Contacts', coldDays: 90,
    stages: [
      { key: 'met', label: 'Met' },
      { key: 'keeping_in_touch', label: 'Keeping in Touch' },
    ],
  },
];

export const roleKeys = roles.map((r) => r.key) as RoleKey[];

export function roleDef(key: string): RoleDef | undefined {
  return roles.find((r) => r.key === key);
}

export function roleLabel(key: string): string {
  return roleDef(key)?.label ?? key;
}

export function stageLabel(role: string, stage: string): string {
  return roleDef(role)?.stages.find((s) => s.key === stage)?.label ?? stage;
}

export function isStage(role: string, stage: string): boolean {
  return !!roleDef(role)?.stages.some((s) => s.key === stage);
}

export function firstStage(role: string): string {
  const def = roleDef(role);
  if (!def) throw new Error(`Unknown role ${role}`);
  return def.stages[0].key;
}

/** Days since the last touch, or null if never touched. */
export function daysSince(lastOn: string | null, today: string): number | null {
  if (!lastOn) return null;
  const a = Date.UTC(+lastOn.slice(0, 4), +lastOn.slice(5, 7) - 1, +lastOn.slice(8, 10));
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Going Cold: a person is cold for a role when that role is live, not in a
 * quiet stage, and their last touch (any kind) is older than the role's days
 * (or they were never touched and the role is older than that).
 */
export function isCold(
  role: { role: string; stage: string; createdOn: string },
  lastTouchOn: string | null,
  today: string,
): boolean {
  const def = roleDef(role.role);
  if (!def) return false;
  if (def.quietStages?.includes(role.stage)) return false;
  const since = daysSince(lastTouchOn ?? role.createdOn, today);
  return since !== null && since > def.coldDays;
}
