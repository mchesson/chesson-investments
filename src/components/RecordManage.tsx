import { ActionButton } from '@/components/ActionButton';
import Link from 'next/link';
import { Section } from './ui';
import { setArchived } from '@/app/(app)/delete-actions';

/** Archive (staff) and Delete Permanently (the owner) at the bottom of a person or company. */
export function RecordManage({ kind, id, canArchive, canDelete }: { kind: 'person' | 'company'; id: string; canArchive: boolean; canDelete: boolean }) {
  if (!canArchive && !canDelete) return null;
  return (
    <Section title="Merge, Archive or Delete" kind="grey">
      {canDelete ? <p style={{ margin: '0 0 8px' }}><Link className="btn small" href={`/admin/duplicates/merge?kind=${kind}&a=${id}`}>Merge With a Duplicate…</Link></p> : null}
      {canArchive ? (
        <div>
          <ActionButton action={setArchived.bind(null, kind, id, true)} className="btn secondary small" label="Archive" done="Archived. The owner can restore it from Archived." />
          <span className="small muted"> Hides it everywhere; the owner can restore it from Archived.</span>
        </div>
      ) : null}
      {canDelete ? <p style={{ margin: '8px 0 0' }}><Link className="red small" href={`/admin/delete/${kind}/${id}`}>Delete Permanently…</Link></p> : null}
    </Section>
  );
}
