import Link from 'next/link';
import { agentsWorkingAt } from '@/lib/contacts';
import { Phone } from './Phone';
import { Empty, Section } from './ui';

/** Agents who work where this place is (owner, Oct 3, 2026: agents' areas by city, ZIP and neighborhood). */
export async function AgentsHere({ place }: { place: { city?: string | null; zip?: string | null; neighborhood?: string | null } }) {
  const rows = await agentsWorkingAt(place);
  return (
    <Section title="Agents Who Work Here" kind="grey" hint={rows.length ? `${rows.length}` : undefined}>
      {rows.length ? (
        <ul className="rows">{rows.map((r) => (
          <li key={(r.personId ?? r.companyId)!}>
            <Link href={r.personId ? `/people/${r.personId}` : `/companies/${r.companyId}`}>{r.name}</Link>
            <span className="small muted"> · works {r.matched.join(', ')}</span>{r.phone ? <> · <Phone value={r.phone} /></> : null}
          </li>
        ))}</ul>
      ) : <Empty>No agent on file says they work {[place.neighborhood, place.zip, place.city].filter(Boolean).join(', ') || 'here'} yet. Add their areas on the agent’s page.</Empty>}
    </Section>
  );
}
