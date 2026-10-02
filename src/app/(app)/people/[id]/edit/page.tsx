import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { listEvents, companyOptions, getPerson, peopleOptions } from '@/lib/contacts';
import { isUuid } from '@/lib/forms';
import { PageHead } from '@/components/ui';
import { PersonForm } from '@/components/PersonForm';

export default async function EditPerson({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('contacts.edit');
  const { id } = await params;
  const data = isUuid(id) ? await getPerson(id) : null;
  if (!data) notFound();
  const [companies, people, events] = await Promise.all([companyOptions(), peopleOptions(), listEvents()]);
  return (
    <>
      <PageHead title={`Edit ${data.person.firstName} ${data.person.lastName}`} eyebrow="People" />
      <PersonForm person={data.person} companies={companies} people={people} events={events} />
    </>
  );
}
