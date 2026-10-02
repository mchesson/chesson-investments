import { notFound } from 'next/navigation';
import { requireGuest } from '@/lib/session';
import { guestHasMarket } from '@/lib/guest-data';
import { areaTable, bandTrends, readFilters } from '@/lib/market-data';
import { bandSentence, paceLabel, soldWithin } from '@/lib/market-stats';
import { MarketMap } from '@/components/MarketMap';
import { AreaRows, Filters, query } from '@/components/MarketParts';
import { PageHead, Section, Tile } from '@/components/ui';

export const metadata = { title: 'Market Map' };
export const maxDuration = 60;

// An agent's Market Map: county sales, trends and neighborhoods. Never our
// projects, the watchlist or anything we paid.
export default async function GuestMarket({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireGuest();
  if (!(await guestHasMarket(u.id))) notFound();
  const f = readFilters(await searchParams);
  const [bands, hoods, streets] = await Promise.all([bandTrends(f), areaTable('neighborhood', f), areaTable('street', f)]);
  return (
    <>
      <PageHead title="Market Map" sub="What’s selling, where and for how much, from Wake and Durham County public records." />
      <Section title="Filters" kind="grey"><Filters f={f} base="/guest/market" /></Section>
      <Section title="Map" kind="aqua"><MarketMap query={query(f)} projects={[]} watch={[]} areas={hoods} only={['heat', 'dots', 'parcels', 'areas']} /></Section>
      <Section title="Where the Market Is Headed" kind="blue" hint="Sales per month: the latest 6 months (to 30 days ago) against the same months a year earlier">
        <p className="trend-sentence"><strong>{bandSentence(bands.filter((b) => b.pace !== 'thin'))}</strong></p>
        <div className="tiles">{bands.map((b) => (
          <Tile key={b.band} k={b.label} v={<span className={`pace pace-${b.pace}`}>{paceLabel[b.pace]}</span>}
            s={<>{b.perMonthNow}/month now · {b.perMonthBefore}/month before{b.medianPsf ? <><br />Median ${b.medianPsf}/sf</> : null}</>}
            color={b.pace === 'faster' ? 'var(--aqua)' : b.pace === 'slower' ? 'var(--red)' : 'var(--light-grey)'} />
        ))}</div>
      </Section>
      <div className="grid-2">
        <Section title="Neighborhoods" kind="blue" hint={`Busiest, ${soldWithin.find((m) => m.key === String(f.months))?.label.toLowerCase()}`}><AreaRows rows={hoods} kind="neighborhoods" /></Section>
        <Section title="Streets" kind="aqua" hint="Three or more sales"><AreaRows rows={streets} kind="streets" /></Section>
      </div>
    </>
  );
}
