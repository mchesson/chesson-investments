import { requirePage } from '@/lib/session';
import { PageHead } from '@/components/ui';
import { CompanyForm } from '@/components/CompanyForm';

export const metadata = { title: 'Add Company' };

export default async function NewCompany({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await requirePage('contacts.edit');
  const { role } = await searchParams;
  return (<><PageHead title="Add Company" eyebrow="Companies" /><CompanyForm defaultRole={role} /></>);
}
