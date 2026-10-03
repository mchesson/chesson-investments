import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { formatDate, formatDateTime, showPhone } from '@/lib/format';
import { leadsBySource, listLeads, LEADS_PAGE, websiteVisits } from '@/lib/site-lead-data';
import { isLeadKind, isLeadStatus, leadKindLabel, leadKinds, leadStatuses, leadStatusLabel, pageName, sourceName } from '@/lib/site-leads';
import { Empty, PageHead, Section, Tile } from '@/components/ui';
import { Pager } from '@/components/contacts';

export const metadata = { title: 'Website Leads' };

const statusColor: Record<string, string> = { new: 'blue', contacted: 'aqua', qualified: 'energy', closed: '', not_a_fit: '' };

export default async function Leads({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('contacts.view');
  const sp = await searchParams;
  const status = isLeadStatus(sp.status) ? sp.status : null;
  const kind = isLeadKind(sp.kind) ? sp.kind : null;
  const [{ rows, total, page, counts }, visits, sources] = await Promise.all([
    listLeads({ status, kind, page: Number(sp.page) || 1 }), websiteVisits(30), leadsBySource(90),
  ]);
  const all = Object.values(counts).reduce((a, n) => a + n, 0);
  const href = (o: Record<string, string | null>) => {
    const q = new URLSearchParams(Object.entries({ status, kind, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return q ? `/leads?${q}` : '/leads';
  };
  const maxDay = Math.max(1, ...visits.byDay.map((d) => d.views));
  return (
    <>
      <PageHead title="Website Leads" sub="Everyone who filled in Contact Us or Sell Us Your Property on the website, and how we followed up."
        actions={<>
          <a className="btn secondary" href="/site" target="_blank" rel="noopener">Open the Website</a>
          {can(user, 'website.edit') ? <Link className="btn secondary" href="/leads/settings">Website Settings</Link> : null}
        </>} />
      <Section title="Find Leads" kind="grey">
        <nav className="role-pick" aria-label="Where it stands"><span className="filter-label">Status</span>
          <Link className="role-btn" aria-pressed={!status} href={href({ status: null })}>Every Status ({all})</Link>
          {leadStatuses.map((s) => <Link key={s.key} className="role-btn" aria-pressed={status === s.key} href={href({ status: s.key })}>{s.label} ({counts[s.key] ?? 0})</Link>)}
        </nav>
        <nav className="role-pick" aria-label="Which form"><span className="filter-label">Form</span>
          <Link className="role-btn" aria-pressed={!kind} href={href({ kind: null })}>Both Forms</Link>
          {leadKinds.map((k) => <Link key={k.key} className="role-btn" aria-pressed={kind === k.key} href={href({ kind: k.key })}>{k.label}</Link>)}
        </nav>
      </Section>
      <Section title={status ? leadStatusLabel(status) : 'Every Lead'} kind="energy" hint={`${total}`}>
        {rows.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Who</th><th>Form</th><th>What</th><th>Status</th><th>Came From</th><th>Received</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/leads/${r.id}`}>{r.name}</Link><div className="small muted">{[r.email, showPhone(r.phone)].filter(Boolean).join(' · ')}</div></td>
                <td>{leadKindLabel(r.kind)}</td>
                <td>{r.kind === 'sell' ? [r.propertyAddress, r.propertyCity].filter(Boolean).join(', ') : <span className="small">{(r.message ?? '').slice(0, 90)}{(r.message ?? '').length > 90 ? '…' : ''}</span>}</td>
                <td><span className={`chip ${statusColor[r.status] ?? ''}`}>{leadStatusLabel(r.status)}</span>{r.handledByName ? <div className="small muted">{r.handledByName}</div> : null}</td>
                <td>{sourceName(r)}</td>
                <td>{formatDateTime(r.created)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>No website leads {status || kind ? 'like that' : 'yet'}.</Empty>}
        <Pager base="/leads" page={page} total={total} pageSize={LEADS_PAGE} params={{ status: status ?? undefined, kind: kind ?? undefined }} />
      </Section>
      <Section title="Website Visits" kind="aqua" hint={`last 30 days, from ${formatDate(visits.from)}`}>
        <div className="tiles">
          <Tile k="Page Views" v={visits.total.toLocaleString()} s="Counted on our own server; search engines left out" />
          <Tile k="Leads (90 Days)" v={sources.reduce((a, s) => a + s.leads, 0)} s="Both forms" />
        </div>
        {visits.total ? (
          <div className="visit-bars" role="img" aria-label={`Page views per day: ${visits.byDay.map((d) => `${formatDate(d.day)} ${d.views}`).join(', ')}`}>
            {visits.byDay.map((d) => <span key={d.day} title={`${formatDate(d.day)}: ${d.views}`} style={{ height: d.views ? `${Math.max(4, Math.round((d.views / maxDay) * 100))}%` : '1px' }} />)}
          </div>
        ) : null}
        {visits.byPage.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Page</th><th className="num">Views</th></tr></thead>
            <tbody>{visits.byPage.map((p) => <tr key={p.path}><td>{pageName(p.path)} <span className="small muted">{p.path}</span></td><td className="num">{p.views.toLocaleString()}</td></tr>)}</tbody>
          </table></div>
        ) : <Empty>No visits counted yet.</Empty>}
        <p className="small muted" style={{ margin: '8px 0 0' }}>No cookies and nothing about who visited is kept: a page and a day only. For more (visitors, devices, searches), add a Google Analytics ID on Website Settings.</p>
      </Section>
      <Section title="Leads by Source" kind="blue" hint="last 90 days">
        {sources.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Contact Us</th><th className="num">Sell Us Your Property</th><th className="num">Qualified or Closed</th></tr></thead>
            <tbody>{sources.map((s) => <tr key={s.source}><td>{s.source}</td><td className="num">{s.leads}</td><td className="num">{s.contact}</td><td className="num">{s.sell}</td><td className="num">{s.won}</td></tr>)}</tbody>
          </table></div>
        ) : <Empty>No leads in the last 90 days.</Empty>}
        <p className="small muted" style={{ margin: '8px 0 0' }}>The source is the link’s utm_source tag when it has one (add <code>?utm_source=facebook</code> to links you post), else the site they came from, else Direct.</p>
      </Section>
    </>
  );
}
