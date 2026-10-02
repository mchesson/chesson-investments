import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog, users } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { PageHead, Section } from '@/components/ui';
import { HistoryList } from '@/components/contacts';

export const metadata = { title: 'History' };

export default async function AllHistory() {
  await requirePage('users.manage');
  const rows = await db.select({ id: auditLog.id, at: auditLog.at, summary: auditLog.summary, via: auditLog.via, userName: users.name, entity: auditLog.entity })
    .from(auditLog).leftJoin(users, eq(users.id, auditLog.userId)).orderBy(desc(auditLog.at)).limit(300);
  return (
    <>
      <PageHead title="History (Everything)" sub="The newest 300 changes, across every record. Never edited or deleted." />
      <Section title="Recent Changes" kind="grey"><HistoryList rows={rows.map((r) => ({ ...r, summary: `${r.summary} (${r.entity})` }))} /></Section>
    </>
  );
}
