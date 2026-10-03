import { notFound } from 'next/navigation';
import { requireGuest } from '@/lib/session';
import { isUuid } from '@/lib/forms';
import { guestMay, guestProject } from '@/lib/guest-data';
import { formatDate, today } from '@/lib/format';
import { issueStatusLabel } from '@/lib/issues';
import { rentalStatusLabel } from '@/lib/rentals';
import { ActionForm } from '@/components/ActionForm';
import { Choice } from '@/components/Choice';
import { StageChips } from '@/components/StageChips';
import { Empty, PageHead, Section } from '@/components/ui';
import { guestAddLog, guestUpdateIssue } from '../../actions';
import { sameAsAddress } from '@/lib/locate-rules';

export const metadata = { title: 'Project' };

const stateLabel: Record<string, string> = { done: 'Done', missed: 'Missed', due_soon: 'Due Soon', upcoming: 'Upcoming', no_date: 'No Date Yet' };

export default async function GuestProject({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireGuest();
  const { id } = await params;
  const d = isUuid(id) ? await guestProject(u, id) : null;
  if (!d) notFound();
  const { access: a, project: p } = d;
  return (
    <>
      <PageHead eyebrow={p.number ? `Project P-${p.number}` : 'Project'} title={p.name}
        sub={<span className="sub-row"><StageChips p={p} /> {[!sameAsAddress(p.name, p.address) ? p.address : null, p.city, p.state].filter(Boolean).join(', ')}</span>} />
      <div className="stack">
        {guestMay(a, 'schedule') ? (
          <>
            <Section title="Your Commitments" kind="blue" hint="What you’ve agreed to deliver, and by when">
              {d.commitments.length ? (
                <div className="table-wrap"><table className="t">
                  <thead><tr><th>What</th><th>Due</th><th>Status</th></tr></thead>
                  <tbody>{d.commitments.map((c) => (
                    <tr key={c.id}><td>{c.description}{c.milestoneName ? <div className="small muted">Tied to {c.milestoneName}</div> : null}</td>
                      <td>{c.due ? formatDate(c.due) : '—'}</td><td><span className={`chip ${c.state === 'missed' ? 'red' : c.state === 'done' ? 'aqua' : 'blue'}`}>{stateLabel[c.state] ?? c.state}</span></td></tr>
                  ))}</tbody>
                </table></div>
              ) : <Empty>No commitments for you on this project.</Empty>}
            </Section>
            <Section title="Schedule" kind="aqua" hint="The milestones">
              {d.milestones.length ? (
                <div className="table-wrap"><table className="t">
                  <thead><tr><th>Milestone</th><th>Planned</th><th>Actual</th></tr></thead>
                  <tbody>{d.milestones.map((m) => (
                    <tr key={m.id}><td>{m.name}</td>
                      <td>{[m.plannedStart, m.plannedEnd].filter(Boolean).map((x) => formatDate(x!)).join(' – ') || '—'}</td>
                      <td>{[m.actualStart, m.actualEnd].filter(Boolean).map((x) => formatDate(x!)).join(' – ') || '—'}</td></tr>
                  ))}</tbody>
                </table></div>
              ) : <Empty>No schedule yet.</Empty>}
            </Section>
          </>
        ) : null}

        {d.rental ? (
          <Section title="The Rental" kind="blue">
            <p style={{ margin: '0 0 8px' }}>Status: <strong>{d.rental.status ? rentalStatusLabel(d.rental.status) : 'Not set up yet'}</strong></p>
            {d.rental.leases.length ? (
              <div className="table-wrap"><table className="t">
                <thead><tr><th>Lease</th><th>Starts</th><th>Ends</th><th>Decide on Renewal By</th><th>Renewal</th></tr></thead>
                <tbody>{d.rental.leases.map((l) => (
                  <tr key={l.id}><td>{l.status === 'active' ? 'Current' : 'Ended'}</td><td>{formatDate(l.startsOn)}</td><td>{l.endsOn ? formatDate(l.endsOn) : '—'}</td><td>{l.decideBy ? formatDate(l.decideBy) : '—'}</td><td>{l.renewalTerms ?? '—'}</td></tr>
                ))}</tbody>
              </table></div>
            ) : <Empty>No lease on file yet.</Empty>}
          </Section>
        ) : null}

        {guestMay(a, 'issues') ? (
          <Section title="Issues With You" kind="energy" hint={`${d.issues.filter((i) => i.status !== 'resolved' && i.status !== 'wont_fix').length} open`}>
            {d.issues.length ? <ul className="issue-list">{d.issues.map((i) => (
              <li key={i.id} className="issue-card" data-status={i.status} data-sev={i.severity}>
                <div className="issue-head"><span className="issue-no">#{i.number}</span><strong className="issue-title">{i.title}</strong><span className="chip status">{issueStatusLabel(i.status)}</span></div>
                <div className="issue-facts small"><span>Reported {formatDate(i.reportedOn)}</span>{i.dueOn ? <span>Fix by {formatDate(i.dueOn)}</span> : null}{i.resolvedOn ? <span>Closed {formatDate(i.resolvedOn)}</span> : null}</div>
                {i.details ? <p className="issue-details">{i.details}</p> : null}
                {i.vendorNote ? <p className="issue-details vendor-note"><span className="small muted">Your last update:</span> {i.vendorNote}</p> : null}
                {i.status !== 'resolved' && i.status !== 'wont_fix' ? (
                  <details className="fold"><summary>Update It</summary>
                    <ActionForm action={guestUpdateIssue} submit="Send">
                      <input type="hidden" name="id" value={i.id} />
                      <Choice name="status" label="Where It Stands" options={[{ key: 'in_progress', label: 'Working On It' }, { key: 'check', label: 'Fixed: Please Check' }]} required />
                      <label className="f">What You Did or When You’ll Do It<textarea name="note" required rows={2} /></label>
                    </ActionForm>
                  </details>
                ) : null}
              </li>
            ))}</ul> : <Empty>No issues with you on this project.</Empty>}
          </Section>
        ) : null}

        {guestMay(a, 'daily_log') ? (
          <Section title="Daily Log" kind="grey" hint={`${d.logs.length}`}>
            {guestMay(a, 'daily_log.add') ? (
              <details className="fold" style={{ marginBottom: 10 }}><summary>Add to the Daily Log</summary>
                <ActionForm action={guestAddLog} submit="Add It" resetOnOk>
                  <input type="hidden" name="projectId" value={p.id} />
                  <div className="fields">
                    <label className="f">Day<input type="date" name="loggedOn" defaultValue={today()} max={today()} required /></label>
                    <label className="f">Who Was on Site<input name="onSite" placeholder="Framing crew (4)" /></label>
                    <label className="f">Weather<input name="weather" /></label>
                  </div>
                  <label className="f">What Was Done<textarea name="work" required rows={3} /></label>
                </ActionForm>
              </details>
            ) : null}
            {d.logs.length ? <ul className="rows">{d.logs.map((l) => (
              <li key={l.id}><strong>{formatDate(l.loggedOn)}</strong>{l.by ? <span className="small muted"> · {l.by}</span> : null}{l.onSite ? <span className="small muted"> · {l.onSite}</span> : null}{l.weather ? <span className="small muted"> · {l.weather}</span> : null}
                <div style={{ whiteSpace: 'pre-wrap' }}>{l.work}</div></li>
            ))}</ul> : <Empty>Nothing logged yet.</Empty>}
          </Section>
        ) : null}
      </div>
    </>
  );
}
