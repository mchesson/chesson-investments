import Link from 'next/link';
import { listCompanies } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { roles, roleDef } from '@/lib/roles';
import { PageHead, Section, Empty } from '@/components/ui';
import { Phone } from '@/components/Phone';
import { Pager, RoleChips } from '@/components/contacts';

export const metadata = { title: 'Companies' };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage('contacts.view');
  const sp = await searchParams;
  const role = sp.role && roleDef(sp.role) ? sp.role : undefined;
  const { rows, total, page, pageSize } = await listCompanies({ q: sp.q, role, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHead title="Companies" actions={<Link className="btn" href="/companies/new">Add Company</Link>} />
      <Section title="Find Companies" kind="grey">
        <form className="find-bar">
          <label className="f grow">Search<input name="q" defaultValue={sp.q ?? ''} placeholder="Company name" /></label>
          <label className="f">Role
            <select name="role" defaultValue={role ?? ''}>
              <option value="">Any role</option>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Search</button>
          {sp.q || role ? <Link href="/companies">Clear</Link> : null}
        </form>
      </Section>
      <Section title="Companies" hint={`${total}`}>
        {rows.length ? (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Name</th><th>Roles</th><th>Phone</th><th className="num">People</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/companies/${c.id}`}>{c.name}</Link>{c.city ? <div className="small muted">{c.city}</div> : null}</td>
                    <td><RoleChips items={c.roles} /></td>
                    <td><Phone value={c.phone} /></td>
                    <td className="num">{c.peopleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No companies match.</Empty>}
        <Pager base="/companies" page={page} total={total} pageSize={pageSize} params={{ q: sp.q, role }} />
      </Section>
    </>
  );
}
