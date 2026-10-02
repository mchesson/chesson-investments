import Link from 'next/link';
import { listPeople } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { roles, roleDef } from '@/lib/roles';
import { formatDate } from '@/lib/format';
import { PageHead, Section, Empty } from '@/components/ui';
import { Phone } from '@/components/Phone';
import { Pager, RoleChips } from '@/components/contacts';

export const metadata = { title: 'People' };

/** ?roles=gc,sub (any of them); the old ?role=gc still works. */
function chosenRoles(sp: Record<string, string | undefined>): string[] {
  const raw = [...(sp.roles ?? '').split(','), sp.role ?? ''].map((r) => r.trim()).filter((r) => roleDef(r));
  return [...new Set(raw)];
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage('contacts.view');
  const sp = await searchParams;
  const picked = chosenRoles(sp);
  const one = picked.length === 1 ? picked[0] : undefined;
  const stage = one && sp.stage && roleDef(one)!.stages.some((s) => s.key === sp.stage) ? sp.stage : undefined;
  const business = sp.business === '1';
  const { rows, total, page, pageSize } = await listPeople({ q: sp.q, roles: picked, stage, page: Number(sp.page) || 1, business });
  const href = (next: string[], extra: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams(Object.entries({ q: sp.q, roles: next.length ? next.join(',') : undefined, business: business ? '1' : undefined, ...extra }).filter(([, v]) => v) as [string, string][]);
    const s = q.toString();
    return s ? `/people?${s}` : '/people';
  };
  const toggle = (key: string) => (picked.includes(key) ? picked.filter((r) => r !== key) : [...picked, key]);
  const title = picked.length === 1 ? roleDef(picked[0])!.plural : picked.length ? picked.map((r) => roleDef(r)!.plural).join(', ') : 'Everyone';
  return (
    <>
      <PageHead title="People" sub="Everyone we know: builders, subs, agents, lenders, investors, sellers." actions={<Link className="btn" href="/people/new">Add Person</Link>} />
      <Section title="Find People" kind="grey">
        <nav aria-label="Roles" className="role-pick">
          <Link href={href([])} className="role-btn" aria-pressed={!picked.length}>All Roles</Link>
          {roles.map((r) => (
            <Link key={r.key} href={href(toggle(r.key))} className="role-btn" aria-pressed={picked.includes(r.key)}>{r.plural}</Link>
          ))}
        </nav>
        <form className="find-bar">
          <label className="f grow">Search<input name="q" defaultValue={sp.q ?? ''} placeholder="Name, email, phone, company, trade, area" /></label>
          {picked.length ? <input type="hidden" name="roles" value={picked.join(',')} /> : null}
          {one ? (
            <label className="f">Where We Are With Them
              <select name="stage" defaultValue={stage ?? ''}>
                <option value="">Any</option>
                {roleDef(one)!.stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          ) : null}
          <label className="check"><input type="checkbox" name="business" value="1" defaultChecked={business} /> Business contacts only</label>
          <button className="btn" type="submit">Search</button>
          {sp.q || picked.length || business ? <Link href="/people">Clear</Link> : null}
        </form>
      </Section>
      <Section title={title} hint={`${total} ${total === 1 ? 'person' : 'people'}`}>
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
        <Pager base="/people" page={page} total={total} pageSize={pageSize} params={{ q: sp.q, roles: picked.length ? picked.join(',') : undefined, stage, business: business ? '1' : undefined }} />
      </Section>
    </>
  );
}
