import Link from 'next/link';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { entities, files, projects } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { docGroups, entityDocKinds, splitCaption } from '@/lib/doc-types';
import { aiOn } from '@/lib/doc-filing-ai';
import { PageHead, Section, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { ActionButton } from '@/components/ActionButton';
import { SearchPicker } from '@/components/SearchPicker';
import { DropDocuments } from '@/components/DropDocuments';
import { discardDropped, fileFromInbox } from '../../doc-drop-actions';

export const metadata = { title: 'Drop Documents' };
export const maxDuration = 300; // each file is read by Claude (a few seconds each)

export default async function DropPage() {
  const user = await requirePage('projects.edit');
  const seeEntities = can(user, 'sensitive.view');
  const [inbox, ps, es] = await Promise.all([
    db.select({ id: files.id, name: files.name, caption: files.caption, created: files.created }).from(files).where(and(eq(files.entity, 'inbox'), isNull(files.archived))).orderBy(desc(files.created)).limit(200),
    db.select({ id: projects.id, name: projects.name, address: projects.address, city: projects.city }).from(projects).where(isNull(projects.archived)).orderBy(asc(projects.name)),
    seeEntities ? db.select({ id: entities.id, name: entities.name }).from(entities).where(isNull(entities.archived)).orderBy(asc(entities.name)) : Promise.resolve([]),
  ]);
  const targets = [...ps.map((p) => ({ id: `p:${p.id}`, label: p.name, sub: [p.address !== p.name ? p.address : null, p.city, 'Property'].filter(Boolean).join(' · ') })), ...es.map((e) => ({ id: `e:${e.id}`, label: e.name, sub: 'Business entity' }))];
  const types = [...docGroups.flatMap((g) => g.types), ...(seeEntities ? entityDocKinds.filter((k) => k !== 'Other' && k !== 'Insurance') : [])];
  return (
    <>
      <PageHead title="Drop Documents" sub="Every document at once: each is read and filed on the right property or business entity, with its kind. Anything unclear waits below for you." />
      {!aiOn() ? <div className="notice warn">Claude isn’t connected here, so files go to the inbox below for you to file.</div> : null}
      <div className="stack">
        <Section title="Drop Them Here" kind="aqua" hint="Personal IDs (licenses, passports) are refused, never stored. The same file twice is skipped.">
          <DropDocuments />
        </Section>
        <Section title="Waiting to Be Filed" kind="energy" hint={`${inbox.length}`}>
          {inbox.length ? <ul className="rows">{inbox.map((f) => {
            const c = splitCaption(f.caption);
            return (
              <li key={f.id}>
                <Link href={`/documents/${f.id}`}><strong>{f.name}</strong></Link> <span className="small muted">{c.type ?? ''}{c.title ? ` · ${c.title}` : ''} · dropped {formatDateTime(f.created)}</span>
                <details className="fold"><summary>File It</summary>
                  <ActionForm action={fileFromInbox} submit="File It" saved="Filed.">
                    <input type="hidden" name="id" value={f.id} />
                    <div className="fields">
                      <SearchPicker name="target" label="Where It Goes" required placeholder="Type the property or entity" options={targets} />
                      <label className="f">Kind<select name="type" defaultValue={c.type ?? 'Other'}>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
                      <label className="f">Title<input name="title" defaultValue={c.title ?? ''} /></label>
                    </div>
                  </ActionForm>
                  <ActionButton action={discardDropped.bind(null, f.id)} className="link-btn small" label="Not Needed: Remove It" done="Removed." confirm="Take this file out of the inbox?" />
                </details>
              </li>
            );
          })}</ul> : <Empty>Nothing waiting.</Empty>}
        </Section>
      </div>
    </>
  );
}
