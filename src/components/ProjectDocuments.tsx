import Link from 'next/link';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { files } from '@/db/schema';
import { groupDocs } from '@/lib/doc-types';
import { fileSize } from '@/lib/file-view';
import { formatDate } from '@/lib/format';
import { Empty, Section } from './ui';

/** A project's documents, by kind (photos are on the Website tab). */
export async function ProjectDocuments({ projectId, canAdd }: { projectId: string; canAdd: boolean }) {
  const rows = await db.select({ id: files.id, name: files.name, caption: files.caption, size: files.size, created: files.created }).from(files)
    .where(and(eq(files.entity, 'project'), eq(files.entityId, projectId), isNull(files.archived), isNull(files.photoKind))).orderBy(desc(files.created));
  const groups = groupDocs(rows);
  return (
    <div className="stack">
      {canAdd ? <p style={{ margin: 0 }}><Link className="btn" href="/documents/drop">Drop Documents</Link> <span className="small muted">Drag in any number of files: each is read and filed on the right property.</span></p> : null}
      {groups.length ? groups.map((g) => (
        <Section key={g.key} title={g.label} kind={g.key === 'money' ? 'energy' : g.key === 'other' ? 'grey' : 'blue'} hint={`${g.rows.length}`}>
          <ul className="rows">{g.rows.map((r) => (
            <li key={r.id}><Link href={`/documents/${r.id}`}><strong>{r.type ?? 'Document'}</strong>{r.title ? `: ${r.title}` : ''}</Link> <span className="small muted">{r.name} · {fileSize(r.size)} · added {formatDate(r.created.toISOString().slice(0, 10))}</span></li>
          ))}</ul>
        </Section>
      )) : <Empty>No documents on this project yet.</Empty>}
    </div>
  );
}
