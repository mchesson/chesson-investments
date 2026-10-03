import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { companyOptions, peopleOptions } from '@/lib/contacts';
import { getProperty } from '@/lib/watch';
import { isUuid } from '@/lib/forms';
import { PageHead } from '@/components/ui';
import { PropertyForm } from '@/components/PropertyForm';

export default async function EditProperty({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('properties.edit');
  const { id } = await params;
  const data = isUuid(id) ? await getProperty(id) : null;
  if (!data) notFound();
  return (<><PageHead title={`Edit ${data.property.address}`} eyebrow="Watchlist" /><PropertyForm property={data.property} people={await peopleOptions()} companies={await companyOptions()} /></>);
}
