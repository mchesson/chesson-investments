import { requirePage } from '@/lib/session';
import { listEvents, companyOptions, peopleOptions } from '@/lib/contacts';
import { PageHead } from '@/components/ui';
import { PersonForm } from '@/components/PersonForm';

export const metadata = { title: 'Add Person' };

export default async function NewPerson({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage('contacts.edit');
  const sp = await searchParams;
  const [companies, people, events] = await Promise.all([companyOptions(), peopleOptions(), listEvents()]);
  return (
    <>
      <PageHead title="Add Person" eyebrow="People" />
      <PersonForm companies={companies} people={people} events={events} defaults={{ companyId: sp.company, role: sp.role, introducedById: sp.introducedBy }} />
    </>
  );
}
