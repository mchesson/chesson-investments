import { requirePage } from '@/lib/session';
import { peopleOptions } from '@/lib/contacts';
import { PageHead } from '@/components/ui';
import { PropertyForm } from '@/components/PropertyForm';

export const metadata = { title: 'Add a Property' };

export default async function NewProperty({ searchParams }: { searchParams: Promise<{ source?: string; address?: string; city?: string }> }) {
  await requirePage('properties.edit');
  const { source, address, city } = await searchParams;
  return (<><PageHead title="Add a Property" eyebrow="Watchlist" /><PropertyForm people={await peopleOptions()} defaultSource={source} defaultAddress={address?.slice(0, 200)} defaultCity={city?.slice(0, 80)} /></>);
}
