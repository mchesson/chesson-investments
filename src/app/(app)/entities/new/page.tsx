import { requirePage } from '@/lib/session';
import { companyOptions } from '@/lib/contacts';
import { PageHead } from '@/components/ui';
import { EntityForm } from '@/components/EntityForm';

export const metadata = { title: 'Add an Entity' };

export default async function NewEntity() {
  await requirePage('sensitive.view');
  return (<><PageHead eyebrow="Business Entities" title="Add an Entity" /><EntityForm companies={await companyOptions()} /></>);
}
