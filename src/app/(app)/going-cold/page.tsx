import Link from 'next/link';
import { goingCold } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { roles, roleDef, roleLabel, stageLabel } from '@/lib/roles';
import { formatDate, today } from '@/lib/format';
import { daysSince } from '@/lib/roles';
import { PageHead, Section, Empty } from '@/components/ui';
import { Phone } from '@/components/Phone';

export const metadata = { title: 'Going Cold' };

export default async function GoingCold({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await requirePage('contacts.view');
  const { role: r } = await searchParams;
  const role = r && roleDef(r) ? r : undefined;
  const rows = await goingCold(role);
  return (
    <>
      <PageHead title="Going Cold" sub="People we haven't touched in a while, by role. Each role has its own number of days." />
      <Section title="Find" kind="grey">
        <form className="find-bar">
          <label className="f">Role
            <select name="role" defaultValue={role ?? ''}>
              <option value="">Every role</option>
              {roles.map((x) => <option key={x.key} value={x.key}>{x.label} ({x.coldDays} days)</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Show</button>
        </form>
      </Section>
      <Section title="Reach Out" kind="energy" hint={`${rows.length}`}>
        {rows.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Name</th><th>Role</th><th>Last Touch</th><th>Phone</th></tr></thead>
            <tbody>{rows.map((x, i) => (
              <tr key={i}>
                <td><Link href={`/people/${x.personId}?tab=touches`}>{x.firstName} {x.lastName}</Link>{x.companyName ? <div className="small muted">{x.companyName}</div> : null}</td>
                <td>{roleLabel(x.role)} · {stageLabel(x.role, x.stage)}</td>
                <td>{x.lastTouch ? <>{formatDate(x.lastTouch)} <span className="small red">({daysSince(x.lastTouch, today())} days)</span></> : <span className="red">Never</span>}</td>
                <td><Phone value={x.phone} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>Nobody is going cold. Nice work.</Empty>}
      </Section>
    </>
  );
}
