import { requirePage } from '@/lib/session';
import { peopleOptions } from '@/lib/contacts';
import { PageHead } from '@/components/ui';
import { PropertyForm } from '@/components/PropertyForm';

export const metadata = { title: 'Add a Property' };

export default async function NewProperty({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  await requirePage('properties.edit');
  const { source } = await searchParams;
  return (<><PageHead title="Add a Property" eyebrow="Watchlist" /><PropertyForm people={await peopleOptions()} defaultSource={source} /></>);
}
