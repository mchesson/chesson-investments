import Link from 'next/link';
import { requirePage } from '@/lib/session';
import { dealSources } from '@/lib/deal-source-data';
import { dealTypes, gradeLabel, isDealType, sourceKindLabel, type SourceStats } from '@/lib/deal-sources';
import { daysSince } from '@/lib/roles';
import { formatDate, today } from '@/lib/format';
import { Empty, PageHead, Section, Tile } from '@/components/ui';

export const metadata = { title: 'Deal Sources' };

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
function Grade({ s }: { s: SourceStats }) {
  return <><span className={`chip grade-${s.grade}`}>{gradeLabel[s.grade]}</span><div className="small muted">{s.score} of 100</div></>;
}

export default async function DealSourcesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requirePage('properties.view');
  const { type } = await searchParams;
  const dealType = isDealType(type) ? type : null;
  const { bySource, byKind, deals } = await dealSources({ dealType });
  const day = today();
  const proven = bySource.filter((s) => s.stats.grade === 'proven');
  const coldProven = proven.filter((s) => s.href?.startsWith('/people/') && (daysSince(s.lastTouch, day) ?? 999) > 30);
  return (
    <>
      <PageHead eyebrow="Watchlist" title="Deal Sources" sub="Who sends us deals and how those deals turn out. Over time this shows which people, and which kinds of source, bring the best deals."
        actions={<Link className="btn secondary" href="/watchlist">Watchlist</Link>} />
      <div className="tiles">
        <Tile k="Deals With a Source" v={deals} color="var(--true-blue)" />
        <Tile k="Proven Sources" v={proven.length} s="Deals that fit, numbers that hold up, deals we bought" color="var(--aqua)" />
        <Tile k="Proven, Going Cold" v={coldProven.length} s="No contact in 30+ days: call them" color={coldProven.length ? 'var(--red)' : 'var(--light-grey)'} />
      </div>
      <Section title="Show" kind="grey">
        <nav className="role-pick" aria-label="Kind of deal"><span className="filter-label">Deals</span>
          <Link className="role-btn" aria-pressed={!dealType} href="/watchlist/sources">Every Kind</Link>
          {dealTypes.map((t) => <Link key={t.key} className="role-btn" aria-pressed={dealType === t.key} href={`/watchlist/sources?type=${t.key}`}>{t.label}</Link>)}
        </nav>
      </Section>
      {coldProven.length ? (
        <Section title="Good Sources Going Cold" kind="energy" hint="The relationships that pay: keep them warm">
          <ul className="rows">{coldProven.map((s) => (
            <li key={s.key}><Link href={`${s.href}?tab=touches`}><strong>{s.name}</strong></Link>{s.company ? <span className="small muted"> · {s.company}</span> : null}
              <span className="small red"> · {s.lastTouch ? `last contact ${formatDate(s.lastTouch)} (${daysSince(s.lastTouch, day)} days)` : 'never contacted'}</span>
              <span className="small muted"> · {s.stats.sent} deals sent, {s.stats.bought} bought</span></li>
          ))}</ul>
        </Section>
      ) : null}
      <Section title="By Kind of Source" kind="aqua" hint="Wholesalers as a group, agents as a group …">
        {byKind.length ? (
          <div className="table-wrap"><table className="t sources-table">
            <thead><tr><th>Kind</th><th className="num">Sources</th><th className="num">Deals Sent</th><th className="num">Fit the Buy Box</th><th className="num">Numbers Held Up</th><th className="num">We Offered</th><th className="num">We Bought</th><th>Reliability</th></tr></thead>
            <tbody>{byKind.map((k) => (
              <tr key={k.key}><td><strong>{k.label}</strong></td><td className="num">{k.sources}</td><td className="num">{k.stats.sent}</td><td className="num">{pct(k.stats.fitRate)}<div className="small muted">{k.stats.fit} of {k.stats.judged}</div></td>
                <td className="num">{pct(k.stats.accuracyRate)}<div className="small muted">{k.stats.accurate} of {k.stats.checked}</div></td><td className="num">{k.stats.offered}</td><td className="num">{k.stats.bought}</td><td><Grade s={k.stats} /></td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>No deals with a source yet. Record who sent each deal on the Watchlist.</Empty>}
      </Section>
      <Section title="By Who Sent It" kind="blue" hint="Best first">
        {bySource.length ? (
          <div className="table-wrap"><table className="t sources-table">
            <thead><tr><th>Source</th><th>Kind</th><th className="num">Deals Sent</th><th className="num">Fit the Buy Box</th><th className="num">Numbers Held Up</th><th className="num">We Offered</th><th className="num">We Bought</th><th>Reliability</th><th>Last Deal</th><th>Last Contact</th></tr></thead>
            <tbody>{bySource.map((s) => {
              const since = daysSince(s.lastTouch, day);
              return (
                <tr key={s.key}>
                  <td>{s.href ? <Link href={s.href}><strong>{s.name}</strong></Link> : <strong>{s.name}</strong>}{s.company ? <div className="small muted">{s.company}</div> : null}</td>
                  <td>{sourceKindLabel(s.kind)}</td>
                  <td className="num">{s.stats.sent}</td>
                  <td className="num">{pct(s.stats.fitRate)}<div className="small muted">{s.stats.fit} of {s.stats.judged}</div></td>
                  <td className="num">{pct(s.stats.accuracyRate)}<div className="small muted">{s.stats.accurate} of {s.stats.checked}</div></td>
                  <td className="num">{s.stats.offered}</td>
                  <td className="num">{s.stats.bought}</td>
                  <td><Grade s={s.stats} /></td>
                  <td>{formatDate(s.lastDeal)}</td>
                  <td>{s.href?.startsWith('/people/') ? (s.lastTouch ? <span className={since !== null && since > 30 ? 'red' : ''}>{formatDate(s.lastTouch)}</span> : <span className="red">Never</span>) : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <Empty>No sources yet.</Empty>}
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Reliability blends how often their deals fit the buy box (40%), whether their numbers held up (30%), how often we offered (15%) and bought (15%).
          With only a few deals each rate is pulled toward the middle, so one lucky deal doesn’t make a source proven; under 3 deals is too early to say.
          Record “Did their numbers hold up?” on each deal (Edit) to sharpen it.
        </p>
      </Section>
    </>
  );
}
