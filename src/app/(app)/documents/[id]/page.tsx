import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bills, budgetVersions, dailyLogs, files, leases, users } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { isUuid } from '@/lib/forms';
import { formatDateTime } from '@/lib/format';
import { fileNeed, fileSize, previewKind } from '@/lib/file-view';
import { PageHead, Section } from '@/components/ui';

export const metadata = { title: 'Document' };

/** Where a file belongs, so the page links back to it. */
async function belongsTo(entity: string, entityId: string): Promise<{ href: string; label: string } | null> {
  if (entity === 'project') return { href: `/projects/${entityId}?tab=website`, label: 'the project' };
  if (entity === 'property') return { href: `/watchlist/${entityId}`, label: 'the property' };
  if (entity === 'daily_log') {
    const [l] = await db.select({ p: dailyLogs.projectId, on: dailyLogs.loggedOn }).from(dailyLogs).where(eq(dailyLogs.id, entityId));
    return l ? { href: `/projects/${l.p}?tab=log`, label: `the daily log (${l.on})` } : null;
  }
  if (entity === 'bill') {
    const [b] = await db.select({ p: bills.projectId, n: bills.invoiceNumber }).from(bills).where(eq(bills.id, entityId));
    return b ? { href: `/projects/${b.p}?tab=bills`, label: `the bill${b.n ? ` #${b.n}` : ''}` } : null;
  }
  if (entity === 'bid') {
    const [v] = await db.select({ p: budgetVersions.projectId }).from(budgetVersions).where(eq(budgetVersions.id, entityId));
    return v ? { href: `/projects/${v.p}?tab=budget`, label: 'the bid' } : null;
  }
  if (entity === 'lease') {
    const [l] = await db.select({ p: leases.projectId }).from(leases).where(eq(leases.id, entityId));
    return l ? { href: `/projects/${l.p}?tab=rental`, label: 'the rental' } : null;
  }
  return null;
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('projects.view');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [f] = await db.select({ id: files.id, entity: files.entity, entityId: files.entityId, name: files.name, contentType: files.contentType, size: files.size,
    caption: files.caption, created: files.created, archived: files.archived, by: sql<string | null>`(select coalesce(u.name, u.email) from ${users} u where u.id = ${files.uploadedBy})` })
    .from(files).where(eq(files.id, id));
  if (!f || f.archived || !can(user.role, fileNeed(f.entity))) notFound();
  const kind = previewKind(f.contentType);
  const parent = await belongsTo(f.entity, f.entityId);
  const src = `/files/${f.id}`;
  return (
    <div className="stack">
      <PageHead eyebrow="Document" title={f.caption ?? f.name}
        sub={<span className="small muted">{[f.name !== (f.caption ?? f.name) ? f.name : null, fileSize(f.size), `added ${formatDateTime(f.created)}${f.by ? ` by ${f.by}` : ''}`].filter(Boolean).join(' · ')}</span>}
        actions={<><a className="btn" href={`${src}?download=1`}>Download</a>{kind !== 'download' ? <a className="btn secondary" href={`${src}?inline=1`} target="_blank" rel="noreferrer">Open in a New Tab</a> : null}{parent ? <Link className="btn secondary" href={parent.href}>Back to {parent.label}</Link> : null}</>} />
      <Section title="The Document" kind="grey">
        {kind === 'pdf' ? <iframe className="doc-frame" src={`${src}?inline=1`} title={f.name} />
          : kind === 'image' ? <img className="doc-image" src={src} alt={f.caption ?? f.name} />
          : <p>This kind of file ({f.contentType}) can’t be shown in the browser. <a href={`${src}?download=1`}>Download it</a> to open it.</p>}
      </Section>
    </div>
  );
}
