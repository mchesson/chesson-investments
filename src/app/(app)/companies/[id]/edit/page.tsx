import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { getCompany } from '@/lib/contacts';
import { isUuid } from '@/lib/forms';
import { PageHead } from '@/components/ui';
import { CompanyForm } from '@/components/CompanyForm';

export default async function EditCompany({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('contacts.edit');
  const { id } = await params;
  const data = isUuid(id) ? await getCompany(id) : null;
  if (!data) notFound();
  return (<><PageHead title={`Edit ${data.company.name}`} eyebrow="Companies" /><CompanyForm company={data.company} /></>);
}
