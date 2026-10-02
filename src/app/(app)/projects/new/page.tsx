import { requirePage } from '@/lib/session';
import { PageHead } from '@/components/ui';
import { ProjectForm } from '@/components/ProjectForm';

export const metadata = { title: 'Add Project' };

export default async function NewProject() {
  await requirePage('projects.edit');
  return (<><PageHead title="Add Project" eyebrow="Projects" sub="Usually a project starts from the watchlist (Make It a Project)." /><ProjectForm /></>);
}
