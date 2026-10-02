import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { getProject } from '@/lib/projects';
import { isUuid } from '@/lib/forms';
import { PageHead } from '@/components/ui';
import { ProjectForm } from '@/components/ProjectForm';

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('projects.edit');
  const { id } = await params;
  const p = isUuid(id) ? await getProject(id) : null;
  if (!p) notFound();
  return (<><PageHead title={`Edit ${p.name}`} eyebrow="Projects" /><ProjectForm project={p} /></>);
}
