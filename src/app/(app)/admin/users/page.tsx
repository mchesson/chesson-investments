import { asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { guestAccess, projects, users } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { allPermissions, effectivePermissions, permissionGroups, roleNames, type Role } from '@/lib/permissions';
import { defaultAbilities, guestAbilities, isLive } from '@/lib/guests';
import { companyOptions, peopleOptions } from '@/lib/contacts';
import { mailReady } from '@/lib/mail';
import { formatDate, formatDateTime, today } from '@/lib/format';
import { Empty, PageHead, Section } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { addUser, inviteGuest, newGuestLink, setGuestAccess, setUserPermissions, setUserRole } from '../../admin-actions';

export const metadata = { title: 'Users and Access' };
const assignable: Role[] = ['owner', 'staff', 'accountant', 'pending'];

function PermissionBoxes({ id, role, own }: { id: string; role: Role; own: string[] | null }) {
  const on = effectivePermissions(role, own);
  return (
    <>
      <ActionForm action={setUserPermissions} submit="Save Access" submitClass="btn small">
        <input type="hidden" name="id" value={id} />
        <div className="perm-groups">{permissionGroups.map((g) => (
          <fieldset key={g.label} className="perm-group">
            <legend>{g.label}</legend>
            {g.items.map((p) => (
              <label key={p.key} className="check"><input type="checkbox" name="perm" value={p.key} defaultChecked={on.includes(p.key)} /> {p.label}</label>
            ))}
          </fieldset>
        ))}</div>
      </ActionForm>
      {own ? (
        <ActionForm action={setUserPermissions} submit={`Back to the ${roleNames[role]} Standard Set`} submitClass="link-btn small">
          <input type="hidden" name="id" value={id} /><input type="hidden" name="standard" value="1" />
        </ActionForm>
      ) : <p className="small muted" style={{ margin: '6px 0 0' }}>Using the {roleNames[role]} standard set.</p>}
    </>
  );
}

function AbilityBoxes({ picked }: { picked: readonly string[] }) {
  return (
    <div className="role-pick">{guestAbilities.map((a) => (
      <label key={a.key} className="role-btn"><input type="checkbox" name="can" value={a.key} defaultChecked={picked.includes(a.key)} /><span>{a.label}</span></label>
    ))}</div>
  );
}

export default async function Users() {
  await requirePage('users.manage');
  const [rows, access, ps, people, cos] = await Promise.all([
    db.select().from(users).orderBy(asc(users.email)),
    db.select({ a: guestAccess, project: projects.name }).from(guestAccess).leftJoin(projects, eq(projects.id, guestAccess.projectId)).where(isNull(guestAccess.removed)),
    db.select({ id: projects.id, name: projects.name, number: projects.projectNumber }).from(projects).where(isNull(projects.archived)).orderBy(asc(projects.name)),
    peopleOptions(), companyOptions(),
  ]);
  const staff = rows.filter((u) => u.role !== 'guest');
  const guests = rows.filter((u) => u.role === 'guest');
  const t = today();
  return (
    <>
      <PageHead title="Users and Access" sub="Each person’s access is a set of checkboxes. Technical Source staff sign in with Microsoft; outside people (contractors, partners) are guests who see only the projects you invite them to." />
      {!mailReady() ? <div className="notice warn"><strong>Email isn’t set up yet.</strong> Invitations and sign-in links are shown here to copy and send yourself (by text or your own email) until the app’s email is connected.</div> : null}
      <div className="stack">
        <Section title="People Who Can Sign In" kind="blue" hint={`${staff.length}`}>
          <ul className="user-list">{staff.map((u) => (
            <li key={u.id} className="user-card">
              <div className="user-head">
                <div className="user-who"><strong>{u.name ?? u.email}</strong><div className="small muted">{u.email} · last sign-in {formatDateTime(u.lastSignIn) || 'never'}</div></div>
                <ActionForm action={setUserRole} className="inline-form" submit="Save" submitClass="btn small">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} aria-label="Role">{assignable.map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}</select>
                  <label className="check"><input type="checkbox" name="active" defaultChecked={u.active} /> Can sign in</label>
                </ActionForm>
              </div>
              {(u.role === 'staff' || u.role === 'owner') && !u.email.endsWith('@technicalsource.com') && !u.email.endsWith('@example.com') ? (
                <p className="notice warn" style={{ margin: 0 }}>This isn’t a Technical Source account, so they can’t sign in with Microsoft. If they’re a contractor or partner, invite them below under <strong>Invite a Guest</strong> with this same email: they become a guest and get a sign-in link.</p>
              ) : null}
              {u.role === 'owner' ? <p className="small muted" style={{ margin: 0 }}>Owner: everything, always.</p>
                : u.role === 'pending' ? <p className="small muted" style={{ margin: 0 }}>Waiting for access: pick a role, then tick what they can do.</p> : (
                  <details className="fold"><summary>What They Can Do ({effectivePermissions(u.role, u.permissions).length} of {allPermissions.length})</summary>
                    <PermissionBoxes id={u.id} role={u.role} own={u.permissions} />
                  </details>
                )}
              {u.role === 'accountant' && !u.email.endsWith('@technicalsource.com') ? (
                <ActionForm action={newGuestLink} submit="Send a New Sign-In Link" submitClass="link-btn small"><input type="hidden" name="id" value={u.id} /></ActionForm>
              ) : null}
            </li>
          ))}</ul>
        </Section>

        <Section title="Guests (Outside People)" kind="aqua" hint={`${guests.length}`}>
          {guests.length ? <ul className="user-list">{guests.map((g) => {
            const mine = access.filter((x) => x.a.userId === g.id);
            return (
              <li key={g.id} className="user-card">
                <div className="user-head">
                  <div className="user-who"><strong>{g.name ?? g.email}</strong><div className="small muted">{g.email} · last sign-in {formatDateTime(g.lastSignIn) || 'never'}</div></div>
                  <ActionForm action={setUserRole} className="inline-form" submit="Save" submitClass="btn small">
                    <input type="hidden" name="id" value={g.id} /><input type="hidden" name="role" value="guest" />
                    <label className="check"><input type="checkbox" name="active" defaultChecked={g.active} /> Can sign in</label>
                  </ActionForm>
                </div>
                {mine.length ? <ul className="rows">{mine.map(({ a, project }) => (
                  <li key={a.id}>
                    <strong>{project}</strong> {isLive(a, t) ? <span className="small muted">{a.can.length} things{a.endsOn ? ` · until ${formatDate(a.endsOn)}` : ''}</span> : <span className="chip red">Ended {a.endsOn ? formatDate(a.endsOn) : ''}</span>}
                    <details className="fold"><summary>What they can do here</summary>
                      <ActionForm action={setGuestAccess} submit="Save">
                        <input type="hidden" name="id" value={a.id} />
                        <AbilityBoxes picked={a.can} />
                        <label className="f">Last Day<span className="h">Optional: their access to this project ends after it</span><input type="date" name="endsOn" defaultValue={a.endsOn ?? ''} /></label>
                      </ActionForm>
                      <ActionForm action={setGuestAccess} submit="Take This Project Off Them" submitClass="link-btn small" confirm="Take this project off them?">
                        <input type="hidden" name="id" value={a.id} /><input type="hidden" name="remove" value="1" />
                      </ActionForm>
                    </details>
                  </li>
                ))}</ul> : <p className="small muted">No projects right now.</p>}
                <ActionForm action={newGuestLink} submit="Send a New Sign-In Link" submitClass="btn small secondary"><input type="hidden" name="id" value={g.id} /></ActionForm>
              </li>
            );
          })}</ul> : <Empty>No guests yet.</Empty>}
        </Section>

        <Section title="Invite a Guest" kind="energy" hint="A GC, a sub or a partner: they see only the projects you pick">
          <ActionForm action={inviteGuest} submit="Invite Them">
            <div className="fields">
              <label className="f">Their Email<input name="email" type="email" required /></label>
              <label className="f">Name<input name="name" /></label>
              <label className="f">Their Record<span className="h">Optional: the person on file</span>
                <select name="personId" defaultValue=""><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.companyName ? ` (${p.companyName})` : ''}</option>)}</select></label>
              <label className="f">Their Company<span className="h">They see the issues and commitments for it</span>
                <select name="companyId" defaultValue=""><option value="">—</option>{cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="f">Last Day<span className="h">Optional</span><input type="date" name="endsOn" /></label>
            </div>
            <fieldset className="f choice"><legend>Projects They Can See</legend>
              <div className="role-pick">{ps.map((p) => (
                <label key={p.id} className="role-btn"><input type="checkbox" name="project" value={p.id} /><span>{p.number ? `P-${p.number} ` : ''}{p.name}</span></label>
              ))}</div>
            </fieldset>
            <fieldset className="f choice"><legend>What They Can Do There<span className="h">They never see budgets, other vendors’ prices, profit or contacts</span></legend>
              <AbilityBoxes picked={defaultAbilities} />
            </fieldset>
          </ActionForm>
        </Section>

        <Section title="Add Staff or an Accountant" kind="grey" hint="Technical Source Microsoft accounts sign in with Microsoft; an outside accountant gets a sign-in link">
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
