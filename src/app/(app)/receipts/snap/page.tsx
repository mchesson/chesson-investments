import { asc, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { costCodes, entities, projects } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { isUuid } from '@/lib/forms';
import { PageHead, Section } from '@/components/ui';
import { SnapReceipt } from '@/components/SnapReceipt';

export const metadata = { title: 'Snap a Receipt' };

export default async function SnapPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await requirePage('bills.edit');
  const { project } = await searchParams;
  const [ps, es, codes] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, address: projects.address }).from(projects).where(isNull(projects.archived)).orderBy(asc(projects.name)),
    can(user, 'money.view') ? db.select({ id: entities.id, name: entities.name }).from(entities).where(isNull(entities.archived)).orderBy(asc(entities.name)) : Promise.resolve([]),
    db.select({ id: costCodes.id, code: costCodes.code, name: costCodes.name }).from(costCodes).where(isNull(costCodes.archived)).orderBy(asc(costCodes.sort)),
  ]);
  const places = [
    ...ps.map((p) => ({ id: `project:${p.id}`, label: p.name, sub: p.address !== p.name ? p.address : 'Property' })),
    ...es.map((e) => ({ id: `overhead:${e.id}`, label: `Overhead: ${e.name}`, sub: 'The business itself, not one property' })),
  ];
  return (
    <>
      <PageHead title="Snap a Receipt" sub="Take a photo: the store, total and date are read for you to check, then it’s saved as a paid receipt on the property (it counts in the budget) or as business overhead, with the photo." />
      <Section title="The Receipt" kind="energy">
        <SnapReceipt places={places} codes={codes.map((c) => ({ id: c.id, label: `${c.code} ${c.name}` }))} projectId={project && isUuid(project) ? project : null} />
      </Section>
    </>
  );
}
