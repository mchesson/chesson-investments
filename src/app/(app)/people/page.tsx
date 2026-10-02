import Link from 'next/link';
import { listPeople } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { roles, roleDef } from '@/lib/roles';
import { formatDate } from '@/lib/format';
import { PageHead, Section, Empty } from '@/components/ui';
import { Phone } from '@/components/Phone';
import { Pager, RoleChips } from '@/components/contacts';

export const metadata = { title: 'People' };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage('contacts.view');
  const sp = await searchParams;
  const role = sp.role && roleDef(sp.role) ? sp.role : undefined;
  const stage = role && sp.stage ? sp.stage : undefined;
  const business = sp.business === '1';
  const { rows, total, page, pageSize } = await listPeople({ q: sp.q, role, stage, page: Number(sp.page) || 1, business });
  return (
    <>
      <PageHead title="People" sub="Everyone we know: builders, subs, agents, lenders, investors, sellers." actions={<Link className="btn" href="/people/new">Add Person</Link>} />
      <Section title="Find People" kind="grey">
        <form className="find-bar">
          <label className="f grow">Search<input name="q" defaultValue={sp.q ?? ''} placeholder="Name, email, phone, company, trade, area" /></label>
          <label className="f">Role
            <select name="role" defaultValue={role ?? ''}>
              <option value="">Any role</option>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          {role ? (
            <label className="f">Stage
              <select name="stage" defaultValue={stage ?? ''}>
                <option value="">Any stage</option>
                {roleDef(role)!.stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          ) : null}
          <label className="check"><input type="checkbox" name="business" value="1" defaultChecked={business} /> Business contacts only</label>
          <button className="btn" type="submit">Search</button>
          {sp.q || role || business ? <Link href="/people">Clear</Link> : null}
        </form>
      </Section>
      <Section title={role ? roleDef(role)!.plural : 'Everyone'} hint={`${total} ${total === 1 ? 'person' : 'people'}`}>
        {rows.length ? (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Name</th><th>Company</th><th>Roles</th><th>Phone</th><th>Last Touch</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/people/${p.id}`}>{p.firstName} {p.lastName}</Link>{p.title ? <div className="small muted">{p.title}</div> : null}{p.introducedByName ? <div className="small muted">via <Link href={`/people/${p.introducedById}`}>{p.introducedByName}</Link></div> : null}</td>
                    <td>{p.companyName ? <Link href={`/companies/${p.companyId}`}>{p.companyName}</Link> : '—'}</td>
                    <td><RoleChips items={p.roles} /></td>
                    <td><Phone value={p.phone} /></td>
                    <td>{p.lastTouch ? formatDate(p.lastTouch) : <span className="muted">Never</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No one matches. Try fewer words, or add them.</Empty>}
        <Pager base="/people" page={page} total={total} pageSize={pageSize} params={{ q: sp.q, role, stage, business: business ? '1' : undefined }} />
      </Section>
    </>
  );
}
