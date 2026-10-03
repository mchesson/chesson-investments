// Who may do what. Data, not scattered checks. Pure, tested in rules.test.ts.
// Each role starts with a set of permissions; the owner can tick or untick any
// of them for one person (owner, Oct 2, 2026: "a checkbox with all the
// available things on the app"), kept in users.permissions.

export type Role = 'pending' | 'owner' | 'admin' | 'staff' | 'accountant' | 'partner' | 'guest';

/** Every permission, grouped as the Users page shows them. */
export const permissionGroups = [
  { label: 'People and Companies', items: [
    { key: 'contacts.view', label: 'See people and companies' },
    { key: 'contacts.edit', label: 'Add and change people and companies' },
    { key: 'vendors.grade', label: 'Grade contractors and log their issues' },
  ] },
  { label: 'Watchlist and Market', items: [
    { key: 'properties.view', label: 'See the watchlist and the Market Map' },
    { key: 'properties.edit', label: 'Add and change watched properties' },
    { key: 'market.update', label: 'Update the market data from the counties' },
  ] },
  { label: 'Projects', items: [
    { key: 'projects.view', label: 'See projects (schedule, daily log, documents)' },
    { key: 'projects.edit', label: 'Change projects, schedules, rentals and the daily log' },
    { key: 'website.edit', label: 'Edit the public website' },
  ] },
  { label: 'Money', items: [
    { key: 'money.view', label: 'See budgets, bids, bills and profit' },
    { key: 'bills.edit', label: 'Enter bills and receipts' },
    { key: 'bills.approve', label: 'Approve bills' },
    { key: 'bills.pay', label: 'Mark bills paid' },
    { key: 'budgets.approve', label: 'Approve budgets and pick the winning bid' },
  ] },
  { label: 'Running the App', items: [
    { key: 'import.run', label: 'Import files' },
    { key: 'records.delete', label: 'See archived records, clean up duplicates, delete permanently' },
    { key: 'history.all', label: 'See everyone’s History' },
    { key: 'users.manage', label: 'Manage users, access and guests' },
    { key: 'sensitive.view', label: 'See restricted records (tax returns, PFS, W-9s)' },
  ] },
] as const;

export type Permission = (typeof permissionGroups)[number]['items'][number]['key'];
export const allPermissions: Permission[] = permissionGroups.flatMap((g) => g.items.map((i) => i.key));
export const isPermission = (v: string): v is Permission => (allPermissions as string[]).includes(v);

export const roleDefaults: Record<Role, Permission[]> = {
  pending: [],
  owner: allPermissions,
  // Admin: runs the app with the owner (users, imports, cleanup, approvals), but
  // not restricted records unless the owner ticks it for them.
  admin: allPermissions.filter((p) => p !== 'sensitive.view'),
  staff: [
    'contacts.view', 'contacts.edit', 'vendors.grade', 'properties.view', 'properties.edit', 'market.update',
    'projects.view', 'projects.edit', 'website.edit', 'money.view', 'bills.edit',
  ],
  accountant: ['projects.view', 'money.view', 'bills.edit', 'bills.pay'],
  // Partners we look at deals with (owner, Oct 3, 2026: Jason DeGroff and James
  // Bailey, "I want him to see everything but is not a TS person"): everything
  // but restricted records, managing users and deleting permanently. They sign
  // in with an emailed link.
  partner: allPermissions.filter((p) => p !== 'sensitive.view' && p !== 'users.manage' && p !== 'records.delete'),
  // Guests (contractors, partners) never use the staff pages: they see only the
  // projects they're invited to, through /guest, with that project's checkboxes.
  guest: [],
};

export const roleNames: Record<Role, string> = {
  pending: 'Waiting for Access', owner: 'Owner', admin: 'Admin', staff: 'Staff', accountant: 'Accountant', partner: 'Partner (Sees Everything)', guest: 'Outside Partner',
};

/** The owner's own standard sets per role (Users page → Standard Access by Type), saved in app_settings. */
export type RoleStandards = Partial<Record<'admin' | 'staff' | 'accountant' | 'partner', string[]>>;
export const editableRoles = ['admin', 'staff', 'accountant', 'partner'] as const;
/** Roles for people outside Technical Source: they sign in with an emailed link, not Microsoft. */
export const linkRoles: Role[] = ['guest', 'accountant', 'partner'];

/** A role's standard set: the owner's if saved, else the built-in one. */
export function roleStandard(role: Role, standards?: RoleStandards | null): Permission[] {
  if (role === 'owner') return allPermissions;
  if (role === 'pending' || role === 'guest') return [];
  const saved = standards?.[role];
  return saved ? saved.filter(isPermission) : roleDefaults[role];
}

/** A person's permissions: their own ticked list if the owner set one, else their role's standard. */
export function effectivePermissions(role: Role, own: string[] | null | undefined, standards?: RoleStandards | null): Permission[] {
  if (role === 'pending' || role === 'guest') return [];
  if (role === 'owner') return allPermissions; // the owner can never lock themselves out
  return own ? own.filter(isPermission) : roleStandard(role, standards);
}

type Who = Role | { role: Role; permissions?: Permission[] } | null | undefined;
export function can(who: Who, p: Permission): boolean {
  if (!who) return false;
  if (typeof who === 'string') return roleDefaults[who].includes(p);
  return (who.permissions ?? roleDefaults[who.role]).includes(p);
}

export const isRole = (v: string): v is Role => v in roleDefaults;

const items: readonly { key: string; label: string }[] = permissionGroups.flatMap((g) => g.items as readonly { key: string; label: string }[]);
export const permissionLabel = (p: string) => items.find((i) => i.key === p)?.label ?? p;

/** Only the owner changes owners and admins, and only the owner gives restricted-record access. */
export function mayManage(me: { id: string; role: Role }, target: { id: string; role: Role }, toRole?: Role): string | null {
  if (me.role === 'owner') return null;
  if (target.id === me.id) return 'Ask the owner to change your own access.';
  if (target.role === 'owner' || target.role === 'admin') return 'Only the owner changes an Owner or an Admin.';
  if (toRole === 'owner' || toRole === 'admin') return 'Only the owner can make someone an Owner or an Admin.';
  return null;
}
