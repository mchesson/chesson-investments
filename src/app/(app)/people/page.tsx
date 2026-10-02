import Link from 'next/link';
import { listPeople } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { roles, roleDef, roleTag, supplierTypes, isSupplierType } from '@/lib/roles';
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
  const supply = picked.includes('supplier') ? [...new Set((sp.supply ?? '').split(',').filter(isSupplierType))] : [];
  const one = picked.length === 1 ? picked[0] : undefined;
  const stage = one && sp.stage && roleDef(one)!.stages.some((s) => s.key === sp.stage) ? sp.stage : undefined;
  const business = sp.business === '1';
  const { rows, total, page, pageSize } = await listPeople({ q: sp.q, roles: picked, supply, stage, page: Number(sp.page) || 1, business });
  const href = (next: string[], extra: Record<string, string | undefined> = {}) => {
    const keepSupply = next.includes('supplier') && supply.length ? supply.join(',') : undefined;
    const q = new URLSearchParams(Object.entries({ q: sp.q, roles: next.length ? next.join(',') : undefined, supply: keepSupply, business: business ? '1' : undefined, ...extra }).filter(([, v]) => v) as [string, string][]);
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
        {picked.includes('supplier') ? (
          <nav aria-label="Kinds of supplier" className="role-pick">
            <span className="small muted" style={{ alignSelf: 'center' }}>Kind of supplier:</span>
            {supplierTypes.map((t) => {
              const next = supply.includes(t.key) ? supply.filter((k) => k !== t.key) : [...supply, t.key];
              return <Link key={t.key} href={href(picked, { supply: next.length ? next.join(',') : undefined })} className="role-btn small-btn" aria-pressed={supply.includes(t.key)}>{t.label}</Link>;
            })}
          </nav>
        ) : null}
        {one ? (
          <nav aria-label="Where we are with them" className="role-pick">
            <span className="small muted" style={{ alignSelf: 'center' }}>Where we are with them:</span>
            <Link href={href(picked)} className="role-btn small-btn" aria-pressed={!stage}>Any</Link>
            {roleDef(one)!.stages.map((s) => <Link key={s.key} href={href(picked, { stage: s.key, supply: supply.length ? supply.join(',') : undefined })} className="role-btn small-btn" aria-pressed={stage === s.key}>{s.label}</Link>)}
          </nav>
        ) : null}
        <form className="find-bar">
          <label className="f grow">Search<input name="q" defaultValue={sp.q ?? ''} placeholder="Name, email, phone, company, trade, area" /></label>
          {picked.length ? <input type="hidden" name="roles" value={picked.join(',')} /> : null}
          {supply.length ? <input type="hidden" name="supply" value={supply.join(',')} /> : null}
          {stage ? <input type="hidden" name="stage" value={stage} /> : null}
          <label className="check"><input type="checkbox" name="business" value="1" defaultChecked={business} /> Business contacts only</label>
          <button className="btn" type="submit">Search</button>
          {sp.q || picked.length || business ? <Link href="/people">Clear</Link> : null}
        </form>
      </Section>
      <Section title={title} hint={`${total} ${total === 1 ? 'person' : 'people'}`}>
        {rows.length ? (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Name</th><th>Title</th><th>Company (What They Do)</th><th>Introduced By</th><th>Their Roles</th><th>Phone</th><th>Last Touch</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/people/${p.id}`}>{p.firstName} {p.lastName}</Link></td>
                    <td>{p.title ?? '—'}</td>
                    <td>{p.companyName ? <><Link href={`/companies/${p.companyId}`}>{p.companyName}</Link>{p.companyTypes.length ? <div className="small muted">{p.companyTypes.map(roleTag).join(' · ')}</div> : null}</> : '—'}</td>
                    <td>{p.introducedById ? <Link href={`/people/${p.introducedById}`}>{p.introducedByName}</Link> : '—'}</td>
                    <td>{p.doNotUse ? <span className="chip red" title={p.doNotUseReason ?? undefined}>Do Not Use</span> : null} <RoleChips items={p.roles} /></td>
                    <td><Phone value={p.phone} /></td>
                    <td>{p.lastTouch ? formatDate(p.lastTouch) : <span className="muted">Never</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No one matches. Try fewer words, or add them.</Empty>}
        <Pager base="/people" page={page} total={total} pageSize={pageSize} params={{ q: sp.q, roles: picked.length ? picked.join(',') : undefined, supply: supply.length ? supply.join(',') : undefined, stage, business: business ? '1' : undefined }} />
      </Section>
    </>
  );
}
