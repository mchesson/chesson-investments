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
        <form action={setArchived.bind(null, kind, id, true)}>
          <button className="btn secondary small" type="submit">Archive</button>
          <span className="small muted"> Hides it everywhere; the owner can restore it from Archived.</span>
        </form>
      ) : null}
      {canDelete ? <p style={{ margin: '8px 0 0' }}><Link className="red small" href={`/admin/delete/${kind}/${id}`}>Delete Permanently…</Link></p> : null}
    </Section>
  );
}
