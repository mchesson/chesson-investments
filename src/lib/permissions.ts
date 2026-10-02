// Who may do what. Data, not scattered checks. Pure, tested in permissions.test.ts.

export type Role = 'pending' | 'owner' | 'staff' | 'accountant';

export type Permission =
  | 'contacts.view' | 'contacts.edit'
  | 'properties.view' | 'properties.edit'
  | 'projects.view' | 'projects.edit'
  | 'money.view' | 'bills.edit' | 'bills.approve' | 'bills.pay'
  | 'users.manage'
  // Later phases (nothing uses these yet): tax returns, PFS, investor money.
  | 'sensitive.view';

const grants: Record<Role, Permission[]> = {
  pending: [],
  owner: [
    'contacts.view', 'contacts.edit', 'properties.view', 'properties.edit', 'projects.view', 'projects.edit',
    'money.view', 'bills.edit', 'bills.approve', 'bills.pay', 'users.manage', 'sensitive.view',
  ],
  staff: [
    'contacts.view', 'contacts.edit', 'properties.view', 'properties.edit', 'projects.view', 'projects.edit',
    'money.view', 'bills.edit',
  ],
  accountant: ['projects.view', 'money.view', 'bills.edit', 'bills.pay'],
};

export const roleNames: Record<Role, string> = {
  pending: 'Waiting for Access', owner: 'Owner', staff: 'Staff', accountant: 'Accountant',
};

export function can(role: Role | null | undefined, p: Permission): boolean {
  return !!role && grants[role].includes(p);
}

export const isRole = (v: string): v is Role => v in grants;
