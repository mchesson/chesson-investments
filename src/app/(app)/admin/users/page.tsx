import { asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { guestAccess, projects, users } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { allPermissions, editableRoles, effectivePermissions, permissionGroups, roleNames, roleStandard, type Role, type RoleStandards } from '@/lib/permissions';
import { readStandards } from '@/lib/access-standards';
import { guestAbilities, guestTypeLabel, guestTypes, isGuestType, isLive, partnerStandard } from '@/lib/guests';
import { GuestTypeFields } from '@/components/GuestTypeFields';
import { companyOptions, peopleOptions } from '@/lib/contacts';
import { mailReady } from '@/lib/mail';
import { formatDate, formatDateTime, today } from '@/lib/format';
import { Empty, PageHead, Section } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { addUser, inviteGuest, newGuestLink, savePartnerStandard, saveRoleStandard, setGuestAccess, setGuestType, setUserPermissions, setUserRole, removeUser } from '../../admin-actions';
import { SearchPicker } from '@/components/SearchPicker';

export const metadata = { title: 'Users and Access' };
const assignable: Role[] = ['owner', 'admin', 'staff', 'partner', 'accountant', 'pending'];

function PermissionBoxes({ id, role, own, std }: { id: string; role: Role; own: string[] | null; std: RoleStandards }) {
  const on = effectivePermissions(role, own, std);
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
      ) : <p className="small muted" style={{ margin: '6px 0 0' }}>Using the {roleNames[role]} standard set (change it under Standard Access by Type).</p>}
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

function Boxes({ on }: { on: readonly string[] }) {
  return (
    <div className="perm-groups">{permissionGroups.map((g) => (
      <fieldset key={g.label} className="perm-group">
        <legend>{g.label}</legend>
        {g.items.map((p) => <label key={p.key} className="check"><input type="checkbox" name="perm" value={p.key} defaultChecked={on.includes(p.key)} /> {p.label}</label>)}
      </fieldset>
    ))}</div>
  );
}

export default async function Users() {
  const me = await requirePage('users.manage');
  const standards = await readStandards();
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
      <PageHead title="Users and Access" sub="Owner: everything. Admin: runs the app with you (users, imports, cleanup, approvals) but not restricted records. Staff and Accountant: their standard set. Each person’s access is a set of checkboxes. Outside partners (contractors, agents, lenders and the rest) see only what you invite them to." />
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
              {u.role !== 'owner' && u.id !== me.id ? (
                <ActionForm action={removeUser} submit="Remove" submitClass="link-btn small" confirm={`Remove ${u.email}? ${u.lastSignIn ? 'They have signed in before, so their sign-in is turned off and they stay in History.' : 'They never signed in, so they come off the list.'}`}>
                  <input type="hidden" name="id" value={u.id} />
                </ActionForm>
              ) : null}
              {(u.role === 'staff' || u.role === 'owner' || u.role === 'admin') && !u.email.endsWith('@technicalsource.com') && !u.email.endsWith('@example.com') ? (
                <p className="notice warn" style={{ margin: 0 }}>This isn’t a Technical Source account, so they can’t sign in with Microsoft. If they’re a contractor or partner, invite them below under <strong>Invite an Outside Partner</strong> with this same email: they become an outside partner and get a sign-in link.</p>
              ) : null}
              {u.role === 'owner' ? <p className="small muted" style={{ margin: 0 }}>Owner: everything, always.</p>
                : u.role === 'pending' ? <p className="small muted" style={{ margin: 0 }}>Waiting for access: pick a role, then tick what they can do.</p> : (
                  <details className="fold"><summary>What They Can Do ({effectivePermissions(u.role, u.permissions, standards.roles).length} of {allPermissions.length})</summary>
                    <PermissionBoxes id={u.id} role={u.role} own={u.permissions} std={standards.roles} />
                  </details>
                )}
              {(u.role === 'accountant' || u.role === 'partner') && !u.email.endsWith('@technicalsource.com') ? (
                <ActionForm action={newGuestLink} submit="Send a New Sign-In Link" submitClass="link-btn small"><input type="hidden" name="id" value={u.id} /></ActionForm>
              ) : null}
            </li>
          ))}</ul>
        </Section>

        <Section title="Outside Partners" kind="aqua" hint={`${guests.length}`}>
          {guests.length ? <ul className="user-list">{guests.map((g) => {
            const mine = access.filter((x) => x.a.userId === g.id);
            return (
              <li key={g.id} className="user-card">
                <div className="user-head">
                  <div className="user-who"><strong>{g.name ?? g.email}</strong> <span className="chip aqua">{guestTypeLabel(g.guestType)}</span>{g.guestExtras?.includes('deals') ? <span className="chip"> Sees deals they sent</span> : null}<div className="small muted">{g.email} · last sign-in {formatDateTime(g.lastSignIn) || 'never'}</div></div>
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
                <details className="fold"><summary>Kind of Partner</summary>
                  <ActionForm action={setGuestType} submit="Save">
                    <input type="hidden" name="id" value={g.id} />
                    <GuestTypeFields initialType={isGuestType(g.guestType) ? g.guestType : 'other'} withAbilities={false} initialExtras={g.guestExtras ?? []} standards={standards.partners} />
                  </ActionForm>
                </details>
                <ActionForm action={newGuestLink} submit="Send a New Sign-In Link" submitClass="btn small secondary"><input type="hidden" name="id" value={g.id} /></ActionForm>
                <ActionForm action={removeUser} submit="Remove" submitClass="link-btn small" confirm={`Remove ${g.email}? ${g.lastSignIn ? 'They have signed in before, so their sign-in is turned off and they stay in History.' : 'They never signed in, so they come off the list.'}`}>
                  <input type="hidden" name="id" value={g.id} />
                </ActionForm>
              </li>
            );
          })}</ul> : <Empty>No guests yet.</Empty>}
        </Section>

        <Section title="Invite an Outside Partner" kind="energy" hint="A GC, sub, supplier, designer, property manager, agent, wholesaler, lender, attorney or investor: they see only what you pick">
          <ActionForm action={inviteGuest} submit="Invite Them">
            <div className="fields">
              <label className="f">Their Email<input name="email" type="email" required /></label>
              <label className="f">Name<input name="name" /></label>
              <SearchPicker name="personId" label="Their Record" hint="Optional: the person on file" placeholder="Type a name or company"
                options={people.map((p) => ({ id: p.id, label: p.name, sub: p.companyName }))} add={{ kind: 'person' }} />
              <SearchPicker name="companyId" label="Their Company" hint="They see the issues and commitments for it" placeholder="Type the company"
                options={cos.map((c) => ({ id: c.id, label: c.name }))} add={{ kind: 'company' }} />
              <label className="f">Last Day<span className="h">Optional</span><input type="date" name="endsOn" /></label>
            </div>
            <fieldset className="f choice"><legend>Projects They Can See</legend>
              <div className="role-pick">{ps.map((p) => (
                <label key={p.id} className="role-btn"><input type="checkbox" name="project" value={p.id} /><span>{p.number ? `P-${p.number} ` : ''}{p.name}</span></label>
              ))}</div>
            </fieldset>
            <GuestTypeFields standards={standards.partners} />
          </ActionForm>
        </Section>

        <Section title="Standard Access by Type" kind="blue" hint={me.role === 'owner' ? 'What each type gets unless you tick something different for one person' : 'Only the owner changes these'}>
          <p className="small muted" style={{ marginTop: 0 }}>Change a type’s standard and everyone of that type who doesn’t have their own ticks gets it at once. For outside partners it’s what a new invitation starts with; tick “apply to everyone” to change the ones already invited.</p>
          <h3 className="std-head">Our Team</h3>
          <ul className="user-list">{editableRoles.map((r) => {
            const using = staff.filter((u) => u.role === r && !u.permissions).length, own = staff.filter((u) => u.role === r && u.permissions).length;
            return (
              <li key={r} className="user-card">
                <div className="user-head"><div className="user-who"><strong>{roleNames[r]}</strong><div className="small muted">{roleStandard(r, standards.roles).length} of {allPermissions.length} · {using} {using === 1 ? 'person follows' : 'people follow'} it{own ? ` · ${own} with their own ticks` : ''}{standards.roles[r] ? ' · your own standard' : ' · built-in standard'}</div></div></div>
                {me.role === 'owner' ? (
                  <details className="fold"><summary>Change the {roleNames[r]} Standard</summary>
                    <ActionForm action={saveRoleStandard} submit={`Save the ${roleNames[r]} Standard`}>
                      <input type="hidden" name="role" value={r} />
                      <Boxes on={roleStandard(r, standards.roles)} />
                    </ActionForm>
                    {standards.roles[r] ? <ActionForm action={saveRoleStandard} submit="Back to the Built-In Standard" submitClass="link-btn small"><input type="hidden" name="role" value={r} /><input type="hidden" name="reset" value="1" /></ActionForm> : null}
                  </details>
                ) : null}
              </li>
            );
          })}</ul>
          <h3 className="std-head">Outside Partners</h3>
          <ul className="user-list">{guestTypes.map((t) => {
            const st = partnerStandard(t.key, standards.partners);
            const n = guests.filter((g) => g.guestType === t.key).length;
            return (
              <li key={t.key} className="user-card">
                <div className="user-head"><div className="user-who"><strong>{t.label}</strong><div className="small muted">{[...st.can.map((k) => guestAbilities.find((a) => a.key === k)?.label.split(' (')[0]), ...st.extras.map((k) => (k === 'deals' ? 'Deals they sent' : 'Market Map'))].join(' · ')}{n ? ` · ${n} invited` : ''}{standards.partners[t.key] ? ' · your own standard' : ''}</div></div></div>
                {me.role === 'owner' ? (
                  <details className="fold"><summary>Change the {t.label} Standard</summary>
                    <ActionForm action={savePartnerStandard} submit={`Save the ${t.label} Standard`}>
                      <GuestTypeFields initialType={t.key} standards={standards.partners} fixedType />
                      <label className="check"><input type="checkbox" name="applyNow" /> Also apply it now to everyone of this type{n ? ` (${n})` : ''}, on all their projects</label>
                    </ActionForm>
                    {standards.partners[t.key] ? <ActionForm action={savePartnerStandard} submit="Back to the Built-In Standard" submitClass="link-btn small"><input type="hidden" name="guestType" value={t.key} /><input type="hidden" name="reset" value="1" /></ActionForm> : null}
                  </details>
                ) : null}
              </li>
            );
          })}</ul>
        </Section>

        <Section title="Add Staff, a Partner or an Accountant" kind="grey" hint="Technical Source accounts sign in with Microsoft; a Partner (sees everything but restricted records) or an outside accountant gets a sign-in link by email">
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
