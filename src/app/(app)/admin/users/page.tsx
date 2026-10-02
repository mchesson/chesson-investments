import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { roleNames, type Role } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { PageHead, Section } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { addUser, setUserRole } from '../../admin-actions';

export const metadata = { title: 'Users and Access' };
const assignable: Role[] = ['owner', 'staff', 'accountant', 'pending'];

export default async function Users() {
  await requirePage('users.manage');
  const rows = await db.select().from(users).orderBy(asc(users.email));
  return (
    <>
      <PageHead title="Users and Access" sub="Owner: everything. Staff: contacts, watchlist and projects (later: no tax returns, PFS or investor money). Accountant: project money and bills only." />
      <div className="stack">
        <Section title="People Who Can Sign In" hint={`${rows.length}`}>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Who</th><th>Last Sign-In</th><th>Access</th></tr></thead>
            <tbody>{rows.map((u) => (
              <tr key={u.id}>
                <td>{u.name ?? '—'}<div className="small muted">{u.email}</div></td>
                <td className="small">{formatDateTime(u.lastSignIn)}</td>
                <td>
                  <ActionForm action={setUserRole} className="inline-form" submit="Save" submitClass="btn small">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} aria-label="Role">{assignable.map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}</select>
                    <label className="check"><input type="checkbox" name="active" defaultChecked={u.active} /> Can sign in</label>
                  </ActionForm>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </Section>
        <Section title="Add Someone" kind="grey" hint="Their Microsoft 365 email at Technical Source">
          <ActionForm action={addUser} submit="Add" resetOnOk>
            <div className="fields">
              <label className="f">Email<input name="email" type="email" required /></label>
              <label className="f">Name<input name="name" /></label>
              <label className="f">Role<select name="role" defaultValue="staff">{assignable.filter((r) => r !== 'pending').map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}</select></label>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
