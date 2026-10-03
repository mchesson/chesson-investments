import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { companyOptions } from '@/lib/contacts';
import { getEntity } from '@/lib/entities';
import { isUuid } from '@/lib/forms';
import { PageHead } from '@/components/ui';
import { EntityForm } from '@/components/EntityForm';

export default async function EditEntity({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('sensitive.view');
  const { id } = await params;
  const d = isUuid(id) ? await getEntity(id) : null;
  if (!d) notFound();
  return (<><PageHead eyebrow="Business Entities" title={`Edit ${d.entity.name}`} /><EntityForm entity={d.entity} companies={await companyOptions()} /></>);
}
