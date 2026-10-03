import { requirePage } from '@/lib/session';
import { listEvents, companyOptions, peopleOptions } from '@/lib/contacts';
import { PageHead } from '@/components/ui';
import { PersonForm } from '@/components/PersonForm';
import { isUuid } from '@/lib/forms';
import { getLead } from '@/lib/site-lead-data';
import { splitName } from '@/lib/how-met';
import { leadKindLabel } from '@/lib/site-leads';

export const metadata = { title: 'Add Person' };

export default async function NewPerson({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage('contacts.edit');
  const sp = await searchParams;
  const [companies, people, events, fromLead] = await Promise.all([companyOptions(), peopleOptions(), listEvents(), isUuid(sp.lead) ? getLead(sp.lead) : null]);
  // Create Person from a website lead: what they typed on the form, filled in.
  const l = fromLead && !fromLead.lead.personId ? fromLead.lead : null;
  const name = l ? splitName(l.name) ?? { firstName: l.name, lastName: '' } : null;
  const leadDefaults = l ? {
    firstName: name!.firstName, lastName: name!.lastName, email: l.email, phone: l.phone, city: l.kind === 'sell' ? l.propertyCity : null, howMet: 'inbound',
    role: l.kind === 'sell' ? 'landowner' : sp.role, siteLeadId: l.id,
    notes: `From the website (${leadKindLabel(l.kind)}, ${l.created.toISOString().slice(0, 10)})${l.propertyAddress ? `: ${l.propertyAddress}` : ''}.${l.message ? `\n${l.message}` : ''}`,
  } : {};
  return (
    <>
      <PageHead title="Add Person" eyebrow={l ? 'From a Website Lead' : 'People'} />
      <PersonForm companies={companies} people={people} events={events} defaults={{ companyId: sp.company, role: sp.role, introducedById: sp.introducedBy, ...leadDefaults }} />
    </>
  );
}
