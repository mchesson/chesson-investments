import Link from 'next/link';
import { byMonth, timelineKinds, type TimelineEvent, type TimelineKind } from '@/lib/timeline-rules';
import { formatDate, formatMoney } from '@/lib/format';
import { Empty, Section, Tile } from './ui';
import type { vendorSummary } from '@/lib/timeline-rules';

/**
 * A property's or a vendor's story in date order, newest first, grouped by month
 * (owner, Oct 3, 2026). Filters are links (?tl=work), so a filtered view can be
 * shared.
 */
export function Timeline({ events, only, href, summary, title = 'Timeline' }: {
  events: TimelineEvent[]; only: TimelineKind | null; href: (kind: TimelineKind | null) => string;
  summary?: ReturnType<typeof vendorSummary>; title?: string;
}) {
  const shown = only ? events.filter((e) => e.kind === only) : events;
  const months = byMonth(shown);
  const count = (k: TimelineKind) => events.filter((e) => e.kind === k).length;
  return (
    <div className="stack">
      {summary ? (
        <div className="tiles">
          <Tile k="Jobs With Us" v={summary.jobs} />
          <Tile k="Paid" v={formatMoney(summary.paid / 100)} />
          <Tile k="On Time" v={summary.onTimePct == null ? '—' : `${summary.onTimePct}%`} s={summary.onTimeOf ? `of ${summary.onTimeOf} scheduled items done` : 'No scheduled work done yet'} />
          <Tile k="Open Issues" v={summary.openIssues} color={summary.openIssues ? 'var(--red)' : undefined} />
          <Tile k="Average Grade" v={summary.averageGrade ?? '—'} />
        </div>
      ) : null}
      <Section title={title} kind="blue" hint={`${shown.length} ${shown.length === 1 ? 'thing' : 'things'}`}>
        <nav className="status-tabs timeline-filter" aria-label="Show">
          <Link className="status-tab" href={href(null)} aria-current={!only ? 'page' : undefined}>Everything <span className="muted">{events.length}</span></Link>
          {timelineKinds.filter((k) => count(k.key)).map((k) => (
            <Link key={k.key} className="status-tab" href={href(k.key)} aria-current={only === k.key ? 'page' : undefined}>{k.label} <span className="muted">{count(k.key)}</span></Link>
          ))}
        </nav>
        {months.length ? months.map((m) => (
          <div key={m.month} className="timeline-month">
            <h3 className="sub-h">{m.label}</h3>
            <ol className="timeline">{m.events.map((e, i) => (
              <li key={i} className={`tl tl-${e.kind}${e.flag ? ` tl-${e.flag}` : ''}`}>
                <span className="tl-date">{formatDate(e.on)}</span>
                <div className="tl-body">
                  <div>{e.href ? <Link href={e.href}>{e.title}</Link> : e.title}
                    {e.flag === 'late' ? <span className="chip red"> Late</span> : null}</div>
                  <div className="small muted">
                    {[e.who ? (e.who.href ? <Link key="w" href={e.who.href}>{e.who.name}</Link> : <span key="w">{e.who.name}</span>) : null,
                      e.where ? <Link key="p" href={e.where.href}>{e.where.name}</Link> : null,
                      e.detail ? <span key="d">{e.detail}</span> : null].filter(Boolean).map((x, j) => <span key={j}>{j ? ' · ' : ''}{x}</span>)}
                  </div>
                </div>
              </li>
            ))}</ol>
          </div>
        )) : <Empty>Nothing {only ? 'of this kind ' : ''}recorded yet. It fills in from bids, the schedule, bills, issues, grades, visits and documents.</Empty>}
      </Section>
    </div>
  );
}
