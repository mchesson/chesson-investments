import { requirePage } from '@/lib/session';
import { companyOptions, peopleOptions } from '@/lib/contacts';
import { PageHead } from '@/components/ui';
import { PropertyForm } from '@/components/PropertyForm';
import { isUuid } from '@/lib/forms';
import { getLead } from '@/lib/site-lead-data';
import { conditionLabel, propertyKindLabel, timelineLabel } from '@/lib/site-leads';

export const metadata = { title: 'Add a Property' };

export default async function NewProperty({ searchParams }: { searchParams: Promise<{ source?: string; address?: string; city?: string; type?: string; lead?: string }> }) {
  await requirePage('properties.edit');
  const { source, address, city, type, lead } = await searchParams;
  // Add to Watchlist from a Sell Us Your Property lead: what they told us, filled in.
  const found = isUuid(lead) ? await getLead(lead) : null;
  const l = found && found.lead.kind === 'sell' && !found.lead.propertyId ? found.lead : null;
  const notes = l ? [
    `From the website (Sell Us Your Property, ${l.created.toISOString().slice(0, 10)}): ${l.name}${l.phone ? `, ${l.phone}` : ''}${l.email ? `, ${l.email}` : ''}.`,
    [propertyKindLabel(l.propertyKind), conditionLabel(l.condition) ? `Condition: ${conditionLabel(l.condition)}` : null, timelineLabel(l.timeline) ? `Timeline: ${timelineLabel(l.timeline)}` : null, l.askingPrice ? `Asking: ${l.askingPrice}` : null].filter(Boolean).join(' · '),
    l.message ?? '',
  ].filter(Boolean).join('\n') : undefined;
  const leadType = l?.propertyKind === 'house' ? 'house' : l?.propertyKind === 'land' ? 'land' : l ? 'lot' : undefined;
  return (<><PageHead title="Add a Property" eyebrow={l ? 'From a Website Lead' : 'Watchlist'} /><PropertyForm people={await peopleOptions()} companies={await companyOptions()} defaultType={type ?? leadType} defaultSource={source ?? l?.personId ?? undefined} defaultAddress={(address ?? l?.propertyAddress ?? undefined)?.slice(0, 200)} defaultCity={(city ?? l?.propertyCity ?? undefined)?.slice(0, 80)} defaultSourceKind={l ? 'website' : undefined} defaultNotes={notes} siteLeadId={l?.id} /></>);
}
