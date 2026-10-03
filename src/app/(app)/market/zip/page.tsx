import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { cleanZipInput } from '@/lib/zip-report-rules';

// The Market Map's "Look Up a ZIP Code" box sends ?zip= here.
export default async function ZipLookup({ searchParams }: { searchParams: Promise<{ zip?: string }> }) {
  await requirePage('properties.view');
  const zip = cleanZipInput((await searchParams).zip);
  redirect(zip ? `/market/zip/${zip}` : '/market?zipError=1');
}
