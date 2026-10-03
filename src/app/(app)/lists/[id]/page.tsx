import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getList, historyFor, peopleOptions } from '@/lib/contacts';
import { requirePage } from '@/lib/session';
import { isUuid } from '@/lib/forms';
import { formatDate } from '@/lib/format';
import { roles } from '@/lib/roles';
import { PageHead, Section, Empty } from '@/components/ui';
import { Phone } from '@/components/Phone';
import { ActionForm } from '@/components/ActionForm';
import { HistoryList } from '@/components/contacts';
import { addRoleToList, addToList, removeMember, setMemberStatus } from '../../contacts-actions';
import { SearchPicker } from '@/components/SearchPicker';

const statuses = [['to_contact', 'To Contact'], ['contacted', 'Contacted'], ['interested', 'Interested'], ['not_interested', 'Not Interested']] as const;

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('contacts.view');
  const { id } = await params;
  const data = isUuid(id) ? await getList(id) : null;
  if (!data) notFound();
  const { list, members } = data;
  const people = await peopleOptions();
  const emails = members.map((m) => m.email).filter(Boolean).join(',');
  return (
    <>
      <PageHead eyebrow="List" title={list.name} sub={list.purpose}
        actions={emails ? <a className="btn secondary" href={`mailto:?bcc=${emails}`}>Email Everyone (BCC)</a> : null} />
      <div className="stack">
        <Section title="People" hint={`${members.length}`}>
          {members.length ? (
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Name</th><th>Phone</th><th>Last Touch</th><th>Status</th><th></th></tr></thead>
              <tbody>{members.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/people/${m.personId}`}>{m.firstName} {m.lastName}</Link>{m.companyName ? <div className="small muted">{m.companyName}</div> : null}</td>
                  <td><Phone value={m.phone} /></td>
                  <td>{m.lastTouch ? formatDate(m.lastTouch) : 'Never'}</td>
                  <td>
                    <div className="chips">{statuses.map(([k, label]) => (
                      <form key={k} action={setMemberStatus.bind(null, m.id, k)}>
                        <button type="submit" className={`btn small ${m.status === k ? '' : 'secondary'}`} aria-pressed={m.status === k}>{label}</button>
                      </form>
                    ))}</div>
                  </td>
                  <td><form action={removeMember.bind(null, m.id)}><button className="link-btn small" type="submit">Remove</button></form></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <Empty>No one on this list yet.</Empty>}
        </Section>
        <Section title="Add People" kind="energy">
          <div className="grid-2">
            <ActionForm action={addToList} submit="Add" resetOnOk>
              <input type="hidden" name="listId" value={id} />
              <SearchPicker name="personId" label="One Person" required placeholder="Type a name or company"
                options={people.map((p) => ({ id: p.id, label: p.name, sub: p.companyName }))} add={{ kind: 'person' }} />
            </ActionForm>
            <ActionForm action={addRoleToList} submit="Add Everyone With This Role">
              <input type="hidden" name="listId" value={id} />
              <label className="f">Everyone Who Is a…
                <select name="role" required defaultValue="">
                  <option value="" disabled>Pick a role</option>
                  {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </label>
            </ActionForm>
          </div>
        </Section>
        <Section title="History" kind="grey"><HistoryList rows={await historyFor('list', id)} /></Section>
      </div>
    </>
  );
}
