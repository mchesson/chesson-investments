import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { isUuid } from '@/lib/forms';
import { formatDateTime, showPhone } from '@/lib/format';
import { historyFor } from '@/lib/contacts';
import { getLead, leadHandlers, sameOnFile } from '@/lib/site-lead-data';
import { conditionLabel, leadKindLabel, leadStatuses, leadStatusLabel, pageName, propertyKindLabel, sourceName, timelineLabel, topicLabel } from '@/lib/site-leads';
import { Empty, Facts, PageHead, Section, Tabs } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { ActionButton } from '@/components/ActionButton';
import { Choice } from '@/components/Choice';
import { HistoryList } from '@/components/contacts';
import { addLeadNote, archiveLead, linkLeadPerson, setLeadStatus } from '../../lead-actions';

export const metadata = { title: 'Website Lead' };

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePage('contacts.view');
  const { id } = await params;
  const { tab = 'overview' } = await searchParams;
  const data = isUuid(id) ? await getLead(id) : null;
  if (!data) notFound();
  const { lead: l, handler, person, property, notes } = data;
  const edit = can(user, 'contacts.edit');
  const base = `/leads/${id}`;
  const [handlers, same] = await Promise.all([edit ? leadHandlers() : [], !l.personId ? sameOnFile(l) : []]);
  return (
    <>
      <PageHead eyebrow={`Website Lead · ${leadKindLabel(l.kind)}`} title={l.name}
        sub={<><span className="chip blue">{leadStatusLabel(l.status)}</span> Received {formatDateTime(l.created)}{l.archived ? <> <span className="chip red">Archived</span></> : null}</>}
        actions={edit ? <ActionButton action={archiveLead.bind(null, id)} className="btn secondary" label={l.archived ? 'Put Back' : 'Archive'} done={l.archived ? 'Back on the list.' : 'Archived.'} confirm={l.archived ? undefined : 'Archive this lead (spam or a duplicate)? It can be put back.'} /> : null} />
      <div className="record">
        <div className="card-side">
          <Section title="Who" kind="blue">
            <Facts items={[
              ['Email', l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : null],
              ['Phone', l.phone ? <a href={`tel:${l.phone}`}>{showPhone(l.phone)}</a> : null],
              ['On File', person ? <Link href={`/people/${person.id}`}>{person.firstName} {person.lastName}</Link> : 'Not yet'],
              ['Handled By', handler ? handler.name ?? handler.email : 'Nobody yet'],
            ]} />
          </Section>
          <Section title="Where They Came From" kind="grey">
            <Facts items={[
              ['Source', sourceName(l)],
              ['Came From', l.referrer],
              ['First Page', l.landingPage ? pageName(l.landingPage.split('?')[0]) : null],
              ['Form Sent From', l.formPage ? pageName(l.formPage) : null],
              ['utm_source', l.utmSource], ['utm_medium', l.utmMedium], ['utm_campaign', l.utmCampaign],
              ['Alert Email', l.alertSent === null ? 'Not sent (email isn’t set up)' : l.alertSent ? 'Sent' : 'Didn’t go'],
            ]} />
          </Section>
        </div>
        <div>
          <Tabs base={base} current={tab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'notes', label: 'Notes', count: notes.length }, { key: 'history', label: 'History' }]} />
          {tab === 'overview' ? (
            <div className="stack">
              {l.kind === 'sell' ? (
                <Section title="The Property" kind="aqua">
                  <Facts items={[
                    ['Address', [l.propertyAddress, l.propertyCity].filter(Boolean).join(', ')],
                    ['Kind', propertyKindLabel(l.propertyKind)], ['Condition', conditionLabel(l.condition)],
                    ['Timeline', timelineLabel(l.timeline)], ['Asking', l.askingPrice],
                    ['On the Watchlist', property ? <Link href={`/watchlist/${property.id}`}>{property.address}</Link> : null],
                  ]} />
                </Section>
              ) : null}
              <Section title={l.kind === 'sell' ? 'What Else They Said' : 'Their Message'} kind="energy" hint={topicLabel(l.topic) ?? undefined}>
                {l.message ? <p className="lead-message">{l.message}</p> : <Empty>Nothing more.</Empty>}
              </Section>
              {edit ? (
                <Section title="Where It Stands" kind="blue">
                  <ActionForm action={setLeadStatus} submit="Save">
                    <input type="hidden" name="id" value={id} />
                    <div className="fields">
                      <Choice name="status" label="Status" options={leadStatuses} defaultValue={l.status} />
                      <label className="f">Handled By
                        <select name="handledBy" defaultValue={l.handledBy ?? ''}>
                          <option value="">{l.handledBy ? 'Keep as it is' : 'Whoever saves this'}</option>
                          <option value="none">Nobody</option>
                          {handlers.map((h) => <option key={h.id} value={h.id}>{h.name ?? h.email}</option>)}
                        </select>
                      </label>
                    </div>
                  </ActionForm>
                </Section>
              ) : null}
              {edit && (!person || (l.kind === 'sell' && !property)) ? (
                <Section title="Next Steps" kind="aqua">
                  {!person ? (
                    <>
                      {same.length ? (
                        <div className="notice warn">
                          Already on file with the same email or phone:
                          {same.map((p) => (
                            <ActionForm key={p.id} action={linkLeadPerson} submit={`Link to ${p.firstName} ${p.lastName}`} className="inline-form">
                              <input type="hidden" name="id" value={id} /><input type="hidden" name="personId" value={p.id} />
                            </ActionForm>
                          ))}
                        </div>
                      ) : null}
                      <p style={{ margin: '0 0 10px' }}><Link className="btn" href={`/people/new?lead=${id}`}>Create Person</Link> <span className="small muted">Opens Add Person with what they typed; it checks for anyone like them on file first.</span></p>
                    </>
                  ) : null}
                  {l.kind === 'sell' && !property && can(user, 'properties.edit') ? (
                    <p style={{ margin: 0 }}><Link className="btn secondary" href={`/watchlist/new?lead=${id}`}>Add to Watchlist</Link> <span className="small muted">Adds the property, with how it came to us: Our Website.</span></p>
                  ) : null}
                </Section>
              ) : null}
            </div>
          ) : null}
          {tab === 'notes' ? (
            <Section title="Notes" kind="energy">
              {edit ? (
                <ActionForm action={addLeadNote} submit="Add the Note" resetOnOk>
                  <input type="hidden" name="id" value={id} />
                  <label className="f">Note<textarea name="text" required placeholder="Called back, left a message…" /></label>
                </ActionForm>
              ) : null}
              {notes.length ? (
                <ul className="rows">{notes.map((n) => <li key={n.id}><p className="lead-message">{n.text}</p><div className="small muted">{n.userName ?? 'Someone'} · {formatDateTime(n.created)}</div></li>)}</ul>
              ) : <Empty>No notes yet.</Empty>}
            </Section>
          ) : null}
          {tab === 'history' ? <Section title="History" kind="grey"><HistoryList rows={await historyFor('site_lead', id)} /></Section> : null}
        </div>
      </div>
    </>
  );
}
